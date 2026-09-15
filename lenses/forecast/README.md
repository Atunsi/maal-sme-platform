# Forecast lens — NOT BUILT

**Owner:** forecast + anomaly owner · **Schema:** §8, §10, §16, §34 · **Due:** Week 5

Prophet/ARIMA 30/60/90-day cash-flow projection + crunch alert, read off the
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
