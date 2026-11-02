# Forecast lens — §10 holdout-shock lead time, neutral and Ramadan windows (DECISIONS entry 36)

Population: **serving**, demo businesses and the `<1yr` tier excluded, N = 751. Data source: synthetic.
Shock: revenue drop from day 92 (week 14) to the window end. Detection: the 30-day projection goes
below zero at an as-of day before the actual balance does. Misses count as 0 days of lead time.
Definitions fixed in DECISIONS entry 36.1 before this ran. No method was changed because of this result.

## Detection and lead time

| placement | shock | businesses | shock-caused crunches | method | detected before the event | lead time, median [IQR] days | false alarms (control) |
|---|---|---|---|---|---|---|---|
| neutral | 30% | 751 | 27 | `naive90` | 88.9% | 15 [4, 34] | 3.8% (of 636) |
| neutral | 30% | 751 | 27 | `naive30` | 96.3% | 27 [12, 46] | 8.3% (of 636) |
| neutral | 50% | 751 | 39 | `naive90` | 69.2% | 13 [0, 30] | 3.8% (of 636) |
| neutral | 50% | 751 | 39 | `naive30` | 82.1% | 26 [5, 42] | 8.3% (of 636) |
| ramadan | 30% | 751 | 26 | `naive90` | 84.6% | 18 [2, 32] | 3.7% (of 616) |
| ramadan | 30% | 751 | 26 | `naive30` | 92.3% | 32 [12, 40] | 10.4% (of 616) |
| ramadan | 50% | 751 | 43 | `naive90` | 83.7% | 20 [4, 34] | 3.7% (of 616) |
| ramadan | 50% | 751 | 43 | `naive30` | 93.0% | 35 [16, 48] | 10.4% (of 616) |

## Paired: does the shipped method warn earlier than the baseline on the same business?

| placement | shock | N | `naive90` earlier | same day | `naive90` later | median difference (naive90 − naive30), days [95% CI] |
|---|---|---|---|---|---|---|
| neutral | 30% | 27 | 25.9% | 22.2% | 51.9% | -1 [-4, +0] |
| neutral | 50% | 39 | 28.2% | 20.5% | 51.3% | -1 [-14, +0] |
| ramadan | 30% | 26 | 26.9% | 7.7% | 65.4% | -6 [-11, +0] |
| ramadan | 50% | 43 | 14.0% | 11.6% | 74.4% | -9 [-17, -4] |

## By sector (30% shock)

| placement | sector | shock-caused crunches | `naive90` detected | `naive30` detected | `naive90` median lead | `naive30` median lead |
|---|---|---|---|---|---|---|
| neutral | construction | 6 | 66.7% | 100.0% | 4 | 36 |
| neutral | food_beverage | 8 | 87.5% | 100.0% | 20 | 19 |
| neutral | retail_trade | 13 | 100.0% | 92.3% | 18 | 22 |
| ramadan | construction | 8 | 75.0% | 100.0% | 16 | 42 |
| ramadan | retail_trade | 11 | 81.8% | 100.0% | 14 | 22 |
| ramadan | food_beverage | 7 | 100.0% | 71.4% | 26 | 31 |

Chart: `holdout_shock.png` — panel (a) is business 10063, the lowest `business_id` with a shock-caused
crunch in the neutral 30% run (the rule in entry 36.1); panel (b) is the lead-time distribution.

`ramadan_adjusted` (feature 36) is a coarse flag; the forecast lens makes no seasonal correction (§16).
