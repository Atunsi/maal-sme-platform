# Calibration — Saudi national sources (SOP_Saudi_Calibration_Sources v1.0)

**Owner:** generator owner · **Governed by:** `SOP_Saudi_Calibration_Sources.md`, Schema §21–§22 ·
**Change record:** `DECISIONS.md` entries 12–13 · **Report:** `/maal/saudi_calibration_report.md`

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
| `probe_sources.py` | 0 | download + archive the SAMA tables and the weekly bulletin PDF; Monsha'at pagination probe (pages 1, 2, 76) |
| `monshaat_pull.py` | 1 | all pages, three quarters, de-dup across pages, Arabic labels verbatim → `sources/monshaat/` (exit 2 = gateway blocked) |
| `sector_mix.py` | 1 | ISIC → four sectors (membership list in `ISIC_MAP`), all regions, large tier excluded → weights and tier splits |
| `seasonality.py` | 2 | §22 NNLS decomposition with Gregorian controls and a LOWESS adoption trend (monthly, 2016–2023 excl. 2020) plus a weekly window model for the 3-day Eid (2021–2023); value and count separately; jackknife CIs |
| `ticket_size.py` | 3 | value ÷ count per sector from the bulletin, the weekly series and the monthly table |
| `holdout_validate.py` | 3 | 2024 and 2025 scored against the ≤2023 fits without refitting — aggregate and per sector |
| `credit_intensity.py` | 4 | bank credit by activity, Individuals' Loans excluded; per-SME index once Phase 1 supplies the denominator |
| `check_config.py` | 5 | drift guard: config values == measured values |
| `write_report.py` | 6 | assembles the report from the JSONs and `eval/out/` |

Run order is the module docstring in `__init__.py`. What must not happen (SOP §12) is enforced
in code, not prose: 2020 never enters a fit (`sources.exclude_year` asserts it), Individuals'
Loans never enters a business share (`credit_intensity` asserts the column is absent), POS
seasonality is never applied to construction or professional services (`check_config` fails if
a ticket or a class-B label appears on them), and the GDP file has no loader.

## Status (2026-09-16)

Phases 0, 2, 3, 4 (shares) done from SAMA. **Phase 1 blocked**: the Monsha'at gateway returned
`1016 Request Timeout` / `1009 No Data Found` on every quarter; nothing was invented in its
place and `sector_size_distribution` is unchanged. Phase 4's per-business index waits on the
same denominator. Details and the aggregate size-split consistency gap: `DECISIONS.md` 13.2.
