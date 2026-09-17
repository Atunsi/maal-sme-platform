# Sensitivity — `ungrounded.obligations.balloon_share_of_loans` (§13.4)

Central = config value `0.2`; low `0.05`; high `0.5`. Research population; AUC vs default_label; ρ vs hidden latent risk. Class C: a RANGE, never a single number.

| Setting | Value | Feature | n | AUC vs default | ρ vs latent | non-zero share |
|---|---|---|---|---|---|---|
| low | `0.05` | `balloon_exposure_sar` | 10000 | 0.503 | -0.009 | 0.02 |
| central | `0.2` | `balloon_exposure_sar` | 10000 | 0.503 | +0.004 | 0.07 |
| high | `0.5` | `balloon_exposure_sar` | 10000 | 0.500 | +0.011 | 0.18 |

## Reading

- `balloon_exposure_sar`: AUC range 0.500–0.503 (spread 0.004) → stable — the conclusion does not depend on the invented number.
