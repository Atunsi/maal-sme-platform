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

Two more were added later under their own protocol, also fixed before any fit (DECISIONS entry 56),
and live in EXTRA_METHODS because their packages are optional:

  arima       statsmodels ARIMA on the last 90 days, order by lowest AIC over 18 (p, d, q)
  prophet     Prophet on the last 90 days, weekly seasonality only, MAP fit, library defaults
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


# --------------------------------------------------------------------------- #
# Prophet and ARIMA (DECISIONS entry 56; every setting was fixed there before any fit)
#
# Kept out of METHODS because `statsmodels` and `prophet` are not in requirements.txt unless one of
# them is chosen on validation (entry 56.5): the shipped lens and the older harnesses must import
# without them. The packages are imported inside the functions for the same reason.
# --------------------------------------------------------------------------- #

ARIMA_ORDERS = [(p, d, q) for p in (0, 1, 2) for d in (0, 1) for q in (0, 1, 2)]
FALLBACKS = {"arima": 0, "prophet": 0}        # calls that returned naive90's projection, per process


def _arima_one(y: np.ndarray, order: tuple, horizon: int) -> tuple[float, np.ndarray] | None:
    """(AIC, forecast) for one order, or None when it does not converge (entry 56.6.1)."""
    import warnings

    from statsmodels.tsa.arima.model import ARIMA

    try:
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            res = ARIMA(y, order=order).fit()
            if not bool((res.mle_retvals or {}).get("converged", False)):
                return None
            aic, out = float(res.aic), np.asarray(res.forecast(horizon), float)
    except Exception:  # noqa: BLE001 — any failure of one order just removes that order
        return None
    return (aic, out) if np.isfinite(aic) and out.shape == (horizon,) and np.isfinite(out).all() else None


def _arima_projection(y: np.ndarray, horizon: int) -> np.ndarray | None:
    """Lowest-AIC converged order's forecast, or None when no order converges (entry 56.6.1)."""
    best_aic, best = np.inf, None
    for order in ARIMA_ORDERS:
        fit = _arima_one(y, order, horizon)
        if fit is not None and fit[0] < best_aic:      # strict <, so a tie keeps the earlier (p, d, q)
            best_aic, best = fit
    return best


def arima(hist: pd.DataFrame, horizon: int, **_) -> np.ndarray:
    out = _arima_projection(hist["net_flow"].to_numpy(float)[-90:], horizon)
    if out is None:
        FALLBACKS["arima"] += 1
        return naive90(hist, horizon)
    return out


def _prophet_projection(fit: pd.DataFrame, horizon: int) -> np.ndarray | None:
    """Prophet point forecast with the entry 56.6.2 arguments, or None when it fails."""
    import logging

    try:
        from prophet import Prophet

        for name in ("cmdstanpy", "prophet"):          # after the import: cmdstanpy resets its own level
            logging.getLogger(name).setLevel(logging.CRITICAL)
        m = Prophet(weekly_seasonality=True, yearly_seasonality=False, daily_seasonality=False,
                    changepoint_prior_scale=0.05, mcmc_samples=0, uncertainty_samples=0)
        m.fit(pd.DataFrame({"ds": pd.DatetimeIndex(fit["date"]), "y": fit["net_flow"].to_numpy(float)}))
        out = m.predict(pd.DataFrame({"ds": _future_dates(fit, horizon)}))["yhat"].to_numpy(float)
    except Exception:  # noqa: BLE001 — a failed fit is a counted fallback, not a crash
        return None
    return out if out.shape == (horizon,) and np.isfinite(out).all() else None


def prophet(hist: pd.DataFrame, horizon: int, **_) -> np.ndarray:
    out = _prophet_projection(hist.tail(90), horizon)
    if out is None:
        FALLBACKS["prophet"] += 1
        return naive90(hist, horizon)
    return out


EXTRA_METHODS = {"arima": arima, "prophet": prophet}
