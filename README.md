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
| [`docs/Behavioral_Profile_Feature_Schema.md`](docs/Behavioral_Profile_Feature_Schema.md) | **v2.10 — the source of truth.** Feature contract, API read-paths, generator design, gate criteria. Its text defines features 1–59; the engine also computes 60–69, 18b and 62b (71 registry entries), and the credit lens reads 58. The schema edit that adds them is entry 33, still PROPOSED. |
| [`docs/SME_Platform_SOP.md`](docs/SME_Platform_SOP.md) | Working rules, roles, gates, build/cut order. **Defers to the schema wherever the two disagree.** |
| `SOP_Data_Grounding_And_Dimensions.md` (v2.0, team copy) | Real-data grounding (Berka) and honest completion of the ungrounded dimensions. Executed 2026-09-15/16; every phase's evidence is in `DECISIONS.md` entries 7–11 and `eval/out/`. |
| [`DECISIONS.md`](DECISIONS.md) | Change-control log (SOP §9). Every decision the schema doesn't pin down, plus every open question, with rationale and sign-off lines. |
| [`docs/NUMBERS.md`](docs/NUMBERS.md) | **Numbers register.** Every headline number with its population, protocol, source and what it may be quoted for — and the retired ones. Quote numbers from here; `python -m eval.check_numbers` fails if it drifts from the artifacts. |

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
| Eval harnesses (gate, §21 validation, held-out anomalies, real-vs-synthetic, sensitivity, evidence) | [`eval/`](eval/) | generator owner | **BUILT** — the §25 within-sector fairness audit has run and is **not met** (entry 43) |
| Profile engine — features 1–69 | [`profile_engine/`](profile_engine/) | profile engine owner | **BUILT** — source-agnostic; 24–26, 34–35 `not_implemented` (module owners); unit tests in `tests/test_profile_engine.py`. Since 2026-11-04: counterparty features read full-stream totals, not thinned rows (entry 30); §35 reference stats rebuilt and pinned as v2 (entry 35); 55–59 clipped at ±3 (entry 38) |
| Credit lens (Base Murabaha + SHAP) | [`lenses/credit/`](lenses/credit/) | credit lens owner | **v1, retrained 2026-11-07** — an L2 logistic regression (XGBoost was measured and lost, entry 49); CV AUC 0.591 (88.8% of ceiling); exact log-odds contributions. **§25 fairness audit not met** (entry 43). The customer explanation's first sentence is a sector effect for 834 of 943 serving businesses (entry 47, open) |
| Forecast lens | [`lenses/forecast/`](lenses/forecast/) | forecast + anomaly owner | **v2 built** — `naive90` chosen on validation, **beats the naive baseline** on an untouched test (0.323 vs 0.376; entry 27); holdout shock: warns later than the baseline (median 15 vs 27 days) with half the false alarms (entry 36). Prophet and ARIMA, named in the SOP, were evaluated and both lose to `naive90` (entry 56) |
| Anomaly lens | [`lenses/anomaly/`](lenses/anomaly/) | forecast + anomaly owner | **v1 + seasonal gate + exact repeat check** — held-out round-trip recall 0.93; same-day exact duplicates caught (0.66, designed-for); re-sent and vendor-record duplicates missed (entries 23, 36, 37) |
| Zakat lens | [`lenses/zakat/`](lenses/zakat/) | compliance owner | **v1 built** — both §17 branches demoed; nisab at the calculation month's gold price (World Bank monthly average × 3.75 SAR/USD, archived; July 2026 SAR 491.0625/g, nisab SAR 41,740.31; entry 54); no Sharia advisor review yet |
| Sharia screening, PDPL | [`compliance/`](compliance/) | compliance owner | **Screening v1 built** — feature 24, deterministic rule table (PROPOSED, not certified); 85.1% compliant / 14.9% soft (entry 26) |
| **Week 8 CLI** | [`pipeline/`](pipeline/) | — | **Built** — one JSON per business; `eval.week8_check` PASSED (43 objects, byte-identical re-run) |
| API read-paths | [`api/`](api/) | — | **v1 built** — five routes over a DuckDB serving store; **Week 7 latency test PASSED** (credit max 248 ms on all 1,000; anomaly max 1,028 ms; re-run 2026-11-09; entries 25–27). **Proposed additions** (entry 44): `GET /businesses`, `GET /scenarios`, `POST /scenarios/run`; the review cap in the anomaly response stopped (S9) |
| Next.js UI | [`web/`](web/) | open (entry 41) | **Type scale, header, surfaces and motion, PROPOSED** (entry 60: four text sizes, nothing under 14 px; a sticky header that condenses on scroll at 768 px and wider; three surface levels; page and theme crossfades through the View Transitions API, a sliding thumb on segmented controls, hover only where a pointer hovers, one focus ring; motion never changes a value and stops under reduced motion; nisab and rule-list status codes shown as words). **Record wording and no logo band, PROPOSED** (entry 59: the owner card is "About this result", each "how we decided" line names what assessed the data and makes no "no AI" claim; the drifting logo band is gone). **Plain-language decision record, PROPOSED** (entry 58: owners see a plain card and a reference number to quote; the technical record stays for admin, the public demo and the Compliance View; admins open a business from its reference). **Arabic complete and the Saudi riyal sign, PROPOSED** (entry 57: the backend sends an Arabic sibling of every template it shows, `text_ar` and the like, from fixed tables beside the English ones; plural forms, one term per concept, formal register for decision text, page titles; every amount shows U+20C1 from a self-hosted font, spoken as words to screen readers; preview at `/maal-sme-platform/preview/`). **Review fixes built, PROPOSED** (entry 45: defects B1 to B22, clarity C1 to C8, interactions I1 to I10, nisab plate for every unverified status, self-hosted fonts, visual snapshot tests; I6 waits for the store fix). **Enhancements built, PROPOSED** (entry 51: tour, print sheet, glossary, receipt tools, chart readouts, Arabic-Indic digits, phones and tablets, how-it-works, Play all, searchable admin list, custom scenarios), on the redesign (entry 42) — landing page, demo sign-in, admin list, overview, one page per lens, Compliance View, scenario diff sheet, light and dark themes, Arabic and English; API calls are queued until the store concurrency bug is fixed (entry 41). A phone design in its own stylesheet (`web/app/phone.css`), an installable app mode, and a static online snapshot for GitHub Pages (`web/scripts/build-static.mjs`). Own Week 10 gate. |

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
python -m eval.latent_ceiling       # §14 oracle ceiling + p_default spread (seconds, no economics)
python -m eval.run_section14        # §14 AUC vs rho + signal ladder + model baseline (~10 min)

# Week 8 path (DECISIONS entry 23)
python -m profile_engine.compute --dir data   # once: profiles for lens training
python -m lenses.credit.train                 # → lenses/credit/model_v1.json
python -m pipeline.week8 --demo               # one JSON per demo business (§9)
python -m eval.week8_check                    # contract + non-negotiables on real output
python -m pipeline.verify decisions.json      # re-run saved decisions; byte-identical or names the changed input
python -m eval.check_numbers                  # docs/NUMBERS.md matches every source artifact

# API (entry 25)
python -m api.store --dir data --out data/serving.duckdb   # serving store, once
uvicorn api.app:app --port 8000                           # needs MAAL_API_KEY in the environment
python -m eval.latency_test                               # §19 Week 7 test → eval/out/latency_week7.md
python -m pytest tests                                    # unit tests
python -m scenarios.run --list                            # hostile-demo menu (DECISIONS 29); --scenario NAME, --check
python -m eval.demo_exposure                  # serving-population counts behind the demo findings → eval/out/demo_exposure.md (~5 min)
python -m eval.anomaly_eval                   # §12 injected vs held-out → eval/out/anomaly_eval.md
python -m eval.forecast_backtest              # §10 model vs naive → eval/out/forecast_backtest.md
python -m eval.holdout_shock                  # §10/§16 shock lead time, neutral + Ramadan windows → eval/out/holdout_shock.{md,png} (entry 36, ~8 min)
python -m eval.anomaly_seasonal               # §16 anomaly false positives, seasonal gate off vs on → eval/out/anomaly_seasonal.md (entry 36.7, ~15 min)
python -m eval.repeat_variants                # repeat-payment variants: choose on seen types, test once → eval/out/repeat_variants.md (entry 37, ~40 min)

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
lenses/               credit · forecast · anomaly · zakat.      [v1 built, owners to take over]
compliance/           Sharia screening, PDPL note.              [screening v1 built]
api/                  The five read-paths (§8).                 [v1 built]
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
ticket (~33/day for a micro shop) and the `sales` rows of POS sectors are a 10% random
thinning (weight 10.0); `daily_aggregates` keeps the full counts and is authoritative.
Anything that sums inflow amounts from `transactions.csv` must weight by it. **Counterparty
features cannot be computed from the thinned rows**: features 20, 21, 22, 5 and 45 were biased
(DECISIONS entry 30). Since 2026-11-04 the generator also writes `counterparty_windows`,
per-customer totals taken before thinning; the engine reads those features from it and refuses
a thinned business that has none. `python -m eval.thinning_bias` shows the values before and after.

## Real-data grounding (2026-09-16) — what is measured and what is judged

| | Value | Where |
|---|---|---|
| Berka archived | 4,500 accounts, 1,056,320 transactions, 682 loans, sha256 `dfd5e949…` | [`sources/berka/SOURCE.md`](sources/berka/SOURCE.md) |
| Phase 0 probes | 4 / 4 PASS: 6.4% of accounts go negative; partner key stable; counts match published; one account per client | [`DECISIONS.md` entry 7](DECISIONS.md) |
| Completeness gate | 4,500 / 4,500 accounts chain (0.21 CZK month-end tolerance) | `data/berka/build_summary.json` |
| §15 rule on real data | **excludes 100%** of accounts as written; scored under `external_real: 10` (3,947 / 4,500) | [entry 9](DECISIONS.md) |
| Evidence classes | **A2 22, A1 21, B 3, C 25** of 71 registry entries (69 numbered features + 18b, 62b). A2 = computed on Berka *and* univariate AUC CI excludes 0.50 on ≥ 1 label set; A1 = computed on Berka, performance reported, not assumed | [`eval/out/evidence_table.md`](eval/out/evidence_table.md), [`eval/out/feature_transfer.md`](eval/out/feature_transfer.md), [entry 16](DECISIONS.md) |
| Real vs synthetic AUC | **one protocol on all three sources** (repeated stratified group 5-fold × 20): synthetic **0.570 [0.563, 0.580]** vs Berka primary **0.721 [0.681, 0.770]** / secondary **0.859 [0.841, 0.880]** — gap 0.15 (primary) / 0.29 (secondary), **FINDING**, not retuned. The v1.0 headline (0.578 vs a single temporal split 0.901, gap 0.32) mixed protocols and is kept as a labelled leakage check. The §15 exclusion is **selective**: excluded accounts default at 2.6–3.4× the retained rate | [`eval/out/real_vs_synthetic.md`](eval/out/real_vs_synthetic.md), [`eval/out/exclusion_selectivity.md`](eval/out/exclusion_selectivity.md), [entry 19](DECISIONS.md) |
| Class-C features | sensitivity ranges only, never a single number | `eval/out/sensitivity_*.md` |

The three-column evidence table is the honest answer to "you have no real
data": per feature, the project knows which of A / B / C it has, and says so.

## Open decisions needing sign-off

Full detail and sign-off lines in [`DECISIONS.md`](DECISIONS.md):

1. **Volatility-feature consequence** (entry 1b) — feature 11 / 56 carry
   near-zero signal *within construction* by an understood mechanism. The §25
   fairness audit should expect the signal through features 13, 16–19, 37–40.
   Profile engine owner signed 2026-11-01 (re-measured: `python -m eval.entry1b_check`);
   credit lens owner signed 2026-11-07. The audit has since run and is not met (entry 43).
2. ~~Sector scope~~ (entry 2) — **decided 2026-10-31: option A**, four sectors;
   logistics is a named cut in the report.
3. **`daily_aggregates` row count** (entry 5) — proposed schema edit. §7 says
   "~90 rows", but features 4, 9, 43 and 45 need a prior 90-day window, so a 90-row
   table makes four committed features uncomputable. Profile engine owner signed
   2026-11-01; team still to sign.
4. **GASTAT calibration** (entry 6) — blocked on pulling the establishment-count
   table.
5. **Grounding-SOP schema changes** (entry 8) — `external_real`, `evidence_class`,
   `subfamily`, nullable `counterparty_id`, `obligations.csv`, `balances_daily.csv`,
   `facilities.csv`, features 60–69, the feature-15 formula (wording corrected to match
   the code). Profile engine owner signed 2026-11-01; team still to sign.
6. **§15 threshold on real data** (entry 9) — 60 active days excludes every Berka
   account; `external_real: 10` is the proposed source-labelled threshold. Profile
   engine owner signed 2026-11-01; team still to sign.
7. **Feature 41 re-specification on the transaction code; feature 61 in the §31
   underwriting rule** (entry 10) — credit lens and profile engine owners signed
   (2026-11-07, 2026-11-05); team still to sign.
8. **Phase 5 ungrounded dimensions** (entry 11) — obligations not reconciled with
   the transaction stream by design; generator owner signed 2026-10-31, profile
   engine owner signed 2026-11-01 (66–69); team still to sign.
9. ~~Ticket-size re-pin~~ (entry 20.1) — **decided 2026-10-31: keep the archived
   12-Sep-2026 edition this term**; re-pin deferred to next term.
10. **A1 / A2 evidence split** (entry 16) — profile engine owner signed 2026-11-01;
    team still to sign the claim wording.
11. ~~POS thinning biases the counterparty features~~ (entry 30) — **fixed 2026-11-04** with
    `counterparty_windows`. Profile engine owner signed 2026-11-05; the generator owner and
    team boxes are still unticked.
12. **Feature 24 has a value and a null reason at once for `insufficient_data` businesses**
    (entry 31, PROPOSED) — 57 of 57 refused serving businesses through `/profile`.
    Compliance owner and profile engine owner.
13. **Where features 24–26, 34 and 35 are computed** (entry 32, PROPOSED, options only) —
    engine or pipeline. Profile engine owner, compliance owner and team.
14. **Schema text for features 60–69 and 62b** (entry 33, PROPOSED schema edit v2.9 → v2.10) —
    count 59 → 71, new sections numbered §38/§39, §31 "feature 45" → 49. Profile engine
    owner, generator owner and team.
15. **Entry 10 pre-registration** (entry 34, PROPOSED, implementation blocked) — features 41
    and 42 with k = 0.15; nothing implemented and no number computed until the credit lens
    owner agrees.
16. ~~Stale §35 reference statistics~~ (entry 35) — **rebuilt and pinned as v2**; the credit
    model was retrained on 2026-11-07 (entry 38).
17. ~~Two counts of `insufficient_data`~~ (entry 39) — both windows labelled in NUMBERS.
18. ~~Receipt hashes depend on the operating system~~ (entry 40) — **implemented 2026-11-10**
    in `00ae025`: canonical-LF hashing and LF line endings repo-wide; archived `sources/` kept
    byte-exact. Older Windows receipts name their config, lens-config and data hashes as changed.
19. **§25 fairness audit not met** (entry 43, FINDING) — the team line is still open.
20. ~~Scenario findings restated for the retrained model~~ (entry 46).
21. **Customer explanation states a sector effect** (entry 47) — **option A decided**: kept as
    is and stated in the demo; the "cannot shortcut" comment is withdrawn (`81f2c4e`).
22. ~~Zakat nisab valuation date~~ (entry 48) — **implemented** (entry 54, `185a57d`): the
    calculation month's World Bank monthly average; compliance owner to confirm the monthly
    average, Sharia advisor line open.
23. **Prophet and ARIMA** (entries 49, 56) — **evaluated 2026-11-10, protocol committed first; both lose to `naive90`** on validation and on a fresh population (median error 0.331 `naive90`, 0.348 ARIMA, 0.467 Prophet; N = 944). `naive90` stays. `python -m eval.forecast_prophet_arima report` rebuilds the table from the saved runs; re-running the fits needs `pip install statsmodels prophet`.
24. ~~Five class-A1 features have no usable value on Berka~~ (entry 50) — **option A** (classes
    kept, narrower headline), chosen by the generator owner; profile engine owner to confirm (entry 55).
25. ~~Schema text for 60–69 and 62b~~ (entry 33) — **applied: schema v2.10** (`74997c2`).

Entry 43 is the §25 fairness finding. The web UI's entries are 41, 42, 44, 45 and 51 (its
former 43, renumbered when the branch was merged on 2026-11-10).

**Sign-offs (2026-11-10, entry 53).** The generator owner ticked the remaining owner and team
lines of entries 23 to 51 on the other owners' behalf, on their verbal agreement; each is marked
"ticked by Ahmed Altunusi on his behalf", and written confirmation from each owner is pending. A
tick records agreement, not finished work (entry 53 lists what is still to do). Still open: the
three Sharia-advisor lines (entries 23, 26, 48), the team lines of entries 5 to 24, 34 and 43,
and entry 53's own confirmation line.

## Known gaps

- **Unit tests cover the lenses, API, Sharia rules, generator determinism and now the
  profile engine** (`python -m pytest tests`; engine: `tests/test_profile_engine.py` —
  the §15 states, §16 rules, no bare nulls, determinism, registry, no latent leak). They do
  not test each of the 71 feature formulas one by one; most are still exercised only
  through the integration harnesses. (The entry 30 `xfail` was replaced by passing tests
  when the bias was fixed, `tests/test_thinning.py`.)
- **Obligation rows are not reconciled with the transaction stream.** A synthetic
  direct-debit or scheduled row does not add collections to `transactions.csv`,
  because that would move gate numbers (§9.3). Committed outflow can therefore
  exceed observed outflow for some businesses.
- **The 0.1 tolerance on `real_vs_synthetic_signal_strength` was missed**: gap 0.152 on the
  Berka primary label (0.570 vs 0.721) and 0.289 on the secondary, one protocol on both sides
  (`eval/out/real_vs_synthetic.md`; the old "missed by 0.30" was the retired single-split comparison)
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
- **DuckDB backs only the API serving store** (`api/store.py`, `SET threads TO 1`,
  explicit `ORDER BY`, §37.2). The CLI and the eval harnesses still read CSV.

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
  and the growth features are A1 (entry 16). Of the 22, **14 hold on the confirmed-default
  label**; 8 hold only on the censored one. Of the 43, five are constant or empty on Berka
  (entry 50).
- Berka's `C` status is **censored**, not a confirmed non-default. Both label
  treatments are reported and the censoring is named.
- The real-versus-synthetic AUC gap (0.152 on the primary label, 0.289 on the censored
  secondary; real side higher) is **reported as a finding**.

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

### §14 sensitivity reporting (2026-09-20, post-calibration)

AUC as a function of `latent_to_observable_correlation`, entity-level 5-fold
OOF, research population (N=9,495 scorable, 449 defaults), all 71 engine
features:

| ρ | 0.6 | 0.7 | 0.8 | 0.9 |
|---|---|---|---|---|
| logistic OOF AUC | 0.5936 | 0.6040 | 0.6031 | 0.6087 |

**The curve is nearly flat** — spread 0.0151, about one standard error (0.0144), and
non-monotone. ρ is not the binding constraint; up to 92% of the
oracle-to-measured gap is the economics pipeline (re-run 2026-11-10 after entries 30, 35
and 38; entry 52).

**AUC ≥ 0.85 (§14's circularity threshold) is not reached and cannot be.** The
oracle ceiling — the AUC of the hidden latent itself, which no feature set can
exceed — is **0.6648**, and it is analytic: AUC ≈ Φ(sd(logit)/√2), an
expression in which ρ does not appear. An out-of-sample AUC at or above 0.85
on this data would be evidence of leakage, not skill; treat it as a tripwire.
Labels are identical at every ρ (asserted), so the sweep isolates observable
cleanliness against fixed ground truth. Detail in
[`DECISIONS.md`](DECISIONS.md) entry 21; the calibration decision it raises is
entry 22, which was settled before the credit lens trained (Path A, 2026-10-31). These
figures were re-measured on 2026-11-10, after entries 30, 35 and 38 (`docs/NUMBERS.md` §4).

