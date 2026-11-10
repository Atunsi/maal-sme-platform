# Entry 1b re-measured: features 11 and 56 inside construction

Data: `data`, research population, sector `construction`, engine status scored or partial_profile: **N = 3,486 businesses, 201 defaults** (5.77%). Spearman ρ with a percentile bootstrap 95% CI, 1,000 resamples of businesses, seed 0.

| # | Feature | Role | N | ρ vs observed default [95% CI] | ρ vs hidden risk score [95% CI] |
|---|---|---|---|---|---|
| 11 | `cash_flow_volatility` | claim (1b) | 3,486 | +0.025 [-0.011, +0.061] | +0.031 [-0.002, +0.064] |
| 56 | `sector_relative_volatility_z` | claim (1b) | 3,486 | +0.025 [-0.011, +0.060] | +0.031 [+0.000, +0.065] |
| 13 | `days_negative_balance_90d` | alternative named in 1b | 3,486 | +0.040 [+0.005, +0.072] | +0.299 [+0.269, +0.332] |
| 16 | `avg_daily_balance` | alternative named in 1b | 3,486 | -0.020 [-0.052, +0.013] | -0.250 [-0.283, -0.217] |
| 17 | `min_daily_balance_90d` | alternative named in 1b | 3,486 | -0.036 [-0.071, -0.004] | -0.309 [-0.339, -0.280] |
| 18 | `current_runway_days` | alternative named in 1b | 1,642 | -0.021 [-0.068, +0.027] | -0.264 [-0.309, -0.219] |
| 19 | `liquidity_trend_slope` | alternative named in 1b | 3,486 | -0.013 [-0.046, +0.021] | -0.087 [-0.121, -0.056] |
| 37 | `implied_dso_days` | alternative named in 1b | 3,486 | +0.030 [-0.001, +0.063] | +0.199 [+0.167, +0.230] |
| 38 | `implied_dio_days` | alternative named in 1b | 3,486 | +0.036 [+0.003, +0.067] | +0.503 [+0.478, +0.529] |
| 39 | `implied_dpo_days` | alternative named in 1b | 3,486 | +0.058 [+0.029, +0.087] | +0.480 [+0.453, +0.505] |
| 40 | `cash_conversion_cycle_days` | alternative named in 1b | 3,486 | +0.008 [-0.030, +0.040] | +0.007 [-0.025, +0.040] |

## Reading the table (generated from the numbers above)

- Feature 11 against the observed default: ρ = +0.025 [-0.011, +0.061]; against the hidden risk score: +0.031 [-0.002, +0.064]. The CI against default contains 0.
- Feature 56 is 11 standardised with one sector's mean and SD, a monotone transform inside a sector, so its ρ is identical by construction; its CI differs slightly only because it uses different bootstrap draws.
- Of the 9 alternatives entry 1b names, 4 have a CI against observed default that excludes 0: 13 (+0.040), 17 (-0.036), 38 (+0.036), 39 (+0.058).
- Against the observed default the correlations are small for every feature, partly because the label is a rare binary event; the hidden risk score is the cleaner comparison and is what entry 1 measured.

Table as CSV: `entry1b_check.csv`. Nothing is changed by this check.
