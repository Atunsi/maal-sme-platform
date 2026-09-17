# Ma'al — SME Financial Health Platform

A Sharia-compliant financial health platform for Saudi SMEs. **One profile
engine** computes a shared behavioural feature vector; **three analytical
lenses** (Credit, Forecast, Anomaly) and **two governance modules** (Sharia
screening, Zakat) read it independently.

> The reuse is the contribution — not any single feature. Adding a lens means
> registering a route against the existing engine; the engine itself never
> changes. — SOP §1

CS499 Capstone · 12-week term · **Week 8 is the hard gate**: one CLI script
ingesting the three CSVs and emitting a single JSON object with a credit
decision, cash-flow forecast + crunch alert, anomaly flags, Zakat liability,
and `insufficient_data` as a distinct state. No UI required to pass.

---

## Governing documents — read before writing code

| Document | Role |
|---|---|
| [`docs/Behavioral_Profile_Feature_Schema.md`](docs/Behavioral_Profile_Feature_Schema.md) | **v2.9 — the source of truth.** Feature contract (1–59), API read-paths, generator design, gate criteria. |
| [`docs/SME_Platform_SOP.md`](docs/SME_Platform_SOP.md) | Working rules, roles, gates, build/cut order. **Defers to the schema wherever the two disagree.** |
| `SOP_Data_Grounding_And_Dimensions.md` (v2.0, team copy) | Real-data grounding (Berka) and honest completion of the ungrounded dimensions. Executed 2026-09-15/16; every phase's evidence is in `DECISIONS.md` entries 7–11 and `eval/out/`. |
| [`DECISIONS.md`](DECISIONS.md) | Change-control log (SOP §9). Every decision the schema doesn't pin down, plus every open question, with rationale and sign-off lines. |

## Non-negotiables (SOP §2)

These are never traded away, at any point in the term. If you are about to
write code that breaks one, stop and raise it.

1. **Markup is fixed at signing.** No `stressed_markup_pct`, no field that
   varies `base_markup_pct` / `adjusted_markup_pct` from any stress, forecast,
   or generated output. Risk-tiering different businesses at different *fixed*
   rates is fine; repricing one business after signing is not.
2. **`late_penalty_policy: "charity_directed"`**, always.
3. **Zakat and `sharia_screen_status` stay 100% deterministic.** No LLM near
   either, ever.
4. **No generated text in the Compliance View** — it is the proof of
   non-black-box behaviour.
5. **No `eligible` field on the Monsha'at/Kafalah navigator.**
6. **No random shuffling of time-series data** for any train/test split.
7. **Exactly three analytical lenses.** A fourth needs a schema change with
   sign-off, not a new module.

---

## Component status

| Component | Directory | Owner (SOP §3) | Status |
|---|---|---|---|
| Synthetic data generator | [`generator/`](generator/) | generator owner | **BUILT** — Week 3 gate PASSED, re-run unchanged after Phase 5 dimensions (obligations, facilities, transaction sub-fields, MCC coverage) |
| Berka real-data adapter | [`berka_adapter/`](berka_adapter/) | generator owner | **BUILT** — Phases 0–4 of the grounding SOP accepted/run |
| Eval harnesses (gate, §21 validation, held-out anomalies, real-vs-synthetic, sensitivity, evidence) | [`eval/`](eval/) | generator owner | **BUILT** (credit-lens CV curves, fairness audit pending Week 6–7) |
| Profile engine — features 1–69 | [`profile_engine/`](profile_engine/) | profile engine owner | **BUILT** — source-agnostic; 24–26, 34–35 `not_implemented` (module owners) |
| Credit lens (Base Murabaha + SHAP) | [`lenses/credit/`](lenses/credit/) | credit lens owner | Not built — Week 5, SHAP Week 7 |
| Forecast lens | [`lenses/forecast/`](lenses/forecast/) | forecast + anomaly owner | Not built — Week 5 |
| Anomaly lens | [`lenses/anomaly/`](lenses/anomaly/) | forecast + anomaly owner | Not built — Week 6 |
| Zakat lens | [`lenses/zakat/`](lenses/zakat/) | compliance owner | Not built — Week 7 |
| Sharia screening, PDPL | [`compliance/`](compliance/) | compliance owner | Not built — Week 7 |
| API read-paths | [`api/`](api/) | — | Not built — Week 5–7, latency test Week 7 |
| Next.js UI | — | — | Post-Week-8, own Week 10 gate. Not in this repo yet. |

Each component directory has a README stating its contract, the schema sections
that govern it, and the constraints it must not implement around. **Read the
component README before writing code in that directory.**

---

## Quick start

```bash
pip install -r requirements.txt     # Python 3.13; versions pinned

python -m generator.generate        # generate all tables → data/  (~3 min at full scale)
python -m eval.gate_week3           # Week 3 gate: exit 0 = PASS, 1 = FAIL
python -m eval.validate_emergent    # §21 macro validation (always exit 0 — findings are results)
python -m eval.heldout_anomalies    # self-test the §12 held-out anomaly injector
python -m eval.dimensions_check     # Phase 5 structural assertions (obligations terminate, cancellations ↔ distress, …)

python -m profile_engine.compute --dir data          # features 1–69 → data/profiles.csv (+ nulls, status, coverage)

# Real-data grounding (Berka — see berka_adapter/README.md). Raw data: unzip sources/berka/the-berka-dataset.zip into data/berka_raw/
python -m berka_adapter.probe                        # Phase 0 gate, writes nothing
python -m berka_adapter.build                        # Phase 1 → data/berka/
python -m profile_engine.compute --dir data/berka    # the same engine, unmodified
python -m eval.berka_coverage                        # Phase 2 → eval/out/berka_coverage.md
python -m eval.compare_real                          # Phase 4 → eval/out/real_vs_synthetic.md
python -m eval.sensitivity --all                     # §13.4 class-C ranges → eval/out/sensitivity_*.md
python -m eval.evidence_table                        # §13.5 → eval/out/evidence_table.md

# Saudi national source calibration (SOP_Saudi_Calibration_Sources — see calibration/README.md)
python -m calibration.probe_sources                  # Phase 0: archive SAMA tables + bulletin, assert quirks, probe Monsha'at
python -m calibration.monshaat_probe                 # Phase 1 / A2: period range 2019Q2–2021Q4, page sizes, pagination semantics
python -m calibration.monshaat_pull                  # Phase 1: register pull, three quarters → sources/monshaat/ (exit 2 only if nothing is served)
python -m calibration.sector_mix                     # Phase 1: ISIC → four sectors, rows summed, large tier excluded
python -m calibration.seasonality                    # Phase 2: §22 NNLS + weekly Eid window model → calibration/out/
python -m calibration.ticket_size                    # Phase 3
python -m calibration.holdout_validate               # Phase 3: 2024–2025 held out, never refitted
python -m calibration.credit_intensity               # Phase 4
python -m calibration.check_config                   # config.yaml == measured values (exit 1 on drift)
python -m calibration.write_report                   # Phase 6 → ../saudi_calibration_report.md (revision 2)

# SOP_Monshaat_Unblock Workstream B (report integrity; generator untouched)
python -m eval.feature_transfer                      # B1: per-feature Berka AUC + CI → eval/out/feature_transfer.*
python -m calibration.reclass_evidence               # B1 + B2: A1/A2 registry file and B/B-weak labels, mechanically (--check to verify)
python -m calibration.holdout_validate               # B3: PASS / BOUNDED / FAIL / NOT_APPLIED
python -m eval.compare_real                          # B4: one CV protocol on all three sources (--protocol temporal = v1.0)
python -m eval.exclusion_selectivity                 # B4: is the §15 exclusion selective on the label?
python -m calibration.ticket_size --all-editions     # B5: cross-edition mean and spread

python -m ruff check .              # §37.3
```

All commands run **from the repo root**. `--quick` on the generator produces a
300-business-per-population sample in `data/quick/` for fast iteration; pass
`--dir data/quick` to the harnesses to run against it.

**`data/` is git-ignored.** Run the generator after cloning — nothing
downstream works until you do.

## Repository layout

```
config.yaml           Every generative parameter (§12). Show this in the demo —
                      it is the difference between a tuned demo and a repeatable
                      instrument. Also holds the §21 emergent validation targets,
                      the `grounded_from_berka` (class B) and `ungrounded` (class C)
                      blocks, and the per-source §15 eligibility threshold.
generator/            The generator + Pandera schemas + Phase 5 dimensions. [BUILT]
berka_adapter/        PKDD'99 Berka → the same table contract.  [BUILT]
eval/                 Gates, validation, comparison, sensitivity harnesses; reports in eval/out/. [BUILT]
calibration/          Saudi national source calibration: SAMA POS seasonality, ticket sizes, credit,
                      Monsha'at register pull; measurements in calibration/out/. [BUILT]
profile_engine/       Features 1–69, evidence registry, /profile membership lists. [BUILT]
lenses/               credit · forecast · anomaly · zakat.      [stubs + contracts]
compliance/           Sharia screening, PDPL note.              [stub + contract]
api/                  The five read-paths (§8).                 [stub + contract]
data/                 Generated tables (+ data/berka/, data/berka_raw/). Git-ignored.
docs/                 The schema and the SOP.
sources/gastat/       Archived GASTAT publications (§21 source discipline).
sources/sama/         Archived SAMA POS / credit tables + weekly bulletin, each with .sha256 and .meta.json.
sources/monshaat/     Monsha'at Enterprises Statistics 2021Q4 / 2020Q4 / 2019Q4, each with .sha256 and .meta.json (DECISIONS.md 14).
sources/berka/        Archived Berka dataset + SOURCE.md (hash, access date, citation).
DECISIONS.md          Change-control log.
```

---

## Current state of the data (2026-09-17, after the Monsha'at register inputs)

**Week 3 "Generator Accepted" gate: PASS with one loud SKIP** at full scale (N=10,000
research + N=1,000 serving), re-run after the register-derived sector mix landed
(`eval/out/gate_week3_after_monshaat.txt`). The SKIP: professional services is 2.9% of the
population in the register (237 businesses, 3 defaults), below the §23 minimum cell, so the
sector-differential check is `insufficient_sample` rather than passed.

| Criterion | Result |
|---|---|
| 1. Sector-consistent balance sheets (§24, §30) | construction `implied_dso_days` 65.9 / 94.2 / 118.2 (min/median/max) for all 3,679 scorable; professional `implied_dio_days` max 3.39 for all 261 |
| 2. Labels not a function of observables (§14) | ground-truth default rate construction 5.7%, food 4.7%, retail 4.1%, professional 1.3% (n=237, 3 defaults → sector differential SKIPPED as `insufficient_sample`); in-sample AUC on observables 0.61; closest cross-label pair at least as close as a typical neighbour |
| 3. POS/inflow tracks Ramadan/Eid (§22) | population-level recovery of the **measured** multipliers: restaurants Ramadan 0.84 value / 0.72 count (down, as SAMA POS shows), Eid 1.62; retail Ramadan 1.33 / 1.11 — every measured window within ±0.04 of config |

**Saudi national source calibration (`SOP_Saudi_Calibration_Sources` v1.0, 2026-09-16, and
`SOP_Monshaat_Unblock_And_Report_Corrections` v2.0, 2026-09-17)** — report at
[`../saudi_calibration_report.md`](../saudi_calibration_report.md) (revision 2; copy in
`calibration/out/`), decisions in [`DECISIONS.md` entries 12–20](DECISIONS.md). Measured from
SAMA: Ramadan/Eid **value and count** multipliers for retail and F&B (the old placeholder had
food service *rising* 1.45× in Ramadan; it falls to 0.82×) — 9 of the 16 are class B, **7 are
B-weak** (interval contains 1.0; applied, not claimed as grounded) — and POS ticket sizes
(retail 61.5 SAR, restaurants 29.0 SAR against a config-implied 400 / 250). 2024 and 2025 held
out and never refitted: 12 PASS, 8 BOUNDED (the weekly-resolution Eid rows), 0 FAIL, 16
NOT_APPLIED. Measured from the **Monsha'at register (2021 Q4, the newest quarter the gateway
serves)**: sector count weights retail 0.450 / construction 0.360 / food 0.161 / professional
0.029 and the micro/small/medium split per sector (~75 / 23 / 2), class B; the v1.0
"blocked gateway" was a misdiagnosis (the run probed 2023–2026 against a 2019Q2–2021Q4
dataset; DECISIONS.md 14.1). Financing share is now sector-conditional (0.384 / 0.328 /
0.296 / 0.394): relative shape B, level 0.35 still judgement.

**§21 validation: 0 emergent findings; 6 input-consistency misses.** The revenue-share
metrics are *calibration-derived checks* (a closed-form function of sector weight × base
inflow × size scale — entry 12). With the count mix now sourced, the GASTAT gap (medium tier
19.7% vs 34.3% — it was 44.0% and too high before the register; construction 63.9% vs 25.6%
of revenue; sector TV distance 0.519 → 0.384) is what the two remaining unsourced inputs,
`base_monthly_inflow_sar` and `size_tier_scale`, imply. Only sourcing those moves it. The
genuinely emergent targets — days-negative shape, realised DSO vs archetype, Ramadan amplitude
recovered — all pass or are reported.

**Do not put any cross-sector revenue total on a slide** (aggregate Zakat,
portfolio amounts) until entry 6's step 3 lands.

**`transactions.csv` carries `sample_weight`.** POS receipts are generated at the measured
ticket (~33/day for a micro shop) and the `sales` rows of POS sectors are a 10% unbiased
thinning (weight 10.0); `daily_aggregates` keeps the full counts and is authoritative.
Anything that sums inflow amounts from `transactions.csv` must weight by it.

## Real-data grounding (2026-09-16) — what is measured and what is judged

| | Value | Where |
|---|---|---|
| Berka archived | 4,500 accounts, 1,056,320 transactions, 682 loans, sha256 `dfd5e949…` | [`sources/berka/SOURCE.md`](sources/berka/SOURCE.md) |
| Phase 0 probes | 4 / 4 PASS: 6.4% of accounts go negative; partner key stable; counts match published; one account per client | [`DECISIONS.md` entry 7](DECISIONS.md) |
| Completeness gate | 4,500 / 4,500 accounts chain (0.21 CZK month-end tolerance) | `data/berka/build_summary.json` |
| §15 rule on real data | **excludes 100%** of accounts as written; scored under `external_real: 10` (3,947 / 4,500) | [entry 9](DECISIONS.md) |
| Evidence classes | **A2 22, A1 21, B 3, C 25** of 71 registry entries (69 numbered features + 18b, 62b). A2 = computed on Berka *and* univariate AUC CI excludes 0.50 on ≥ 1 label set; A1 = computed on Berka, performance reported, not assumed | [`eval/out/evidence_table.md`](eval/out/evidence_table.md), [`eval/out/feature_transfer.md`](eval/out/feature_transfer.md), [entry 16](DECISIONS.md) |
| Real vs synthetic AUC | **one protocol on all three sources** (repeated stratified group 5-fold × 20): synthetic **0.574 [0.568, 0.585]** vs Berka primary **0.721 [0.681, 0.770]** / secondary **0.859 [0.841, 0.880]** — gap 0.15 (primary) / 0.29 (secondary), **FINDING**, not retuned. The v1.0 headline (0.578 vs a single temporal split 0.901, gap 0.32) mixed protocols and is kept as a labelled leakage check. The §15 exclusion is **selective**: excluded accounts default at 2.6–3.4× the retained rate | [`eval/out/real_vs_synthetic.md`](eval/out/real_vs_synthetic.md), [`eval/out/exclusion_selectivity.md`](eval/out/exclusion_selectivity.md), [entry 19](DECISIONS.md) |
| Class-C features | sensitivity ranges only, never a single number | `eval/out/sensitivity_*.md` |

The three-column evidence table is the honest answer to "you have no real
data": per feature, the project knows which of A / B / C it has, and says so.

## Open decisions needing sign-off

Full detail and sign-off lines in [`DECISIONS.md`](DECISIONS.md):

1. **Volatility-feature consequence** (entry 1b) — feature 11 / 56 carry
   near-zero signal *within construction* by an understood mechanism. The §25
   fairness audit should expect the signal through features 13, 16–19, 37–40.
   Needs credit lens + profile engine owner sign-off, because it changes their
   Week 11 audit expectations.
2. **Sector scope** (entry 2) — four sectors modelled, logistics excluded.
   Recommendation: keep four, name the cut in the report. Week-1-or-never.
3. **`daily_aggregates` row count** (entry 5) — proposed schema edit. §7 says
   "~90 rows", but features 4, 9 and 45 need a prior 90-day window, so a 90-row
   table makes three committed features uncomputable.
4. **GASTAT calibration** (entry 6) — blocked on pulling the establishment-count
   table.
5. **Grounding-SOP schema changes** (entry 8) — `external_real`, `evidence_class`,
   `subfamily`, nullable `counterparty_id`, `obligations.csv`, `balances_daily.csv`,
   `facilities.csv`, features 60–69, the proposed feature-15 formula.
6. **§15 threshold on real data** (entry 9) — 60 active days excludes every Berka
   account; `external_real: 10` is the proposed source-labelled threshold.
7. **Feature 41 re-specification on the transaction code; feature 61 in the §31
   underwriting rule** (entry 10) — credit lens + profile engine owners.
8. **Phase 5 ungrounded dimensions** (entry 11) — obligations not reconciled with
   the transaction stream by design; sign-off on the `ungrounded:` block.

## Known gaps

- **No unit tests.** The gate and validation harnesses are integration-level
  only (the no-look-ahead assertion in `eval/compare_real.py` self-tests with a
  deliberate violation; that is the only unit-style check). Week 11's
  full-system integration test (SOP §19) has nothing beneath it.
- **Obligation rows are not reconciled with the transaction stream.** A synthetic
  direct-debit or scheduled row does not add collections to `transactions.csv`,
  because that would move gate numbers (§9.3). Committed outflow can therefore
  exceed observed outflow for some businesses.
- **The 0.1 tolerance on `real_vs_synthetic_signal_strength` was missed by 0.30**
  in the direction of *more* real signal. The generator's ρ = 0.6 / σ = 0.2 is
  untouched; revisit only through a recorded §21 decision.
- **Seasonality is measured only for retail and F&B.** Construction and
  professional-services multipliers stay author judgement (class C): SAMA POS
  measures consumer card spend, not contractor or firm receipts.
- **Sector weights and tier splits are the 2021 Q4 register (class B); the financing
  level is still judgement.** The register is four years stale and the gateway serves
  nothing later; professional services is below the §23 minimum cell at N = 10,000
  (DECISIONS.md 14, 15).
- **Ramadan/Eid dates are a pinned table** in `config.yaml` (1445–1448), asserted
  against the Umm al-Qura converter by `calibration/hijri.py` (1448 was one day
  off and was corrected from the converter).
- **SAMA SME-specific NPL target is unregistered** pending the §21 Week-1 check
  that a citable published series exists at all. Drop the target rather than
  assert an untraceable number.
- **DuckDB is installed but unwired** (§37.2). When it is used for a receipted
  value, `SET threads TO 1` immediately after connecting.

## Honesty rules for the defense (SOP §10)

State these proactively — each is stronger volunteered than extracted.

- Results are labelled by data source. **Synthetic results are never presented
  as validated on real transactions.** Every row carries `data_source`.
- The demo population is **disjoint from training** — separate seed, separate ID
  range (research 1–10,000, serving 10,001–11,000), asserted by the gate.
- Every reported number carries its population. An AUC from N=10,000 and a
  response time from N=1,000 are both legitimate — only if labelled.
- Calibration targets are 2–3 years old due to GASTAT's publication lag. The
  claim is a match to the most recent published census, not to today's economy.
- The registered-SME population, our simulated-forward defaults, and bank NPL
  figures are **three different populations**. The comparison is directional.
- `ramadan_adjusted` is a coarse gate, not a magnitude adjustment.
- Emergent targets outside their pre-registered band are **reported as
  findings, never retuned**.
- Named scope cuts: geography sampling, logistics sector, penetration testing,
  encryption-at-rest, adversarial robustness, production key management.

Added by the real-data grounding SOP (§16):

- Berka is **Czech retail and small-account data from 1993–1998**, not Saudi SME
  data. The claim is that feature engineering transfers, not that the
  populations are equivalent.
- The real-data label set is small: **31 confirmed defaults** (A vs B) and 76
  including censored running loans. Every Berka number carries its interval.
- **43 of 69 features are computed on Berka** — but only **22 are A2** (univariate AUC
  CI excludes 0.50 on at least one label set); the other 21 are **A1**: computed on
  real data, performance reported, not claimed to predict. The counterparty family
  and the growth features are A1 (entry 16).
- Berka's `C` status is **censored**, not a confirmed non-default. Both label
  treatments are reported and the censoring is named.
- The real-versus-synthetic AUC gap (0.29, real side higher) is **reported as a
  finding**.

Added by the Saudi source calibration (2026-09-16):

- Ramadan/Eid seasonality is **measured from SAMA POS for retail and food service
  only** (class B, with confidence intervals in `config.yaml`); construction and
  professional-services seasonality remains author judgement (class C) because POS
  measures consumer card spend, not contractor or firm receipts.
- **Food service falls in Ramadan** (0.82× value, 0.70× count, down in every one of
  seven years) and spikes at Eid (1.66×). The biggest Eid effect in the data is
  **clothing** (β 1.90), which no generator sector isolates.
- **Sector weights and tier splits come from the Monsha'at register, 2021 Q4** (the
  dataset ends there; the v1.0 "unreachable" was a misdiagnosis). The register's split
  (~75 / 23 / 2) is less micro-skewed than Monsha'at's 2023 national 87.0 / 11.5 / 1.4 %.
  The financing shape is credit-by-activity ÷ SME count (2026 numerator, 2021
  denominator); bank credit by activity is total credit, not SME credit, and has no NPL
  field, so the level stays judgement.
- Ticket sizes are **one bulletin edition** (12 Sep 2026, four weeks); across four
  editions the spread is 19% (retail) and 23% (restaurants) of the mean. A re-pin to the
  cross-edition mean (63.2 / 31.1 SAR) is proposed, not applied (entry 20).
- **7 of the 16 measured seasonality parameters are B-weak** (retail pre-Ramadan and Eid,
  F&B pre-Ramadan, F&B count Eid): applied, with the CI in `config.yaml`, not claimed as
  grounded.
- 2024 and 2025 were **held out** and never refitted; the aggregate and per-sector
  Ramadan predictions land within ±0.10, the consumer building-materials line does not.
- **No public dataset contains direct debits, scheduled payments, or credit
  facilities.** These are class C, synthesised, reported with sensitivity ranges.
- MCC is coverage-limited per §12.3: only 90% of retail/F&B and 15–25% of
  construction/professional businesses carry one, so the compliance module has
  to fall back to the ISO 20022-style transaction code path.
- Berka has no sector, so the fairness audit could not be replicated on real data.
- One account per business is assumed on both sources; own-account transfers
  would inflate features 1 and 6 as phantom revenue and expense, and our data
  contains no such case by construction.
- The schema's 60-active-day eligibility rule excludes **every** real Berka
  account; real results use a source-labelled threshold of 10 (entry 9).
