# Forecast lens — Prophet and ARIMA against the shipped candidates (DECISIONS 49, 56)

Data source: synthetic. Scorable businesses (§15). Horizon 30 days. Error = |projected − actual end balance| / avg monthly outflow.
Protocol fixed and committed before either package was installed (DECISIONS entry 56). Scoring is
`eval/forecast_selection.py`'s own `evaluate` and `summarise`.

## 1. Validation — days 121–150, research (N = 9,495) — the method is chosen here

| method | median error | mean error | better than naive30 for | MAPE (away from zero) | crunch recall | false alarms |
|---|---|---|---|---|---|---|
| naive90 | 0.345 | 0.709 | 58.7% | 14.1% | 78.4% | 0.6% |
| ewma | 0.349 | 0.732 | 59.8% | 14.4% | 83.8% | 1.4% |
| blend | 0.363 | 0.737 | 63.3% | 14.7% | 78.2% | 0.8% |
| arima | 0.379 | 1.264 | 54.1% | 15.5% | 83.4% | 1.8% |
| naive30 | 0.411 | 0.812 | — | 16.7% | 79.7% | 1.3% |
| structural | 0.411 | 0.814 | 48.5% | 16.8% | 80.1% | 1.3% |
| ols_damped | 0.488 | 0.905 | 41.5% | 19.8% | 87.1% | 4.1% |
| prophet | 0.530 | 0.961 | 38.0% | 21.5% | 87.2% | 5.0% |

**Selected: `naive90`** (lowest median error).
The six existing rows reproduce `eval/out/forecast_selection.md` section 1 exactly (checked by the harness before anything was fitted).

Cost on validation (10 worker processes for arima and prophet; the six others in one process):

| method | businesses | fell back to naive90 | median seconds per business | mean seconds per business |
|---|---|---|---|---|
| naive30 | 9,495 | — | 0.0000 | 0.0000 |
| naive90 | 9,495 | — | 0.0000 | 0.0000 |
| blend | 9,495 | — | 0.0000 | 0.0000 |
| ewma | 9,495 | — | 0.0000 | 0.0000 |
| ols_damped | 9,495 | — | 0.0004 | 0.0004 |
| structural | 9,495 | — | 0.0003 | 0.0004 |
| arima | 9,495 | 0 (0.0%) | 0.7169 | 0.7410 |
| prophet | 9,495 | 0 (0.0%) | 0.4079 | 0.4244 |

## 2. Test — fresh population (seed 44, IDs 20001–21000), days 151–180, N = 944 — scored once

| method | median error | mean error | better than naive30 for | MAPE (away from zero) | crunch recall | false alarms |
|---|---|---|---|---|---|---|
| naive90 | 0.331 | 0.446 | 55.9% | 13.2% | 83.5% | 0.4% |
| arima | 0.348 | 0.512 | 52.0% | 13.5% | 85.8% | 1.8% |
| naive30 | 0.374 | 0.519 | — | 14.0% | 84.3% | 0.9% |
| prophet | 0.467 | 0.664 | 35.2% | 18.7% | 89.8% | 3.8% |

Chosen on validation: `naive90`. `arima` and `prophet` are shown for information only (entry 56.6.6); they could not change the choice.

Cost on test (10 worker processes for arima and prophet):

| method | businesses | fell back to naive90 | median seconds per business | mean seconds per business |
|---|---|---|---|---|
| naive90 | 944 | — | 0.0000 | 0.0000 |
| naive30 | 944 | — | 0.0000 | 0.0000 |
| arima | 944 | 0 (0.0%) | 0.7202 | 0.7502 |
| prophet | 944 | 0 (0.0%) | 0.4061 | 0.4259 |

## 3. Environment

Python 3.11.4, Windows-10-10.0.26200-SP0, 12 logical CPUs. prophet 1.5.0, cmdstanpy 1.3.2, statsmodels 0.15.0, numpy 2.3.4, pandas 2.3.3, scipy 1.16.3.
Wall time: validation 19 min (finished 2026-11-10 16:44:18), test 2 min (finished 2026-11-10 16:46:39).

