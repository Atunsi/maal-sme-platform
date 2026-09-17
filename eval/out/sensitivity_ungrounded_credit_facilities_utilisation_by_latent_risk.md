# Sensitivity — `ungrounded.credit_facilities.utilisation_by_latent_risk` (§13.4)

Central = config value `[0.05, 0.85]`; low `[0.05, 0.4]`; high `[0.05, 0.99]`. Research population; AUC vs default_label; ρ vs hidden latent risk. Class C: a RANGE, never a single number.

| Setting | Value | Feature | n | AUC vs default | ρ vs latent | non-zero share |
|---|---|---|---|---|---|---|
| low | `[0.05, 0.4]` | `facility_utilisation` | 4010 | 0.643 | +0.728 | 0.38 |
| low | `[0.05, 0.4]` | `emergency_line_present` | 10000 | 0.486 | -0.006 | 0.08 |
| central | `[0.05, 0.85]` | `facility_utilisation` | 4010 | 0.677 | +0.925 | 0.39 |
| central | `[0.05, 0.85]` | `emergency_line_present` | 10000 | 0.490 | +0.039 | 0.09 |
| high | `[0.05, 0.99]` | `facility_utilisation` | 4010 | 0.680 | +0.944 | 0.39 |
| high | `[0.05, 0.99]` | `emergency_line_present` | 10000 | 0.503 | +0.149 | 0.12 |

## Reading

- `facility_utilisation`: AUC range 0.643–0.680 (spread 0.037) → moves — the feature is sensitive to an unvalidated assumption; say so.
- `emergency_line_present`: AUC range 0.486–0.503 (spread 0.017) → stable — the conclusion does not depend on the invented number.
