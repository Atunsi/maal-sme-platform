# Sensitivity — `ungrounded.direct_debits.cancellation_prob_90d_by_latent_risk` (§13.4)

Central = config value `[0.02, 0.3]`; low `[0.02, 0.08]`; high `[0.02, 0.6]`. Research population; AUC vs default_label; ρ vs hidden latent risk. Class C: a RANGE, never a single number.

| Setting | Value | Feature | n | AUC vs default | ρ vs latent | non-zero share |
|---|---|---|---|---|---|---|
| low | `[0.02, 0.08]` | `mandate_cancellation_count_90d` | 10000 | 0.511 | +0.065 | 0.05 |
| central | `[0.02, 0.3]` | `mandate_cancellation_count_90d` | 10000 | 0.524 | +0.187 | 0.13 |
| high | `[0.02, 0.6]` | `mandate_cancellation_count_90d` | 10000 | 0.547 | +0.266 | 0.23 |

## Reading

- `mandate_cancellation_count_90d`: AUC range 0.511–0.547 (spread 0.036) → moves — the feature is sensitive to an unvalidated assumption; say so.
