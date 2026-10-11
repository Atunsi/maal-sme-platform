# CLAUDE.md — Ma'al SME Financial Health Platform

CS499 capstone. Sharia-compliant financial-health platform for Saudi SMEs:
**one profile engine** → **three analytical lenses** (Credit, Forecast, Anomaly)
+ **two deterministic governance modules** (Sharia screening, Zakat).
Shared repo: https://github.com/Atunsi/maal-sme-platform — several people (and
their Claude sessions) push to `main`.

## Start every session here

1. `git fetch origin && git log --oneline HEAD..origin/main` — teammates push
   often. Pull/merge **before** editing, never after.
2. Read, in this order, only what the task needs:
   - [`docs/Behavioral_Profile_Feature_Schema.md`](docs/Behavioral_Profile_Feature_Schema.md) — **v2.9, the source of truth.** Cite sections as `§N`.
   - [`docs/SME_Platform_SOP.md`](docs/SME_Platform_SOP.md) — working rules. **Defers to the schema** wherever they disagree.
   - [`DECISIONS.md`](DECISIONS.md) — change-control log (entries 1–22+). Check it before re-deciding anything; most "open questions" are already answered or explicitly open there.
   - [`README.md`](README.md) — component status table, every run command, current results.
   - The `README.md` inside whatever component directory you're touching — each states its contract and the constraints it must not implement around.

## Non-negotiables (SOP §2) — stop and raise it, never "fix later"

1. Markup fixed at signing. **No `stressed_markup_pct`**, no field that varies `base_markup_pct`/`adjusted_markup_pct` from stress, forecast or generated output.
2. `late_penalty_policy: "charity_directed"`, always.
3. Zakat and `sharia_screen_status` are **100% deterministic** — no LLM anywhere near them.
4. **No generated text in the Compliance View.**
5. No `eligible` field on the Monsha'at/Kafalah navigator.
6. **No random shuffling of time-series data** for any split. CV is expanding-window (temporal) **and** entity-level (by `business_id`).
7. Exactly three analytical lenses. A fourth needs a schema change with sign-off.

## Methodology discipline — the project's credibility depends on these

- **Findings are reported, never retuned.** If a §21 emergent target misses, record it in DECISIONS; do not adjust config to make it pass. Correcting an *input* from a cited source is calibration; adjusting it to hit a *result* is retuning.
- **Decide calibration before the result exists.** e.g. DECISIONS entry 22 (latent spread) must be settled *before* the credit lens trains — after, it's retuning regardless of the reasoning.
- **Gates must be able to fail.** Assert on generated *output tables*, never on the generator's own parameters (an early gate was tautological for exactly this reason).
- **Measure, don't assume.** Tuned XGBoost was predicted to beat logistic; measured, it doesn't (entry 21). Record the measurement either way.
- **Every number carries its population and N.** Research = `business_id` 1–10,000 (training/CV); serving = 10,001–11,000 (demo slice). Disjoint seeds and ID ranges — never mix them.
- **Withdraw wrong claims explicitly** in DECISIONS, don't quietly drop them.
- Held-out anomaly types (`round_trip_transfer`, `duplicate_payment`) live **only** in `eval/heldout_anomalies.py` — never in `config.yaml` or `generator/`. `assert_held_out()` enforces it.
- Latent variables and labels never reach an engine-facing table (`schemas.assert_no_latent_leak`; anything prefixed `latent_` is covered).
- Archive any external source on download into `sources/` and pin the exact edition (§21).

## Change control (SOP §9)

A change that exists only in someone's module is a bug. Anything the schema
doesn't pin down → a numbered DECISIONS entry with status (`RECORDED` /
`PROPOSED` / `OPEN`), rationale, and a sign-off line naming the owners it
affects. Ask the owners who bear the **consequence** to sign off on the
consequence, not on generator internals. Take the next free entry number —
check the remote first; numbering collided once.

## Running things (always from the repo root, Python 3.13)

```bash
pip install -r requirements.txt
python -m generator.generate [--quick]      # → data/ (git-ignored). ~4.5 min full, --quick → data/quick/
python -m eval.gate_week3 [--dir data]      # Week 3 gate, exit 0 = PASS
python -m eval.validate_emergent            # §21, always exit 0 (findings are results)
python -m eval.latent_ceiling               # §14 ceiling/label spread, seconds, no economics
python -m eval.run_section14                # §14 AUC vs rho + ladder + baseline, ~10 min
python -m profile_engine.compute --dir data # features → data/profiles.csv
python -m ruff check .                      # must pass before committing
```

Full command list (Berka grounding, Saudi calibration, workstream B) is in README "Quick start".

## Traps we have already hit — check before repeating them

- **`profile_engine.registry.FEATURE_NAMES` is a dict `{id: name}`.** Iterate `.values()`. Iterating the dict yields integers that match no column and silently left a model with only categorical dummies — a plausible AUC measured on nothing. `eval/sweep_rho.numeric_features` now raises below 20 features.
- **Quick-mode gate failures are usually small-sample artifacts** (e.g. seasonality recovery at n≈108). Re-run the gate at full scale before concluding anything is broken — and before pushing.
- **Memory: the machine has ~16 GB, often ~6 GB free.** A full generation holds ~12.5M transactions with string counterparty IDs. Run the profile engine **once** per generation and drop `tables["transactions"]` after it; never run two full-scale jobs at once (contention also made generation look 10× slower than it is).
- **Generation is deterministic per business** — RNG keyed on `(population seed, business_id, purpose)`. Purpose 1's first four draws (mgmt, shock, label noise, Bernoulli) precede anything ρ-dependent, so labels are identical across ρ and the latents can be replicated without running the economics (`eval/latent_ceiling.py --verify`).
- **Untuned XGBoost memorises at this event rate** (~4.7% defaults; in-sample ≈0.99 vs OOF ≈0.56). In-sample AUC is an overfitting diagnostic, never evidence of signal or circularity.
- **Engine nulls:** features 24–26 and 34–35 are `not_implemented` (owned by compliance/Zakat) and all-null. Impute from the training fold only, with a 0.0 backstop.
- **Windows + Git Bash + OneDrive.** Paths contain `Ma'al` — always quote them. Large heredocs with non-ASCII (`§`, `ρ`, `—`) can break in Bash; use the Write/Edit tools for multi-line file content. A plot can be locked by a viewer/OneDrive (`ramadan_pos_check.png` → harness writes `_new.png`).
- **`data/` is git-ignored and regenerable.** Never commit generated tables — `transactions.csv` alone exceeds GitHub's 100 MB limit.

## Git

- Branch/back up before a non-trivial merge (`git branch pre-merge-backup`). Never force-push `main`.
- On a rejected push: fetch, inspect what landed (`git diff --stat HEAD...origin/main`), and check whether it invalidates numbers you're about to record before merging.
- Commit messages explain *why* and state what was verified. End with the `Co-Authored-By:` line the harness specifies.

## State as of 2026-10-11 (verify — this rots)

- **Built:** generator (Week 3 gate PASSED, full scale), profile engine (71 features), Berka real-data adapter, Saudi source calibration (SAMA, Monsha'at), eval harnesses incl. §14 ρ-sweep.
- **Not built (0 code):** credit, forecast, anomaly, Zakat lenses; compliance; API. These are the entire **Week 8 hard gate** (one CLI → one JSON: credit decision, forecast + crunch alert, anomaly flags, Zakat liability, `insufficient_data`). Missing it cancels all stretch goals (SOP §5).
- **Open decisions:** entry 2 (sector scope — overdue), 6 (GASTAT revenue mix), **22 (latent spread — before credit lens trains)**. Most other entries await cross-owner sign-off; none has one yet.
- **Owed:** §14 label-noise axis (`sweep_rho.py --param noise` — implemented, never run). No unit tests anywhere.
- Key measured numbers (entry 21): oracle ceiling AUC 0.665; best model logistic 0.596 (~90% of ceiling); AUC flat across ρ; logistic beats tuned XGBoost.
