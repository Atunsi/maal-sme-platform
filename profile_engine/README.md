# Profile engine — BUILT (features 1–69), source-agnostic

**Owner:** profile engine owner (SOP §3) · **Schema:** §1–§6, §15, §16, §30–§35; proposed §37 (60–65) and §38 (66–69) per `SOP_Data_Grounding` ·
**Built during:** the real-data grounding SOP (2026-09-15/16), because Phases 2–4 need one engine that runs unmodified on both sources.

The single shared engine all three lenses read from. It reads the tables in
`generator/schemas.py` and a per-business as-of date (`businesses.window_end`);
it does not know whether a row came from the generator or from Berka.

| File | Role |
|---|---|
| `registry.py` | **Explicit feature-ID membership lists** (`PROFILE_FEATURE_IDS`, `ZAKAT_PROFILE_FEATURE_IDS`), names, `MIN_HISTORY_DAYS`, `NULL_REASONS`. Never a range. |
| `evidence.py` | Class A / B / C per feature with a basis string (SOP_Data_Grounding §6.3). A mixed metric reports the weakest class. |
| `features.py` | The computation. Daily-series features per business (numpy), transaction features vectorised, obligations, facilities, balance sheet, §35 z-scores. |
| `compute.py` | CLI. `python -m profile_engine.compute --dir data` / `--dir data/berka`. |
| `sector_reference_stats_v1.json` | §35 pinned μ/σ per sector for features 3, 11, 13, 16, 21, built once on the N=10,000 research population (`--build-reference-stats`), never recomputed at serving time. Its sha256 is printed at build. |

## Outputs (into the data directory)

| File | Contents |
|---|---|
| `profiles.csv` | one row per business, features by name (+ `financing_outflow_ratio_code`, the §8.4 diagnostic) |
| `profile_nulls.csv` | every null with its reason — `insufficient_data`, `insufficient_history`, `near_zero_denominator`, `not_applicable`, `insufficient_events`, `no_break_detected`, `not_available_in_source`, `not_implemented`, `reference_stats_missing`. A bare null is a bug (asserted). |
| `profile_status.csv` | §15 state: `scored` / `partial_profile` / `insufficient_data` |
| `profile_coverage.csv` | value share with a counterparty identity, for features 5, 20–22, 45, 46 |

## Contract points

- **`insufficient_data`** is a distinct state (§15): every feature except 32 is null with that reason; nothing is scored. The threshold is `profile_engine.coverage_min_days_by_source` in `config.yaml` — 60 for synthetic, **10 for `external_real`** ([DECISIONS.md entry 9](../DECISIONS.md)).
- **`partial_profile`** when history < 180 days: 4, 9, 43, 45 return `insufficient_history`.
- **§16 conventions:** runway null when not burning (and zero, never negative, when already overdrawn); SAR 500 epsilon floor on monthly denominators; growth capped at ±300%.
- **Not implemented (module owners):** 24, 25, 26, 34, 35 → `not_implemented` on synthetic, `not_available_in_source` on a bank feed where the input itself does not exist.
- **Proposed formulas** the schema leaves open — 15, 46's threshold, 33's calendar — are in [DECISIONS.md entry 8](../DECISIONS.md).
- Pandera validation of every input table before computation (§37.1), reusing `generator/schemas.py`.
