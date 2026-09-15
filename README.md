# Ma'al SME Financial Health Platform — Synthetic Data Generator

One profile engine, three lenses (Credit, Forecast, Anomaly) plus two
deterministic governance modules (Sharia screening, Zakat) — this repo
currently holds the **synthetic data generator and its Week 3 / §21
validation harnesses**, which is the component every downstream lens depends
on.

**Authority:** [`docs/Behavioral_Profile_Feature_Schema.md`](docs/Behavioral_Profile_Feature_Schema.md)
(v2.9) is the source of truth for the feature contract, the generator design,
and every gate criterion. [`docs/SME_Platform_SOP.md`](docs/SME_Platform_SOP.md)
governs day-to-day working rules and defers to the schema wherever the two
disagree. [`DECISIONS.md`](DECISIONS.md) is the change-control log (SOP §9) —
every generator design choice not fully pinned down by the schema, and every
open question, is recorded there with a rationale and a sign-off line.

## Status (2026-09-15)

**Week 3 "Generator Accepted" gate: PASS**, on the full population
(N=10,000 research + N=1,000 serving) — see [`gate_week3.py`](gate_week3.py).

| Gate criterion | Result |
|---|---|
| 1. Sector-consistent balance sheets (§24, §30) | construction `implied_dso_days` ∈ [60,120] for all 2,103 scorable businesses; professional `implied_dio_days` < 5 for all 2,401 |
| 2. Labels not a function of observables (§14) | ground-truth default rate: construction 6.1% vs professional 1.8% (ratio 3.4×); in-sample AUC on observables = 0.64; closest cross-label pair (dist 0.15) closer than a typical same-label neighbour (0.44) |
| 3. POS/inflow tracks Ramadan/Eid (§22) | demo business 10001: Ramadan inflow 1.3–1.5× baseline, Eid 2.2–4.4× |

**§21 emergent macro validation: 4 reported findings, 0 retuned.** The
generator's sector revenue mix does not yet match GASTAT 2022 (medium-tier
revenue share 43.9% generated vs. 34.3% published, on the same four sectors —
see [`validate_emergent.py`](validate_emergent.py) output and
[`DECISIONS.md` §6](DECISIONS.md#6-sector-revenue-mix-vs-gastat-2022--finding-reported-not-retuned-base-inflows-unsourced--open)
for the full diagnosis and resolution path). Per §21, this is reported as a
finding, not corrected by tuning the generator to hit the target.

**Open items needing a team decision before Week 4** (details and sign-off
lines in `DECISIONS.md`):
1. Downstream consequence of the volatility-feature redesign (§25 fairness
   audit expectations) — needs credit lens + profile engine owner sign-off.
2. Sector scope: four sectors modelled, logistics excluded — needs a recorded
   §9 decision (recommendation: keep four, name the cut).
3. `daily_aggregates.csv` row count — proposed schema edit (§7 vs. §12/§15
   conflict; features 4, 9, 45 need the full window, not "~90 rows").
4. Sector revenue mix vs. GASTAT — blocked on the GASTAT establishment-count
   table (not yet pulled) to re-derive `sector_size_distribution` and
   `base_monthly_inflow_sar` from a source that isn't the revenue table itself.

## Setup

```bash
pip install -r requirements.txt
```

Requires Python 3.13 (pinned versions in `requirements.txt`; not tested on
other versions).

## Usage

```bash
# Generate all output tables (deterministic; ~25s for the full population)
python generator.py                # N=10,000 research + N=1,000 serving
python generator.py --quick         # first 300 of each population, → quick_out/

# Week 3 "Generator Accepted" gate (SOP §5 / Schema §19, §30)
python gate_week3.py                # exit 0 = PASS, 1 = FAIL
python gate_week3.py --dir quick_out

# §21 emergent macro validation against archived GASTAT figures
python validate_emergent.py         # always exits 0 — findings are results, never a gate

# Self-test the §12 held-out anomaly injector (harness-only; run against
# generator.py output before ever wiring it into an eval pipeline)
python heldout_anomalies.py
```

Generated tables are **not committed** — see [Reproducibility](#reproducibility)
below. Run `python generator.py` after cloning before running anything else.

## Repository layout

```
config.yaml              All generative parameters (§12) — sector economics, latents,
                          sector-size-age sampling, seasonality, demo businesses,
                          §21 emergent validation targets. Read this before the code.
generator.py              The generator (§7, §14, §20, §22, §24, §29).
schemas.py                Pandera schemas for every engine-facing table (§37.1);
                          also enforces the §14 no-latent-leak rule.
gate_week3.py              Week 3 gate (SOP §5 / Schema §19): recomputes features
                          from the OUTPUT tables (never the generator's internals)
                          so every assertion can actually fail.
validate_emergent.py       §21 emergent validation: KS / total-variation distance
                          against pre-registered GASTAT targets, with committed
                          tolerance bands. Findings only — never retunes anything.
heldout_anomalies.py       §12 held-out anomaly types (round_trip_transfer,
                          duplicate_payment) — defined ONLY here, never in
                          config.yaml or generator.py; asserts that at import time.
ruff.toml                  §37.3 lint config (default rule set).
DECISIONS.md                Change-control log (SOP §9) — every generator design
                          decision and open item, with rationale and sign-off lines.
docs/
  Behavioral_Profile_Feature_Schema.md   The schema (v2.9) — source of truth.
  SME_Platform_SOP.md                    Team working rules.
sources/gastat/            Archived GASTAT publications (§21 source discipline:
                          archive on download, pin the exact edition). SME_2022.xlsx
                          is the pinned 2022 edition cited in config.yaml; the
                          2021/2023/2024 editions are kept for trend context only.
```

## Reproducibility

Every generated table (`transactions.csv`, `daily_aggregates.csv`,
`balances_monthly.csv`, `businesses.csv`, `labels.csv`, `latents_hidden.csv`,
`injected_anomalies.csv`) and the Ramadan/Eid check plot are **git-ignored**,
not committed:

- They are fully deterministic — every business's RNG is keyed on
  `(population seed, business_id)` (§23), so re-running `python generator.py`
  reproduces them byte-for-byte from `config.yaml` alone.
- `transactions.csv` alone is ~720MB at full scale, past GitHub's 100MB
  per-file limit.
- Committing generated data invites the two tables (code and data) to drift
  out of sync silently. The config is the single source of truth; regenerate
  from it.

The one thing that is committed and *not* regenerable is
[`sources/gastat/`](sources/gastat/) — real-world published data the
generator is validated against, archived per §21's "archive on download, pin
the exact edition" rule.
