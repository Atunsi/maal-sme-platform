"""Cash-flow forecast lens — schema §8 (/lenses/forecast), §10, §16, §34.

Two projections of daily net flow over the horizon, so the model is always shown
against the baseline it has to beat (§10):

  naive  trailing-30-day mean daily net flow, held flat.
  model  OLS on the last 90 days: net_t = a + b*t + day-of-week effects, projected
         forward with the slope damped (lens_config.forecast.trend_damping) so a
         short-window trend is not extrapolated as if it were permanent.

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


def _naive(net: np.ndarray, window: int, horizon: int) -> np.ndarray:
    return np.full(horizon, float(net[-window:].mean()))


def _model(dates: pd.DatetimeIndex, net: np.ndarray, horizon: int, damping: float) -> np.ndarray:
    n = len(net)
    t = np.arange(n, dtype=float)
    dow = dates.dayofweek.to_numpy()
    X = np.column_stack([np.ones(n), t] + [(dow == k).astype(float) for k in range(1, 7)])
    beta, *_ = np.linalg.lstsq(X, net, rcond=None)
    fut_dates = pd.date_range(dates[-1] + pd.Timedelta(days=1), periods=horizon, freq="D")
    fd = fut_dates.dayofweek.to_numpy()
    tf = n - 1 + damping * (np.arange(1, horizon + 1, dtype=float))
    Xf = np.column_stack([np.ones(horizon), tf] + [(fd == k).astype(float) for k in range(1, 7)])
    return Xf @ beta


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

    net = fit["net_flow"].to_numpy(dtype=float)
    balance_today = float(g["eod_balance"].iloc[-1])
    dates = pd.DatetimeIndex(fit["date"])

    proj = {
        "naive": _naive(net, int(fcfg["naive_window_days"]), H),
        "model": _model(dates, net, H, float(fcfg["trend_damping"])),
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
        "method": "OLS trend + day-of-week on trailing 90d, damped slope; naive = trailing-30d mean",
    }
