# The pinned §35 sector reference statistics against the current data (DECISIONS entry 35)

File in use by the engine: `sector_reference_stats_v2.json`. v1 is kept for receipts made before entry 35.

## Provenance

### v1

- File: `profile_engine/sector_reference_stats_v1.json`, sha256 `14026c000b3507ac1f92fa8fbf0c8f11c1d3816060468083eb80896c8ee6fae4`. Keys: version, population, n_businesses, stats; version `v1`, population `research`, N = 10,000.
- Commits that touched it (1):
  - `4442e94` author date 2026-09-17 09:51:02 +0300, commit date 2026-09-17 09:51:02 +0300: Baseline: repository state before the Saudi national source calibration SOP (grafted onto origin/main; tree identical to local fe9ec4a)
- Calibration commits that changed the generator afterwards (git ancestry, which is reliable here; dates are not, see below):
  - `a4a7f40` (SAMA inputs, POS receipts at the measured ticket, thinning; author 2026-09-16 13:07:49 +0300, commit 2026-09-17 09:51:10 +0300): `4442e94` is an ancestor of it.
  - `01b5ebd` (full-scale re-run after the Saudi calibration; author 2026-09-16 13:14:32 +0300, commit 2026-09-17 09:51:10 +0300): `4442e94` is an ancestor of it.
  - `fa21be6` (Monsha'at sector mix and financing share; author 2026-09-17 09:30:02 +0300, commit 2026-09-17 09:51:11 +0300): `4442e94` is an ancestor of it.
- **Reading:** v1 entered the repository in `4442e94` and `4442e94` comes before every calibration commit in the history. Its author date is later than two of the calibration commits' author dates only because it is a baseline commit grafted on 2026-09-17 to hold the pre-calibration tree; the topology, not the dates, is the evidence.

### v2

- File: `profile_engine/sector_reference_stats_v2.json`, sha256 `e7d4beb01d7ffe2583a91a6cad2c53e124ee241391a09137a2e3609b05217f60`. Keys: version, population, n_businesses, stats; version `v2`, population `research`, N = 10,000.
- Commits that touched it (1):
  - `bbbc9d7` author date 2026-11-05 21:55:58 +0300, commit date 2026-11-05 21:55:58 +0300: Entry 35: pin sector_reference_stats_v2.json, built once at full scale

## Pinned against rebuilt-from-current (research population)

| Stats | Sector | Base feature | Pinned mean | Current mean | Pinned SD | Current SD |
|---|---|---|---|---|---|---|
| v1 | retail_trade | `3 inflow_regularity_score` | 0.8257 | 0.9975 | 0.1346 | 0.01964 |
| v1 | retail_trade | `11 cash_flow_volatility` | 4427 | 4741 | 5860 | 5757 |
| v1 | retail_trade | `13 days_negative_balance_90d` | 4.548 | 3.257 | 16.84 | 14.55 |
| v1 | retail_trade | `16 avg_daily_balance` | 1.69e+05 | 2.086e+05 | 3.01e+05 | 3.244e+05 |
| v1 | retail_trade | `21 counterparty_concentration_index` | 0.0375 | 0.03612 | 0.01149 | 0.01106 |
| v1 | food_beverage | `3 inflow_regularity_score` | 0.8451 | 0.9994 | 0.1329 | 0.009149 |
| v1 | food_beverage | `11 cash_flow_volatility` | 3131 | 3997 | 3623 | 4870 |
| v1 | food_beverage | `13 days_negative_balance_90d` | 4.743 | 3.862 | 16.8 | 15.26 |
| v1 | food_beverage | `16 avg_daily_balance` | 1.088e+05 | 1.443e+05 | 1.669e+05 | 2.162e+05 |
| v1 | food_beverage | `21 counterparty_concentration_index` | 0.03811 | 0.03698 | 0.01182 | 0.01114 |
| v1 | construction | `3 inflow_regularity_score` | 0.145 | 0.1444 | 0.1305 | 0.1332 |
| v1 | construction | `11 cash_flow_volatility` | 7.085e+04 | 3.608e+04 | 7.844e+04 | 4.073e+04 |
| v1 | construction | `13 days_negative_balance_90d` | 15.17 | 13.35 | 28.23 | 26.71 |
| v1 | construction | `16 avg_daily_balance` | 9.409e+05 | 4.692e+05 | 1.854e+06 | 8.458e+05 |
| v1 | construction | `21 counterparty_concentration_index` | 0.1625 | 0.162 | 0.06119 | 0.06057 |
| v1 | professional_services | `3 inflow_regularity_score` | 0.1985 | 0.1973 | 0.1303 | 0.13 |
| v1 | professional_services | `11 cash_flow_volatility` | 1.933e+04 | 1.959e+04 | 2.676e+04 | 2.27e+04 |
| v1 | professional_services | `13 days_negative_balance_90d` | 0.8679 | 0.504 | 6.281 | 3.898 |
| v1 | professional_services | `16 avg_daily_balance` | 4.961e+05 | 5.221e+05 | 8.032e+05 | 6.909e+05 |
| v1 | professional_services | `21 counterparty_concentration_index` | 0.1453 | 0.1423 | 0.0462 | 0.04565 |
| v2 | retail_trade | `3 inflow_regularity_score` | 0.9975 | 0.9975 | 0.01964 | 0.01964 |
| v2 | retail_trade | `11 cash_flow_volatility` | 4741 | 4741 | 5757 | 5757 |
| v2 | retail_trade | `13 days_negative_balance_90d` | 3.257 | 3.257 | 14.55 | 14.55 |
| v2 | retail_trade | `16 avg_daily_balance` | 2.086e+05 | 2.086e+05 | 3.244e+05 | 3.244e+05 |
| v2 | retail_trade | `21 counterparty_concentration_index` | 0.03612 | 0.03612 | 0.01106 | 0.01106 |
| v2 | food_beverage | `3 inflow_regularity_score` | 0.9994 | 0.9994 | 0.009149 | 0.009149 |
| v2 | food_beverage | `11 cash_flow_volatility` | 3997 | 3997 | 4870 | 4870 |
| v2 | food_beverage | `13 days_negative_balance_90d` | 3.862 | 3.862 | 15.26 | 15.26 |
| v2 | food_beverage | `16 avg_daily_balance` | 1.443e+05 | 1.443e+05 | 2.162e+05 | 2.162e+05 |
| v2 | food_beverage | `21 counterparty_concentration_index` | 0.03698 | 0.03698 | 0.01114 | 0.01114 |
| v2 | construction | `3 inflow_regularity_score` | 0.1444 | 0.1444 | 0.1332 | 0.1332 |
| v2 | construction | `11 cash_flow_volatility` | 3.608e+04 | 3.608e+04 | 4.073e+04 | 4.073e+04 |
| v2 | construction | `13 days_negative_balance_90d` | 13.35 | 13.35 | 26.71 | 26.71 |
| v2 | construction | `16 avg_daily_balance` | 4.692e+05 | 4.692e+05 | 8.458e+05 | 8.458e+05 |
| v2 | construction | `21 counterparty_concentration_index` | 0.162 | 0.162 | 0.06057 | 0.06057 |
| v2 | professional_services | `3 inflow_regularity_score` | 0.1973 | 0.1973 | 0.13 | 0.13 |
| v2 | professional_services | `11 cash_flow_volatility` | 1.959e+04 | 1.959e+04 | 2.27e+04 | 2.27e+04 |
| v2 | professional_services | `13 days_negative_balance_90d` | 0.504 | 0.504 | 3.898 | 3.898 |
| v2 | professional_services | `16 avg_daily_balance` | 5.221e+05 | 5.221e+05 | 6.909e+05 | 6.909e+05 |
| v2 | professional_services | `21 counterparty_concentration_index` | 0.1423 | 0.1423 | 0.04565 | 0.04565 |

## Features 55–59 on the current data (research, scored + partial_profile, `data`)

z recomputed from the base features in `profiles.csv` against each file's μ/σ.

| Sector | Feature | N | v1 mean | v1 SD | v2 mean | v2 SD |
|---|---|---|---|---|---|---|
| retail_trade | `55 sector_relative_regularity_z` | 4,204 | 1.28 | 0.15 | 0.00 | 1.00 |
| retail_trade | `56 sector_relative_volatility_z` | 4,204 | 0.05 | 0.98 | -0.00 | 1.00 |
| retail_trade | `57 sector_relative_days_negative_z` | 4,204 | -0.08 | 0.86 | 0.00 | 1.00 |
| retail_trade | `58 sector_relative_balance_z` | 4,204 | 0.13 | 1.08 | -0.00 | 1.00 |
| retail_trade | `59 sector_relative_concentration_z` | 4,204 | -0.12 | 0.96 | -0.00 | 1.00 |
| food_beverage | `55 sector_relative_regularity_z` | 1,555 | 1.16 | 0.07 | 0.00 | 1.00 |
| food_beverage | `56 sector_relative_volatility_z` | 1,555 | 0.24 | 1.34 | -0.00 | 1.00 |
| food_beverage | `57 sector_relative_days_negative_z` | 1,555 | -0.05 | 0.91 | -0.00 | 1.00 |
| food_beverage | `58 sector_relative_balance_z` | 1,555 | 0.21 | 1.30 | 0.00 | 1.00 |
| food_beverage | `59 sector_relative_concentration_z` | 1,555 | -0.10 | 0.94 | -0.00 | 1.00 |
| construction | `55 sector_relative_regularity_z` | 3,486 | -0.00 | 1.02 | -0.00 | 1.00 |
| construction | `56 sector_relative_volatility_z` | 3,486 | -0.44 | 0.52 | -0.00 | 1.00 |
| construction | `57 sector_relative_days_negative_z` | 3,486 | -0.06 | 0.95 | 0.00 | 1.00 |
| construction | `58 sector_relative_balance_z` | 3,486 | -0.25 | 0.46 | 0.00 | 1.00 |
| construction | `59 sector_relative_concentration_z` | 3,486 | -0.01 | 0.99 | -0.00 | 1.00 |
| professional_services | `55 sector_relative_regularity_z` | 250 | -0.01 | 1.00 | -0.00 | 1.00 |
| professional_services | `56 sector_relative_volatility_z` | 250 | 0.01 | 0.85 | 0.00 | 1.00 |
| professional_services | `57 sector_relative_days_negative_z` | 250 | -0.06 | 0.62 | 0.00 | 1.00 |
| professional_services | `58 sector_relative_balance_z` | 250 | 0.03 | 0.86 | -0.00 | 1.00 |
| professional_services | `59 sector_relative_concentration_z` | 250 | -0.06 | 0.99 | -0.00 | 1.00 |

- v1: largest deviation of the mean: 55 sector_relative_regularity_z in retail_trade, 1.28. Largest deviation of the SD: 55 sector_relative_regularity_z in food_beverage, 0.07.
- v2: largest deviation of the mean: 55 sector_relative_regularity_z in food_beverage, 0.00. Largest deviation of the SD: 57 sector_relative_days_negative_z in retail_trade, 1.00.
- Engine's own 55–59 columns vs the recomputation against v2: largest absolute difference 9.10e-15.

Chart: `reference_stats_drift.png`; tables: `reference_stats_drift_*.csv`. Nothing is rebuilt by this script.
