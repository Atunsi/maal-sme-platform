"""Feature computation for features 1–65 from the shared table contract.

Inputs (already Pandera-validated): daily_aggregates, transactions, businesses,
optional balances_monthly, optional obligations. Every business is scored at
its own as-of date (`businesses.window_end`); the trailing 90 days ending there
is "the window", the 90 before that is "the prior window".

Outputs: a wide feature frame (one row per business, columns = feature names),
a long null-reason frame, a status frame (§15 states) and a coverage-share
frame for the counterparty features.

Formulas that the schema leaves open are documented inline and marked PROPOSED.
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

import numpy as np
import pandas as pd

from profile_engine.registry import (
    COUNTERPARTY_FEATURE_IDS,
    COVERAGE_MIN_DAYS,
    EPS_MONTHLY,
    FEATURE_NAMES,
    GROWTH_CAP_PCT,
    MIN_HISTORY_DAYS,
    NULL_REASONS,
    TRAILING_DAYS,
)

CUSUM_K, CUSUM_H = 0.5, 5.0  # §32 fixed constants
ASYMMETRY_K, ASYMMETRY_CAP = 0.15, 0.5  # §31 feature 42
COVERAGE_MONTHS_CAP = 24.0  # §34 feature 51
HAZARD_SIMS, HAZARD_BLOCK = 500, 7  # §34 features 52–54 (block bootstrap preserves weekly autocorrelation)
CIRCULAR_VALUE_SHARE = 0.005  # feature 46: fixed documented threshold = 0.5% of trailing-90d total value, floored at EPS_MONTHLY
WEEKEND_BY_SOURCE = {"synthetic": (4, 5), "sandbox": (4, 5), "external_real": (5, 6)}  # feature 33: Fri/Sat vs Sat/Sun
MONTHLY_EQUIVALENT = {"monthly": 1.0, "weekly": 52.0 / 12.0, "quarterly": 1.0 / 3.0, "one_off": 0.0}  # `unknown` excluded
REFERENCE_STATS_PATH = Path(__file__).with_name("sector_reference_stats_v1.json")
Z_FEATURES = {55: 3, 56: 11, 57: 13, 58: 16, 59: 21}  # §35 z-score → base feature

F = FEATURE_NAMES


class Profile:
    """Accumulates one business's feature values and null reasons."""

    __slots__ = ("reasons", "values")

    def __init__(self) -> None:
        self.values: dict[int | str, object] = {}
        self.reasons: dict[int | str, str] = {}

    def set(self, fid: int | str, value) -> None:
        if value is None or (isinstance(value, float) and np.isnan(value)):
            raise ValueError(f"feature {fid}: use null(fid, reason) for nulls")
        self.values[fid] = value

    def null(self, fid: int | str, reason: str) -> None:
        assert reason in NULL_REASONS, reason
        self.values[fid] = np.nan
        self.reasons[fid] = reason


# --------------------------------------------------------------------------- #
# Daily-series features (one business at a time, numpy)
# --------------------------------------------------------------------------- #


def _runs_below_zero(eod: np.ndarray) -> int:
    neg = eod < 0
    return int(np.sum(neg[1:] & ~neg[:-1]) + (1 if neg.size and neg[0] else 0))


def _max_run_below_zero(eod: np.ndarray) -> int:
    best = run = 0
    for v in eod < 0:
        run = run + 1 if v else 0
        best = max(best, run)
    return int(best)


def _cusum_break_recency(x_cur: np.ndarray, mu: float, sd: float) -> float | None:
    if sd <= 0:
        return None
    z = (x_cur - mu) / sd
    s_pos = s_neg = 0.0
    last = None
    for t, v in enumerate(z):
        s_pos = max(0.0, s_pos + v - CUSUM_K)
        s_neg = max(0.0, s_neg - v - CUSUM_K)
        if s_pos > CUSUM_H or s_neg > CUSUM_H:
            last = t
            s_pos = s_neg = 0.0
    return None if last is None else float(len(z) - 1 - last)


def _autocorr(x: np.ndarray, lag: int) -> float | None:
    if len(x) <= lag + 2:
        return None
    a, b = x[:-lag], x[lag:]
    if a.std() == 0 or b.std() == 0:
        return None
    return float(np.corrcoef(a, b)[0, 1])


def _shock_absorption(inflow, fixed, variable, b0) -> float:
    def min_balance(theta):
        return float(b0 + np.cumsum((1 - theta) * inflow - fixed - (1 - theta) * variable).min())

    if min_balance(0.0) < 0:
        return 0.0
    lo, hi = 0.0, 1.0
    if min_balance(1.0) >= 0:
        return 1.0
    for _ in range(20):
        mid = (lo + hi) / 2
        if min_balance(mid) >= 0:
            lo = mid
        else:
            hi = mid
    return lo


def _hazard(net: np.ndarray, balance_today: float, rng: np.random.Generator) -> tuple[float, float, float]:
    mean = net.mean()
    resid = net - mean
    n = len(resid)
    n_blocks = int(np.ceil(90 / HAZARD_BLOCK)) + 1
    starts = rng.integers(0, max(n - HAZARD_BLOCK, 1), size=(HAZARD_SIMS, n_blocks))
    idx = (starts[:, :, None] + np.arange(HAZARD_BLOCK)[None, None, :]).reshape(HAZARD_SIMS, -1)[:, :90]
    idx = np.minimum(idx, n - 1)
    paths = balance_today + np.cumsum(mean + resid[idx], axis=1)
    return tuple(float((paths[:, :h].min(axis=1) < 0).mean()) for h in (30, 60, 90))


def daily_features(
    g: pd.DataFrame,
    as_of: pd.Timestamp,
    operating_start: pd.Timestamp,
    source: str,
    ramadan_windows,
    hazard_seed: int,
    p: Profile,
    coverage_min: int = COVERAGE_MIN_DAYS,
) -> dict:
    """Features from daily_aggregates for one business. Returns status info."""
    g = g[(g["date"] <= as_of) & (g["date"] >= operating_start)]
    w = g[g["date"] > as_of - pd.Timedelta(days=TRAILING_DAYS)]
    prior = g[(g["date"] <= as_of - pd.Timedelta(days=TRAILING_DAYS)) & (g["date"] > as_of - pd.Timedelta(days=2 * TRAILING_DAYS))]
    history_days = len(g)
    n = len(w)
    active = (w["inflow_count"] + w["outflow_count"]).to_numpy() > 0
    coverage = int(active.sum())
    p.set(32, coverage)

    if coverage < coverage_min:
        return {"status": "insufficient_data", "coverage_days_90d": coverage, "history_days": history_days}
    status = "partial_profile" if history_days < max(MIN_HISTORY_DAYS.values()) else "scored"

    inflow = w["inflow_total"].to_numpy(float)
    outflow = w["outflow_total"].to_numpy(float)
    icount = w["inflow_count"].to_numpy(float)
    ocount = w["outflow_count"].to_numpy(float)
    rec = w["recurring_outflow_total"].to_numpy(float)
    net = w["net_flow"].to_numpy(float)
    eod = w["eod_balance"].to_numpy(float)
    per_month = n / 30.0

    f1 = inflow.sum() / per_month
    f6 = outflow.sum() / per_month
    p.set(1, f1)
    p.set(2, icount.sum() / per_month)
    p.set(6, f6)
    p.set(7, ocount.sum() / per_month)

    in_days = np.flatnonzero(icount > 0)
    if len(in_days) >= 3:
        gaps = np.diff(in_days)
        p.set(3, float(np.clip(1.0 - gaps.std() / max(gaps.mean(), 1e-9), 0.0, 1.0)))
    else:
        p.null(3, "insufficient_events")

    for fid, cur, col in ((4, f1, "inflow_total"), (9, f6, "outflow_total")):
        if history_days < MIN_HISTORY_DAYS[fid] or len(prior) < TRAILING_DAYS:
            p.null(fid, "insufficient_history")
            continue
        prev = prior[col].sum() / (len(prior) / 30.0)
        if prev < EPS_MONTHLY:
            p.null(fid, "near_zero_denominator")
        else:
            p.set(fid, float(np.clip((cur - prev) / prev * 100.0, -GROWTH_CAP_PCT, GROWTH_CAP_PCT)))

    out_sum = outflow.sum()
    if out_sum < EPS_MONTHLY:
        p.null(8, "near_zero_denominator")
        f8 = np.nan
    else:
        f8 = float(rec.sum() / out_sum)
        p.set(8, f8)

    f11 = float(net.std(ddof=0))
    p.set(11, f11)
    f12 = f1 / max(f6, EPS_MONTHLY)
    p.set(12, float(f12))
    f13 = int((eod < 0).sum())
    f14 = _runs_below_zero(eod)
    p.set(13, f13)
    p.set(14, f14)
    p.set(68, _max_run_below_zero(eod))
    # PROPOSED (schema "Notes for the team meeting"): equal-weight mean of four bounded terms, ×100.
    # t11 = σ_net / (σ_net + mean daily gross flow) ∈ [0, 1) — scale-free and does not saturate on lumpy flows.
    t11 = f11 / (f11 + max((f1 + f6) / 30.0, EPS_MONTHLY / 30.0))
    t12 = float(np.clip(1.0 - f12, 0.0, 1.0))
    t13 = f13 / n
    t14 = min(1.0, f14 / 5.0)
    p.set(15, 100.0 * (t11 + t12 + t13 + t14) / 4.0)

    f16 = float(eod.mean())
    p.set(16, f16)
    p.set(17, float(eod.min()))
    last30 = net[-30:]
    burn = -last30.mean()
    balance_today = float(eod[-1])
    if burn <= 0:
        p.null(18, "not_applicable")
        p.null("18b", "not_applicable")
    else:
        p.set(18, max(balance_today, 0.0) / max(burn, EPS_MONTHLY / 30.0))  # already overdrawn → zero runway, never negative
        p.set("18b", max(f16, 0.0) / max(burn, EPS_MONTHLY / 30.0))
    e30 = eod[-30:]
    p.set(19, float(np.polyfit(np.arange(len(e30)), e30, 1)[0]) if len(e30) >= 2 else 0.0)

    weekend = WEEKEND_BY_SOURCE[source]
    dow = w["date"].dt.dayofweek.to_numpy()
    operating = ~np.isin(dow, weekend)
    n_op = int(operating.sum())
    p.set(33, float((operating & ~active).sum() / n_op) if n_op else 0.0)

    if ramadan_windows is None:
        p.null(36, "not_available_in_source")
    else:
        start = as_of - pd.Timedelta(days=TRAILING_DAYS - 1)
        p.set(36, bool(any(s <= as_of and e >= start for s, e in ramadan_windows)))

    if history_days < MIN_HISTORY_DAYS[43] or len(prior) < TRAILING_DAYS:
        p.null(43, "insufficient_history")
    else:
        rec_days = _cusum_break_recency(inflow, prior["inflow_total"].mean(), prior["inflow_total"].std(ddof=0))
        if rec_days is None:
            p.null(43, "no_break_detected")
        else:
            p.set(43, rec_days)
    ac = _autocorr(net, 7)
    if ac is None:
        p.null(44, "insufficient_events")
    else:
        p.set(44, ac)

    d = max(n - 1, 1)
    down = float(np.sqrt(np.sum(np.minimum(net, 0.0) ** 2) / d))
    up = float(np.sqrt(np.sum(np.maximum(net, 0.0) ** 2) / d))
    p.set(47, down)
    p.set(48, up)
    f49 = down / max(up, EPS_MONTHLY / 30.0)
    p.set(49, f49)
    p.set(42, max(0.0, f1 - f6) * (1.0 - min(ASYMMETRY_K * f49, ASYMMETRY_CAP)))

    b0 = float(eod[0] - net[0])
    p.set(50, _shock_absorption(inflow, rec, outflow - rec, b0))
    if np.isnan(f8) or f8 * f6 < EPS_MONTHLY:
        p.null(51, "near_zero_denominator")
    else:
        p.set(51, min(f16 / (f8 * f6), COVERAGE_MONTHS_CAP))

    h30, h60, h90 = _hazard(net, balance_today, np.random.default_rng([hazard_seed, int(g["business_id"].iloc[0])]))
    p.set(52, h30)
    p.set(53, h60)
    p.set(54, h90)
    return {
        "status": status,
        "coverage_days_90d": coverage,
        "history_days": history_days,
        "balance_today": balance_today,
        "burn30": float(burn),
        "rec_total_90": float(rec.sum()),
        "total_value_90": float(inflow.sum() + out_sum),
    }


# --------------------------------------------------------------------------- #
# Transaction-based features (vectorised over all businesses)
# --------------------------------------------------------------------------- #


def transaction_features(tx: pd.DataFrame, biz: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Returns (per-business frame of features 5, 10, 20, 21, 22, 45, 46, fi_outflow, loan_outflow, cp_coverage_share), plus prior-window availability."""
    t = tx.merge(biz[["business_id", "window_end", "operating_start_date"]], on="business_id")
    t = t[(t["date"] <= t["window_end"]) & (t["date"] >= t["operating_start_date"])]
    t["dbe"] = (t["window_end"] - t["date"]).dt.days
    cur = t[t["dbe"] < TRAILING_DAYS]
    prior = t[(t["dbe"] >= TRAILING_DAYS) & (t["dbe"] < 2 * TRAILING_DAYS)]
    out = pd.DataFrame(index=pd.Index(biz["business_id"], name="business_id"))

    is_in = cur["direction"] == "in"
    is_out = ~is_in
    out["fi_outflow_90"] = cur[is_out & (cur["counterparty_type"] == "financial_institution")].groupby("business_id")["amount"].sum()
    out["loan_outflow_90"] = cur[is_out & (cur["subfamily"] == "LOAN")].groupby("business_id")["amount"].sum()
    cat = cur[is_out].groupby(["business_id", "category"], observed=True)["amount"].sum()
    out[F[10]] = (cat / cat.groupby(level=0).transform("sum")).groupby(level=0).max()

    has_cp = cur["counterparty_id"].notna()
    out["cp_coverage_share"] = cur[has_cp].groupby("business_id")["amount"].sum() / cur.groupby("business_id")["amount"].sum()
    c = cur[has_cp]
    in_by_cp = c[c["direction"] == "in"].groupby(["business_id", "counterparty_id"])["amount"].sum()
    out[F[5]] = in_by_cp.groupby(level=0).max() / in_by_cp.groupby(level=0).sum()
    out[F[20]] = c.groupby("business_id")["counterparty_id"].nunique()
    val_by_cp = c.groupby(["business_id", "counterparty_id"])["amount"].sum()
    share = val_by_cp / val_by_cp.groupby(level=0).transform("sum")
    out[F[21]] = (share**2).groupby(level=0).sum()

    seen_before = t[(t["dbe"] >= 30) & t["counterparty_id"].notna()].groupby("business_id")["counterparty_id"].apply(set)
    last30 = c[c["dbe"] < 30]
    known = pd.Series(
        [cp in seen_before.get(b, set()) for b, cp in zip(last30["business_id"], last30["counterparty_id"], strict=True)],
        index=last30.index,
        dtype=bool,
    )
    out[F[22]] = last30[~known].groupby("business_id")["amount"].sum() / last30.groupby("business_id")["amount"].sum()
    out.loc[out[F[22]].isna() & last30.groupby("business_id")["amount"].sum().reindex(out.index).gt(0), F[22]] = 0.0

    prior_in = prior[prior["counterparty_id"].notna() & (prior["direction"] == "in")].groupby("business_id")["counterparty_id"].apply(set)
    cin = c[c["direction"] == "in"]
    persist = pd.Series(
        [cp in prior_in.get(b, set()) for b, cp in zip(cin["business_id"], cin["counterparty_id"], strict=True)], index=cin.index, dtype=bool
    )
    out[F[45]] = cin[persist].groupby("business_id")["amount"].sum() / cin.groupby("business_id")["amount"].sum()
    out.loc[out[F[45]].isna() & cin.groupby("business_id")["amount"].sum().reindex(out.index).gt(0), F[45]] = 0.0
    out["prior_tx_days"] = prior.groupby("business_id")["date"].nunique()

    total_val = cur.groupby("business_id")["amount"].sum()
    thr = np.maximum(CIRCULAR_VALUE_SHARE * total_val, EPS_MONTHLY)
    both = c.groupby(["business_id", "counterparty_id", "direction"], observed=True)["amount"].sum().unstack("direction")
    if not both.empty:
        both = both.reindex(columns=["in", "out"]).fillna(0.0)
        thr_b = thr.reindex(both.index.get_level_values(0)).to_numpy()
        circ = (both["in"].to_numpy() > thr_b) & (both["out"].to_numpy() > thr_b)
        out[F[46]] = pd.Series(circ, index=both.index).groupby(level=0).sum()
    else:
        out[F[46]] = np.nan
    return out.reset_index(), c[["business_id"]].drop_duplicates()


# --------------------------------------------------------------------------- #
# Obligations (features 60–65)
# --------------------------------------------------------------------------- #


def obligation_features(obl: pd.DataFrame | None, biz: pd.DataFrame) -> pd.DataFrame:
    out = pd.DataFrame(index=pd.Index(biz["business_id"], name="business_id"))
    if obl is None:
        return out.reset_index()
    o = obl.merge(biz[["business_id", "window_end"]], on="business_id")
    o["monthly_eq"] = o["amount"] * o["frequency"].map(MONTHLY_EQUIVALENT)
    active = o[(o["status"] == "active") & (o["final_date"].isna() | (o["final_date"] > o["window_end"]))]
    known = active[active["monthly_eq"].notna()]
    out[F[60]] = known.groupby("business_id")["monthly_eq"].sum()
    out["obligation_frequency_coverage"] = known.groupby("business_id")["amount"].sum() / active.groupby("business_id")["amount"].sum()
    for fid, days in ((62, 90), ("62b", 180)):
        fwd = known[known["final_date"].isna() | (known["final_date"] > known["window_end"] + pd.Timedelta(days=days))]
        out[f"_committed_{fid}"] = fwd.groupby("business_id")["monthly_eq"].sum()
    fd = active[active["final_date"].notna()]
    max_final = fd.groupby("business_id")["final_date"].max()
    out["_horizon_months"] = (max_final - biz.set_index("business_id")["window_end"].reindex(max_final.index)).dt.days / 30.0
    out["_any_final_known"] = out.index.isin(o.loc[o["final_date"].notna(), "business_id"])
    out["has_obligations"] = out.index.isin(o["business_id"])
    inactive = o[(o["status"] == "inactive") & o["status_change_date"].notna()]
    inactive = inactive[(inactive["status_change_date"] <= inactive["window_end"]) & (inactive["status_change_date"] > inactive["window_end"] - pd.Timedelta(days=TRAILING_DAYS))]
    out[F[64]] = inactive.groupby("business_id").size()
    bal = active[active["final_amount"].notna()]
    out[F[65]] = (bal["final_amount"] - bal["amount"]).clip(lower=0).groupby(bal["business_id"]).sum()
    return out.reset_index()


# --------------------------------------------------------------------------- #
# Balance-sheet features (27–31, 37–40) — synthetic only
# --------------------------------------------------------------------------- #


def balance_sheet_row(bm: pd.DataFrame | None, b_id: int, as_of: pd.Timestamp) -> pd.Series | None:
    if bm is None:
        return None
    g = bm[(bm["business_id"] == b_id) & (bm["month_end"] <= as_of)]
    return None if g.empty else g.sort_values("month_end").iloc[-1]


# --------------------------------------------------------------------------- #
# Orchestration
# --------------------------------------------------------------------------- #


def load_reference_stats(path: Path = REFERENCE_STATS_PATH) -> tuple[dict | None, str | None]:
    if not path.exists():
        return None, None
    raw = path.read_bytes()
    return json.loads(raw), hashlib.sha256(raw).hexdigest()


def build_reference_stats(features: pd.DataFrame, biz: pd.DataFrame, population: str = "research") -> dict:
    """§35: μ/σ per sector for features 3, 11, 13, 16, 21 on the research population, pinned once."""
    df = features.merge(biz[["business_id", "sector", "population"]], on="business_id")
    df = df[df["population"] == population]
    stats = {}
    for sector, g in df.groupby("sector"):
        stats[sector] = {F[b]: {"mean": float(g[F[b]].mean()), "std": float(g[F[b]].std(ddof=0)), "n": int(g[F[b]].notna().sum())} for b in Z_FEATURES.values()}
    return {"version": "v1", "population": population, "n_businesses": len(df), "stats": stats}


def compute_profiles(
    tables: dict[str, pd.DataFrame],
    ramadan_windows: list[tuple[pd.Timestamp, pd.Timestamp]] | None,
    ramadan_years: set[int] | None,
    hazard_seed: int = 0,
    reference_stats: dict | None = None,
    coverage_min_by_source: dict[str, int] | None = None,
) -> dict[str, pd.DataFrame]:
    """coverage_min_by_source: §15 eligibility threshold per data_source (DECISIONS.md entry 9). Default 60 everywhere."""
    cov_min = coverage_min_by_source or {}
    daily, tx, biz = tables["daily_aggregates"], tables["transactions"], tables["businesses"]
    bm = tables.get("balances_monthly")
    obl = tables.get("obligations")
    fac = tables.get("facilities")
    facf = fac.set_index("business_id") if fac is not None else None
    txf = transaction_features(tx, biz)[0].set_index("business_id")
    obf = obligation_features(obl, biz).set_index("business_id")

    rows, nulls, status_rows, cov_rows = [], [], [], []
    daily = daily.sort_values(["business_id", "date"])
    groups = dict(tuple(daily.groupby("business_id", sort=False)))
    for b in biz.itertuples(index=False):
        b_id = int(b.business_id)
        as_of = pd.Timestamp(b.window_end)
        p = Profile()
        g = groups.get(b_id)
        if g is None:
            p.set(32, 0)
            info = {"status": "insufficient_data", "coverage_days_90d": 0, "history_days": 0}
        else:
            rw = ramadan_windows if (ramadan_years is None or as_of.year in ramadan_years) else None
            info = daily_features(
                g, as_of, pd.Timestamp(b.operating_start_date), b.data_source, rw, hazard_seed, p, cov_min.get(b.data_source, COVERAGE_MIN_DAYS)
            )
        status_rows.append({"business_id": b_id, **{k: v for k, v in info.items() if k in ("status", "coverage_days_90d", "history_days")}})

        if info["status"] == "insufficient_data":
            for fid in FEATURE_NAMES:
                if fid != 32:
                    p.null(fid, "insufficient_data")
        else:
            _fill_registry(p, b)
            _fill_transactions(p, txf.loc[b_id] if b_id in txf.index else None, info)
            _fill_balance_sheet(p, balance_sheet_row(bm, b_id, as_of), b.data_source, p.values.get(1), p.values.get(6))
            _fill_obligations(p, obf.loc[b_id] if b_id in obf.index else None, p.values.get(1), b.data_source)
            _fill_facilities(p, facf.loc[b_id] if facf is not None and b_id in facf.index else None, info, b.data_source)
            _fill_zscores(p, b.sector, reference_stats)
            p.null(26, "not_implemented")
            for fid in (24, 25, 34, 35):  # need MCC / ESG / balance sheet: absent from a bank feed regardless of implementation
                p.null(fid, "not_available_in_source" if b.data_source == "external_real" else "not_implemented")
        for fid in FEATURE_NAMES:
            assert fid in p.values, f"business {b_id}: feature {fid} neither set nor nulled"
        rows.append(
            {
                "business_id": b_id,
                **{F[k]: v for k, v in p.values.items() if k in F},
                "financing_outflow_ratio_code": p.values.get("_41_code", np.nan),
            }
        )
        nulls.extend({"business_id": b_id, "feature_id": str(k), "feature": F[k], "reason": r} for k, r in p.reasons.items())
        if b_id in txf.index and info["status"] != "insufficient_data":
            cs = txf.loc[b_id, "cp_coverage_share"]
            cov_rows.extend({"business_id": b_id, "feature_id": str(fid), "feature": F[fid], "coverage_share": cs} for fid in COUNTERPARTY_FEATURE_IDS)
    features = pd.DataFrame(rows)
    return {
        "features": features,
        "nulls": pd.DataFrame(nulls, columns=["business_id", "feature_id", "feature", "reason"]),
        "status": pd.DataFrame(status_rows),
        "coverage": pd.DataFrame(cov_rows, columns=["business_id", "feature_id", "feature", "coverage_share"]),
    }


def _fill_registry(p: Profile, b) -> None:
    if pd.isna(b.declared_mcc_code):
        p.null(23, "not_available_in_source")
    else:
        p.set(23, int(b.declared_mcc_code))


def _fill_transactions(p: Profile, r: pd.Series | None, info: dict) -> None:
    if r is None:
        for fid in (5, 10, 20, 21, 22, 45, 46):
            p.null(fid, "insufficient_events")
        p.null(41, "insufficient_events")
        return
    for fid in (5, 10, 20, 21, 22, 46):
        v = r[F[fid]]
        if pd.isna(v):
            p.null(fid, "insufficient_events")
        else:
            p.set(fid, int(v) if fid in (20, 46) else float(v))
    if info["history_days"] < MIN_HISTORY_DAYS[45] or pd.isna(r["prior_tx_days"]) or r["prior_tx_days"] < 1:
        p.null(45, "insufficient_history")
    elif pd.isna(r[F[45]]):
        p.null(45, "insufficient_events")
    else:
        p.set(45, float(r[F[45]]))
    rec = info["rec_total_90"]
    if rec < EPS_MONTHLY:
        p.null(41, "near_zero_denominator")
        p.values["_41_code"] = np.nan
    else:
        p.set(41, float(min(np.nan_to_num(r["fi_outflow_90"]) / rec, 1.0)))
        p.values["_41_code"] = float(min(np.nan_to_num(r["loan_outflow_90"]) / rec, 1.0))


def _fill_balance_sheet(p: Profile, row: pd.Series | None, source: str, f1, f6) -> None:
    if row is None:
        for fid in (27, 28, 29, 30, 31, 37, 38, 39, 40):
            p.null(fid, "not_available_in_source" if source == "external_real" else "insufficient_history")
        return
    for fid in (27, 28, 29, 30, 31):
        p.set(fid, float(row[F[fid]]))
    dso = row[F[29]] / max(f1, EPS_MONTHLY) * 30.0
    dio = row[F[28]] / max(f6, EPS_MONTHLY) * 30.0
    dpo = row[F[30]] / max(f6, EPS_MONTHLY) * 30.0
    p.set(37, float(dso))
    p.set(38, float(dio))
    p.set(39, float(dpo))
    p.set(40, float(dso + dio - dpo))


def _fill_obligations(p: Profile, r: pd.Series | None, f1, source: str) -> None:
    real = source == "external_real"
    if r is None or not bool(r.get("has_obligations", False)):
        p.set(60, 0.0)
        p.null(61, "not_applicable")
        p.null(62, "not_applicable")
        p.null("62b", "not_applicable")
        p.null(63, "not_available_in_source" if real else "not_applicable")
        if real:  # no mandate status history and no balloon field in the source — a 0 would read as "none observed"
            p.null(64, "not_available_in_source")
            p.null(65, "not_available_in_source")
        else:
            p.set(64, 0)
            p.set(65, 0.0)
        return
    committed = float(np.nan_to_num(r[F[60]]))
    p.set(60, committed)
    if committed < EPS_MONTHLY:
        p.null(61, "near_zero_denominator")
    else:
        p.set(61, float(f1) / committed)
    for fid in (62, "62b"):
        c = float(np.nan_to_num(r[f"_committed_{fid}"]))
        if c < EPS_MONTHLY:
            p.null(fid, "near_zero_denominator")
        else:
            p.set(fid, float(f1) / c)
    if not bool(r.get("_any_final_known", False)):
        p.null(63, "not_available_in_source" if source == "external_real" else "not_applicable")
    elif pd.isna(r["_horizon_months"]):
        p.null(63, "not_applicable")  # every dated obligation already ended
    else:
        p.set(63, float(r["_horizon_months"]))
    if real:
        p.null(64, "not_available_in_source")
        p.null(65, "not_available_in_source")
    else:
        p.set(64, int(np.nan_to_num(r[F[64]])))
        p.set(65, float(np.nan_to_num(r[F[65]])))


def _fill_facilities(p: Profile, r: pd.Series | None, info: dict, source: str) -> None:
    if source == "external_real" or r is None:
        reason = "not_available_in_source" if source == "external_real" else "not_applicable"
        for fid in (66, 67, 69):
            p.null(fid, reason)
        return
    if r["facility_type"] == "none" or r["facility_limit"] <= 0:
        p.null(66, "not_applicable")
        p.null(67, "not_applicable")
        p.set(69, False)
        return
    p.set(66, float(r["facility_drawn"] / r["facility_limit"]))
    burn = info.get("burn30", 0.0)
    if burn <= 0:
        p.null(67, "not_applicable")
    else:
        p.set(67, float(max(r["headroom"], 0.0) / max(burn, EPS_MONTHLY / 30.0)))
    p.set(69, bool(r["facility_type"] in ("emergency", "temporary")))


def _fill_zscores(p: Profile, sector: str, stats: dict | None) -> None:
    for zid, base in Z_FEATURES.items():
        if sector == "not_available_in_source":
            p.null(zid, "not_available_in_source")
            continue
        if sector not in (stats or {}).get("stats", {}):
            p.null(zid, "reference_stats_missing")
            continue
        v = p.values.get(base)
        if v is None or (isinstance(v, float) and np.isnan(v)):
            p.null(zid, p.reasons.get(base, "insufficient_events"))
            continue
        s = stats["stats"][sector][F[base]]
        p.set(zid, float((v - s["mean"]) / max(s["std"], 1e-9)))
