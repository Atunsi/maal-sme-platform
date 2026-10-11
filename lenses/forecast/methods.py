"""Daily net-flow projection methods for the forecast lens (§10).

One module, used by BOTH the selection harness (eval/forecast_selection.py) and the shipped
lens (lenses/forecast/forecast.py), so the method that was evaluated is exactly the method
that runs. Every method takes the business's history up to the forecast origin and returns
H daily net-flow projections; the projected balance is today's balance plus their cumsum.

The candidate list was fixed BEFORE any of them was evaluated (DECISIONS entry 27):

  naive30     trailing-30-day mean, held flat                        — the §10 baseline
  naive90     trailing-90-day mean                                   — less noise, more lag
  blend       0.5 × naive30 + 0.5 × naive90
  ewma        exponentially weighted mean, half-life 21 days, over the last 90
  ols_damped  v1 model: OLS trend + day-of-week on 90 days, slope damped (v1 lost to naive30)
  structural  recurring outflows (rent, payroll, loans) replayed on the days they recur, plus
              the non-recurring net flow at its 30-day level with a 90-day day-of-week profile
"""

from __future__ import annotations

import numpy as np
import pandas as pd


def _future_dates(hist: pd.DataFrame, horizon: int) -> pd.DatetimeIndex:
    return pd.date_range(pd.Timestamp(hist["date"].iloc[-1]) + pd.Timedelta(days=1), periods=horizon, freq="D")


def naive30(hist: pd.DataFrame, horizon: int, **_) -> np.ndarray:
    return np.full(horizon, float(hist["net_flow"].to_numpy(float)[-30:].mean()))


def naive90(hist: pd.DataFrame, horizon: int, **_) -> np.ndarray:
    return np.full(horizon, float(hist["net_flow"].to_numpy(float)[-90:].mean()))


def blend(hist: pd.DataFrame, horizon: int, **_) -> np.ndarray:
    return 0.5 * naive30(hist, horizon) + 0.5 * naive90(hist, horizon)


def ewma(hist: pd.DataFrame, horizon: int, half_life: float = 21.0, **_) -> np.ndarray:
    x = hist["net_flow"].to_numpy(float)[-90:]
    age = np.arange(len(x))[::-1]
    w = 0.5 ** (age / half_life)
    return np.full(horizon, float((w * x).sum() / w.sum()))


def ols_damped(hist: pd.DataFrame, horizon: int, damping: float = 0.5, **_) -> np.ndarray:
    fit = hist.tail(90)
    net = fit["net_flow"].to_numpy(float)
    n = len(net)
    dow = pd.DatetimeIndex(fit["date"]).dayofweek.to_numpy()
    X = np.column_stack([np.ones(n), np.arange(n, dtype=float)] + [(dow == k).astype(float) for k in range(1, 7)])
    beta, *_ = np.linalg.lstsq(X, net, rcond=None)
    fd = _future_dates(hist, horizon).dayofweek.to_numpy()
    tf = n - 1 + damping * np.arange(1, horizon + 1, dtype=float)
    Xf = np.column_stack([np.ones(horizon), tf] + [(fd == k).astype(float) for k in range(1, 7)])
    return Xf @ beta


def structural(hist: pd.DataFrame, horizon: int, **_) -> np.ndarray:
    rec = hist["recurring_outflow_total"].to_numpy(float)
    nonrec = hist["net_flow"].to_numpy(float) + rec          # net flow before recurring payments
    last90 = hist.tail(90)
    d90 = pd.DatetimeIndex(last90["date"]).dayofweek.to_numpy()
    nr90 = nonrec[-90:]
    dow_effect = np.array([nr90[d90 == k].mean() - nr90.mean() if (d90 == k).any() else 0.0 for k in range(7)])
    level = nonrec[-30:].mean()
    fd = _future_dates(hist, horizon).dayofweek.to_numpy()
    rec_tile = np.resize(rec[-30:], horizon)                  # monthly payments recur on (roughly) the same days
    return level + dow_effect[fd] - rec_tile


METHODS = {"naive30": naive30, "naive90": naive90, "blend": blend, "ewma": ewma, "ols_damped": ols_damped, "structural": structural}
BASELINE = "naive30"
