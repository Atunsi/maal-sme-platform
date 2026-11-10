# Data provenance for the evidence pack

- Repository head when checked: `812a67a`; Python 3.13.2.
- `config.yaml` sha256 `9d60db774d169931`; generator-parameter hash `a5b2bccab775fa71` (`calibration.check_config`).
- Seeds: research 42 (IDs 1–10000), serving 43 (IDs 10001–11000); quick mode keeps the first 300 per population.

| Folder | Generated tables written | Profiles written | Serving store written |
|---|---|---|---|
| `data` | 2026-09-17 09:21 | 2026-11-01 20:16 | 2026-11-01 20:17 |
| `data/quick` | 2026-11-01 19:51 | 2026-11-01 19:51 | — |

## `data` against `data/quick` on the 600 businesses they share

| Table | Rows compared | Result |
|---|---|---|
| businesses | 600 | **identical** |
| daily_aggregates | 108,000 | **identical** |
| balances_monthly | 3,000 | **identical** |
| labels | 600 | **identical** |
| obligations | 2,256 | **identical outside rank-driven columns (`next_date` 2, `status` 2, `status_change_date` 2 rows differ)** |
| facilities | 600 | **identical outside rank-driven columns (`facility_drawn` 246, `headroom` 246, `own_funds` 246 rows differ)** |
| transactions (per business and direction: row count, Σ amount, Σ sample_weight) | 664,780 | **identical** |

**Every table identical, apart from the population-rank-driven columns listed.** The quick folder was generated from the current code, so `data` is what the current generator produces for these 600 businesses, and, since generation is per business with the same seeds, for the rest of the population as well, outside the rank-driven columns.

Surrogate keys (`transaction_id`, `obligation_id`) are excluded because each run numbers them from 1. Facility utilisation and obligation cancellations are drawn from `generator/dimensions.py` `latent_rank()`, a percentile rank over every business in the run, so the same business gets different values in a 600-business run and an 11,000-business run. Those columns cannot be checked by this method, and they are not 'deterministic per business' in the sense CLAUDE.md states for the generator.
