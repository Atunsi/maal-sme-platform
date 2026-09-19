# Per-feature transfer to real outcomes — the A1 / A2 split (SOP_Monshaat_Unblock B1)

Berka labelled accounts scored under coverage_days_90d ≥ 10: 615 (primary label set non-null: 209). Univariate AUC of the feature against the label, percentile bootstrap 1000 resamples, 95% CI. Bold = CI excludes 0.50 on that label set. Rule: **A2 = real_predictive** iff bold on at least one label set; otherwise **A1 = real_computed**. Assigned by this script, never by hand.

**Result: 22 of 43 class-A features are A2; 21 are A1.** An A1 feature is computed on real bank data and its performance is reported here — it is not claimed to predict.

| # | Feature | Berka primary (A vs B) | Berka secondary (A+C vs B+D) | subclass |
|---|---|---|---|---|
| 1 | `avg_monthly_inflow` | 0.463 [0.32, 0.61] ρ -0.04 (n=209/22) | 0.450 [0.36, 0.54] ρ -0.05 (n=615/59) | **A1** |
| 2 | `inflow_count_per_month` | **0.672 [0.56, 0.78]** ρ +0.19 (n=209/22) | **0.614 [0.54, 0.69]** ρ +0.12 (n=615/59) | **A2** |
| 3 | `inflow_regularity_score` | **0.346 [0.23, 0.48]** ρ -0.16 (n=209/22) | **0.394 [0.32, 0.46]** ρ -0.11 (n=614/58) | **A2** |
| 4 | `revenue_growth_rate_90d` | 0.474 [0.31, 0.65] ρ -0.03 (n=191/20) | 0.452 [0.36, 0.55] ρ -0.05 (n=579/57) | **A1** |
| 5 | `largest_single_source_ratio` | — (constant, n=66) | — (constant, n=192) | **A1** |
| 6 | `avg_monthly_outflow` | 0.467 [0.33, 0.61] ρ -0.03 (n=209/22) | 0.500 [0.42, 0.58] ρ -0.00 (n=615/59) | **A1** |
| 7 | `outflow_count_per_month` | **0.334 [0.21, 0.46]** ρ -0.18 (n=209/22) | 0.438 [0.36, 0.52] ρ -0.06 (n=615/59) | **A2** |
| 8 | `recurring_expense_ratio` | **0.299 [0.19, 0.43]** ρ -0.22 (n=209/22) | **0.295 [0.23, 0.37]** ρ -0.21 (n=615/59) | **A2** |
| 9 | `expense_growth_rate_90d` | 0.452 [0.30, 0.60] ρ -0.05 (n=191/20) | 0.496 [0.41, 0.58] ρ -0.00 (n=578/57) | **A1** |
| 10 | `top_expense_category_share` | **0.629 [0.53, 0.72]** ρ +0.14 (n=209/22) | **0.609 [0.54, 0.68]** ρ +0.11 (n=615/59) | **A2** |
| 11 | `cash_flow_volatility` | 0.491 [0.36, 0.63] ρ -0.01 (n=209/22) | 0.484 [0.40, 0.56] ρ -0.02 (n=615/59) | **A1** |
| 12 | `inflow_outflow_ratio` | 0.497 [0.36, 0.63] ρ -0.00 (n=209/22) | **0.413 [0.34, 0.50]** ρ -0.09 (n=615/59) | **A2** |
| 13 | `days_negative_balance_90d` | 0.568 [0.50, 0.66] ρ +0.35 (n=209/22) | **0.627 [0.57, 0.68]** ρ +0.49 (n=615/59) | **A2** |
| 14 | `overdraft_events_90d` | 0.568 [0.50, 0.65] ρ +0.35 (n=209/22) | **0.627 [0.57, 0.68]** ρ +0.49 (n=615/59) | **A2** |
| 15 | `volatility_index` | 0.602 [0.46, 0.74] ρ +0.11 (n=209/22) | **0.650 [0.56, 0.73]** ρ +0.15 (n=615/59) | **A2** |
| 16 | `avg_daily_balance` | **0.291 [0.17, 0.43]** ρ -0.22 (n=209/22) | **0.259 [0.18, 0.33]** ρ -0.25 (n=615/59) | **A2** |
| 17 | `min_daily_balance_90d` | **0.158 [0.06, 0.26]** ρ -0.36 (n=209/22) | **0.154 [0.10, 0.23]** ρ -0.35 (n=615/59) | **A2** |
| 18 | `current_runway_days` | 0.467 [0.31, 0.62] ρ -0.04 (n=99/12) | 0.387 [0.28, 0.50] ρ -0.12 (n=291/30) | **A1** |
| 18b | `runway_days_avg_balance` | 0.447 [0.30, 0.60] ρ -0.06 (n=99/12) | 0.395 [0.30, 0.51] ρ -0.11 (n=291/30) | **A1** |
| 19 | `liquidity_trend_slope` | 0.497 [0.36, 0.63] ρ -0.00 (n=209/22) | 0.488 [0.41, 0.57] ρ -0.01 (n=615/59) | **A1** |
| 20 | `unique_counterparties_count` | 0.466 [0.30, 0.64] ρ -0.03 (n=160/10) | 0.524 [0.42, 0.64] ρ +0.02 (n=473/25) | **A1** |
| 21 | `counterparty_concentration_index` | 0.540 [0.39, 0.70] ρ +0.03 (n=160/10) | 0.469 [0.35, 0.59] ρ -0.02 (n=473/25) | **A1** |
| 22 | `new_counterparty_ratio_30d` | **0.470 [0.45, 0.49]** ρ -0.06 (n=158/9) | **0.472 [0.46, 0.48]** ρ -0.05 (n=470/24) | **A2** |
| 26 | `governance_transparency_score` | — (< 20 rows, n=0) | — (< 20 rows, n=0) | **A1** |
| 32 | `coverage_days_90d` | **0.358 [0.25, 0.47]** ρ -0.15 (n=209/22) | 0.420 [0.35, 0.50] ρ -0.08 (n=615/59) | **A2** |
| 33 | `data_gap_ratio` | **0.631 [0.51, 0.74]** ρ +0.14 (n=209/22) | 0.560 [0.48, 0.64] ρ +0.06 (n=615/59) | **A2** |
| 41 | `financing_outflow_ratio` | — (constant, n=133) | — (constant, n=401) | **A1** |
| 42 | `installment_capacity_sar` | 0.522 [0.40, 0.65] ρ +0.03 (n=209/22) | 0.441 [0.37, 0.52] ρ -0.06 (n=615/59) | **A1** |
| 43 | `inflow_break_recency_days` | 0.420 [0.21, 0.64] ρ -0.08 (n=108/11) | 0.458 [0.36, 0.57] ρ -0.04 (n=333/33) | **A1** |
| 44 | `net_flow_autocorr_lag7` | 0.453 [0.34, 0.58] ρ -0.05 (n=209/22) | 0.446 [0.37, 0.52] ρ -0.05 (n=615/59) | **A1** |
| 45 | `counterparty_persistence_ratio` | — (constant, n=61) | — (constant, n=180) | **A1** |
| 46 | `circular_counterparty_count` | — (constant, n=160) | — (constant, n=473) | **A1** |
| 47 | `downside_semideviation_90d` | 0.515 [0.39, 0.64] ρ +0.02 (n=209/22) | 0.526 [0.45, 0.60] ρ +0.03 (n=615/59) | **A1** |
| 48 | `upside_semideviation_90d` | 0.466 [0.34, 0.60] ρ -0.04 (n=209/22) | 0.459 [0.38, 0.54] ρ -0.04 (n=615/59) | **A1** |
| 49 | `flow_asymmetry_ratio` | 0.624 [0.47, 0.76] ρ +0.13 (n=209/22) | **0.646 [0.57, 0.73]** ρ +0.15 (n=615/59) | **A2** |
| 50 | `revenue_shock_absorption_pct` | 0.444 [0.35, 0.53] ρ -0.12 (n=209/22) | **0.384 [0.32, 0.45]** ρ -0.21 (n=615/59) | **A2** |
| 51 | `fixed_obligation_coverage_months` | 0.236 [0.01, 0.55] ρ -0.19 (n=133/6) | **0.219 [0.08, 0.36]** ρ -0.19 (n=400/15) | **A2** |
| 52 | `liquidity_hazard_30d` | **0.670 [0.54, 0.79]** ρ +0.18 (n=209/22) | **0.759 [0.69, 0.82]** ρ +0.27 (n=615/59) | **A2** |
| 53 | `liquidity_hazard_60d` | **0.654 [0.52, 0.79]** ρ +0.16 (n=209/22) | **0.744 [0.68, 0.81]** ρ +0.25 (n=615/59) | **A2** |
| 54 | `liquidity_hazard_90d` | **0.645 [0.51, 0.77]** ρ +0.15 (n=209/22) | **0.735 [0.66, 0.81]** ρ +0.24 (n=615/59) | **A2** |
| 60 | `committed_monthly_outflow` | **0.333 [0.23, 0.46]** ρ -0.18 (n=209/22) | **0.332 [0.26, 0.41]** ρ -0.18 (n=615/59) | **A2** |
| 61 | `obligation_coverage_ratio` | 0.379 [0.08, 0.73] ρ -0.09 (n=127/6) | 0.376 [0.20, 0.55] ρ -0.09 (n=384/16) | **A1** |
| 68 | `max_consecutive_overdraft_days` | 0.568 [0.50, 0.65] ρ +0.35 (n=209/22) | **0.627 [0.57, 0.68]** ρ +0.49 (n=615/59) | **A2** |

## Reading the table (generated from the numbers above)

- **A1 (21):** 1 `avg_monthly_inflow`, 4 `revenue_growth_rate_90d`, 5 `largest_single_source_ratio`, 6 `avg_monthly_outflow`, 9 `expense_growth_rate_90d`, 11 `cash_flow_volatility`, 18 `current_runway_days`, 18b `runway_days_avg_balance`, 19 `liquidity_trend_slope`, 20 `unique_counterparties_count`, 21 `counterparty_concentration_index`, 26 `governance_transparency_score`, 41 `financing_outflow_ratio`, 42 `installment_capacity_sar`, 43 `inflow_break_recency_days`, 44 `net_flow_autocorr_lag7`, 45 `counterparty_persistence_ratio`, 46 `circular_counterparty_count`, 47 `downside_semideviation_90d`, 48 `upside_semideviation_90d`, 61 `obligation_coverage_ratio`. Computable on real data; not shown to predict real outcomes in this corpus. Of these, 5 could not be evaluated at all on Berka (constant or absent): 5 `largest_single_source_ratio`, 26 `governance_transparency_score`, 41 `financing_outflow_ratio`, 45 `counterparty_persistence_ratio`, 46 `circular_counterparty_count`.
- **Strongest A2 by folded AUC:** 17 `min_daily_balance_90d` 0.846; 51 `fixed_obligation_coverage_months` 0.781; 52 `liquidity_hazard_30d` 0.759; 53 `liquidity_hazard_60d` 0.744; 16 `avg_daily_balance` 0.741; 54 `liquidity_hazard_90d` 0.735.
- **A2 on a hair-thin interval (1):** 22 `new_counterparty_ratio_30d` (folded AUC 0.530) — the CI excludes 0.50 because the feature is near-constant (ties dominate), so the interval is narrow around a negligible effect. The rule is applied as written and the folded AUC is printed so a reader can see the effect size; a threshold on effect size would be a second, judgement-bearing rule and is not added here.
- Intervals are wide on the primary label set (22 defaults among scored accounts) and narrower on the secondary (59, censored).
- Both label sets are scored on the *eligible* population only; `eval/out/exclusion_selectivity.md` shows the excluded accounts default at 2.6–3.4× the retained rate.
- An A2 label is a univariate statement on 1990s Czech accounts. It says the feature carries signal on real outcomes somewhere; it does not say how much it adds to a model, nor that it transfers to Saudi SMEs.
