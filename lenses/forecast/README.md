# Forecast lens — v2 BUILT (beats the naive baseline), owner to take over

**Method (2026-10-11, DECISIONS entry 27):** `naive90` (trailing-90-day mean), chosen on a validation window from six candidates fixed in advance (`methods.py`), then reported once on an untouched test window. **It beats the naive-30 baseline**: median error 0.323 vs 0.376 (research), 0.344 vs 0.401 (serving), with fewer than half the false alarms. It is a longer moving average, not a sophisticated model. Any new model must beat it under the same protocol (`python -m eval.forecast_selection`); never pick by reading the test table.

**Holdout shock and Ramadan run (2026-11-02, DECISIONS entry 36):** `python -m eval.holdout_shock`. On a 30% revenue drop, `naive90` warns a median 15 days ahead (88.9% detected) against the baseline's 27 days (96.3%), and the baseline raises about twice the false alarms on unshocked businesses (8.3% vs 3.8%). The gap widens over a Ramadan window. A longer average lags a sudden drop: this is the price of the accuracy win, measured and kept, not tuned away. Chart: `eval/out/holdout_shock.png`.

**Owner:** forecast + anomaly owner · **Schema:** §8, §10, §16, §34 · **Due:** Week 5

30/60/90-day cash-flow projection + crunch alert (the original brief named Prophet/ARIMA;
neither was evaluated, DECISIONS entry 49), read off the
shared profile.

## Required

- **MAPE against a naive trailing-30-day-average baseline** — the model is only
  interesting relative to the baseline (§10).
- **Holdout-shock test**: inject a synthetic macro event (e.g. 30% revenue
  drop) and report **detection lead time vs. the naive baseline's**. The
  model/baseline/actual comparison chart is the single strongest visual in the
  project (§10). `config.yaml` supports this via `inject_cash_crunch`
  (demo business 10001 carries a week-18, 30% crunch).
- **Run the holdout-shock backtest across a Ramadan window, not only a neutral
  one** (§16), and report anomaly false-positive rate with and without the
  seasonal gate.
- Hazard-curve features 52–54 are computed in the **profile engine**, not here —
  the credit lens reads them from the same profile, which is what preserves §8's
  no-cross-lens-dependency guarantee (§34).

## Known limitation to state, not to engineer around

`ramadan_adjusted` (feature 36) is a **coarse boolean gate** — "don't trust raw
comparisons this window". It does not say how much of the window overlaps or
which days, so it is **not sufficient for a quantitative seasonal correction**
(§16). That would need an overlap fraction or per-day calendar table, which is
out of scope this term. Do not over-claim it in the report.
