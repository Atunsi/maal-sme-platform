"""Recover the §22 seasonal multipliers FROM the generated tables (§21 target `ramadan_amplitude_recovered`).

Shared by eval.validate_emergent and eval.gate_week3 (criterion 3) so both agree on the definition:

  per sector, research population, businesses operating for the whole window (thin-file starts excluded
  because they contribute to the baseline but not to Ramadan). Each business's daily series is divided by
  its own window mean and the sector series is the equal-weighted mean across businesses, so a few
  medium-tier businesses cannot dominate:
      y_t = log mean_b( inflow_total[b, t] / mean_t inflow_total[b, ·] )   (value)   and the same on inflow_count (count)
      y_t = α + β·t/T + Σ_dow δ_dow + Σ_w θ_w · 1[t ∈ window w] + ε_t
  recovered multiplier for window w = exp(θ_w). Day-of-week dummies matter: Eid 1447 (20–22 Mar 2026)
  falls on Fri–Sun, so for sun_thu sectors a raw window mean would confound Eid with the weekend.

The configured inputs are read from `seasonality_value_multiplier` / `seasonality_count_multiplier`
(or, before the split landed, from the legacy `seasonality_multipliers` block with count = 1.0).
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from generator.generate import calendar_masks

WINDOWS = ("pre_ramadan_10d", "ramadan", "eid", "post_eid_7d")


def configured_multipliers(cfg: dict) -> dict[str, dict[str, dict[str, float]]]:
    """{sector: {"value": {window: m}, "count": {window: m}}} from either config layout."""
    if "seasonality_value_multiplier" in cfg:
        val = cfg["seasonality_value_multiplier"]
        cnt = cfg.get("seasonality_count_multiplier", {})
        return {s: {"value": {w: float(val[s][w]) for w in WINDOWS}, "count": {w: float(cnt.get(s, {}).get(w, 1.0)) for w in WINDOWS}} for s in val}
    legacy = cfg["seasonality_multipliers"]
    return {s: {"value": {w: float(legacy[s][w]) for w in WINDOWS}, "count": {w: 1.0 for w in WINDOWS}} for s in legacy}


def _equal_weight_series(d: pd.DataFrame, col: str) -> pd.Series:
    """Mean over businesses of each business's series divided by its own window mean.

    Equal weighting, not a raw sector sum: a raw sum is dominated by the handful of medium-tier
    businesses (15× scale) whose persistent AR(1) receipt lumpiness then masquerades as a
    sector-wide level shift — visible as a uniform bias across all four windows at quick scale.
    """
    piv = d.pivot_table(index="date", columns="business_id", values=col, aggfunc="sum").sort_index()
    means = piv.mean(axis=0)
    piv = piv.loc[:, means > 0]
    return (piv / piv.mean(axis=0)).mean(axis=1)


def recover(daily: pd.DataFrame, businesses: pd.DataFrame, cfg: dict, population: str = "research") -> dict:
    biz = businesses[(businesses["population"] == population) & (businesses["operating_start_date"] == businesses["start_date"])]
    out = {}
    for sector, ids in biz.groupby("sector")["business_id"]:
        d = daily[daily["business_id"].isin(set(ids))]
        agg = pd.DataFrame({"inflow_total": _equal_weight_series(d, "inflow_total"), "inflow_count": _equal_weight_series(d, "inflow_count")})
        dates = pd.DatetimeIndex(agg.index)
        masks = calendar_masks(cfg, dates)
        T = len(dates)
        X = [np.ones(T), np.arange(T) / (T - 1)]
        for dow in range(1, 7):
            X.append((dates.dayofweek == dow).astype(float))
        for w in WINDOWS:
            X.append(masks[w].astype(float))
        X = np.column_stack(X)
        res = {"n_businesses": len(ids), "n_days": int(T)}
        for kind, col in (("value", "inflow_total"), ("count", "inflow_count")):
            y = np.log(np.maximum(agg[col].to_numpy(float), 1e-9))
            coef, *_ = np.linalg.lstsq(X, y, rcond=None)
            res[kind] = {w: float(np.exp(coef[8 + k])) for k, w in enumerate(WINDOWS)}
        out[sector] = res
    return out


def compare(recovered: dict, cfg: dict, tolerance_abs: float) -> list[dict]:
    """One row per sector × kind × window: recovered vs configured, pass/finding."""
    conf = configured_multipliers(cfg)
    rows = []
    for sector, r in recovered.items():
        for kind in ("value", "count"):
            for w in WINDOWS:
                target = conf[sector][kind][w]
                got = r[kind][w]
                rows.append({"sector": sector, "kind": kind, "window": w, "configured": target, "recovered": got, "abs_diff": abs(got - target), "ok": abs(got - target) <= tolerance_abs})
    return rows
