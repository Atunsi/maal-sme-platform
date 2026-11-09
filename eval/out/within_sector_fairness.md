# Section 25 — Within-Sector Credit Lens Fairness Audit

## Methodology

- Eligible research businesses: **9,495**
- Sectors: **4**
- Trained model features: **58**
- Population: research, scored or partial_profile.
- Attribution: coefficient × standardized feature value.
- Mean absolute contribution measures feature impact.
- Contribution standard deviation measures variation within a sector.
- No retraining or modification of model predictions.

These are exact additive contributions for the frozen linear model,
rather than separately estimated SHAP values.
They sum with the intercept to reproduce the model logit.

## Sector-Level Calibration — Research Population

| Sector | Businesses | Defaults | Predicted default | Observed default | Difference (pp) |
|---|---:|---:|---:|---:|---:|
| construction | 3,486 | 201 | 5.82% | 5.77% | +0.06 |
| food_beverage | 1,555 | 74 | 4.52% | 4.76% | -0.24 |
| professional_services | 250 | 3 | 1.14% | 1.20% | -0.06 |
| retail_trade | 4,204 | 171 | 4.13% | 4.07% | +0.06 |

Research-population calibration is descriptive and is not
an independent holdout validation.

## Sector-Level Calibration — Serving Population

| Sector | Businesses | Defaults | Predicted default | Observed default | Difference (pp) |
|---|---:|---:|---:|---:|---:|
| construction | 360 | 25 | 5.64% | 6.94% | -1.31 |
| food_beverage | 148 | 5 | 4.61% | 3.38% | +1.23 |
| professional_services | 26 | 0 | 1.00% | 0.00% | +1.00 |
| retail_trade | 409 | 15 | 4.22% | 3.67% | +0.56 |

The serving population is separate from the research population.
Sector-level default counts are limited, so observed rates
are uncertain, particularly for professional services.
Calibration differences alone do not establish fairness.

## construction — Top 10 Features

Eligible businesses: **3,486**

| Rank | Feature ID | Feature | Mean absolute contribution | Within-sector SD |
|---|---|---|---:|---:|
| 1 | 3 | `inflow_regularity_score` | 1.58537 | 0.40696 |
| 2 | 15 | `volatility_index` | 0.53256 | 0.78756 |
| 3 | 6 | `avg_monthly_outflow` | 0.45357 | 0.43601 |
| 4 | 10 | `top_expense_category_share` | 0.43532 | 0.15043 |
| 5 | 55 | `sector_relative_regularity_z` | 0.30731 | 0.35813 |
| 6 | 39 | `implied_dpo_days` | 0.26366 | 0.13804 |
| 7 | 49 | `flow_asymmetry_ratio` | 0.23048 | 0.19649 |
| 8 | 52 | `liquidity_hazard_30d` | 0.22543 | 0.31174 |
| 9 | 53 | `liquidity_hazard_60d` | 0.20248 | 0.26439 |
| 10 | 60 | `committed_monthly_outflow` | 0.20048 | 0.18219 |

## food_beverage — Top 10 Features

Eligible businesses: **1,555**

| Rank | Feature ID | Feature | Mean absolute contribution | Within-sector SD |
|---|---|---|---:|---:|
| 1 | 3 | `inflow_regularity_score` | 1.02565 | 0.02795 |
| 2 | 6 | `avg_monthly_outflow` | 0.53098 | 0.42074 |
| 3 | 15 | `volatility_index` | 0.40441 | 0.44443 |
| 4 | 49 | `flow_asymmetry_ratio` | 0.26231 | 0.32988 |
| 5 | 60 | `committed_monthly_outflow` | 0.21759 | 0.18908 |
| 6 | 41 | `financing_outflow_ratio` | 0.18720 | 0.19721 |
| 7 | 10 | `top_expense_category_share` | 0.17265 | 0.17053 |
| 8 | 39 | `implied_dpo_days` | 0.16190 | 0.07878 |
| 9 | 52 | `liquidity_hazard_30d` | 0.13543 | 0.18472 |
| 10 | 53 | `liquidity_hazard_60d` | 0.12932 | 0.16617 |

## professional_services — Top 10 Features

Eligible businesses: **250**

| Rank | Feature ID | Feature | Mean absolute contribution | Within-sector SD |
|---|---|---|---:|---:|
| 1 | 3 | `inflow_regularity_score` | 1.42386 | 0.39775 |
| 2 | 10 | `top_expense_category_share` | 0.42643 | 0.14629 |
| 3 | 6 | `avg_monthly_outflow` | 0.39744 | 0.46130 |
| 4 | 39 | `implied_dpo_days` | 0.34051 | 0.03782 |
| 5 | 55 | `sector_relative_regularity_z` | 0.30341 | 0.36069 |
| 6 | 66 | `facility_utilisation` | 0.16816 | 0.24770 |
| 7 | 60 | `committed_monthly_outflow` | 0.15504 | 0.18627 |
| 8 | 49 | `flow_asymmetry_ratio` | 0.14270 | 0.16707 |
| 9 | 12 | `inflow_outflow_ratio` | 0.13453 | 0.12184 |
| 10 | 41 | `financing_outflow_ratio` | 0.12442 | 0.11652 |

## retail_trade — Top 10 Features

Eligible businesses: **4,204**

| Rank | Feature ID | Feature | Mean absolute contribution | Within-sector SD |
|---|---|---|---:|---:|
| 1 | 3 | `inflow_regularity_score` | 1.01989 | 0.05998 |
| 2 | 15 | `volatility_index` | 0.43180 | 0.42029 |
| 3 | 6 | `avg_monthly_outflow` | 0.42803 | 0.41287 |
| 4 | 10 | `top_expense_category_share` | 0.34867 | 0.17559 |
| 5 | 41 | `financing_outflow_ratio` | 0.22189 | 0.23926 |
| 6 | 49 | `flow_asymmetry_ratio` | 0.20524 | 0.27274 |
| 7 | 60 | `committed_monthly_outflow` | 0.18886 | 0.19123 |
| 8 | 39 | `implied_dpo_days` | 0.13705 | 0.08154 |
| 9 | 52 | `liquidity_hazard_30d` | 0.13142 | 0.17199 |
| 10 | 9 | `expense_growth_rate_90d` | 0.12979 | 0.14523 |

## Construction — Required Feature Comparison

| Feature ID | Feature | Impact rank | Variation rank | Mean absolute contribution |
|---|---|---:|---:|---:|
| 15 | `volatility_index` | 2 | 1 | 0.53256 |
| 55 | `sector_relative_regularity_z` | 5 | 4 | 0.30731 |
| 39 | `implied_dpo_days` | 6 | 18 | 0.26366 |
| 14 | `overdraft_events_90d` | 13 | 8 | 0.15832 |
| 56 | `sector_relative_volatility_z` | 15 | 13 | 0.12101 |
| 12 | `inflow_outflow_ratio` | 17 | 17 | 0.11037 |
| 13 | `days_negative_balance_90d` | 19 | 12 | 0.10814 |
| 58 | `sector_relative_balance_z` | 21 | 19 | 0.08775 |
| 17 | `min_daily_balance_90d` | 24 | 22 | 0.08036 |
| 37 | `implied_dso_days` | 26 | 35 | 0.07648 |
| 38 | `implied_dio_days` | 28 | 52 | 0.07139 |
| 11 | `cash_flow_volatility` | 32 | 20 | 0.06253 |
| 59 | `sector_relative_concentration_z` | 33 | 27 | 0.05865 |
| 18b | `runway_days_avg_balance` | 34 | 23 | 0.05311 |
| 57 | `sector_relative_days_negative_z` | 35 | 31 | 0.04093 |
| 16 | `avg_daily_balance` | 37 | 29 | 0.03438 |
| 18 | `current_runway_days` | 49 | 37 | 0.01409 |
| 40 | `cash_conversion_cycle_days` | 50 | 48 | 0.01285 |
| 19 | `liquidity_trend_slope` | 52 | 53 | 0.00945 |

## Section 25 — Audit Assessment

- Liquidity/working-capital features among construction's top 10: **2/10**.
- Sector-relative features among construction's top 10: **1/10**.

**Assessment: Not demonstrated / further review required.**

The Section 25 specification expects construction's
attributions to be dominated by liquidity-trend and
working-capital-resilience signals rather than sector proxies.
The feature rankings must be reviewed against that requirement.

The absence of an explicit sector-code coefficient does not
rule out indirect sector effects through financial features
or sector-relative reference statistics.

Sector-average calibration is supplementary evidence only.
It cannot establish that individual businesses are treated
fairly or that the Section 25 criterion has been satisfied.

## Limitations

- Data are synthetic and may not represent real lending populations.
- Research-population calibration is not independent validation.
- Small sector/default counts make some estimates uncertain.
- Correlated features can distribute attribution across signals.
- Contribution magnitude alone does not establish causation.
- Sector-relative features require additional proxy-risk review.
- This audit does not establish legal or Sharia compliance.
- No model parameters or credit decisions were changed.

## Output Files

- `within_sector_fairness.csv`: attribution results by sector.
- `within_sector_calibration.csv`: research calibration results.

