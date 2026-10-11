"""Cash-flow forecast lens — schema §8 (/lenses/forecast), §10, §16, §34.

Two projections of daily net flow over the horizon, so the model is always shown
against the baseline it has to beat (§10):

  naive_baseline  trailing-30-day mean daily net flow, held flat (the §10 baseline).
  model           the method named in lens_config.forecast.method — chosen on a
                  validation window and reported once on an untouched test window
                  (eval/forecast_selection.py, DECISIONS entry 27). Currently `naive90`,
                  the trailing-90-day mean: a longer moving average, not a sophisticated
                  model — it wins because daily flows are noisy and trends are small.
                  All candidates live in lenses/forecast/methods.py, shared with the
                  selection harness, so the method evaluated is the method that runs.

Projected balance = today's end-of-day balance + cumulative projected net flow.

Crunch alert — the stronger of two signals:
  * the model's projected balance goes below zero inside a horizon; and
  * the profile engine's liquidity hazard P(min balance < 0) (features 52–54).
The hazard is read from the shared profile, NOT computed here, so this lens and the
credit lens read the same number and neither depends on the other's output (§8, §34).

`ramadan_adjusted` (feature 36) is passed through as a coarse gate only: it says
"raw comparisons in this window are unreliable", it is NOT a seasonal correction
(§16 known limitation). A quantitative seasonal correction is out of scope this term.
"""

from __future__ import annotations

import math

import numpy as np
import pandas as pd

from lenses.forecast.methods import BASELINE, METHODS

METHOD_LABELS = {
    "naive30": "trailing-30-day mean (the §10 baseline)",
    "naive90": "trailing-90-day mean",
    "blend": "average of the 30- and 90-day means",
    "ewma": "exponentially weighted mean, half-life 21 days",
    "ols_damped": "OLS trend + day-of-week, damped slope",
    "structural": "recurring payments on their days + non-recurring level with day-of-week profile",
}


def _num(v) -> float | None:
    try:
        f = float(v)
        return None if math.isnan(f) else f
    except (TypeError, ValueError):
        return None


def forecast(daily: pd.DataFrame, as_of: pd.Timestamp, profile_row: pd.Series, fcfg: dict) -> dict:
    g = daily[daily["date"] <= as_of].sort_values("date")
    fit = g.tail(int(fcfg["fit_window_days"]))
    horizons = [int(h) for h in fcfg["horizons_days"]]
    H = max(horizons)
    if len(fit) < int(fcfg["naive_window_days"]):
        return {"status": "not_computed", "reason": "insufficient_history", "history_days": len(fit)}

    balance_today = float(g["eod_balance"].iloc[-1])
    method = fcfg["method"]
    proj = {
        "naive": METHODS[BASELINE](g, H),
        "model": METHODS[method](g, H, damping=float(fcfg["trend_damping"])),
    }
    bal = {k: balance_today + np.cumsum(v) for k, v in proj.items()}

    def horizon_rows(k: str) -> list[dict]:
        out = []
        for h in horizons:
            b = bal[k][:h]
            out.append({
                "horizon_days": h,
                "projected_net_flow_sar": round(float(proj[k][:h].sum()), 2),
                "projected_balance_sar": round(float(b[-1]), 2),
                "min_projected_balance_sar": round(float(b.min()), 2),
            })
        return out

    below = np.where(bal["model"] < 0)[0]
    days_to_crunch = int(below[0]) + 1 if len(below) else None
    hazard = {h: _num(profile_row.get(f"liquidity_hazard_{h}d")) for h in (30, 60, 90)}
    hz30 = hazard[30] or 0.0

    if (days_to_crunch is not None and days_to_crunch <= 30) or hz30 >= fcfg["hazard_alert_threshold"]:
        level = "crunch"
    elif days_to_crunch is not None or hz30 >= fcfg["hazard_watch_threshold"] or (hazard[90] or 0.0) >= fcfg["hazard_alert_threshold"]:
        level = "watch"
    else:
        level = "none"

    drivers = []
    if days_to_crunch is not None:
        drivers.append(f"projected balance falls below zero in {days_to_crunch} days")
    if hz30 >= fcfg["hazard_watch_threshold"]:
        drivers.append(f"30-day liquidity hazard {hz30:.2f}")

    ram = profile_row.get("ramadan_adjusted")
    return {
        "status": "computed",
        "as_of": as_of.date().isoformat(),
        "balance_today_sar": round(balance_today, 2),
        "model": horizon_rows("model"),
        "naive_baseline": horizon_rows("naive"),
        "crunch_alert": {
            "level": level,
            "days_to_projected_negative_balance": days_to_crunch,
            "liquidity_hazard": {f"{h}d": (round(v, 4) if v is not None else None) for h, v in hazard.items()},
            "drivers": drivers,
        },
        "ramadan_adjusted": bool(ram) if ram in (True, False) else (ram == "True" if isinstance(ram, str) else None),
        "method": f"{method}: {METHOD_LABELS[method]}; naive_baseline = {METHOD_LABELS[BASELINE]}",
    }
