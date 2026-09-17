# Sensitivity — `ungrounded.direct_debits.share_of_businesses` (§13.4)

Central = config value `0.55`; low `0.25`; high `0.85`. Research population; AUC vs default_label; ρ vs hidden latent risk. Class C: a RANGE, never a single number.

| Setting | Value | Feature | n | AUC vs default | ρ vs latent | non-zero share |
|---|---|---|---|---|---|---|
| low | `0.25` | `committed_monthly_outflow` | 10000 | 0.535 | +0.041 | 1.00 |
| low | `0.25` | `obligation_coverage_ratio` | 10000 | 0.536 | +0.137 | 1.00 |
| low | `0.25` | `mandate_cancellation_count_90d` | 10000 | 0.511 | +0.117 | 0.06 |
| central | `0.55` | `committed_monthly_outflow` | 10000 | 0.533 | +0.032 | 1.00 |
| central | `0.55` | `obligation_coverage_ratio` | 10000 | 0.539 | +0.155 | 1.00 |
| central | `0.55` | `mandate_cancellation_count_90d` | 10000 | 0.524 | +0.187 | 0.13 |
| high | `0.85` | `committed_monthly_outflow` | 10000 | 0.528 | +0.031 | 1.00 |
| high | `0.85` | `obligation_coverage_ratio` | 10000 | 0.549 | +0.161 | 1.00 |
| high | `0.85` | `mandate_cancellation_count_90d` | 10000 | 0.535 | +0.243 | 0.21 |

## Reading

- `committed_monthly_outflow`: AUC range 0.528–0.535 (spread 0.007) → stable — the conclusion does not depend on the invented number.
- `obligation_coverage_ratio`: AUC range 0.536–0.549 (spread 0.014) → stable — the conclusion does not depend on the invented number.
- `mandate_cancellation_count_90d`: AUC range 0.511–0.535 (spread 0.024) → stable — the conclusion does not depend on the invented number.
