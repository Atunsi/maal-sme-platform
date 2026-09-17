# Sensitivity — `ungrounded.credit_facilities.emergency_line_appears_if_utilisation_above` (§13.4)

Central = config value `0.9`; low `0.7`; high `0.99`. Research population; AUC vs default_label; ρ vs hidden latent risk. Class C: a RANGE, never a single number.

| Setting | Value | Feature | n | AUC vs default | ρ vs latent | non-zero share |
|---|---|---|---|---|---|---|
| low | `0.7` | `emergency_line_present` | 10000 | 0.509 | +0.216 | 0.14 |
| central | `0.9` | `emergency_line_present` | 10000 | 0.490 | +0.039 | 0.09 |
| high | `0.99` | `emergency_line_present` | 10000 | 0.489 | +0.003 | 0.09 |

## Reading

- `emergency_line_present`: AUC range 0.489–0.509 (spread 0.021) → stable — the conclusion does not depend on the invented number.
