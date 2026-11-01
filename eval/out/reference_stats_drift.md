# The pinned §35 sector reference statistics against the current data (DECISIONS entry 35)

## Provenance

- File: `profile_engine/sector_reference_stats_v1.json`, sha256 `14026c000b3507ac1f92fa8fbf0c8f11c1d3816060468083eb80896c8ee6fae4`. The JSON carries no build date (keys: version, population, n_businesses, stats); population `research`, N = 10,000.
- Commits that touched it (1):
  - `4442e94` author date 2026-09-17 09:51:02 +0300, commit date 2026-09-17 09:51:02 +0300: Baseline: repository state before the Saudi national source calibration SOP (grafted onto origin/main; tree identical to local fe9ec4a)
- Calibration commits that changed the generator afterwards (git ancestry, which is reliable here; dates are not, see below):
  - `a4a7f40` (SAMA inputs, POS receipts at the measured ticket, thinning; author 2026-09-16 13:07:49 +0300, commit 2026-09-17 09:51:10 +0300): `4442e94` is an ancestor of it.
  - `01b5ebd` (full-scale re-run after the Saudi calibration; author 2026-09-16 13:14:32 +0300, commit 2026-09-17 09:51:10 +0300): `4442e94` is an ancestor of it.
  - `fa21be6` (Monsha'at sector mix and financing share; author 2026-09-17 09:30:02 +0300, commit 2026-09-17 09:51:11 +0300): `4442e94` is an ancestor of it.
- **Reading:** the file entered the repository in `4442e94` and was never changed afterwards, and `4442e94` comes before every calibration commit in the history. Its author date is later than two of the calibration commits' author dates only because it is a baseline commit grafted on 2026-09-17 to hold the pre-calibration tree; the topology, not the dates, is the evidence.

## Pinned against rebuilt-from-current (research population)

| Sector | Base feature | Pinned mean | Current mean | Pinned SD | Current SD |
|---|---|---|---|---|---|
| retail_trade | `3 inflow_regularity_score` | 0.8257 | 0.9975 | 0.1346 | 0.01964 |
| retail_trade | `11 cash_flow_volatility` | 4427 | 4741 | 5860 | 5757 |
| retail_trade | `13 days_negative_balance_90d` | 4.548 | 3.257 | 16.84 | 14.55 |
| retail_trade | `16 avg_daily_balance` | 1.69e+05 | 2.086e+05 | 3.01e+05 | 3.244e+05 |
| retail_trade | `21 counterparty_concentration_index` | 0.0375 | 0.1137 | 0.01149 | 0.03212 |
| food_beverage | `3 inflow_regularity_score` | 0.8451 | 0.9994 | 0.1329 | 0.009149 |
| food_beverage | `11 cash_flow_volatility` | 3131 | 3997 | 3623 | 4870 |
| food_beverage | `13 days_negative_balance_90d` | 4.743 | 3.862 | 16.8 | 15.26 |
| food_beverage | `16 avg_daily_balance` | 1.088e+05 | 1.443e+05 | 1.669e+05 | 2.162e+05 |
| food_beverage | `21 counterparty_concentration_index` | 0.03811 | 0.1246 | 0.01182 | 0.02908 |
| construction | `3 inflow_regularity_score` | 0.145 | 0.1444 | 0.1305 | 0.1332 |
| construction | `11 cash_flow_volatility` | 7.085e+04 | 3.608e+04 | 7.844e+04 | 4.073e+04 |
| construction | `13 days_negative_balance_90d` | 15.17 | 13.35 | 28.23 | 26.71 |
| construction | `16 avg_daily_balance` | 9.409e+05 | 4.692e+05 | 1.854e+06 | 8.458e+05 |
| construction | `21 counterparty_concentration_index` | 0.1625 | 0.162 | 0.06119 | 0.06057 |
| professional_services | `3 inflow_regularity_score` | 0.1985 | 0.1973 | 0.1303 | 0.13 |
| professional_services | `11 cash_flow_volatility` | 1.933e+04 | 1.959e+04 | 2.676e+04 | 2.27e+04 |
| professional_services | `13 days_negative_balance_90d` | 0.8679 | 0.504 | 6.281 | 3.898 |
| professional_services | `16 avg_daily_balance` | 4.961e+05 | 5.221e+05 | 8.032e+05 | 6.909e+05 |
| professional_services | `21 counterparty_concentration_index` | 0.1453 | 0.1423 | 0.0462 | 0.04565 |

## Features 55–59 on the current data (research, scored + partial_profile, `data`)

| Sector | Feature | N | Mean (expected 0) | SD (expected 1) |
|---|---|---|---|---|
| retail_trade | `55 sector_relative_regularity_z` | 4,204 | 1.28 | 0.15 |
| retail_trade | `56 sector_relative_volatility_z` | 4,204 | 0.05 | 0.98 |
| retail_trade | `57 sector_relative_days_negative_z` | 4,204 | -0.08 | 0.86 |
| retail_trade | `58 sector_relative_balance_z` | 4,204 | 0.13 | 1.08 |
| retail_trade | `59 sector_relative_concentration_z` | 4,204 | 6.63 | 2.79 |
| food_beverage | `55 sector_relative_regularity_z` | 1,555 | 1.16 | 0.07 |
| food_beverage | `56 sector_relative_volatility_z` | 1,555 | 0.24 | 1.34 |
| food_beverage | `57 sector_relative_days_negative_z` | 1,555 | -0.05 | 0.91 |
| food_beverage | `58 sector_relative_balance_z` | 1,555 | 0.21 | 1.30 |
| food_beverage | `59 sector_relative_concentration_z` | 1,555 | 7.32 | 2.46 |
| construction | `55 sector_relative_regularity_z` | 3,486 | -0.00 | 1.02 |
| construction | `56 sector_relative_volatility_z` | 3,486 | -0.44 | 0.52 |
| construction | `57 sector_relative_days_negative_z` | 3,486 | -0.06 | 0.95 |
| construction | `58 sector_relative_balance_z` | 3,486 | -0.25 | 0.46 |
| construction | `59 sector_relative_concentration_z` | 3,486 | -0.01 | 0.99 |
| professional_services | `55 sector_relative_regularity_z` | 250 | -0.01 | 1.00 |
| professional_services | `56 sector_relative_volatility_z` | 250 | 0.01 | 0.85 |
| professional_services | `57 sector_relative_days_negative_z` | 250 | -0.06 | 0.62 |
| professional_services | `58 sector_relative_balance_z` | 250 | 0.03 | 0.86 |
| professional_services | `59 sector_relative_concentration_z` | 250 | -0.06 | 0.99 |

Largest deviation of the mean: 59 sector_relative_concentration_z in food_beverage, 7.32. Largest deviation of the SD: 59 sector_relative_concentration_z in retail_trade, 2.79. Chart: `reference_stats_drift.png`; tables: `reference_stats_drift_*.csv`.

Nothing is rebuilt by this script. The rebuild is proposed in DECISIONS entry 35, after entry 30.
