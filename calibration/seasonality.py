"""Phase 2 — Hijri seasonality from SAMA POS, the §22 decomposition with Gregorian controls (SOP §5).

    python -m calibration.seasonality

Two fits, both on the calibration window ONLY (2016–2023 monthly; 2021–2023 weekly). 2020 is excluded
and the exclusion is asserted (§1.5). 2024–2025 are never touched here — `holdout_validate` scores them.

A. Monthly, per POS sector (SAMA Table 30d, 2016–2023):
       P_m ≈ T_m · ( Σ_h w_{m,h} β_h ) · exp(γ_{g(m)})
   w_{m,h} = share of Gregorian month m falling in Hijri month h (Umm al-Qura), β_h ≥ 0 by NNLS with
   mean(β) = 1, γ_g = Gregorian month-of-year controls (Σγ = 0; back-to-school, National Day, …),
   T_m = smooth trend (LOWESS on the log series) that absorbs card adoption (§5.2). The three pieces are
   estimated by backfitting to convergence. Uncertainty: leave-one-year-out jackknife (7 years).

B. Weekly, per POS sector (SAMA weekly bulletin series, 2021–2023):
   the same machinery on the generator's four windows — pre_ramadan_10d, ramadan, eid (Shawwal 1–3),
   post_eid_7d — with day-overlap weights per week, so the three-day Eid window that a monthly series
   cannot resolve gets a measured multiplier. Value and count are fitted separately (§5.4).

Applied to the generator (§5.3): food_beverage ← Restaurants & Café; retail_trade ← value-weighted
composite of Clothing and Footwear + Beverage and Food + Electronic & Electric Devices + Furniture +
Jewelry. Construction & Building Materials is fitted and REPORTED but never applied (it measures
consumers buying materials, not contractor revenue); professional services has no POS line at all.
"""

from __future__ import annotations

import sys

import numpy as np
import pandas as pd
from scipy.optimize import nnls
from statsmodels.nonparametric.smoothers_lowess import lowess

from calibration import hijri
from calibration import sources as S

CAL_END = pd.Timestamp("2023-12-31")  # calibration window ends here; 2024–2025 are held out (§6.2)
WEEKLY_CAL_START = pd.Timestamp("2021-01-01")
WINDOWS = ["pre_ramadan_10d", "ramadan", "eid", "post_eid_7d"]

RETAIL_COMPOSITE = ["Clothing and Footwear", "Beverage and Food", "Electronic & Electric Devices", "Furniture", "Jewelry"]
GENERATOR_SERIES = {  # generator sector → POS series used (§5.3); None = no POS line exists
    "food_beverage": S.RESTAURANTS,
    "retail_trade": "retail_composite",
    "construction": "Construction & Building Materials",  # reported only, never applied
    "professional_services": None,
}
APPLIED_SECTORS = ("food_beverage", "retail_trade")


# --------------------------------------------------------------------------- #
# Core: backfitting trend × Hijri × Gregorian
# --------------------------------------------------------------------------- #


def backfit(y: np.ndarray, t: np.ndarray, H: np.ndarray, greg: np.ndarray, frac: float, baseline_offset: np.ndarray | None = None, n_iter: int = 40, tol: float = 1e-7) -> dict:
    """y: positive series; t: time index; H: overlap design (n × k); greg: Gregorian month index 0–11.

    Multiplicative model y = T · (H β + offset) · exp(γ[greg]).  offset lets the weekly window model
    treat 'no window' days as multiplier 1 (offset = 1 − row-sum of H). β ≥ 0 via NNLS; monthly form
    normalises mean(β) = 1, weekly form leaves β as multipliers relative to the offset baseline.
    """
    n, k = H.shape
    offset = np.zeros(n) if baseline_offset is None else baseline_offset
    normalise_mean = baseline_offset is None
    beta = np.ones(k)
    gamma = np.zeros(12)
    logy = np.log(y)
    for _ in range(n_iter):
        season = (H @ beta + offset) * np.exp(gamma[greg])
        T = np.exp(lowess(logy - np.log(season), t, frac=frac, it=1, return_sorted=False))
        target = y / (T * np.exp(gamma[greg])) - offset
        new_beta, _ = nnls(H, target)
        if normalise_mean:
            scale = new_beta.mean()
            new_beta = new_beta / scale
            T = T * scale
        resid_g = logy - np.log(T) - np.log(np.maximum(H @ new_beta + offset, 1e-9))
        g = np.array([resid_g[greg == m].mean() if (greg == m).any() else 0.0 for m in range(12)])
        new_gamma = g - g.mean()
        done = np.abs(new_beta - beta).max() < tol and np.abs(new_gamma - gamma).max() < tol
        beta, gamma = new_beta, new_gamma
        if done:
            break
    season = (H @ beta + offset) * np.exp(gamma[greg])
    fitted = T * season
    resid = logy - np.log(fitted)
    return {
        "beta": beta,
        "gamma": gamma,
        "trend": T,
        "fitted": fitted,
        "resid_log": resid,
        "r2_log": float(1 - resid.var() / logy.var()),
        "trend_ratio_end_over_start": float(T[-1] / T[0]),
    }


def jackknife(fit_fn, years: np.ndarray, **kw) -> dict:
    """Leave-one-year-out: returns point estimate, SE and 95% CI for every β and γ."""
    full = fit_fn(np.ones(len(years), dtype=bool), **kw)
    uniq = np.unique(years)
    reps_b, reps_g = [], []
    for y in uniq:
        f = fit_fn(years != y, **kw)
        reps_b.append(f["beta"])
        reps_g.append(f["gamma"])
    reps_b, reps_g = np.array(reps_b), np.array(reps_g)
    m = len(uniq)
    se_b = np.sqrt((m - 1) / m * ((reps_b - reps_b.mean(axis=0)) ** 2).sum(axis=0))
    se_g = np.sqrt((m - 1) / m * ((reps_g - reps_g.mean(axis=0)) ** 2).sum(axis=0))
    return {**full, "beta_se": se_b, "beta_ci95": np.stack([full["beta"] - 1.96 * se_b, full["beta"] + 1.96 * se_b], axis=1), "gamma_se": se_g, "n_years": int(m)}


# --------------------------------------------------------------------------- #
# A. Monthly sector series
# --------------------------------------------------------------------------- #


def monthly_series(tidy: pd.DataFrame, sector: str, indicator: str) -> pd.Series:
    if sector == "retail_composite":
        s = tidy[(tidy["sector"].isin(RETAIL_COMPOSITE)) & (tidy["indicator"] == indicator)].groupby("date")["value"].sum()
    else:
        s = tidy[(tidy["sector"] == sector) & (tidy["indicator"] == indicator)].set_index("date")["value"]
    return s.sort_index()


def fit_monthly(series: pd.Series, frac: float = 0.6) -> dict:
    series = series[series.index <= CAL_END]
    df = S.exclude_year(series.rename("y").reset_index(), "date")
    assert not (df["date"].dt.year == S.EXCLUDED_YEAR).any() and (df["date"] <= CAL_END).all()
    dates = pd.DatetimeIndex(df["date"])
    starts, ends = hijri.month_bounds(dates)
    W = hijri.overlap_weights(starts, ends)
    t = ((dates.year - 2016) * 12 + dates.month - 1).to_numpy(float)
    greg = (dates.month - 1).to_numpy()
    years = dates.year.to_numpy()
    y = df["y"].to_numpy(float)

    def fit_fn(mask, **_):
        return backfit(y[mask], t[mask], W[mask], greg[mask], frac)

    out = jackknife(fit_fn, years)
    out.update({"n_months": len(y), "years": sorted({int(v) for v in years}), "dates": dates})
    return out


def raw_ramadan_ratio(series: pd.Series) -> dict:
    """The SOP's first-pass number for comparison: Ramadan-dominant month over the year's own mean, per year (2020 excluded)."""
    series = series[series.index <= CAL_END]
    df = S.exclude_year(series.rename("y").reset_index(), "date")
    out = {}
    for w in hijri.ramadan_windows_for_gregorian_years(df["date"].dt.year.unique()):
        yr = w["ramadan_start"].year
        yr_vals = df[df["date"].dt.year == yr].set_index("date")["y"]
        if len(yr_vals) < 12:
            continue
        mid = w["ramadan_start"] + (w["ramadan_end"] - w["ramadan_start"]) / 2
        ram_month = pd.Timestamp(mid.year, mid.month, 1)
        out[str(yr)] = float(yr_vals[ram_month] / yr_vals.mean())
    return {"per_year": out, "mean": float(np.mean(list(out.values()))) if out else None}


# --------------------------------------------------------------------------- #
# B. Weekly window model
# --------------------------------------------------------------------------- #


def window_overlap(week_starts: pd.DatetimeIndex) -> np.ndarray:
    """F[w, k] = share of the 7 days of week w falling in generator window k (§22 windows, Umm al-Qura)."""
    wins = hijri.ramadan_windows_for_gregorian_years(range(week_starts.min().year - 1, week_starts.max().year + 2))
    spans = {k: [] for k in WINDOWS}
    for w in wins:
        spans["pre_ramadan_10d"].append((w["ramadan_start"] - pd.Timedelta(days=10), w["ramadan_start"] - pd.Timedelta(days=1)))
        spans["ramadan"].append((w["ramadan_start"], w["ramadan_end"]))
        spans["eid"].append((w["eid_start"], w["eid_end"]))
        spans["post_eid_7d"].append((w["eid_end"] + pd.Timedelta(days=1), w["eid_end"] + pd.Timedelta(days=7)))
    F = np.zeros((len(week_starts), len(WINDOWS)))
    for i, ws in enumerate(week_starts):
        days = pd.date_range(ws, ws + pd.Timedelta(days=6), freq="D")
        for k, key in enumerate(WINDOWS):
            F[i, k] = sum(((days >= a) & (days <= b)).sum() for a, b in spans[key]) / 7.0
    assert (F.sum(axis=1) <= 1.0 + 1e-9).all()
    return F


def weekly_series(tidy: pd.DataFrame, sector: str, indicator: str) -> pd.Series:
    if sector == "retail_composite":
        sub = tidy[(tidy["sector"].isin(RETAIL_COMPOSITE)) & (tidy["indicator"] == indicator)]
        counts = sub.groupby("week_start")["sector"].nunique()
        s = sub.groupby("week_start")["value"].sum()
        s = s[counts == len(RETAIL_COMPOSITE)]  # a week missing one component is dropped, not summed short
    else:
        s = tidy[(tidy["sector"] == sector) & (tidy["indicator"] == indicator)].set_index("week_start")["value"]
    return s[s > 0].sort_index()


def fit_weekly(series: pd.Series, start: pd.Timestamp = WEEKLY_CAL_START, end: pd.Timestamp = CAL_END, frac: float = 0.35) -> dict:
    s = series[(series.index >= start) & (series.index <= end)]
    df = S.exclude_year(s.rename("y").reset_index(), "week_start")
    assert not (df["week_start"].dt.year == S.EXCLUDED_YEAR).any()
    ws = pd.DatetimeIndex(df["week_start"])
    F = window_overlap(ws)
    offset = 1.0 - F.sum(axis=1)
    t = ((ws - ws.min()).days / 7.0).to_numpy(float)
    greg = (ws.month - 1).to_numpy()
    years = ws.year.to_numpy()
    y = df["y"].to_numpy(float)

    def fit_fn(mask, **_):
        return backfit(y[mask], t[mask], F[mask], greg[mask], frac, baseline_offset=offset[mask])

    out = jackknife(fit_fn, years)
    out.update({"n_weeks": len(y), "years": sorted({int(v) for v in years}), "week_starts": ws})
    return out


# --------------------------------------------------------------------------- #
# Reporting helpers
# --------------------------------------------------------------------------- #


def beta_table(fit: dict, names: list[str]) -> dict:
    return {nm: {"multiplier": round(float(b), 4), "se": round(float(se), 4), "ci95": [round(float(lo), 4), round(float(hi), 4)]} for nm, b, se, (lo, hi) in zip(names, fit["beta"], fit["beta_se"], fit["beta_ci95"], strict=True)}


def gamma_table(fit: dict) -> dict:
    months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    return {m: {"multiplier": round(float(np.exp(g)), 4), "se_log": round(float(se), 4)} for m, g, se in zip(months, fit["gamma"], fit["gamma_se"], strict=True)}


def summarise_monthly(fit: dict, raw: dict) -> dict:
    hb = beta_table(fit, hijri.HIJRI_MONTHS)
    return {
        "hijri_beta": hb,
        "gregorian_controls": gamma_table(fit),
        "r2_log": round(fit["r2_log"], 4),
        "trend_ratio_end_over_start": round(fit["trend_ratio_end_over_start"], 3),
        "n_months": fit["n_months"],
        "years": fit["years"],
        "jackknife_years": fit["n_years"],
        "ramadan": hb["Ramadan"],
        "shawwal": hb["Shawwal"],
        "raw_first_pass_ramadan_month_over_year_mean": raw,
    }


def summarise_weekly(fit: dict) -> dict:
    return {"windows": beta_table(fit, WINDOWS), "gregorian_controls": gamma_table(fit), "r2_log": round(fit["r2_log"], 4), "n_weeks": fit["n_weeks"], "years": fit["years"], "jackknife_years": fit["n_years"], "trend_ratio_end_over_start": round(fit["trend_ratio_end_over_start"], 3)}


def _pick(entry: dict, ind: str) -> dict:
    w = entry["weekly"][ind]
    return {k: round(entry["monthly"][ind]["multiplier"] if k == "ramadan" else w[k]["multiplier"], 2) for k in WINDOWS}


def _ci(entry: dict, ind: str) -> dict:
    w = entry["weekly"][ind]
    return {k: (entry["monthly"][ind]["ci95"] if k == "ramadan" else w[k]["ci95"]) for k in WINDOWS}


def main(argv: list[str] | None = None) -> int:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    monthly = S.load_pos_sector_monthly()
    weekly = S.load_pos_weekly_sector()
    agg = S.load_pos_aggregate_monthly()
    terminals = agg[agg["indicator"] == S.AGG_TERMINALS].set_index("date")["value"]
    adoption = {"terminals_2016_12": float(terminals[pd.Timestamp("2016-12-01")]), "terminals_2023_12": float(terminals[pd.Timestamp("2023-12-01")]), "terminals_2025_12": float(terminals[pd.Timestamp("2025-12-01")])}

    result = {"run_at": S.now_iso(), "calibration_window": {"monthly": "2016-01..2023-12 excluding 2020", "weekly": "2021-01..2023-12"}, "excluded_year": S.EXCLUDED_YEAR, "adoption": adoption, "monthly": {}, "weekly": {}, "generator": {}}

    print("== A. Monthly §22 decomposition, all POS sectors (2016–2023, 2020 excluded) ==")
    sectors = sorted(monthly["sector"].unique()) + ["retail_composite"]
    for sec in sectors:
        result["monthly"][sec] = {}
        for ind in ("sales", "count"):
            s = monthly_series(monthly, sec, ind)
            fit = fit_monthly(s)
            summ = summarise_monthly(fit, raw_ramadan_ratio(s))
            result["monthly"][sec][ind] = summ
        v, c = result["monthly"][sec]["sales"], result["monthly"][sec]["count"]
        print(f"  {sec:36s} β_Ramadan value {v['ramadan']['multiplier']:.3f} [{v['ramadan']['ci95'][0]:.2f},{v['ramadan']['ci95'][1]:.2f}]  count {c['ramadan']['multiplier']:.3f}  | β_Shawwal value {v['shawwal']['multiplier']:.3f}  | raw first-pass {v['raw_first_pass_ramadan_month_over_year_mean']['mean']:.3f}  | R² {v['r2_log']:.2f}  trend×{v['trend_ratio_end_over_start']:.1f}")

    print("\n== B. Weekly window model (2021–2023): pre_ramadan_10d / ramadan / eid / post_eid_7d ==")
    for sec in sorted(weekly["sector"].unique()) + ["retail_composite"]:
        result["weekly"][sec] = {}
        for ind in ("sales", "count"):
            s = weekly_series(weekly, sec, ind)
            if len(s[(s.index >= WEEKLY_CAL_START) & (s.index <= CAL_END)]) < 100:
                continue
            fit = fit_weekly(s)
            result["weekly"][sec][ind] = summarise_weekly(fit)
        if result["weekly"][sec]:
            v, c = result["weekly"][sec]["sales"]["windows"], result["weekly"][sec]["count"]["windows"]
            print(f"  {sec:36s} value  pre {v['pre_ramadan_10d']['multiplier']:.2f} ram {v['ramadan']['multiplier']:.2f} eid {v['eid']['multiplier']:.2f} [{v['eid']['ci95'][0]:.2f},{v['eid']['ci95'][1]:.2f}] post {v['post_eid_7d']['multiplier']:.2f}  | count  pre {c['pre_ramadan_10d']['multiplier']:.2f} ram {c['ramadan']['multiplier']:.2f} eid {c['eid']['multiplier']:.2f} post {c['post_eid_7d']['multiplier']:.2f}")

    print("\n== Generator sectors (§5.3) ==")
    for gsec, pos in GENERATOR_SERIES.items():
        if pos is None:
            result["generator"][gsec] = {"pos_series": None, "applied": False, "evidence_class": "C", "note": "no POS line measures professional-services revenue; multipliers stay author judgement"}
            print(f"  {gsec:22s} no POS series — class C, not applied")
            continue
        entry = {"pos_series": pos, "applied": gsec in APPLIED_SECTORS, "evidence_class": "B" if gsec in APPLIED_SECTORS else "C", "monthly": {ind: result["monthly"][pos][ind]["ramadan"] for ind in ("sales", "count")}, "weekly": {ind: result["weekly"][pos][ind]["windows"] for ind in ("sales", "count")}}
        if gsec == "construction":
            entry["note"] = "Construction & Building Materials measures consumers buying materials at POS, not contractor revenue; reported, never applied (§5.3)"
        if gsec == "retail_trade":
            entry["composition_rule"] = RETAIL_COMPOSITE
        # Values written to config: `ramadan` from the monthly §22 NNLS (seven Ramadans, the tighter
        # interval); the sub-monthly windows (pre_ramadan_10d, eid, post_eid_7d) from the weekly window
        # model, the only series that resolves them. Both are ≤2023 fits; 2024–2025 are held out.
        entry["proposed_config"] = {
            "seasonality_value_multiplier": _pick(entry, "sales"),
            "seasonality_count_multiplier": _pick(entry, "count"),
            "ci95_value": _ci(entry, "sales"),
            "ci95_count": _ci(entry, "count"),
            "basis": "ramadan: monthly Table 30d NNLS 2016–2023 excl. 2020 (jackknife CI over 7 years); pre/eid/post: weekly window model 2021–2023 (jackknife CI over 3 years)",
        }
        entry["ramadan_cross_check"] = {"monthly_beta_value": entry["monthly"]["sales"]["multiplier"], "weekly_window_value": entry["weekly"]["sales"]["ramadan"]["multiplier"], "monthly_beta_count": entry["monthly"]["count"]["multiplier"], "weekly_window_count": entry["weekly"]["count"]["ramadan"]["multiplier"]}
        result["generator"][gsec] = entry
        pc = entry["proposed_config"]
        print(f"  {gsec:22s} ← {pos:32s} value {pc['seasonality_value_multiplier']}  count {pc['seasonality_count_multiplier']}  {'APPLIED' if entry['applied'] else 'reported only (C)'}")

    # §5.4 value vs count divergence, Total POS
    tot_v, tot_c = result["monthly"]["Total"]["sales"]["ramadan"]["multiplier"], result["monthly"]["Total"]["count"]["ramadan"]["multiplier"]
    result["value_count_divergence_total"] = {"beta_ramadan_value": tot_v, "beta_ramadan_count": tot_c, "implied_ticket_multiplier": round(tot_v / tot_c, 3)}
    print(f"\n§5.4 Total POS: β_Ramadan value {tot_v:.3f}, count {tot_c:.3f} → average ticket ×{tot_v / tot_c:.3f} in Ramadan")
    p = S.write_out("phase2_seasonality", result)
    print(f"→ {p}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
