"""Phase 3 — held-out anchor years 2024 and 2025, scored against the ≤2023 fits WITHOUT refitting (SOP §6.2).

    python -m calibration.holdout_validate

Two tests, both out of sample:

  1. Aggregate (SOP §6.2 as written): the Total POS sales and count series (SAMA aggregate file, to
     2026) — the §22 monthly decomposition fitted on 2016–2023 (2020 excluded) predicts each held-out
     year's within-year seasonal index; the actual index is the year's monthly values after removing
     that year's own log-linear trend. Reports the Ramadan-month index (predicted vs actual) and the
     mean absolute error over all 12 months.

  2. Per sector (possible because the weekly SAMA series runs to July 2025 — the SOP expected this to
     be impossible with the monthly file alone): for Restaurants & Café, the retail composite and
     Construction & Building Materials, the ratio of the Ramadan window and the Eid window to the
     surrounding baseline (8 weeks either side, excluding the ±10-day shoulders) in 2024 and 2025,
     against the ≤2023 predictions. Two predictions are shown for Ramadan: the monthly β_Ramadan and
     the weekly-window μ_ramadan — the same numbers `seasonality.py` wrote out.

Nothing here is refitted on 2024 or 2025; the calibration JSON is read, not recomputed.
"""

from __future__ import annotations

import sys

import numpy as np
import pandas as pd

from calibration import hijri
from calibration import sources as S
from calibration.seasonality import CAL_END, fit_monthly, weekly_series

HELD_OUT = [2024, 2025]
TOL_ABS = 0.10  # |actual − predicted| on a multiplier, reported against; not a gate


def yearly_index_actual(series: pd.Series, year: int) -> pd.Series:
    """Actual within-year seasonal index: monthly value ÷ the year's own log-linear trend, normalised to mean 1."""
    y = series[series.index.year == year]
    assert len(y) == 12, f"{year}: {len(y)} months available"
    t = np.arange(12.0)
    b = np.polyfit(t, np.log(y.to_numpy()), 1)
    idx = y.to_numpy() / np.exp(np.polyval(b, t))
    return pd.Series(idx / idx.mean(), index=y.index)


def yearly_index_predicted(fit: dict, year: int) -> pd.Series:
    dates = pd.date_range(f"{year}-01-01", f"{year}-12-01", freq="MS")
    s, e = hijri.month_bounds(dates)
    W = hijri.overlap_weights(s, e)
    H = W @ fit["beta"]
    G = np.exp(fit["gamma"][dates.month - 1])
    pred = H * G
    return pd.Series(pred / pred.mean(), index=dates)


def ramadan_month(year: int) -> pd.Timestamp:
    w = next(w for w in hijri.ramadan_windows_for_gregorian_years([year]) if w["ramadan_start"].year == year)
    mid = w["ramadan_start"] + (w["ramadan_end"] - w["ramadan_start"]) / 2
    return pd.Timestamp(mid.year, mid.month, 1)


def aggregate_holdout(agg: pd.DataFrame) -> dict:
    out = {}
    for ind, name in ((S.AGG_SALES, "sales"), (S.AGG_COUNT, "count")):
        s = agg[agg["indicator"] == ind].set_index("date")["value"].sort_index()
        s = s[s.index >= "2016-01-01"]
        fit = fit_monthly(s[s.index <= CAL_END])
        years = {}
        for yr in HELD_OUT:
            act, pred = yearly_index_actual(s, yr), yearly_index_predicted(fit, yr)
            rm = ramadan_month(yr)
            years[str(yr)] = {
                "ramadan_month": str(rm.date()),
                "ramadan_index_actual": round(float(act[rm]), 3),
                "ramadan_index_predicted": round(float(pred[rm]), 3),
                "abs_error_ramadan": round(float(abs(act[rm] - pred[rm])), 3),
                "mae_all_months": round(float((act - pred).abs().mean()), 3),
                "within_tolerance": bool(abs(act[rm] - pred[rm]) <= TOL_ABS),
                "monthly": {str(d.date()): [round(float(a), 3), round(float(p), 3)] for d, a, p in zip(act.index, act, pred, strict=True)},
            }
        out[name] = {"beta_ramadan_calibrated": round(float(fit["beta"][hijri.RAMADAN - 1]), 3), "calibration_years": fit["years"], "held_out": years}
    return out


def window_ratio(s: pd.Series, a: pd.Timestamp, b: pd.Timestamp, shoulder_days: int = 10, base_weeks: int = 8) -> float | None:
    """Mean weekly value over weeks fully inside [a, b] ÷ mean over baseline weeks before/after the shoulders. Day-weighted when no full week fits."""
    ws = s.index
    days_in = np.array([((pd.date_range(w, w + pd.Timedelta(days=6)) >= a) & (pd.date_range(w, w + pd.Timedelta(days=6)) <= b)).sum() for w in ws])
    if days_in.sum() == 0:
        return None
    inside = float((s.to_numpy() * days_in).sum() / days_in.sum())
    lo, hi = a - pd.Timedelta(days=shoulder_days), b + pd.Timedelta(days=shoulder_days)
    before = s[(ws < lo - pd.Timedelta(days=6)) & (ws >= lo - pd.Timedelta(weeks=base_weeks) - pd.Timedelta(days=6))]
    after = s[(ws > hi) & (ws <= hi + pd.Timedelta(weeks=base_weeks))]
    base = pd.concat([before, after])
    return float(inside / base.mean()) if len(base) >= 4 else None


def sector_holdout(weekly: pd.DataFrame, cal: dict) -> dict:
    out = {}
    targets = {"food_beverage": S.RESTAURANTS, "retail_trade": "retail_composite", "construction": "Construction & Building Materials", "total": "Total"}
    for gsec, pos in targets.items():
        out[gsec] = {"pos_series": pos}
        for ind in ("sales", "count"):
            s = weekly_series(weekly, pos, ind)
            mon = cal["monthly"][pos][ind]["ramadan"]["multiplier"]
            wk = cal["weekly"][pos][ind]["windows"]
            years = {}
            for yr in HELD_OUT:
                w = next(w for w in hijri.ramadan_windows_for_gregorian_years([yr]) if w["ramadan_start"].year == yr)
                if s.index.max() < w["eid_end"] + pd.Timedelta(weeks=4):
                    years[str(yr)] = {"status": "insufficient_post_window_data", "series_ends": str(s.index.max().date())}
                    continue
                r_ram = window_ratio(s, w["ramadan_start"], w["ramadan_end"])
                r_eid = window_ratio(s, w["eid_start"], w["eid_end"])
                years[str(yr)] = {
                    "ramadan_actual": round(r_ram, 3) if r_ram is not None else None,
                    "ramadan_pred_monthly_beta": mon,
                    "ramadan_pred_weekly_window": wk["ramadan"]["multiplier"],
                    "ramadan_within_tol_vs_monthly": bool(r_ram is not None and abs(r_ram - mon) <= TOL_ABS),
                    "eid_week_actual": round(r_eid, 3) if r_eid is not None else None,
                    "eid_pred_weekly_window": wk["eid"]["multiplier"],
                    "eid_pred_ci95": wk["eid"]["ci95"],
                    "note": "eid_week_actual is the Eid-day-weighted weekly mean over baseline; a 3-day window inside 7-day weeks dilutes the peak, so it is a floor on the daily Eid multiplier",
                }
            out[gsec][ind] = years
    return out


def main(argv: list[str] | None = None) -> int:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    cal = S.read_out("phase2_seasonality")
    agg = S.load_pos_aggregate_monthly()
    weekly = S.load_pos_weekly_sector()

    print("== 1. Aggregate Total POS — §22 fit on 2016–2023 (2020 excl.), scored on 2024 and 2025 without refitting ==")
    a = aggregate_holdout(agg)
    for ind, r in a.items():
        for yr, h in r["held_out"].items():
            print(f"  {ind:6s} {yr}: Ramadan-month index actual {h['ramadan_index_actual']:.3f} vs predicted {h['ramadan_index_predicted']:.3f} (|Δ| {h['abs_error_ramadan']:.3f}, {'within' if h['within_tolerance'] else 'OUTSIDE'} ±{TOL_ABS}); MAE all months {h['mae_all_months']:.3f}; β_Ramadan(cal) {r['beta_ramadan_calibrated']:.3f}")

    print("\n== 2. Per sector — weekly SAMA series, 2024 and 2025 held out ==")
    sct = sector_holdout(weekly, cal)
    for gsec, r in sct.items():
        for ind in ("sales", "count"):
            for yr, h in r[ind].items():
                if "status" in h:
                    print(f"  {gsec:14s} {ind:6s} {yr}: {h['status']} (series ends {h['series_ends']})")
                    continue
                print(f"  {gsec:14s} {ind:6s} {yr}: Ramadan actual {h['ramadan_actual']} vs β(monthly) {h['ramadan_pred_monthly_beta']} / μ(weekly) {h['ramadan_pred_weekly_window']}  {'within' if h['ramadan_within_tol_vs_monthly'] else 'OUTSIDE'} ±{TOL_ABS};  Eid-week actual {h['eid_week_actual']} vs pred {h['eid_pred_weekly_window']}")

    payload = {"run_at": S.now_iso(), "held_out_years": HELD_OUT, "tolerance_abs": TOL_ABS, "aggregate": a, "per_sector": sct, "note": "Fits read from calibration/out/phase2_seasonality.json (≤2023). 2025 weekly data end 2025-07-06, which covers Ramadan/Eid 1446 (Mar 2025) fully."}
    p = S.write_out("phase3_holdout", payload)
    print(f"→ {p}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
