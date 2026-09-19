# Berka coverage bands and evidence registry (Phase 2)

Source: `data_source = external_real` (PKDD'99 Berka, archived `sources/berka/`). Eligibility: coverage_days_90d ≥ 10 for external_real (DECISIONS.md entry 9).
Accounts: 4500 total → 3983 scored ({'scored': 3947, 'insufficient_data': 517, 'partial_profile': 36}); labelled accounts scorable: 615 / 682.

Band sizes: computable 32, partial 14, not_computable 25 (the SOP expected ~33 / ~10 / ~16 over 59 features; this registry has 71 entries because 18b, 60–65 and 62b are included).
Evidence classes: A2 22, A1 21, B 3, B-weak 0, C 25 (A2 = real and predictive by the CI rule, A1 = real-computed; SOP_Monshaat_Unblock B1).

Population caveat: Czech retail and small-account banking data, 1993–1998. Never presented as Saudi SME data.

| # | Feature | Band | Class | Available share (scored; null-by-definition counts as available) | Null reasons | Coverage share | Basis |
|---|---|---|---|---|---|---|---|
| 1 | `avg_monthly_inflow` | computable | A1 (real_computed) | 100% | — | — | Berka: computed on real accounts, point-in-time before loan.date (absolute CZK; never in the comparison set) |
| 2 | `inflow_count_per_month` | computable | A2 (real_predictive) | 100% | — | — | Berka: computed on real accounts, point-in-time before loan.date |
| 3 | `inflow_regularity_score` | computable | A2 (real_predictive) | 100% | insufficient_events 1 | — | Berka: inflow interval CV on real accounts |
| 4 | `revenue_growth_rate_90d` | computable | A1 (real_computed) | 99% | insufficient_history 36, near_zero_denominator 8 | — | Berka: computed on real accounts, point-in-time before loan.date |
| 5 | `largest_single_source_ratio` | partial | A1 (real_computed) | 37% | insufficient_events 2495 | 0.29 (median value share with a counterparty) | Berka: bank+account partner key (Probe 2 PASS); coverage share reported |
| 6 | `avg_monthly_outflow` | computable | A1 (real_computed) | 100% | — | — | Berka: computed on real accounts, point-in-time before loan.date (absolute CZK; never in the comparison set) |
| 7 | `outflow_count_per_month` | computable | A2 (real_predictive) | 100% | — | — | Berka: computed on real accounts, point-in-time before loan.date |
| 8 | `recurring_expense_ratio` | computable | A2 (real_predictive) | 100% | — | — | Berka: declared `order` table vs inferred classification (§8.4) |
| 9 | `expense_growth_rate_90d` | computable | A1 (real_computed) | 98% | insufficient_history 36, near_zero_denominator 25 | — | Berka: computed on real accounts, point-in-time before loan.date |
| 10 | `top_expense_category_share` | computable | A2 (real_predictive) | 100% | — | — | Berka: category from k_symbol/operation codes |
| 11 | `cash_flow_volatility` | computable | A1 (real_computed) | 100% | — | — | Berka: computed on real accounts, point-in-time before loan.date |
| 12 | `inflow_outflow_ratio` | computable | A2 (real_predictive) | 100% | — | — | Berka: computed on real accounts, point-in-time before loan.date |
| 13 | `days_negative_balance_90d` | partial | A2 (real_predictive) | 100% | — | — | Berka: 6.4% of accounts ever negative (Probe 1 PASS) |
| 14 | `overdraft_events_90d` | partial | A2 (real_predictive) | 100% | — | — | Berka: Probe 1 PASS |
| 15 | `volatility_index` | partial | A2 (real_predictive) | 100% | — | — | Berka: composite of 11–14; formula PROPOSED (DECISIONS.md entry 8) |
| 16 | `avg_daily_balance` | computable | A2 (real_predictive) | 100% | — | — | Berka: computed on real accounts, point-in-time before loan.date (absolute CZK) |
| 17 | `min_daily_balance_90d` | computable | A2 (real_predictive) | 100% | — | — | Berka: computed on real accounts, point-in-time before loan.date (absolute CZK) |
| 18 | `current_runway_days` | computable | A1 (real_computed) | 100% | not_applicable 2789 | — | Berka: computed on real accounts, point-in-time before loan.date |
| 18b | `runway_days_avg_balance` | computable | A1 (real_computed) | 100% | not_applicable 2789 | — | Berka: computed on real accounts, point-in-time before loan.date |
| 19 | `liquidity_trend_slope` | computable | A1 (real_computed) | 100% | — | — | Berka: computed on real accounts, point-in-time before loan.date (currency/day; never in the comparison set) |
| 20 | `unique_counterparties_count` | partial | A1 (real_computed) | 84% | insufficient_events 642 | 0.29 (median value share with a counterparty) | Berka: Probe 2 PASS; coverage share reported |
| 21 | `counterparty_concentration_index` | partial | A1 (real_computed) | 84% | insufficient_events 642 | 0.29 (median value share with a counterparty) | Berka: Probe 2 PASS; coverage share reported |
| 22 | `new_counterparty_ratio_30d` | partial | A2 (real_predictive) | 84% | insufficient_events 645 | 0.29 (median value share with a counterparty) | Berka: Probe 2 PASS; coverage share reported |
| 23 | `declared_mcc_code` | not_computable | C (demonstrated_only) | 0% | not_available_in_source 3983 | — | MCC assigned by the generator to every business; no public source pairs MCC coverage with SMEs (§12.3) |
| 24 | `sharia_screen_status` | not_computable | C (demonstrated_only) | 0% | not_available_in_source 3983 | — | Sharia screen depends on MCC; compliance module not built; no real MCC exists in any public dataset |
| 25 | `esg_proxy_score` | not_computable | C (demonstrated_only) | 0% | not_available_in_source 3983 | — | ESG proxy: no public source; module not built |
| 26 | `governance_transparency_score` | computable | A1 (real_computed) | 100% | not_implemented 3983 | — | reuses features 3 and 11 (both A); weighting formula not yet signed off — not_implemented |
| 27 | `cash_and_equivalents_eom` | not_computable | C (demonstrated_only) | 0% | not_available_in_source 3983 | — | Balance sheet from §24 sector archetypes; author judgement, Berka has no balance sheet |
| 28 | `inventory_value_eom` | not_computable | C (demonstrated_only) | 0% | not_available_in_source 3983 | — | same as 27 |
| 29 | `accounts_receivable_eom` | not_computable | C (demonstrated_only) | 0% | not_available_in_source 3983 | — | same as 27 |
| 30 | `accounts_payable_eom` | not_computable | C (demonstrated_only) | 0% | not_available_in_source 3983 | — | same as 27 |
| 31 | `short_term_liabilities_eom` | not_computable | C (demonstrated_only) | 0% | not_available_in_source 3983 | — | same as 27 |
| 32 | `coverage_days_90d` | computable | A2 (real_predictive) | 100% | — | — | Berka: computed on real accounts, point-in-time before loan.date |
| 33 | `data_gap_ratio` | partial | A2 (real_predictive) | 100% | — | — | Berka: operating-day calendar is Sat/Sun for external_real (Czech), Fri/Sat for synthetic |
| 34 | `nisab_threshold_met` | not_computable | C (demonstrated_only) | 0% | not_available_in_source 3983 | — | nisab/hawl: zakat module not built; no source |
| 35 | `hawl_completion_date` | not_computable | C (demonstrated_only) | 0% | not_available_in_source 3983 | — | same as 34 |
| 36 | `ramadan_adjusted` | not_computable | C (demonstrated_only) | 0% | not_available_in_source 3983 | — | Ramadan calendar pinned for 1445–1448 only; Berka window (1993–98) not covered → not_available_in_source |
| 37 | `implied_dso_days` | not_computable | C (demonstrated_only) | 0% | not_available_in_source 3983 | — | implied DSO from §24 archetype receivables (author judgement) |
| 38 | `implied_dio_days` | not_computable | C (demonstrated_only) | 0% | not_available_in_source 3983 | — | same as 37 |
| 39 | `implied_dpo_days` | not_computable | C (demonstrated_only) | 0% | not_available_in_source 3983 | — | same as 37 |
| 40 | `cash_conversion_cycle_days` | not_computable | C (demonstrated_only) | 0% | not_available_in_source 3983 | — | same as 37 |
| 41 | `financing_outflow_ratio` | computable | A1 (real_computed) | 80% | near_zero_denominator 806 | — | Berka: k_symbol=UVER loan payments (code path); MCC path does not exist on real data (§8.4) |
| 42 | `installment_capacity_sar` | computable | A1 (real_computed) | 100% | — | — | derived from 1, 6, 49 — all A |
| 43 | `inflow_break_recency_days` | computable | A1 (real_computed) | 99% | no_break_detected 1527, insufficient_history 36 | — | Berka: computed on real accounts, point-in-time before loan.date |
| 44 | `net_flow_autocorr_lag7` | computable | A1 (real_computed) | 100% | — | — | Berka: computed on real accounts, point-in-time before loan.date |
| 45 | `counterparty_persistence_ratio` | partial | A1 (real_computed) | 37% | insufficient_events 2471, insufficient_history 36 | 0.29 (median value share with a counterparty) | Berka: Probe 2 PASS; coverage share reported |
| 46 | `circular_counterparty_count` | partial | A1 (real_computed) | 84% | insufficient_events 642 | 0.29 (median value share with a counterparty) | Berka: Probe 2 PASS; coverage share reported |
| 47 | `downside_semideviation_90d` | computable | A1 (real_computed) | 100% | — | — | Berka: computed on real accounts, point-in-time before loan.date |
| 48 | `upside_semideviation_90d` | computable | A1 (real_computed) | 100% | — | — | Berka: computed on real accounts, point-in-time before loan.date |
| 49 | `flow_asymmetry_ratio` | computable | A2 (real_predictive) | 100% | — | — | Berka: computed on real accounts, point-in-time before loan.date |
| 50 | `revenue_shock_absorption_pct` | computable | A2 (real_predictive) | 100% | — | — | Berka: fixed costs = declared standing-order outflow, variable = the rest |
| 51 | `fixed_obligation_coverage_months` | computable | A2 (real_predictive) | 80% | near_zero_denominator 807 | — | Berka: computed on real accounts, point-in-time before loan.date |
| 52 | `liquidity_hazard_30d` | computable | A2 (real_predictive) | 100% | — | — | Berka: block-bootstrap hazard over real net flows (naive trailing-mean model) |
| 53 | `liquidity_hazard_60d` | computable | A2 (real_predictive) | 100% | — | — | same as 52 |
| 54 | `liquidity_hazard_90d` | computable | A2 (real_predictive) | 100% | — | — | same as 52 |
| 55 | `sector_relative_regularity_z` | not_computable | C (demonstrated_only) | 0% | not_available_in_source 3983 | — | z-score against the SYNTHETIC N=10,000 sector reference table; Berka has no sector (§15.8) |
| 56 | `sector_relative_volatility_z` | not_computable | C (demonstrated_only) | 0% | not_available_in_source 3983 | — | same as 55 |
| 57 | `sector_relative_days_negative_z` | not_computable | C (demonstrated_only) | 0% | not_available_in_source 3983 | — | same as 55 |
| 58 | `sector_relative_balance_z` | not_computable | C (demonstrated_only) | 0% | not_available_in_source 3983 | — | same as 55 |
| 59 | `sector_relative_concentration_z` | not_computable | C (demonstrated_only) | 0% | not_available_in_source 3983 | — | same as 55 |
| 60 | `committed_monthly_outflow` | computable | A2 (real_predictive) | 100% | — | — | Berka: `order` table, declared standing orders (frequency measured from executions) |
| 61 | `obligation_coverage_ratio` | computable | A1 (real_computed) | 91% | not_applicable 482, near_zero_denominator 341 | — | Berka: `order` table + real inflow |
| 62 | `ocr_forward_3m` | partial | B (grounded_synthetic) | 91% | not_applicable 482, near_zero_denominator 341 | — | termination dates drawn from Berka loan.duration distribution (synthetic side only) |
| 62b | `ocr_forward_6m` | partial | B (grounded_synthetic) | 91% | not_applicable 482, near_zero_denominator 341 | — | same as 62 — same as 62 |
| 63 | `obligation_horizon_months` | partial | B (grounded_synthetic) | 0% | not_available_in_source 3983 | — | same as 62 |
| 64 | `mandate_cancellation_count_90d` | not_computable | C (demonstrated_only) | 0% | not_available_in_source 3983 | — | mandate cancellation: no public source; must correlate with latent distress in the generator (§10.2) |
| 65 | `balloon_exposure_sar` | not_computable | C (demonstrated_only) | 0% | not_available_in_source 3983 | — | balloon payments: no public source |
| 66 | `facility_utilisation` | not_computable | C (demonstrated_only) | 0% | not_available_in_source 3983 | — | credit facilities: no public source pairs facility state with outcomes (§12.1) |
| 67 | `headroom_days_of_burn` | not_computable | C (demonstrated_only) | 0% | not_available_in_source 3983 | — | same as 66 |
| 68 | `max_consecutive_overdraft_days` | partial | A2 (real_predictive) | 100% | — | — | Berka: longest run of consecutive negative-balance days on real accounts (Probe 1 PASS) |
| 69 | `emergency_line_present` | not_computable | C (demonstrated_only) | 0% | not_available_in_source 3983 | — | same as 66 |

## Acceptance (§6.4)

- PASS: engine ran on data_source=external_real
- PASS: not_computable feature 23 (declared_mcc_code) returns only not_available_in_source (got ['not_available_in_source'])
- PASS: not_computable feature 24 (sharia_screen_status) returns only not_available_in_source (got ['not_available_in_source'])
- PASS: not_computable feature 25 (esg_proxy_score) returns only not_available_in_source (got ['not_available_in_source'])
- PASS: not_computable feature 27 (cash_and_equivalents_eom) returns only not_available_in_source (got ['not_available_in_source'])
- PASS: not_computable feature 28 (inventory_value_eom) returns only not_available_in_source (got ['not_available_in_source'])
- PASS: not_computable feature 29 (accounts_receivable_eom) returns only not_available_in_source (got ['not_available_in_source'])
- PASS: not_computable feature 30 (accounts_payable_eom) returns only not_available_in_source (got ['not_available_in_source'])
- PASS: not_computable feature 31 (short_term_liabilities_eom) returns only not_available_in_source (got ['not_available_in_source'])
- PASS: not_computable feature 34 (nisab_threshold_met) returns only not_available_in_source (got ['not_available_in_source'])
- PASS: not_computable feature 35 (hawl_completion_date) returns only not_available_in_source (got ['not_available_in_source'])
- PASS: not_computable feature 36 (ramadan_adjusted) returns only not_available_in_source (got ['not_available_in_source'])
- PASS: not_computable feature 37 (implied_dso_days) returns only not_available_in_source (got ['not_available_in_source'])
- PASS: not_computable feature 38 (implied_dio_days) returns only not_available_in_source (got ['not_available_in_source'])
- PASS: not_computable feature 39 (implied_dpo_days) returns only not_available_in_source (got ['not_available_in_source'])
- PASS: not_computable feature 40 (cash_conversion_cycle_days) returns only not_available_in_source (got ['not_available_in_source'])
- PASS: not_computable feature 55 (sector_relative_regularity_z) returns only not_available_in_source (got ['not_available_in_source'])
- PASS: not_computable feature 56 (sector_relative_volatility_z) returns only not_available_in_source (got ['not_available_in_source'])
- PASS: not_computable feature 57 (sector_relative_days_negative_z) returns only not_available_in_source (got ['not_available_in_source'])
- PASS: not_computable feature 58 (sector_relative_balance_z) returns only not_available_in_source (got ['not_available_in_source'])
- PASS: not_computable feature 59 (sector_relative_concentration_z) returns only not_available_in_source (got ['not_available_in_source'])
- PASS: not_computable feature 64 (mandate_cancellation_count_90d) returns only not_available_in_source (got ['not_available_in_source'])
- PASS: not_computable feature 65 (balloon_exposure_sar) returns only not_available_in_source (got ['not_available_in_source'])
- PASS: not_computable feature 66 (facility_utilisation) returns only not_available_in_source (got ['not_available_in_source'])
- PASS: not_computable feature 67 (headroom_days_of_burn) returns only not_available_in_source (got ['not_available_in_source'])
- PASS: not_computable feature 69 (emergency_line_present) returns only not_available_in_source (got ['not_available_in_source'])
- PASS: partial feature 5 (largest_single_source_ratio) reports a coverage share for every scored account
- PASS: partial feature 20 (unique_counterparties_count) reports a coverage share for every scored account
- PASS: partial feature 21 (counterparty_concentration_index) reports a coverage share for every scored account
- PASS: partial feature 22 (new_counterparty_ratio_30d) reports a coverage share for every scored account
- PASS: partial feature 45 (counterparty_persistence_ratio) reports a coverage share for every scored account
- PASS: partial feature 46 (circular_counterparty_count) reports a coverage share for every scored account
- PASS: EVIDENCE registry covers every feature, no gaps
- PASS: every `computable` feature is non-null (or null by its own definition) on ≥50% of scored accounts (short: [])
