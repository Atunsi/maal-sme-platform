# Forecast lens — §10 backtest (30-day holdout)

Population: **research**, scorable (§15), N = 9,495. Data source: synthetic. Each business's last 30 days are held out; projections are fitted only on the days before.

## End-of-holdout balance error (scale-free: |error| / avg monthly outflow)

| projection | median error | mean error | businesses where it is the better of the two |
|---|---|---|---|
| model (OLS trend + day-of-week, damped) | 0.455 | 0.637 | 36.9% |
| naive (trailing-30d mean) | 0.376 | 0.532 | 63.1% |

MAPE (median, only the 7,525 businesses whose actual balance is ≥ 1 month of outflow from zero): model 18.1%, naive 15.0%.

## Crunch detection — 1,164 businesses went negative inside the holdout

| projection | caught in advance (recall) | false alarms among the rest |
|---|---|---|
| model | 87.1% | 3.7% |
| naive | 81.8% | 1.3% |

Not yet covered (§10, owner's next step): the holdout-shock test — inject a deliberate revenue drop and
report detection lead time vs the naive baseline — and a run across a Ramadan window (§16).
