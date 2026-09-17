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
profile_engine/       Features 1–69, evidence registry, /profile membership lists. [BUILT]
lenses/               credit · forecast · anomaly · zakat.      [stubs + contracts]
compliance/           Sharia screening, PDPL note.              [stub + contract]
api/                  The five read-paths (§8).                 [stub + contract]
data/                 Generated tables (+ data/berka/, data/berka_raw/). Git-ignored.
docs/                 The schema and the SOP.
sources/gastat/       Archived GASTAT publications (§21 source discipline).
sources/berka/        Archived Berka dataset + SOURCE.md (hash, access date, citation).
DECISIONS.md          Change-control log.
```

---

## Current state of the data (2026-09-15)

**Week 3 "Generator Accepted" gate: PASS** at full scale (N=10,000 research +
N=1,000 serving).

| Criterion | Result |
|---|---|
| 1. Sector-consistent balance sheets (§24, §30) | construction `implied_dso_days` ∈ [60,120] for all 2,103 scorable; professional `implied_dio_days` < 5 for all 2,401 |
| 2. Labels not a function of observables (§14) | ground-truth default rate construction 6.1% vs professional 1.8% (3.4×); in-sample AUC on observables 0.64; closest cross-label pair (0.15) closer than a typical neighbour (0.44) |
| 3. POS/inflow tracks Ramadan/Eid (§22) | demo business 10001: Ramadan 1.29× baseline, Eid 3.68× |

**§21 emergent macro validation: 4 findings, 0 retuned.** The generator's
sector revenue mix does not match GASTAT 2022 — medium-tier revenue share is
43.9% generated vs 34.3% published on the same four sectors, and the sector mix
is off materially (construction 60.6% vs 25.6%, retail 13.9% vs 60.0%). Per
§21 this is **reported as a finding, not corrected by tuning the generator to
hit the target** — doing so would convert an emergent validation into a
calibration input wearing a validation label. Root cause and resolution path:
[`DECISIONS.md` entry 6](DECISIONS.md).

**Do not put any cross-sector revenue total on a slide** (aggregate Zakat,
portfolio amounts) until that entry's step 3 lands.

## Real-data grounding (2026-09-16) — what is measured and what is judged

| | Value | Where |
|---|---|---|
| Berka archived | 4,500 accounts, 1,056,320 transactions, 682 loans, sha256 `dfd5e949…` | [`sources/berka/SOURCE.md`](sources/berka/SOURCE.md) |
| Phase 0 probes | 4 / 4 PASS: 6.4% of accounts go negative; partner key stable; counts match published; one account per client | [`DECISIONS.md` entry 7](DECISIONS.md) |
| Completeness gate | 4,500 / 4,500 accounts chain (0.21 CZK month-end tolerance) | `data/berka/build_summary.json` |
| §15 rule on real data | **excludes 100%** of accounts as written; scored under `external_real: 10` (3,947 / 4,500) | [entry 9](DECISIONS.md) |
| Evidence classes | **A 43, B 3, C 25** of 71 registry entries (69 numbered features + 18b, 62b) | [`eval/out/evidence_table.md`](eval/out/evidence_table.md) |
| Real vs synthetic AUC | synthetic **0.594 [0.567, 0.621]** (N=10,000, entity folds) vs Berka **0.901 [0.835, 0.955]** (secondary/censored, temporal holdout) / **0.740 [0.558, 0.902]** (primary, expanding folds) — **FINDING**, not retuned | [`eval/out/real_vs_synthetic.md`](eval/out/real_vs_synthetic.md), [entry 10](DECISIONS.md) |
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
- **Seasonality multipliers are placeholders** until β_Ramadan / β_Eid are
  estimated from mada bulletins by the §22 NNLS method.
- **Ramadan/Eid dates are a pinned table** in `config.yaml` (1445–1448), not a
  runtime Hijri library — reproducible from the file alone, but verify against
  the Umm al-Qura calendar before the defense.
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
- **43 of 69 features are class A** (computable on Berka against real outcomes);
  the rest are B or C and the membership list is published.
- Berka's `C` status is **censored**, not a confirmed non-default. Both label
  treatments are reported and the censoring is named.
- The real-versus-synthetic AUC gap (0.30, real side higher) is **reported as a
  finding**.
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
