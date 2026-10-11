# Forecast lens — method selection (validation) and one-time test (§10)

Data source: synthetic. Scorable businesses (§15). Horizon 30 days. Error = |projected − actual end balance| / avg monthly outflow.
Candidates and criterion fixed before the run (lenses/forecast/methods.py, DECISIONS entry 27).

## 1. Validation — days 121–150, research (N = 9,495) — the method is chosen here

| method | median error | mean error | better than naive30 for | MAPE (away from zero) | crunch recall | false alarms |
|---|---|---|---|---|---|---|
| naive90 | 0.345 | 0.709 | 58.7% | 14.1% | 78.4% | 0.6% |
| ewma | 0.349 | 0.732 | 59.8% | 14.4% | 83.8% | 1.4% |
| blend | 0.363 | 0.737 | 63.3% | 14.7% | 78.2% | 0.8% |
| naive30 | 0.411 | 0.812 | — | 16.7% | 79.7% | 1.3% |
| structural | 0.411 | 0.814 | 48.5% | 16.8% | 80.1% | 1.3% |
| ols_damped | 0.488 | 0.905 | 41.5% | 19.8% | 87.1% | 4.1% |

**Selected: `naive90`** (lowest median error).

## 2. Test — days 151–180, reported once, never used to choose

### research (N = 9,495)

| method | median error | mean error | better than naive30 for | MAPE (away from zero) | crunch recall | false alarms |
|---|---|---|---|---|---|---|
| naive90 | 0.323 | 0.448 | 58.5% | 13.0% | 79.4% | 0.5% |
| naive30 | 0.376 | 0.532 | — | 15.0% | 81.8% | 1.3% |

### serving (N = 943)

| method | median error | mean error | better than naive30 for | MAPE (away from zero) | crunch recall | false alarms |
|---|---|---|---|---|---|---|
| naive90 | 0.344 | 0.476 | 58.4% | 14.7% | 74.6% | 1.0% |
| naive30 | 0.401 | 0.552 | — | 15.5% | 75.4% | 1.7% |

Ramadan falls in days 18–47 of the window, so neither target window contains it; the §16 Ramadan-window
run and the §10 holdout-shock lead-time test are separate, still-open checks.
