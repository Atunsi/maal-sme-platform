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
| Synthetic data generator | [`generator/`](generator/) | generator owner | **BUILT** — Week 3 gate PASSED |
| Eval harnesses (gate, §21 validation, held-out anomalies) | [`eval/`](eval/) | generator owner | **BUILT** (Week 6–7 harnesses pending) |
| Profile engine — features 1–59 | [`profile_engine/`](profile_engine/) | profile engine owner | Not built — Week 3–4 |
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

python -m generator.generate        # generate all tables → data/  (~30-60s)
python -m eval.gate_week3           # Week 3 gate: exit 0 = PASS, 1 = FAIL
python -m eval.validate_emergent    # §21 macro validation (always exit 0 — findings are results)
python -m eval.heldout_anomalies    # self-test the §12 held-out anomaly injector

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
                      instrument. Also holds the §21 emergent validation targets.
generator/            The generator + Pandera schemas.          [BUILT]
eval/                 Gates and validation harnesses.           [BUILT]
profile_engine/       Features 1–59, the /profile route.        [stub + contract]
lenses/               credit · forecast · anomaly · zakat.      [stubs + contracts]
compliance/           Sharia screening, PDPL note.              [stub + contract]
api/                  The five read-paths (§8).                 [stub + contract]
data/                 Generated tables. Git-ignored — regenerate, don't commit.
docs/                 The schema and the SOP.
sources/gastat/       Archived GASTAT publications (§21 source discipline).
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

## Known gaps

- **No unit tests.** The gate and validation harnesses are integration-level
  only. Week 11's full-system integration test (SOP §19) has nothing beneath it.
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
