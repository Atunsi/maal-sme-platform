# Generator — BUILT, Week 3 gate PASSED

**Owner:** generator owner (SOP §3) · **Schema:** §7, §12, §14, §20, §22, §23, §24, §29

Produces the three tables every downstream component reads. All generative
parameters live in [`../config.yaml`](../config.yaml) — nothing is hard-coded
here (§12), so the config alone reproduces the dataset.

| File | Role |
|---|---|
| `generate.py` | The generator. Run `python -m generator.generate` from the repo root. |
| `schemas.py` | Pandera schemas (§37.1) for every engine-facing table; also enforces the §14 no-latent-leak rule. |

## Outputs (→ `data/`, git-ignored)

| Table | Schema | Consumed by |
|---|---|---|
| `transactions.csv` | §7 table 1 | anomaly lens; profile engine (via aggregates) |
| `daily_aggregates.csv` | §7 table 2 | **profile engine** — this is what `GET /profile` reads (§8) |
| `balances_monthly.csv` | §7 table 3 — features 27–31 | **Zakat lens only** (§7: separate profile, never merged into `/profile`) |
| `businesses.csv` | registry: sector, size tier, age tier, window, MCC | all |
| `labels.csv` | `default_label` per business | credit lens (training target) |
| `latents_hidden.csv` | §14 latents + `p_default` | **eval harness only — never a model input** |
| `injected_anomalies.csv` | ground truth for the *injected* anomaly types | anomaly lens eval (injected half only) |

## Contract the rest of the project depends on

- **No latent variable or label ever appears in an engine-facing table.** Enforced
  by `schemas.assert_no_latent_leak`, re-checked by the Week 3 gate.
- **Two disjoint populations** (§23): research `business_id` 1–10,000 (training,
  CV) and serving 10,001–11,000 (the demo slice). Separate seeds, disjoint ID
  ranges, asserted — never a subset.
- **Deterministic per business**: RNG is keyed on `(population seed,
  business_id)`, so a business reproduces identically regardless of what else
  is generated, and `--quick` output matches the full run for shared IDs.
- **`data_source` stamped on every row** at generation (§29).
- **POS receipts arrive at the SAMA-measured average ticket** (retail 61.5 SAR, restaurants
  29.0 SAR — `avg_inflow_ticket_sar`), so `daily_aggregates.inflow_count` is real POS
  frequency (~33/day for a micro shop). To bound `transactions.csv`, the `sales` rows of POS
  sectors are an unbiased 10% thinning carrying `sample_weight = 10.0`; every other row is 1.0
  and `daily_aggregates` stays authoritative (SOP_Saudi_Calibration §6.1, DECISIONS.md 13.6).
- **Ramadan/Eid multipliers are measured, value and count separately**, for retail and F&B
  (`seasonality_value_multiplier`, `seasonality_count_multiplier`, class B); construction and
  professional services keep judgement values labelled class C.
- Thin-file businesses (`coverage_days_90d < 60`) occur naturally from the
  sampled age tier (§15, §20) — ~1,200 of 11,000. They are the `insufficient_data`
  population the Week 8 gate must surface as a distinct state.

Design decisions not fully pinned down by the schema — and the known
miscalibration against GASTAT — are recorded in [`../DECISIONS.md`](../DECISIONS.md).
