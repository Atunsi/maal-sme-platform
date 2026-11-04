"""Anomaly lens — schema §8 (/lenses/anomaly), §12, §29, §33.

Flags unusual transactions against the business's OWN baseline: an Isolation Forest
is fitted on that business's transactions in the scan window and the most isolated
ones are flagged. A per-business baseline needs no cross-business artifact and asks
the question the schema asks — "unusual for this business", not "unusual for SMEs".

Per-transaction features (all generic; none is built around a specific anomaly type):
  amount_z           robust z of log1p(amount) within (direction, category)
  hour_rarity        -log share of this business's transactions at that hour
  category_rarity    -log share of this business's transactions in that category
  new_counterparty   first appearance of the counterparty in the scan window
  both_directions    counterparty appears as both payer and payee in the window —
                     the round-tripping signal the schema itself names (§33, feature 46)
  direction          1 = inflow, 0 = outflow

Hard rules that flag in their own right (listed before forest-only outliers):
  amount_z ≥ threshold (one-sided), a rare hour, and — when `repeat_payment_rule` is on —
  a repeat payment (entry 36.4): same counterparty, amount within tolerance, a short gap,
  not part of a recurring series.

Seasonal gate (entry 36.3, `seasonal_gate`): the amount baseline is computed per
Ramadan-to-Eid season, using the pinned windows feature 36 uses, so ordinary Ramadan
baskets are not compared with the rest of the year. No rule is switched off.

Output rules (§8, §29):
  * `flag_reason` only — never `fraud_reason`. The lens detects statistical
    anomalies, not fraud.
  * Raw anomaly scores and the decision threshold are NEVER returned. They are
    strictly more informative to someone probing the detector than a categorical
    reason. Flags are listed most-unusual first; that ordering is the only
    information the score contributes.

Held-out discipline (§12): the evaluation's held-out types live only in
eval/heldout_anomalies.py. Nothing here was designed around them; in particular
the repeat-payment rule was fixed in DECISIONS entry 36.4 only after a new held-out
type had been defined there, so the evaluation still has unseen types to score.
"""

from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest

FEATURES = ["amount_z", "hour_rarity", "category_rarity", "new_counterparty", "both_directions", "direction"]


def _robust_z(x: pd.Series) -> pd.Series:
    med = x.median()
    mad = (x - med).abs().median() * 1.4826
    if not mad or np.isnan(mad):
        sd = x.std(ddof=0)
        mad = sd if sd and not np.isnan(sd) else 1.0
    return (x - med) / mad


def in_season(dates: pd.Series, windows: list[tuple[pd.Timestamp, pd.Timestamp]] | None) -> pd.Series:
    """True on days inside any Ramadan-to-Eid window (the pinned windows feature 36 uses)."""
    d = pd.to_datetime(dates)
    out = pd.Series(False, index=dates.index)
    for start, end in windows or []:
        out |= (d >= start) & (d <= end)
    return out


REPEAT_MODES = ("off", "window", "exact", "rarity", "forest_feature")


def repeat_mode(acfg: dict) -> str:
    """Entry 37.1 variants. `window` is the entry 36.4 rule; `repeat_payment_rule: true` is its old switch."""
    mode = acfg.get("repeat_payment_mode") or ("window" if acfg.get("repeat_payment_rule") else "off")
    if mode not in REPEAT_MODES:
        raise ValueError(f"repeat_payment_mode {mode!r} not in {REPEAT_MODES}")
    return mode


def _repeat_payment(t: pd.DataFrame, tol: float, gap: int) -> np.ndarray:
    """An outflow repeating an earlier outflow to the same counterparty, amount within `tol` (relative),
    0–`gap` days later, neither in a recurring series. The later of the two is the one marked."""
    flag = np.zeros(len(t), dtype=bool)
    out = t[(t["direction_in"] == 0) & t["counterparty_id"].notna() & ~t["recurring"]]
    for _, g in out.groupby(out["counterparty_id"].astype(str), sort=False):
        if len(g) < 2:
            continue
        idx = g.index.to_numpy()
        day = pd.to_datetime(g["date"]).to_numpy("datetime64[D]").astype(np.int64)
        amt = g["amount"].to_numpy(float)
        lo = 0
        for i in range(1, len(g)):
            while day[i] - day[lo] > gap:
                lo += 1
            prev = amt[lo:i]
            if len(prev) and (np.abs(amt[i] / np.where(prev == 0, np.nan, prev) - 1) <= tol).any():
                flag[idx[i]] = True
    return flag


def _close_match_rate(t: pd.DataFrame, tol: float) -> pd.Series:
    """Per row: the share of all pairs of its counterparty's (non-recurring) outflows whose amounts are
    within `tol` of each other — how ordinary a close match is for that counterparty (entry 37.1 rarity)."""
    rate = pd.Series(np.nan, index=t.index)
    out = t[(t["direction_in"] == 0) & t["counterparty_id"].notna() & ~t["recurring"]]
    for _, g in out.groupby(out["counterparty_id"].astype(str), sort=False):
        n = len(g)
        if n < 2:
            continue
        a = np.sort(g["amount"].to_numpy(float))
        close = int((np.searchsorted(a, a * (1 + tol), side="right") - np.arange(n) - 1).sum())
        rate.loc[g.index] = close / (n * (n - 1) / 2)
    return rate


def repeat_signal(t: pd.DataFrame, acfg: dict) -> np.ndarray:
    mode = repeat_mode(acfg)
    if mode == "off":
        return np.zeros(len(t), dtype=bool)
    if mode == "exact":
        return _repeat_payment(t, tol=1e-9, gap=0) & _same_to_the_halala(t)
    sig = _repeat_payment(t, float(acfg["repeat_amount_tolerance"]), int(acfg["repeat_max_gap_days"]))
    if mode == "rarity":
        rate = _close_match_rate(t, float(acfg["repeat_amount_tolerance"])).to_numpy()
        sig &= np.nan_to_num(rate, nan=1.0) < float(acfg["repeat_rarity_max_share"])
    return sig


def _same_to_the_halala(t: pd.DataFrame) -> np.ndarray:
    """True where an earlier same-day outflow to the same counterparty has the identical amount (2 dp)."""
    key = t["counterparty_id"].astype(str) + "|" + pd.to_datetime(t["date"]).dt.strftime("%Y-%m-%d") + "|" + t["amount"].round(2).astype(str)
    return (key.duplicated() & (t["direction_in"] == 0)).to_numpy()


def transaction_features(tx: pd.DataFrame, acfg: dict, seasonal_windows: list | None = None) -> pd.DataFrame:
    t = tx.sort_values(["date", "hour", "transaction_id"]).reset_index(drop=True).copy()
    t["log_amount"] = np.log1p(t["amount"].astype(float).clip(lower=0))
    t["direction_in"] = (t["direction"].astype(str) == "in").astype(float)
    grp = t.groupby([t["direction"].astype(str), t["category"].astype(str)], observed=True)["log_amount"]
    big = grp.transform("size") >= 5
    t["amount_z"] = np.where(big, grp.transform(_robust_z), t.groupby(t["direction"].astype(str), observed=True)["log_amount"].transform(_robust_z))
    t["in_season"] = in_season(t["date"], seasonal_windows)
    if acfg.get("seasonal_gate", False) and t["in_season"].any():
        # Entry 36.3 seasonal gate: the amount baseline is (direction, category, season), so ordinary
        # Ramadan baskets — fewer and larger — are compared with Ramadan, not with the rest of the year.
        # A seasonal group under 5 rows keeps the (direction, category) z above. No rule is switched off.
        sgrp = t.groupby([t["direction"].astype(str), t["category"].astype(str), t["in_season"]], observed=True)["log_amount"]
        t["amount_z"] = np.where(sgrp.transform("size") >= 5, sgrp.transform(_robust_z), t["amount_z"])
    n = len(t)
    t["hour_share"] = t.groupby("hour")["hour"].transform("size") / n
    t["hour_rarity"] = -np.log(t["hour_share"])
    cat = t["category"].astype(str)
    t["category_share"] = cat.map(cat.value_counts()) / n

    cp = t["counterparty_id"].astype(object)
    has_cp = cp.notna()
    # Recurring series: the same counterparty + category at least `recurring_min_occurrences`
    # times with amounts inside the band around their median. A scheduled payment is the
    # definition of expected, so it is not "rare" however infrequent its category is.
    key = cp.astype(str) + "|" + cat
    med = t.groupby(key)["amount"].transform("median")
    in_band = has_cp & ((t["amount"] / med.replace(0, np.nan) - 1).abs() <= float(acfg["recurring_amount_band"]))
    t["recurring"] = in_band & (in_band.groupby(key).transform("sum") >= int(acfg["recurring_min_occurrences"]))
    t["category_rarity"] = np.where(t["recurring"], 0.0, -np.log(t["category_share"]))

    # Every counterparty is "new" at its first sighting, and first sightings cluster at the
    # start of the window. Only count novelty after a burn-in that establishes the baseline.
    burn_in_end = t["date"].min() + pd.Timedelta(days=int(acfg["new_counterparty_burn_in_days"]))
    t["new_counterparty"] = (has_cp & ~cp.duplicated() & (t["date"] >= burn_in_end)).astype(float)
    dirs = t[has_cp].groupby(cp[has_cp])["direction"].nunique()
    t["both_directions"] = cp.map(dirs).fillna(0).ge(2).astype(float)
    t["repeat_payment"] = repeat_signal(t, acfg)
    t["direction"] = t["direction_in"]
    return t


def rule_hits(t: pd.DataFrame, acfg: dict) -> np.ndarray:
    """Hard-rule violations that flag in their own right (entry 23 fix 3; entries 36.4, 37.1). In the
    `forest_feature` mode the repeat signal is a forest input, not a rule, so it is left out here."""
    if not acfg.get("rule_violations_also_flag", False):
        return np.zeros(len(t), dtype=bool)
    rep = t["repeat_payment"] if repeat_mode(acfg) in ("window", "exact", "rarity") else False
    return ((t["amount_z"] >= acfg["amount_z"]) | (t["hour_share"] < acfg["rare_hour_share"]) | rep).to_numpy()


def _reason(r: pd.Series, acfg: dict) -> str:
    if r["repeat_payment"]:  # the most specific reason first
        return "repeat_payment"
    if r["amount_z"] >= acfg["amount_z"]:  # one-sided: an unusually SMALL amount is not a risk anomaly
        return "amount_outlier"
    if r["new_counterparty"] and r["amount_z"] >= acfg["new_counterparty_amount_z"]:
        return "new_counterparty_large_amount"
    if r["both_directions"]:
        return "counterparty_both_directions"
    if r["hour_share"] < acfg["rare_hour_share"]:
        return "unusual_hour"
    if not r["recurring"] and r["category_share"] < acfg["rare_category_share"]:
        return "rare_category"
    return "multivariate_outlier"


def detect(tx: pd.DataFrame, as_of: pd.Timestamp, acfg: dict, seasonal_windows: list | None = None) -> dict:
    """`seasonal_windows`: the pinned Ramadan-to-Eid windows (profile_engine.compute.ramadan_from_config),
    used only when `acfg["seasonal_gate"]` is on (entry 36.3)."""
    lo = as_of - pd.Timedelta(days=int(acfg["scan_days"]) - 1)
    w = tx[(tx["date"] >= lo) & (tx["date"] <= as_of)]
    if len(w) < int(acfg["min_transactions"]):
        return {"status": "not_computed", "reason": "too_few_transactions_for_a_baseline", "transactions_scanned": len(w), "flags": []}

    t = transaction_features(w, acfg, seasonal_windows)
    cols = FEATURES + (["repeat_payment"] if repeat_mode(acfg) == "forest_feature" else [])
    X = t[cols].to_numpy(dtype=float)
    forest = IsolationForest(
        n_estimators=int(acfg["n_estimators"]), contamination=float(acfg["contamination"]),
        random_state=int(acfg["random_state"]),
    ).fit(X)
    outlier = forest.predict(X) == -1
    score = forest.score_samples(X)  # never leaves this function (§29)
    rule = rule_hits(t, acfg)
    # Hard univariate violations first (each ordered most-isolated first), then forest-only outliers.
    order = sorted(np.where(outlier | rule)[0], key=lambda i: (not rule[i], score[i]))
    picked = order[: int(acfg["max_flags"])]

    flags = []
    for i in picked:
        r = t.iloc[i]
        flags.append({
            "transaction_id": int(r["transaction_id"]),
            "date": pd.Timestamp(r["date"]).date().isoformat(),
            "hour": int(r["hour"]),
            "direction": "in" if r["direction"] == 1.0 else "out",
            "amount_sar": round(float(r["amount"]), 2),
            "counterparty_type": str(r["counterparty_type"]),
            "category": str(r["category"]),
            "flag_reason": _reason(r, acfg),
        })
    n = len(t)
    return {
        "status": "computed",
        "scan_window": {"from": lo.date().isoformat(), "to": as_of.date().isoformat()},
        "transactions_scanned": n,
        "flags": flags,
        "method": "per-business Isolation Forest + hard univariate rules; flag_reason only, scores and threshold withheld (§29)",
    }
