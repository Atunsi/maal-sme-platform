"""Forecast methods (lenses/forecast/methods.py) and the lens's use of the configured one. No data needed."""

from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from lenses import load_lens_config
from lenses.forecast.forecast import forecast
from lenses.forecast.methods import BASELINE, METHODS

H = 30


def history(net, recurring=None, start="2026-01-01"):
    n = len(net)
    return pd.DataFrame({
        "date": pd.date_range(start, periods=n, freq="D"),
        "net_flow": np.asarray(net, float),
        "recurring_outflow_total": np.zeros(n) if recurring is None else np.asarray(recurring, float),
        "eod_balance": 10_000.0 + np.cumsum(net),
    })


@pytest.mark.parametrize("name", sorted(METHODS))
def test_every_method_returns_h_finite_values(name):
    rng = np.random.default_rng(0)
    out = METHODS[name](history(rng.normal(50, 200, 120)), H, damping=0.5)
    assert out.shape == (H,) and np.isfinite(out).all()


def test_naive_windows_are_the_trailing_means():
    net = np.r_[np.full(60, 10.0), np.full(30, 40.0)]  # last 30 = 40, last 90 mean = 20
    h = history(net)
    assert METHODS["naive30"](h, H)[0] == pytest.approx(40.0)
    assert METHODS["naive90"](h, H)[0] == pytest.approx(20.0)
    assert METHODS["blend"](h, H)[0] == pytest.approx(30.0)


def test_constant_series_is_projected_constant_by_every_level_method():
    h = history(np.full(120, 25.0))
    for name in ("naive30", "naive90", "blend", "ewma"):
        assert METHODS[name](h, H) == pytest.approx(np.full(H, 25.0))


def test_structural_puts_recurring_payments_back_on_their_days():
    rec = np.zeros(120)
    rec[np.arange(119, -1, -30)] = 5_000.0            # one payment every 30 days, the last on the final day
    net = 200.0 - rec
    out = METHODS["structural"](history(net, rec), H)
    assert out.argmin() == H - 1                       # next payment lands 30 days after the last one
    assert out.sum() == pytest.approx(net[-30:].sum(), rel=1e-9)


def test_lens_uses_the_configured_method_and_always_shows_the_baseline():
    fcfg = load_lens_config()["forecast"]
    rng = np.random.default_rng(1)
    h = history(rng.normal(100, 300, 180))
    out = forecast(h, pd.Timestamp(h["date"].iloc[-1]), pd.Series(dtype=object), fcfg)
    assert out["method"].startswith(fcfg["method"])
    assert len(out["model"]) == len(out["naive_baseline"]) == len(fcfg["horizons_days"])
    expected_naive = h["eod_balance"].iloc[-1] + 30 * METHODS[BASELINE](h, 30)[0]
    assert out["naive_baseline"][0]["projected_balance_sar"] == pytest.approx(expected_naive, abs=0.01)


# --- Prophet and ARIMA (DECISIONS entry 56). Their packages are optional, so these skip without them. ---

def test_arima_returns_h_finite_values_and_falls_back_to_naive90(monkeypatch):
    pytest.importorskip("statsmodels")
    from lenses.forecast import methods as fm

    h = history(np.random.default_rng(2).normal(50, 200, 120))
    out = fm.arima(h, H)
    assert out.shape == (H,) and np.isfinite(out).all()

    monkeypatch.setattr(fm, "_arima_projection", lambda y, horizon: None)   # no order converges
    before = fm.FALLBACKS["arima"]
    assert fm.arima(h, H) == pytest.approx(fm.naive90(h, H))
    assert fm.FALLBACKS["arima"] == before + 1


def test_arima_fits_only_the_last_90_days():
    pytest.importorskip("statsmodels")
    from lenses.forecast import methods as fm

    rng = np.random.default_rng(3)
    recent = rng.normal(50, 200, 90)
    a = fm.arima(history(np.r_[np.full(30, 9e6), recent], start="2026-01-01"), H)
    b = fm.arima(history(np.r_[np.full(60, -9e6), recent], start="2025-12-02"), H)
    assert a == pytest.approx(b)


def test_prophet_returns_h_finite_values_and_falls_back_to_naive90(monkeypatch):
    pytest.importorskip("prophet")
    from lenses.forecast import methods as fm

    h = history(np.random.default_rng(4).normal(50, 200, 120))
    out = fm.prophet(h, H)
    assert out.shape == (H,) and np.isfinite(out).all()

    monkeypatch.setattr(fm, "_prophet_projection", lambda fit, horizon: None)   # the fit failed
    before = fm.FALLBACKS["prophet"]
    assert fm.prophet(h, H) == pytest.approx(fm.naive90(h, H))
    assert fm.FALLBACKS["prophet"] == before + 1


def test_harness_times_each_call_and_marks_fallbacks(monkeypatch):
    pytest.importorskip("statsmodels")
    pytest.importorskip("prophet")
    from eval import forecast_prophet_arima as harness
    from eval.forecast_selection import evaluate
    from lenses.forecast import methods as fm

    rng = np.random.default_rng(5)
    parts = []
    for b_id in (1, 2, 3):
        d = history(rng.normal(50, 200, 180))
        d["business_id"], d["outflow_total"] = b_id, 300.0
        parts.append(d)
    daily = pd.concat(parts, ignore_index=True)

    def failing_on_business_2(fit, horizon):
        return None if fit["business_id"].iloc[0] == 2 else np.zeros(horizon)

    monkeypatch.setattr(fm, "_prophet_projection", failing_on_business_2)
    r = harness.score(daily, 30, ["naive30", "naive90", "prophet"])
    assert len(r) == 9 and r["seconds"].notna().all()
    assert r.loc[r["fallback"], ["business_id", "method"]].to_numpy().tolist() == [[2, "prophet"]]
    plain = evaluate(daily, 30, methods={"naive30": fm.naive30, "naive90": fm.naive90})
    scored = r[r["method"] != "prophet"].reset_index(drop=True)
    pd.testing.assert_frame_equal(scored[plain.columns], plain)      # the timing wrapper changes no score
