# §21 validation — 2026-09-16, tables from `data`

## A. Calibration-derived checks (closed form of the inputs — NOT emergent)

Research population, four modelled sectors. `closed form` = weight × base_monthly_inflow_sar × E[size_tier_scale] from config.yaml; no simulation involved.

| metric | closed form | realised | published (GASTAT 2022) | distance | band | status |
|---|---|---|---|---|---|---|
| revenue_share_medium_tier [modelled_sectors] | 0.415 | 0.440 | 0.343 | 0.281 rel | 0.15 | INPUTS DIFFER FROM GASTAT |
| revenue_share_medium_tier [all_sectors_context_only] | — | 0.440 | 0.470 | — | — | CONTEXT_ONLY (not like-for-like) |
| sector_revenue_share | — | — | — | 0.519 TV | 0.10 | INPUTS DIFFER FROM GASTAT |
| &nbsp;&nbsp;· retail_trade | 0.138 | 0.140 | 0.600 | | | |
| &nbsp;&nbsp;· construction | 0.609 | 0.609 | 0.256 | | | |
| &nbsp;&nbsp;· food_beverage | 0.050 | 0.048 | 0.106 | | | |
| &nbsp;&nbsp;· professional_services | 0.203 | 0.204 | 0.038 | | | |
| within_sector_size_revenue_share · retail_trade | 0.51/0.31/0.18 | 0.48/0.31/0.21 | 0.50/0.25/0.24 | 0.038 KS | 0.10 | consistent |
| within_sector_size_revenue_share · construction | 0.10/0.37/0.52 | 0.09/0.36/0.55 | 0.16/0.34/0.50 | 0.065 KS | 0.10 | consistent |
| within_sector_size_revenue_share · food_beverage | 0.64/0.26/0.11 | 0.59/0.29/0.12 | 0.20/0.36/0.44 | 0.390 KS | 0.10 | INPUTS DIFFER FROM GASTAT |
| within_sector_size_revenue_share · professional_services | 0.33/0.35/0.33 | 0.30/0.35/0.35 | 0.13/0.31/0.56 | 0.211 KS | 0.10 | INPUTS DIFFER FROM GASTAT |

4 input-consistency miss(es). These describe `sector_size_distribution`, `base_monthly_inflow_sar` and `size_tier_scale`; the resolution is a sourced correction of those inputs (DECISIONS.md entries 6, 12), not a validation result.

## B. Emergent targets (no closed form — the simulation had to run)

### days_negative_balance_distribution — REPORTED (pending_no_saudi_series)

Scorable research businesses n=8909: **14.4%** have ≥ 1 negative-balance day in the trailing 90; among those the 50/90/99th percentiles are 33 / 90 / 90 days. By sector: construction 34.4%, food_beverage 13.1%, professional_services 4.1%, retail_trade 10.2%.
Comparator: No Saudi SME source. Berka: 6.4% of accounts ever negative over their full history (Probe 1) — directional context only, different population and horizon. `comparable: false` — no Saudi SME series exists; nothing is judged against it.

### realised_dso_vs_archetype — machinery test against the §24 archetype bands

| sector | archetype dso_days band | realised median implied_dso_days | inside band? |
|---|---|---|---|
| retail_trade | [5, 25] | 14.9 | PASS |
| construction | [72, 108] | 95.4 | PASS |
| food_beverage | [1, 8] | 5.1 | PASS |
| professional_services | [25, 55] | 34.5 | PASS |

### ramadan_amplitude_recovered — §22 decomposition fitted to the generated data (tolerance_abs 0.08)

Research population, businesses operating for the full window; OLS on log sector-daily totals with trend + day-of-week + window dummies. exp(coef) vs the configured multiplier.

| sector | kind | pre_ramadan_10d | ramadan | eid | post_eid_7d | status |
|---|---|---|---|---|---|---|
| construction (n=1736) | value | 0.99 (cfg 1.00) | 0.82 (cfg 0.80) | 0.26 (cfg 0.25) | 0.90 (cfg 0.90) | PASS |
| construction (n=1736) | count | 0.99 (cfg 1.00) | 1.01 (cfg 1.00) | 1.01 (cfg 1.00) | 1.01 (cfg 1.00) | PASS |
| food_beverage (n=1348) | value | 1.00 (cfg 1.00) | 0.82 (cfg 0.82) | 1.70 (cfg 1.66) | 0.99 (cfg 0.96) | PASS |
| food_beverage (n=1348) | count | 1.00 (cfg 1.00) | 0.70 (cfg 0.70) | 1.00 (cfg 0.97) | 0.95 (cfg 0.92) | PASS |
| professional_services (n=1832) | value | 1.02 (cfg 1.00) | 0.90 (cfg 0.90) | 0.39 (cfg 0.40) | 0.96 (cfg 0.95) | PASS |
| professional_services (n=1832) | count | 1.02 (cfg 1.00) | 1.01 (cfg 1.00) | 0.99 (cfg 1.00) | 1.02 (cfg 1.00) | PASS |
| retail_trade (n=2502) | value | 1.28 (cfg 1.28) | 1.32 (cfg 1.34) | 0.91 (cfg 0.94) | 0.83 (cfg 0.84) | PASS |
| retail_trade (n=2502) | count | 1.09 (cfg 1.09) | 1.11 (cfg 1.12) | 0.92 (cfg 0.95) | 0.85 (cfg 0.86) | PASS |

### aggregate_default_rate — NOT REGISTERED (pending_week1_check)

Realised: **4.060%** (research, n=10000, 406 defaults). No citable SME-specific NPL series has been pinned; the target stays unregistered rather than asserting an untraceable number (§21). Bank credit by activity (Phase 4) has no NPL field.

### real_vs_synthetic_signal_strength — see `python -m eval.compare_real` → eval/out/real_vs_synthetic.md

Registered here (tolerance_abs 0.1); computed by the comparison harness, not repeated in this script.

source 'gastat_2022_sme_revenue_bn_sar': GASTAT, 'Operating Revenues by Economic Activity and Size 2022' — status: archived

**0 emergent FINDING(s)** (reported, never retuned) and 4 input-consistency miss(es) against GASTAT.
