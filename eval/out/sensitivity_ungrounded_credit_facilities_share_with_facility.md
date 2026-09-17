# Sensitivity — `ungrounded.credit_facilities.share_with_facility` (§13.4)

Central = config value `0.4`; low `0.15`; high `0.7`. Research population; AUC vs default_label; ρ vs hidden latent risk. Class C: a RANGE, never a single number.

| Setting | Value | Feature | n | AUC vs default | ρ vs latent | non-zero share |
|---|---|---|---|---|---|---|
| low | `0.15` | `facility_utilisation` | 1548 | 0.638 | +0.924 | 0.15 |
| low | `0.15` | `emergency_line_present` | 10000 | 0.501 | +0.031 | 0.04 |
| central | `0.4` | `facility_utilisation` | 4010 | 0.677 | +0.925 | 0.39 |
| central | `0.4` | `emergency_line_present` | 10000 | 0.490 | +0.039 | 0.09 |
| high | `0.7` | `facility_utilisation` | 7055 | 0.664 | +0.925 | 0.69 |
| high | `0.7` | `emergency_line_present` | 10000 | 0.487 | +0.053 | 0.16 |

## Reading

- `facility_utilisation`: AUC range 0.638–0.677 (spread 0.040) → moves — the feature is sensitive to an unvalidated assumption; say so.
- `emergency_line_present`: AUC range 0.487–0.501 (spread 0.014) → stable — the conclusion does not depend on the invented number.
