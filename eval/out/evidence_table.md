# Evidence table (SOP_Data_Grounding §13.5)

Generated from `profile_engine/evidence.py`. A class-C feature never carries a performance claim; it carries a functional
demonstration and a sensitivity range (`eval/out/sensitivity_*.md`). A metric over mixed inputs reports the weakest class present.

Class A is split by a mechanical rule (SOP_Monshaat_Unblock B1): **A2** iff the feature's univariate Berka AUC has a 1,000-resample bootstrap CI that excludes 0.50
on at least one label set (`eval/out/feature_transfer.md`, applied by `calibration.reclass_evidence` → `profile_engine/feature_transfer.json`); otherwise **A1**.
No feature claims prediction without that interval. **B-weak** is a measured parameter whose interval contains the null (B2).

| Class | n | Features | Claim made |
|---|---|---|---|
| **A2 — real_predictive** | 22 | 2 `inflow_count_per_month`, 3 `inflow_regularity_score`, 7 `outflow_count_per_month`, 8 `recurring_expense_ratio`, 10 `top_expense_category_share`, 12 `inflow_outflow_ratio`, 13 `days_negative_balance_90d`, 14 `overdraft_events_90d`, 15 `volatility_index`, 16 `avg_daily_balance`, 17 `min_daily_balance_90d`, 22 `new_counterparty_ratio_30d`, 32 `coverage_days_90d`, 33 `data_gap_ratio`, 49 `flow_asymmetry_ratio`, 50 `revenue_shock_absorption_pct`, 51 `fixed_obligation_coverage_months`, 52 `liquidity_hazard_30d`, 53 `liquidity_hazard_60d`, 54 `liquidity_hazard_90d`, 60 `committed_monthly_outflow`, 68 `max_consecutive_overdraft_days` | Computed on real bank data and predictive of real credit outcomes (univariate AUC with CI in eval/out/feature_transfer.md) |
| **A1 — real_computed** | 21 | 1 `avg_monthly_inflow`, 4 `revenue_growth_rate_90d`, 5 `largest_single_source_ratio`, 6 `avg_monthly_outflow`, 9 `expense_growth_rate_90d`, 11 `cash_flow_volatility`, 18 `current_runway_days`, 18b `runway_days_avg_balance`, 19 `liquidity_trend_slope`, 20 `unique_counterparties_count`, 21 `counterparty_concentration_index`, 26 `governance_transparency_score`, 41 `financing_outflow_ratio`, 42 `installment_capacity_sar`, 43 `inflow_break_recency_days`, 44 `net_flow_autocorr_lag7`, 45 `counterparty_persistence_ratio`, 46 `circular_counterparty_count`, 47 `downside_semideviation_90d`, 48 `upside_semideviation_90d`, 61 `obligation_coverage_ratio` | Computed on real bank data; predictive performance reported per feature, not assumed |
| **B — grounded_synthetic** | 3 | 62 `ocr_forward_3m`, 62b `ocr_forward_6m`, 63 `obligation_horizon_months` | Behaves correctly under measured parameters |
| **B-weak — grounded_synthetic_weak** | 0 |  | Behaves correctly under measured parameters whose interval contains no effect; the measurement is applied but not claimed as grounded |
| **C — demonstrated_only** | 25 | 23 `declared_mcc_code`, 24 `sharia_screen_status`, 25 `esg_proxy_score`, 27 `cash_and_equivalents_eom`, 28 `inventory_value_eom`, 29 `accounts_receivable_eom`, 30 `accounts_payable_eom`, 31 `short_term_liabilities_eom`, 34 `nisab_threshold_met`, 35 `hawl_completion_date`, 36 `ramadan_adjusted`, 37 `implied_dso_days`, 38 `implied_dio_days`, 39 `implied_dpo_days`, 40 `cash_conversion_cycle_days`, 55 `sector_relative_regularity_z`, 56 `sector_relative_volatility_z`, 57 `sector_relative_days_negative_z`, 58 `sector_relative_balance_z`, 59 `sector_relative_concentration_z`, 64 `mandate_cancellation_count_90d`, 65 `balloon_exposure_sar`, 66 `facility_utilisation`, 67 `headroom_days_of_burn`, 69 `emergency_line_present` | Implemented and functional; no public data exists to validate it |

## Basis per feature

| # | Feature | Class | Basis |
|---|---|---|---|
| 1 | `avg_monthly_inflow` | A1 | Berka: computed on real accounts, point-in-time before loan.date (absolute CZK; never in the comparison set) |
| 2 | `inflow_count_per_month` | A2 | Berka: computed on real accounts, point-in-time before loan.date |
| 3 | `inflow_regularity_score` | A2 | Berka: inflow interval CV on real accounts |
| 4 | `revenue_growth_rate_90d` | A1 | Berka: computed on real accounts, point-in-time before loan.date |
| 5 | `largest_single_source_ratio` | A1 | Berka: bank+account partner key (Probe 2 PASS); coverage share reported |
| 6 | `avg_monthly_outflow` | A1 | Berka: computed on real accounts, point-in-time before loan.date (absolute CZK; never in the comparison set) |
| 7 | `outflow_count_per_month` | A2 | Berka: computed on real accounts, point-in-time before loan.date |
| 8 | `recurring_expense_ratio` | A2 | Berka: declared `order` table vs inferred classification (§8.4) |
| 9 | `expense_growth_rate_90d` | A1 | Berka: computed on real accounts, point-in-time before loan.date |
| 10 | `top_expense_category_share` | A2 | Berka: category from k_symbol/operation codes |
| 11 | `cash_flow_volatility` | A1 | Berka: computed on real accounts, point-in-time before loan.date |
| 12 | `inflow_outflow_ratio` | A2 | Berka: computed on real accounts, point-in-time before loan.date |
| 13 | `days_negative_balance_90d` | A2 | Berka: 6.4% of accounts ever negative (Probe 1 PASS) |
| 14 | `overdraft_events_90d` | A2 | Berka: Probe 1 PASS |
| 15 | `volatility_index` | A2 | Berka: composite of 11–14; formula PROPOSED (DECISIONS.md entry 8) |
| 16 | `avg_daily_balance` | A2 | Berka: computed on real accounts, point-in-time before loan.date (absolute CZK) |
| 17 | `min_daily_balance_90d` | A2 | Berka: computed on real accounts, point-in-time before loan.date (absolute CZK) |
| 18 | `current_runway_days` | A1 | Berka: computed on real accounts, point-in-time before loan.date |
| 18b | `runway_days_avg_balance` | A1 | Berka: computed on real accounts, point-in-time before loan.date |
| 19 | `liquidity_trend_slope` | A1 | Berka: computed on real accounts, point-in-time before loan.date (currency/day; never in the comparison set) |
| 20 | `unique_counterparties_count` | A1 | Berka: Probe 2 PASS; coverage share reported |
| 21 | `counterparty_concentration_index` | A1 | Berka: Probe 2 PASS; coverage share reported |
| 22 | `new_counterparty_ratio_30d` | A2 | Berka: Probe 2 PASS; coverage share reported |
| 23 | `declared_mcc_code` | C | MCC assigned by the generator to every business; no public source pairs MCC coverage with SMEs (§12.3) |
| 24 | `sharia_screen_status` | C | Sharia screen depends on MCC; compliance module not built; no real MCC exists in any public dataset |
| 25 | `esg_proxy_score` | C | ESG proxy: no public source; module not built |
| 26 | `governance_transparency_score` | A1 | reuses features 3 and 11 (both A); weighting formula not yet signed off — not_implemented |
| 27 | `cash_and_equivalents_eom` | C | Balance sheet from §24 sector archetypes; author judgement, Berka has no balance sheet |
| 28 | `inventory_value_eom` | C | same as 27 |
| 29 | `accounts_receivable_eom` | C | same as 27 |
| 30 | `accounts_payable_eom` | C | same as 27 |
| 31 | `short_term_liabilities_eom` | C | same as 27 |
| 32 | `coverage_days_90d` | A2 | Berka: computed on real accounts, point-in-time before loan.date |
| 33 | `data_gap_ratio` | A2 | Berka: operating-day calendar is Sat/Sun for external_real (Czech), Fri/Sat for synthetic |
| 34 | `nisab_threshold_met` | C | nisab/hawl: zakat module not built; no source |
| 35 | `hawl_completion_date` | C | same as 34 |
| 36 | `ramadan_adjusted` | C | Ramadan calendar pinned for 1445–1448 only; Berka window (1993–98) not covered → not_available_in_source |
| 37 | `implied_dso_days` | C | implied DSO from §24 archetype receivables (author judgement) |
| 38 | `implied_dio_days` | C | same as 37 |
| 39 | `implied_dpo_days` | C | same as 37 |
| 40 | `cash_conversion_cycle_days` | C | same as 37 |
| 41 | `financing_outflow_ratio` | A1 | Berka: k_symbol=UVER loan payments (code path); MCC path does not exist on real data (§8.4) |
| 42 | `installment_capacity_sar` | A1 | derived from 1, 6, 49 — all A |
| 43 | `inflow_break_recency_days` | A1 | Berka: computed on real accounts, point-in-time before loan.date |
| 44 | `net_flow_autocorr_lag7` | A1 | Berka: computed on real accounts, point-in-time before loan.date |
| 45 | `counterparty_persistence_ratio` | A1 | Berka: Probe 2 PASS; coverage share reported |
| 46 | `circular_counterparty_count` | A1 | Berka: Probe 2 PASS; coverage share reported |
| 47 | `downside_semideviation_90d` | A1 | Berka: computed on real accounts, point-in-time before loan.date |
| 48 | `upside_semideviation_90d` | A1 | Berka: computed on real accounts, point-in-time before loan.date |
| 49 | `flow_asymmetry_ratio` | A2 | Berka: computed on real accounts, point-in-time before loan.date |
| 50 | `revenue_shock_absorption_pct` | A2 | Berka: fixed costs = declared standing-order outflow, variable = the rest |
| 51 | `fixed_obligation_coverage_months` | A2 | Berka: computed on real accounts, point-in-time before loan.date |
| 52 | `liquidity_hazard_30d` | A2 | Berka: block-bootstrap hazard over real net flows (naive trailing-mean model) |
| 53 | `liquidity_hazard_60d` | A2 | same as 52 |
| 54 | `liquidity_hazard_90d` | A2 | same as 52 |
| 55 | `sector_relative_regularity_z` | C | z-score against the SYNTHETIC N=10,000 sector reference table; Berka has no sector (§15.8) |
| 56 | `sector_relative_volatility_z` | C | same as 55 |
| 57 | `sector_relative_days_negative_z` | C | same as 55 |
| 58 | `sector_relative_balance_z` | C | same as 55 |
| 59 | `sector_relative_concentration_z` | C | same as 55 |
| 60 | `committed_monthly_outflow` | A2 | Berka: `order` table, declared standing orders (frequency measured from executions) |
| 61 | `obligation_coverage_ratio` | A1 | Berka: `order` table + real inflow |
| 62 | `ocr_forward_3m` | B | termination dates drawn from Berka loan.duration distribution (synthetic side only) |
| 62b | `ocr_forward_6m` | B | same as 62 |
| 63 | `obligation_horizon_months` | B | same as 62 |
| 64 | `mandate_cancellation_count_90d` | C | mandate cancellation: no public source; must correlate with latent distress in the generator (§10.2) |
| 65 | `balloon_exposure_sar` | C | balloon payments: no public source |
| 66 | `facility_utilisation` | C | credit facilities: no public source pairs facility state with outcomes (§12.1) |
| 67 | `headroom_days_of_burn` | C | same as 66 |
| 68 | `max_consecutive_overdraft_days` | A2 | Berka: longest run of consecutive negative-balance days on real accounts (Probe 1 PASS) |
| 69 | `emergency_line_present` | C | same as 66 |
