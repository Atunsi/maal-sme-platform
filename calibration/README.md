# Calibration — Saudi national sources (SOP_Saudi_Calibration_Sources v1.0 + SOP_Monshaat_Unblock v2.0)

**Owner:** generator owner · **Governed by:** `SOP_Saudi_Calibration_Sources.md`, Schema §21–§22 ·
**Change record:** `DECISIONS.md` entries 12–20 · **Report:** `/maal/saudi_calibration_report.md` (revision 2; copy in `out/`)

Replaces author judgement in `config.yaml` with measurements from published Saudi sources,
archived on download (`sources/sama/`, `sources/monshaat/`) with SHA-256, access date and
edition. **Correcting, not tuning** (SOP §2.1): every script reads a source and writes a
measurement to `calibration/out/<phase>.json`; none reads a validation target, and none edits
`config.yaml` — the config is edited by hand from those JSONs, each value with a comment naming
its edition, and `check_config` asserts the two still agree.

| File | Phase | Does |
|---|---|---|
| `sources.py` | — | archive paths, `.sha256`/`.meta.json` discipline, loaders that **assert** every documented file quirk (column shift, BOM, spans, Individuals' Loans present, sums to Total), the 2020 exclusion |
| `hijri.py` | — | Umm al-Qura overlap weights `w_{m,h}` (hijridate, pinned); asserts the pinned `ramadan_calendar` against the converter |
| `probe_sources.py` | 0 | download + archive the SAMA tables and the weekly bulletin PDF (its Monsha'at probe is superseded by `monshaat_probe.py`) |
| `monshaat_probe.py` | 1 / A2 | period range (2018Q1 → today, one call each), page sizes, pagination semantics; a fast 1009 = "no such period", 1011/1016 = transient → `out/phase1_monshaat_probe.json` |
| `monshaat_pull.py` | 1 | all pages of the latest quarter with data plus the same quarter one and two years earlier; stops at the first confirmed 1009; **rows summed, never de-duplicated** ((region, activity) is not a key — DECISIONS.md 14.2); Arabic labels verbatim → `sources/monshaat/` |
| `sector_mix.py` | 1 | ISIC → four sectors (membership list in `ISIC_MAP`, keys as the gateway serves them), all regions summed, large tier excluded → weights and tier splits, rounded to sum to exactly 1.0 |
| `seasonality.py` | 2 | §22 NNLS decomposition with Gregorian controls and a LOWESS adoption trend (monthly, 2016–2023 excl. 2020) plus a weekly window model for the 3-day Eid (2021–2023); value and count separately; jackknife CIs |
| `ticket_size.py` | 3 | value ÷ count per sector from the bulletin, the weekly series and the monthly table |
| `holdout_validate.py` | 3 | 2024 and 2025 scored against the ≤2023 fits without refitting — aggregate and per sector; one status per row: PASS / BOUNDED / FAIL / NOT_APPLIED (B3) |
| `credit_intensity.py` | 4 | bank credit by activity, Individuals' Loans excluded, ÷ the Phase 1 SME count → relative index → `financing.share_of_businesses` per sector (level pinned) |
| `reclass_evidence.py` | B1 + B2 | applies the two mechanical rules: A1/A2 from `eval/out/feature_transfer.json` → `profile_engine/feature_transfer.json`; B/B-weak per seasonality window from the CI (rewrites the two config blocks, values asserted unchanged) |
| `check_config.py` | 5 | drift guard: config values == measured values; B/B-weak labels == the CI rule; prints the full-file sha256 and the **generator-parameter hash** (labels, CIs, §21 block removed) |
| `write_report.py` | 6 | assembles the report from the JSONs and `eval/out/` |

Run order is the module docstring in `__init__.py`. What must not happen (SOP §12) is enforced
in code, not prose: 2020 never enters a fit (`sources.exclude_year` asserts it), Individuals'
Loans never enters a business share (`credit_intensity` asserts the column is absent), POS
seasonality is never applied to construction or professional services (`check_config` fails if
a ticket or a class-B label appears on them), and the GDP file has no loader.

## Status (2026-09-17)

All phases done. Phases 0, 2, 3 from SAMA; Phase 1 from the Monsha'at register (2021 Q4, 2020 Q4,
2019 Q4 archived — the dataset spans 2019 Q2 – 2021 Q4; the v1.0 "blocked gateway" was a
misdiagnosis, `DECISIONS.md` 14.1); Phase 4's per-SME index written from it. Workstream B of
SOP v2.0 (A1/A2 split, B-weak, held-out statuses, one CV protocol, exclusion selectivity,
cross-edition tickets) changed labels and reports only — the generator-parameter hash
`a5b2bccab775fa71` is unchanged from the Workstream A commit onward.
