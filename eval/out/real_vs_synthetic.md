# Real vs synthetic signal strength (Phase 4 — the deliverable)

§21 target `real_vs_synthetic_signal_strength`, tolerance_abs 0.1, status_on_fail `report_as_finding`. config.yaml sha256 `9d60db774d169931…` asserted unchanged across the run. Model class: median-impute → standardise → logistic regression, fitted separately per source (never on both). Comparison set: 25 real-computed scale-free features (18 of the 30 registered are A2, the rest A1; dropped at runtime: {'largest_single_source_ratio': 'berka: >50% null', 'current_runway_days': 'berka: >50% null', 'financing_outflow_ratio': 'berka: constant', 'counterparty_persistence_ratio': 'berka: >50% null', 'circular_counterparty_count': 'berka: constant'}). Bootstrap: 1000 resamples, 95% percentile CI; unified protocol: median and 2.5/97.5 percentiles over 20 repeats.

## Protocol × source matrix (SOP_Monshaat_Unblock B4)

| protocol | Synthetic (research, class B tables) | Berka primary (A vs B, finished contracts) | Berka secondary (A+C vs B+D, censored) |
|---|---|---|---|
| **Unified — repeated stratified group 5-fold × 20, out-of-fold pooled per repeat, median [2.5, 97.5 pct]** (HEADLINE) | **0.574 [0.568, 0.585]** (n 9495 / 449 defaults) | **0.721 [0.681, 0.770]** (n 209 / 22) | **0.859 [0.841, 0.880]** (n 615 / 59) |
| Temporal split at loan_date 1997-01-01 — single split, bootstrap CI (v1.0 Berka headline; kept as a **leakage check**) | — (one-window population; no temporal axis) | not evaluable (too few defaults in a split) (test 42 / 3) | 0.901 [0.835, 0.955] (test 328 / 25) |
| Expanding loan_date-quintile folds, bootstrap CI (secondary) | — | 0.740 [0.558, 0.902] (167 / 17) | 0.873 [0.789, 0.938] (492 / 39) |
| Contiguous-ID entity 5-fold, no shuffling, bootstrap CI (v1.0 synthetic headline; secondary) | 0.578 [0.550, 0.607] (n 9495 / 449) | — | — |

**Verdict against the pre-registered band: FINDING** — under one protocol on all three sources, |AUC_synth − AUC_berka| = **0.147** on the primary label set (0.574 vs 0.721; repeat bands do not overlap) and 0.285 on the secondary (0.859), vs tolerance 0.1. Per §8.3 a miss is reported as a finding; nothing is retuned.

**What the protocol changed.** The v1.0 headline compared a cross-validated synthetic AUC (0.578) with a single Berka temporal split (0.901 [0.835, 0.955], 25 test defaults) and reported a gap of 0.323. Under the same repeated stratified group k-fold on both sides the Berka primary estimate is 0.721 [0.681, 0.770] and the secondary 0.859 [0.841, 0.880]; the synthetic side is 0.574. The part of the v1.0 gap that was protocol rather than signal is the difference between the temporal-split row and the unified row on the Berka columns.

| Metric | Synthetic (research, N=10,000) | Berka primary | Berka secondary |
|---|---|---|---|
| Default rate | 0.047 | 0.105 | 0.096 |
| n businesses / n defaults (scored) | 9495 / 449 | 209 / 22 | 615 / 59 |
| Features in comparison set | 25 | 25 | 25 |
| Evidence class of the tables | B | A1/A2 (real) | A1/A2 (real) |
| Eligibility threshold (§15) | coverage ≥ 60 | coverage ≥ 10 (DECISIONS.md entry 9) | same |

## §15 exclusion selectivity (B4)

67 of 682 labelled accounts are excluded as insufficient_data (coverage_days_90d < 10 in the 90 days before loan.date). Default rate excluded vs retained — primary: 0.360 vs 0.105 (risk ratio 3.42, Fisher p = 0.0018, 29% of all primary defaults excluded); secondary: 0.254 vs 0.096 (risk ratio 2.64, p = 0.0007). **The exclusion is selective on the label**: every Berka AUC above is an estimate on the eligible population, from which the thinnest and riskiest accounts were removed by the eligibility rule rather than scored. Full table: `eval/out/exclusion_selectivity.md`.

## Per-feature transfer (univariate AUC vs label; > 0.5 = higher value → more default; Spearman ρ)

The A1/A2 split over all class-A features, with 1,000-resample CIs, is in `eval/out/feature_transfer.md`; this table covers the comparison set only.

| Feature | Class | Synthetic AUC [CI] | ρ | Berka primary AUC [CI] | ρ | Berka secondary AUC [CI] | ρ |
|---|---|---|---|---|---|---|---|
| `inflow_count_per_month` | A2 | 0.468 [0.44, 0.49] | -0.02 | 0.672 [0.54, 0.78] | +0.19 | 0.614 [0.54, 0.69] | +0.12 |
| `inflow_regularity_score` | A2 | 0.463 [0.44, 0.49] | -0.03 | 0.346 [0.23, 0.47] | -0.16 | 0.394 [0.33, 0.47] | -0.11 |
| `revenue_growth_rate_90d` | A1 | 0.498 [0.47, 0.53] | -0.00 | 0.474 [0.31, 0.64] | -0.03 | 0.452 [0.36, 0.54] | -0.05 |
| `outflow_count_per_month` | A2 | 0.549 [0.52, 0.58] | +0.04 | 0.334 [0.22, 0.46] | -0.18 | 0.438 [0.36, 0.51] | -0.06 |
| `recurring_expense_ratio` | A2 | 0.534 [0.51, 0.56] | +0.02 | 0.299 [0.19, 0.43] | -0.22 | 0.295 [0.23, 0.37] | -0.21 |
| `expense_growth_rate_90d` | A1 | 0.533 [0.50, 0.56] | +0.02 | 0.452 [0.31, 0.59] | -0.05 | 0.496 [0.41, 0.58] | -0.00 |
| `top_expense_category_share` | A2 | 0.461 [0.44, 0.49] | -0.03 | 0.629 [0.53, 0.72] | +0.14 | 0.609 [0.54, 0.68] | +0.11 |
| `inflow_outflow_ratio` | A2 | 0.454 [0.43, 0.48] | -0.03 | 0.497 [0.36, 0.64] | -0.00 | 0.413 [0.33, 0.50] | -0.09 |
| `days_negative_balance_90d` | A2 | 0.536 [0.52, 0.56] | +0.04 | 0.568 [0.50, 0.65] | +0.35 | 0.627 [0.57, 0.68] | +0.49 |
| `overdraft_events_90d` | A2 | 0.537 [0.52, 0.56] | +0.04 | 0.568 [0.50, 0.65] | +0.35 | 0.627 [0.57, 0.68] | +0.49 |
| `volatility_index` | A2 | 0.566 [0.54, 0.59] | +0.05 | 0.602 [0.47, 0.74] | +0.11 | 0.650 [0.56, 0.74] | +0.15 |
| `unique_counterparties_count` | A1 | 0.450 [0.43, 0.48] | -0.04 | 0.466 [0.32, 0.63] | -0.03 | 0.524 [0.42, 0.63] | +0.02 |
| `counterparty_concentration_index` | A1 | 0.539 [0.52, 0.57] | +0.03 | 0.540 [0.37, 0.70] | +0.03 | 0.469 [0.36, 0.58] | -0.02 |
| `new_counterparty_ratio_30d` | A2 | 0.470 [0.45, 0.49] | -0.02 | 0.470 [0.45, 0.49] | -0.06 | 0.472 [0.46, 0.48] | -0.05 |
| `coverage_days_90d` | A2 | 0.478 [0.45, 0.50] | -0.02 | 0.358 [0.25, 0.47] | -0.15 | 0.420 [0.35, 0.50] | -0.08 |
| `data_gap_ratio` | A2 | 0.511 [0.48, 0.53] | +0.01 | 0.631 [0.51, 0.75] | +0.14 | 0.560 [0.48, 0.63] | +0.06 |
| `inflow_break_recency_days` | A1 | 0.521 [0.49, 0.56] | +0.02 | 0.420 [0.22, 0.64] | -0.08 | 0.458 [0.36, 0.57] | -0.04 |
| `net_flow_autocorr_lag7` | A1 | 0.514 [0.48, 0.54] | +0.01 | 0.453 [0.35, 0.57] | -0.05 | 0.446 [0.37, 0.52] | -0.05 |
| `flow_asymmetry_ratio` | A2 | 0.496 [0.47, 0.52] | -0.00 | 0.624 [0.47, 0.77] | +0.13 | 0.646 [0.56, 0.72] | +0.15 |
| `revenue_shock_absorption_pct` | A2 | 0.447 [0.42, 0.47] | -0.04 | 0.444 [0.34, 0.53] | -0.12 | 0.384 [0.32, 0.44] | -0.21 |
| `fixed_obligation_coverage_months` | A2 | 0.427 [0.40, 0.46] | -0.05 | 0.236 [0.02, 0.61] | -0.19 | 0.219 [0.09, 0.37] | -0.19 |
| `liquidity_hazard_30d` | A2 | 0.552 [0.53, 0.57] | +0.05 | 0.670 [0.53, 0.80] | +0.18 | 0.759 [0.69, 0.82] | +0.27 |
| `liquidity_hazard_60d` | A2 | 0.559 [0.53, 0.58] | +0.05 | 0.654 [0.51, 0.78] | +0.16 | 0.744 [0.67, 0.81] | +0.25 |
| `liquidity_hazard_90d` | A2 | 0.567 [0.54, 0.59] | +0.05 | 0.645 [0.51, 0.77] | +0.15 | 0.735 [0.67, 0.80] | +0.24 |
| `obligation_coverage_ratio` | A1 | 0.473 [0.45, 0.50] | -0.02 | 0.379 [0.06, 0.72] | -0.09 | 0.376 [0.18, 0.56] | -0.09 |

## §8.4 findings

### Feature 8 — `recurring_expense_ratio`: inferred classification vs declared truth (Berka only)

Declared truth = outflows whose counterparty matches one of the account's standing orders (`order` table). Inference rule = counterparty paid ≥3 times in 180 days, median gap 25–35 days, amount CV < 0.15. On 615 scored accounts / 8,930 window outflows (24.3% declared recurring): transaction-level precision 1.00, recall 0.96; per-business ratio correlation 0.99, mean absolute error 0.007. This is the number synthetic data cannot give: on the generator, inference would be checked against the generator's own recurring categories.

### Feature 41 — `financing_outflow_ratio`: MCC path vs code path

Share of scored accounts with a non-zero value — Berka: counterparty-type path 0.0%, code path (`subfamily = LOAN`, from `k_symbol = UVER`) 0.0%; synthetic: 34.8% / 34.8% (paths agree on 100.0% of businesses).

Three structural facts, not tuning results: (1) **no counterparty MCC exists in either dataset** — the generator assigns `declared_mcc_code` to the business itself, Berka has none at all, so the schema's "financial-institution MCC" specification is unimplementable as written and `counterparty_type` has been standing in for it; on Berka that type is itself derived from the `UVER` code, so the two paths coincide by construction. (2) On Berka the point-in-time window ends the day before the loan, so **existing debt service is zero on every labelled account** — feature 41 cannot be validated against Berka outcomes and was pruned from the comparison set at runtime for that reason. (3) Debt service moves by transfer / standing order, which is exactly where a transaction code exists and an MCC does not. **Recommendation: re-specify feature 41 on the transaction code (`subfamily = LOAN`), raised as a §31 schema change (DECISIONS.md entry 10).**

## Honesty notes

- Berka is Czech retail/small-account data from 1993–1998. The claim is that the feature engineering transfers, not that the populations are equivalent.
- Berka `C` loans are censored; the primary set leads because it has no censoring, at the cost of 31 defaults in total (22 among scored accounts).
- Every Berka number above was computed under `coverage_days_90d ≥ 10`, not the schema's 60 (entry 9), on a population the rule selects toward lower risk (see §15 exclusion selectivity).
- The unified protocol's percentile band is the spread across 20 random fold assignments, not a sampling interval for the population AUC; with 22 primary defaults the fold-to-fold spread is itself the honest width.
- The temporal split is retained because it is the only protocol that cannot leak future information across the cut; it is not the headline because a single split with 25 test defaults is high-variance and typically optimistic.
- The synthetic side is a single 180-day snapshot; the temporal dimension of §13 does not apply to a one-window population.
