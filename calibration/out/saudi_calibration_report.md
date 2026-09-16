# Saudi national source calibration — report

**Repository:** `maal-sme-platform-main` · **SOP:** `SOP_Saudi_Calibration_Sources.md` v1.0 · **Run date:** 2026-09-16 · **Change record:** `DECISIONS.md` entries 12 and 13 · **Measurements:** `calibration/out/*.json` · **Archives:** `sources/sama/`

Written for a defense reader. Every number below states what measured it, which edition, and whether it is measured (class B on the synthetic side), judged (class C) or unknown. A finding that weakens the project is still a finding.

**One-paragraph summary.** Three of the five defects the SOP set out to fix were fixed from SAMA sources: the food-service Ramadan direction (restaurants **fall** to 0.82× in Ramadan and spike to 1.66× at Eid; the placeholder had 1.45× / 1.80×), the ticket sizes (retail 61.5 SAR and restaurants 29.0 SAR against config-implied 400 / 250), and the missing held-out year (2024 and 2025 both scored against the ≤2023 fit without refitting, aggregate and per sector). The other two — the sector/size mix and the sector-conditional financing share — are **blocked on the Monsha'at gateway**, which returned no data on the access date; nothing was invented in their place, and the scripts that will write them are complete. The revenue-share metrics were reclassified from emergent targets to calibration-derived checks before any input changed (§2.2).

## 1. What was done

**SAMA Monetary and Financial Statistics, Table 30d — Points of Sale Transactions by Sectors.** Origin: Saudi Central Bank (SAMA). Retrieved via KAPSARC Data Portal mirror (OpenDataSoft export API) on 2026-09-16; span 2016-01-01 → 2023-12-01, 3,264 tidy rows. Used for: Phase 2 — β_h per Hijri month per sector (the §22 decomposition); Phase 3 — 2023 ticket-size edition. Archive `sources/sama/pos_by_sector_monthly_2016_2023.csv`, SHA-256 `4aea3d0ed44ccd50b26f311c640e8ae609f96155e549e7341d8028adda49360c`.

**SAMA Monetary and Financial Statistics — Points of Sale Transactions (aggregate).** Origin: Saudi Central Bank (SAMA). Retrieved via KAPSARC Data Portal mirror (OpenDataSoft export API) on 2026-09-16; span 1995-01-01 → 2026-07-01, 1,683 tidy rows. Used for: Phase 2 — terminal counts for the adoption trend; Phase 3 — aggregate held-out 2024/2025 test; §5.4 value-vs-count divergence. Archive `sources/sama/pos_aggregate_1995_2026.csv`, SHA-256 `c08b693ad7f520d16415d437a9778480ead35a34b9c77bdf77383c95a1564f6e`.

**SAMA Monetary and Financial Statistics — Bank Credit by Economic Activity (17 sectors).** Origin: Saudi Central Bank (SAMA). Retrieved via KAPSARC Data Portal mirror (OpenDataSoft export API) on 2026-09-16; span 2021-07-01 → 2026-04-01, 360 tidy rows. Used for: Phase 4 — credit shares and growth by activity with Individuals' Loans excluded; the per-SME index awaits the Monsha'at denominator. Archive `sources/sama/bank_credit_by_activity_2021_2026.csv`, SHA-256 `10cefcf7b76ac3e05fcaaafb2116c77966d1e7a57f00ef1e410150da896136af`.

**SAMA Weekly Points of Sale Transactions (by activity and city).** Origin: Saudi Central Bank (SAMA). Retrieved via KAPSARC Data Portal mirror (OpenDataSoft export API) on 2026-09-16; span 2020-05-10 → 2025-07-06, 9,720 tidy rows. Used for: Phase 2 — the weekly window model that resolves the 3-day Eid; Phase 3 — per-sector held-out 2024/2025 and the 2025 ticket edition. Not in the SOP's inventory; found on the same mirror. Archive `sources/sama/pos_by_sector_weekly_2020_2025.csv`, SHA-256 `4966f401e979564676236406b411a4de0093e2e9003ce8b2513b1e4d61f00d40`.

**SAMA Weekly Points of Sale Transactions bulletin, 12-Sep-2026 bulletin (four weeks: 16 Aug–12 Sep 2026).** Origin: SAMA. Direct PDF, retrieved 2026-09-16. Used for: Phase 3 ticket sizes at the finest activity split (Restaurants & Cafés vs Bakeries, Professional & Business Services). Archive `sources/sama/sama_weekly_pos_bulletin_2026-09-12.pdf`, SHA-256 `c2b285f3aa57bc9c97f8874000139626ba50c4141f155477cd2021476d01e3cd`.

**Monsha'at Enterprises Statistics (region × ISIC × size).** Origin: Monsha'at. Retrieval path: the OpenData gateway `https://pservices.monshaat.gov.sa/BI/TaskService/OpenData/EnterprisesStatistics/{Year}/{Quarter}?paginationIndex=&recordsPerPage=`. **Not archived:** the gateway answered `null…` on every quarter tried (see §5). `calibration/monshaat_pull.py` and `sector_mix.py` are written and will archive `sources/monshaat/enterprises_{YYYY}Q{Q}.json` with hash and meta when it answers.

**GASTAT seasonally-adjusted real GDP by institutional sector (2023=100).** Deliberately **excluded** (DECISIONS.md 13.10): the export interleaves five unit series under one label, and a seasonally-adjusted, three-sector series cannot inform a four-sector Hijri seasonality calibration.

## 2. Parameters changed

| parameter | old | new | source (edition) | class before → after |
|---|---|---|---|---|
| `seasonality_value_multiplier.retail_trade.pre_ramadan_10d` | 1.10 | **1.28** CI [0.68, 1.88] | SAMA weekly POS 2021–2023, window model | C → B |
| `seasonality_value_multiplier.retail_trade.ramadan` | 1.30 | **1.34** CI [1.28, 1.39] | SAMA Table 30d monthly 2016–2023 excl. 2020, §22 NNLS | C → B |
| `seasonality_value_multiplier.retail_trade.eid` | 2.20 | **0.94** CI [0.19, 1.69] | SAMA weekly POS 2021–2023, window model | C → B |
| `seasonality_value_multiplier.retail_trade.post_eid_7d` | 0.80 | **0.84** CI [0.73, 0.94] | SAMA weekly POS 2021–2023, window model | C → B |
| `seasonality_count_multiplier.retail_trade.pre_ramadan_10d` | 1.00 (implicit) | **1.09** CI [0.84, 1.35] | SAMA weekly POS (count), window model | C → B |
| `seasonality_count_multiplier.retail_trade.ramadan` | 1.00 (implicit) | **1.12** CI [1.05, 1.20] | SAMA Table 30d monthly (count), §22 NNLS | C → B |
| `seasonality_count_multiplier.retail_trade.eid` | 1.00 (implicit) | **0.95** CI [0.75, 1.15] | SAMA weekly POS (count), window model | C → B |
| `seasonality_count_multiplier.retail_trade.post_eid_7d` | 1.00 (implicit) | **0.86** CI [0.79, 0.94] | SAMA weekly POS (count), window model | C → B |
| `seasonality_value_multiplier.food_beverage.pre_ramadan_10d` | 1.05 | **1.00** CI [0.67, 1.32] | SAMA weekly POS 2021–2023, window model | C → B |
| `seasonality_value_multiplier.food_beverage.ramadan` | 1.45 | **0.82** CI [0.76, 0.87] | SAMA Table 30d monthly 2016–2023 excl. 2020, §22 NNLS | C → B |
| `seasonality_value_multiplier.food_beverage.eid` | 1.80 | **1.66** CI [1.44, 1.89] | SAMA weekly POS 2021–2023, window model | C → B |
| `seasonality_value_multiplier.food_beverage.post_eid_7d` | 0.85 | **0.96** CI [0.95, 0.98] | SAMA weekly POS 2021–2023, window model | C → B |
| `seasonality_count_multiplier.food_beverage.pre_ramadan_10d` | 1.00 (implicit) | **1.00** CI [0.82, 1.19] | SAMA weekly POS (count), window model | C → B |
| `seasonality_count_multiplier.food_beverage.ramadan` | 1.00 (implicit) | **0.70** CI [0.66, 0.73] | SAMA Table 30d monthly (count), §22 NNLS | C → B |
| `seasonality_count_multiplier.food_beverage.eid` | 1.00 (implicit) | **0.97** CI [0.92, 1.03] | SAMA weekly POS (count), window model | C → B |
| `seasonality_count_multiplier.food_beverage.post_eid_7d` | 1.00 (implicit) | **0.92** CI [0.87, 0.97] | SAMA weekly POS (count), window model | C → B |
| `sector_economics.retail_trade.avg_inflow_ticket_sar` (replaces `inflow_tx_per_day` 5.0) | implied 400 SAR/receipt | **61.5 SAR** | SAMA weekly bulletin 12-Sep-2026, Table 1, four-week Σvalue ÷ Σcount | C → B |
| `sector_economics.food_beverage.avg_inflow_ticket_sar` (replaces `inflow_tx_per_day` 6.0) | implied 250 SAR/receipt | **29.0 SAR** | SAMA weekly bulletin 12-Sep-2026, Table 1, four-week Σvalue ÷ Σcount | C → B |
| `output.pos_sales_transaction_sample_rate` | — (all rows emitted) | **0.1** with `transactions.sample_weight` = 1/rate on POS `sales` rows | decision, DECISIONS.md 13.6 | structural |
| `ramadan_calendar` 1448 `ramadan_end` / `eid_start` / `eid_end` | 2027-03-09 / 03-10 / 03-12 | **2027-03-08 / 03-09 / 03-11** | Umm al-Qura via hijridate 2.6.0 (Ramadan 1448 has 29 days) | judgement → B |
| `emergent_validation_targets`: revenue-share metrics | `targets` | `calibration_derived_checks` (closed form) | SOP §2.2, DECISIONS.md entry 12 | reclassified |
| `emergent_validation_targets.targets` | 2 | + `days_negative_balance_distribution`, `realised_dso_vs_archetype`, `ramadan_amplitude_recovered` | SOP §2.3 | registered |
| `sector_size_distribution` (weights, tier splits) | unchanged | unchanged | Monsha'at gateway unavailable | C (blocked) |
| `financing.share_of_businesses` | 0.35 uniform | 0.35 uniform (generator now accepts a per-sector map) | needs the Monsha'at denominator | C (blocked) |
| `seasonality_*_multiplier.construction / .professional_services` | unchanged | unchanged, labelled `evidence_class: C` | POS does not measure them (§5.3) | C |
| `base_monthly_inflow_sar` (all sectors) | unchanged | unchanged | SOP §10.6 — remains judgement | C |

## 3. Findings

### 3.1 Sector and size mix — blocked, with one measurable consistency gap

No national ISIC × size counts could be pulled (§5). What can be said without them: the config implies an aggregate micro/small/medium split of **75.5% / 19.4% / 5.1%**, against Monsha'at's published national **87.0% / 11.5% / 1.4%** at Q4 2023 (SME Monitor, 1,138,588 / 150,788 / 18,723). Construction's 45/40/15 tier split is the outlier the SOP predicted (Jazan sample 85/14/1). This is reported, not corrected: allocating a national split across sectors without the register is judgement.

### 3.2 Ramadan multipliers per sector — the direction correction

| POS sector | β_Ramadan value [95% CI] | β_Ramadan count | raw first-pass (Ramadan month ÷ year mean) | R² (log) | adoption trend absorbed (×) |
|---|---|---|---|---|---|
| Restaurants & Café | **0.82** [0.76, 0.87] | 0.70 | 0.86 | 1.00 | 13.0 |
| retail_composite | **1.34** [1.28, 1.39] | 1.12 | 1.28 | 0.99 | 2.6 |
| Clothing and Footwear | **1.90** [1.77, 2.03] | 1.72 | 1.66 | 0.96 | 1.8 |
| Beverage and Food | **1.08** [0.98, 1.18] | 0.95 | 1.07 | 0.99 | 5.5 |
| Jewelry | **1.46** [1.34, 1.58] | 1.52 | 1.47 | 0.81 | 1.0 |
| Furniture | **1.14** [1.06, 1.23] | 1.17 | 1.09 | 0.96 | 2.2 |
| Electronic & Electric Devices | **0.89** [0.82, 0.97] | 0.92 | 1.01 | 0.79 | 1.2 |
| Construction & Building Materials | **0.71** [0.63, 0.78] | 0.90 | 0.82 | 0.94 | 1.8 |
| Total | **1.11** [1.07, 1.15] | 0.98 | 1.10 | 0.99 | 4.0 |

**Food service falls in Ramadan — in every one of the seven calibration years.** Restaurants & Café β_Ramadan is 0.82 on value and 0.70 on count: daytime closure is not recovered by the evening surge, and card volume drops even more than value. The generator had food service **rising** 1.45× in Ramadan and 1.80× at Eid; it now falls to 0.82× and spikes to 1.66× at Eid (weekly window model, CI [1.44, 1.89]). The gate's old criterion 3 ("Ramadan > 1.15× baseline") encoded the wrong sign for this sector and was replaced (DECISIONS.md 13.8).

**The Eid spike is clothing, and no generator sector captures it.** Clothing and Footwear β_Ramadan is 1.90 [1.77, 2.03] — the pre-Eid wardrobe purchase — with Jewelry at 1.46. The retail composite dilutes it to 1.34 because grocery (Beverage and Food, 1.08) and electronics (0.89) move little. A clothing-retail sub-sector would be the honest way to show the spike; it is out of scope this term and named here.

### 3.3 Value versus count — the ticket-size effect

Total POS: β_Ramadan value **1.111**, count **0.978** → the average ticket rises **×1.14** in Ramadan. People shop less often and spend more per basket. The generator now carries value and count multipliers separately, so fewer-and-larger emerges rather than a single revenue scale (the §21 `ramadan_amplitude_recovered` target checks both).

### 3.4 Weekly window model — what a monthly series cannot see

| generator sector ← POS series | window | value μ [CI] | count μ [CI] |
|---|---|---|---|
| food_beverage ← Restaurants & Café | pre_ramadan_10d | 1.00 [0.67, 1.32] | 1.00 [0.82, 1.19] |
| food_beverage ← Restaurants & Café | ramadan | 0.76 [0.50, 1.01] | 0.67 [0.55, 0.78] |
| food_beverage ← Restaurants & Café | eid | 1.66 [1.44, 1.89] | 0.97 [0.92, 1.03] |
| food_beverage ← Restaurants & Café | post_eid_7d | 0.96 [0.95, 0.98] | 0.92 [0.87, 0.97] |
| retail_trade ← composite | pre_ramadan_10d | 1.28 [0.68, 1.88] | 1.09 [0.84, 1.35] |
| retail_trade ← composite | ramadan | 1.42 [0.73, 2.11] | 1.10 [0.86, 1.34] |
| retail_trade ← composite | eid | 0.94 [0.19, 1.69] | 0.95 [0.75, 1.15] |
| retail_trade ← composite | post_eid_7d | 0.84 [0.73, 0.94] | 0.86 [0.79, 0.94] |
| construction ← Construction & Building Materials (not applied) | pre_ramadan_10d | 1.00 [0.88, 1.13] | 1.10 [0.92, 1.28] |
| construction ← Construction & Building Materials (not applied) | ramadan | 0.79 [0.74, 0.83] | 0.97 [0.86, 1.08] |
| construction ← Construction & Building Materials (not applied) | eid | 0.00 [0.00, 0.00] | 0.40 [0.28, 0.52] |
| construction ← Construction & Building Materials (not applied) | post_eid_7d | 0.79 [0.65, 0.94] | 0.82 [0.78, 0.87] |

Intervals are leave-one-year-out over three years, so they are wide where the window is short: the retail Eid value interval spans [0.19, 1.69], and several unapplied sectors sit at exactly 0.00 (the NNLS boundary — the model saying *not identified*). The restaurant Eid spike (1.66, CI [1.44, 1.89]) is identified.

### 3.5 Ticket sizes measured versus config-implied (SAR per receipt)

| sector | config-implied | bulletin 12-Sep-2026, latest week | bulletin, four weeks (**applied**) | weekly series Jan–Jul 2025 | monthly Table 30d 2023 |
|---|---|---|---|---|---|
| retail_trade | 400 | 58.1 | **61.5** | 63.4 | 69.9 |
| food_beverage | 250 | 27.9 | **29.0** | 32.5 | 34.9 |
| construction | 20000 | 127.6 | **129.3** | 197.2 | 250.3 |
| professional_services | 6000 | 50.4 | **52.9** | — | — |
| total | nan | 54.1 | **58.7** | 62.7 | 68.4 |

Bakeries & Pastries read 38.6 SAR in the same bulletin (not modelled separately). Construction and professional tickets are consumer-facing POS lines and are context only.

### 3.6 Credit intensity by sector (Individuals' Loans excluded)

Latest quarter 2026-04-01: total bank credit 3.42 tn SAR, of which Individuals' Loans 42.6% — excluded and asserted. Business credit 1.96 tn SAR.

| generator sector ← activity | credit (SAR mn) | share of all credit | share of business credit | CAGR 2021Q3 → latest |
|---|---|---|---|---|
| retail_trade ← Wholesale and Retail Trade | 220,795 | 6.5% | 11.2% | +6.1% |
| construction ← Construction | 150,844 | 4.4% | 7.7% | +7.9% |
| food_beverage ← Accommodation and Food Service Activities | 60,968 | 1.8% | 3.1% | +15.4% |
| professional_services ← Professional, Scientific and Technical Activities | 14,672 | 0.4% | 0.7% | +21.6% |

Retail carries ~1.5× construction's credit and food service ~0.4×; professional services ~0.1×. A uniform 0.35 financing share is not defensible against this — but converting shares into a **per-business** index needs the SME count per sector, which is the blocked Monsha'at pull. The index is therefore withheld, not approximated. Hard limitation regardless: this is total bank credit, not SME credit (construction is dominated by large contractors), and it has no NPL field.

### 3.7 Held-out 2024 and 2025 — fitted on ≤2023, never refitted

| test | 2024 actual vs predicted | 2025 actual vs predicted | tolerance |
|---|---|---|---|
| Total POS value, Ramadan-month index (monthly fit) | 1.089 vs 1.151 (MAE all months 0.031) | 1.126 vs 1.144 (MAE 0.032) | ±0.1 ✓ |
| Total POS count, Ramadan-month index | 0.982 vs 1.042 (MAE all months 0.033) | 0.972 vs 1.018 (MAE 0.033) | ±0.1 ✓ |
| food_beverage sales, Ramadan window vs baseline (weekly series) | 0.827 vs β 0.816 | 0.852 vs β 0.816 | ±0.1 ✓ |
| food_beverage count, Ramadan window vs baseline (weekly series) | 0.708 vs β 0.695 | 0.721 vs β 0.695 | ±0.1 ✓ |
| retail_trade sales, Ramadan window vs baseline (weekly series) | 1.280 vs β 1.338 | 1.433 vs β 1.338 | ±0.1 ✓ |
| retail_trade count, Ramadan window vs baseline (weekly series) | 1.035 vs β 1.125 | 1.082 vs β 1.125 | ±0.1 ✓ |
| construction sales, Ramadan window vs baseline (weekly series) | 0.814 vs β 0.707 | 0.906 vs β 0.707 | ±0.1 ✗ (not applied to the generator) |
| construction count, Ramadan window vs baseline (weekly series) | 0.964 vs β 0.905 | 1.037 vs β 0.905 | ±0.1 ✗ (not applied to the generator) |
| total sales, Ramadan window vs baseline (weekly series) | 1.054 vs β 1.111 | 1.157 vs β 1.111 | ±0.1 ✓ |
| total count, Ramadan window vs baseline (weekly series) | 0.905 vs β 0.978 | 0.948 vs β 0.978 | ±0.1 ✓ |

Eid-week actuals for restaurants (1.21 / 1.22) sit below the weekly-model point estimate (1.66); a 3-day window diluted over 7-day weeks is a floor on the daily multiplier, so the two are not directly comparable — reported as such. Construction & Building Materials misses in both years on value; it is not applied to the generator, but the miss is a finding about how far a consumer-materials POS line is from anything stable.

### 3.8 Hijri calendar

Every pinned row matches the Umm al-Qura converter.

## 4. Gate and validation results after the change

### 4.1 Week 3 gate at full scale (N = 10,000 research + 1,000 serving): **PASS**

- PASS  Pandera: all tables validate
- PASS  research: all IDs inside configured range [1, 10000]
- PASS  serving: all IDs inside configured range [10001, 11000]
- PASS  research ∩ serving = ∅  (research n=10000, serving n=1000)
- PASS  populations use different seeds
- PASS  transactions: every row tagged data_source=synthetic
- PASS  transactions: no latent/label columns (found [])
- PASS  daily_aggregates: every row tagged data_source=synthetic
- PASS  daily_aggregates: no latent/label columns (found [])
- PASS  balances_monthly: every row tagged data_source=synthetic
- PASS  balances_monthly: no latent/label columns (found [])
- PASS  businesses: every row tagged data_source=synthetic
- PASS  businesses: no latent/label columns (found [])
- PASS  daily_aggregates.outflow_total == Σ transactions[out] (outflows are never thinned)
- PASS  daily_aggregates.inflow_total == Σ transactions[in] exactly on the 4997 businesses with no thinned rows
- PASS  Σ amount×sample_weight [in] / Σ inflow_total = 1.0003 on the 6003 thinned (POS-sector) businesses — within ±2% (unbiased thinning)
- PASS  per-business weighted inflow within ±20% of inflow_total for 99.9% of thinned businesses (> 95%)
- PASS  ALL construction implied_dso_days ∈ [60, 120]
- PASS  ALL professional_services implied_dio_days < 5
- PASS  construction DSO > retail DSO (medians)
- PASS  retail DIO > construction DIO (medians)
- PASS  construction default rate ≥ 1.5 × professional_services (ratio = 3.45)
- PASS  in-sample logistic AUC on observables strictly in (0.55, 0.95): 0.639
- PASS  closest cross-label pair is at least as close as a typical nearest neighbour
- PASS  ID 10001: window overlaps Ramadan
- ID 10001 (retail_trade): Ramadan/base = 1.52, Eid/base = 1.57  (one business — plotted, not gated)
- PASS  ID 10002: window contains no Ramadan days
- INFO  construction value: recovered/configured  pre_ramadan_10d 0.99/1.00  ramadan 0.82/0.80  eid 0.26/0.25  post_eid_7d 0.90/0.90  (class C, reported only)
- INFO  construction count: recovered/configured  pre_ramadan_10d 0.99/1.00  ramadan 1.01/1.00  eid 1.01/1.00  post_eid_7d 1.01/1.00  (class C, reported only)
- PASS  food_beverage value: recovered/configured  pre_ramadan_10d 1.00/1.00  ramadan 0.82/0.82  eid 1.70/1.66  post_eid_7d 0.99/0.96  — ramadan & eid within ±0.08 (class B, n=1348)
- PASS  food_beverage count: recovered/configured  pre_ramadan_10d 1.00/1.00  ramadan 0.70/0.70  eid 1.00/0.97  post_eid_7d 0.95/0.92  — ramadan & eid within ±0.08 (class B, n=1348)
- INFO  professional_services value: recovered/configured  pre_ramadan_10d 1.02/1.00  ramadan 0.90/0.90  eid 0.39/0.40  post_eid_7d 0.96/0.95  (class C, reported only)
- INFO  professional_services count: recovered/configured  pre_ramadan_10d 1.02/1.00  ramadan 1.01/1.00  eid 0.99/1.00  post_eid_7d 1.02/1.00  (class C, reported only)
- PASS  retail_trade value: recovered/configured  pre_ramadan_10d 1.28/1.28  ramadan 1.32/1.34  eid 0.91/0.94  post_eid_7d 0.83/0.84  — ramadan & eid within ±0.08 (class B, n=2502)
- PASS  retail_trade count: recovered/configured  pre_ramadan_10d 1.09/1.09  ramadan 1.11/1.12  eid 0.92/0.95  post_eid_7d 0.85/0.86  — ramadan & eid within ±0.08 (class B, n=2502)
- PASS  food_beverage: Ramadan VALUE direction down matches the measured direction (down)
- PASS  retail_trade: Ramadan VALUE direction up matches the measured direction (up)

Criterion 3 is now the population-level recovery of the configured value **and** count multipliers per sector (class B sectors gated at ±0.08, class C reported), replacing the single-business placeholder thresholds — DECISIONS.md 13.8.

### 4.2 §21 validation — after

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

### 4.3 §21 validation — before (same harness, pre-calibration tables)

| metric | closed form | realised | published (GASTAT 2022) | distance | band | status |
| revenue_share_medium_tier [modelled_sectors] | 0.415 | 0.439 | 0.343 | 0.277 rel | 0.15 | INPUTS DIFFER FROM GASTAT |
| revenue_share_medium_tier [all_sectors_context_only] | — | 0.439 | 0.470 | — | — | CONTEXT_ONLY (not like-for-like) |
| sector_revenue_share | — | — | — | 0.515 TV | 0.10 | INPUTS DIFFER FROM GASTAT |
| &nbsp;&nbsp;· retail_trade | 0.138 | 0.139 | 0.600 | | | |
| &nbsp;&nbsp;· construction | 0.609 | 0.606 | 0.256 | | | |
| &nbsp;&nbsp;· food_beverage | 0.050 | 0.052 | 0.106 | | | |
| &nbsp;&nbsp;· professional_services | 0.203 | 0.203 | 0.038 | | | |
| within_sector_size_revenue_share · retail_trade | 0.51/0.31/0.18 | 0.48/0.31/0.21 | 0.50/0.25/0.24 | 0.038 KS | 0.10 | consistent |
| within_sector_size_revenue_share · construction | 0.10/0.37/0.52 | 0.09/0.36/0.55 | 0.16/0.34/0.50 | 0.065 KS | 0.10 | consistent |
| within_sector_size_revenue_share · food_beverage | 0.64/0.26/0.11 | 0.59/0.29/0.13 | 0.20/0.36/0.44 | 0.389 KS | 0.10 | INPUTS DIFFER FROM GASTAT |
| within_sector_size_revenue_share · professional_services | 0.33/0.35/0.33 | 0.30/0.35/0.35 | 0.13/0.31/0.56 | 0.211 KS | 0.10 | INPUTS DIFFER FROM GASTAT |
Scorable research businesses n=8904: **14.3%** have ≥ 1 negative-balance day in the trailing 90; among those the 50/90/99th percentiles are 32 / 90 / 90 days. By sector: construction 34.4%, food_beverage 11.8%, professional_services 4.1%, retail_trade 10.6%.
| sector | archetype dso_days band | realised median implied_dso_days | inside band? |
| retail_trade | [5, 25] | 14.9 | PASS |
| construction | [72, 108] | 95.4 | PASS |
| food_beverage | [1, 8] | 5.1 | PASS |
| professional_services | [25, 55] | 34.5 | PASS |
| sector | kind | pre_ramadan_10d | ramadan | eid | post_eid_7d | status |
| construction (n=1736) | value | 0.97 (cfg 1.00) | 0.79 (cfg 0.80) | 0.25 (cfg 0.25) | 0.96 (cfg 0.90) | PASS |
| construction (n=1736) | count | 0.99 (cfg 1.00) | 1.00 (cfg 1.00) | 1.01 (cfg 1.00) | 1.02 (cfg 1.00) | PASS |
| food_beverage (n=1348) | value | 1.01 (cfg 1.05) | 1.44 (cfg 1.45) | 1.84 (cfg 1.80) | 0.85 (cfg 0.85) | PASS |
| food_beverage (n=1348) | count | 0.99 (cfg 1.00) | 1.00 (cfg 1.00) | 1.01 (cfg 1.00) | 1.03 (cfg 1.00) | PASS |
| professional_services (n=1832) | value | 1.00 (cfg 1.00) | 0.89 (cfg 0.90) | 0.39 (cfg 0.40) | 0.93 (cfg 0.95) | PASS |
| professional_services (n=1832) | count | 1.01 (cfg 1.00) | 1.01 (cfg 1.00) | 0.98 (cfg 1.00) | 1.01 (cfg 1.00) | PASS |
| retail_trade (n=2502) | value | 1.11 (cfg 1.10) | 1.31 (cfg 1.30) | 2.22 (cfg 2.20) | 0.81 (cfg 0.80) | PASS |
| retail_trade (n=2502) | count | 1.00 (cfg 1.00) | 0.99 (cfg 1.00) | 0.98 (cfg 1.00) | 0.99 (cfg 1.00) | PASS |
Realised: **4.060%** (research, n=10000, 406 defaults). No citable SME-specific NPL series has been pinned; the target stays unregistered rather than asserting an untraceable number (§21). Bank credit by activity (Phase 4) has no NPL field.
**0 emergent FINDING(s)** (reported, never retuned) and 4 input-consistency miss(es) against GASTAT.

### 4.4 Real vs synthetic (`eval.compare_real`) — before and after

**Before (pre-calibration tables, run 2026-09-16 00:25)**

| Comparison-set AUC, 95% CI | 0.594 [0.567, 0.621] (5 contiguous-ID entity folds, out-of-fold) | not evaluable (too few defaults in a split) (train loan_date < 1997-01-01, validate ≥) | 0.901 [0.835, 0.955] (same split; **censored**) |
| Default rate | 0.041 | 0.105 | 0.096 |
| n businesses / n defaults | 9421 / 384 | 209 / 22 (test: 42 / 3) | 615 / 59 (test: 328 / 25) |
**Verdict against the pre-registered band: FINDING** — |AUC_synth − AUC_berka| = 0.307 vs tolerance 0.1, Berka side taken from the secondary (censored) — primary not evaluable on the temporal split label set. Per §8.3 a miss is reported as a finding; nothing is retuned.

**After (calibrated tables)**

| Comparison-set AUC, 95% CI | 0.610 [0.584, 0.636] (5 contiguous-ID entity folds, out-of-fold) | not evaluable (too few defaults in a split) (train loan_date < 1997-01-01, validate ≥) | 0.901 [0.835, 0.955] (same split; **censored**) |
| Default rate | 0.041 | 0.105 | 0.096 |
| n businesses / n defaults | 9424 / 384 | 209 / 22 (test: 42 / 3) | 615 / 59 (test: 328 / 25) |
**Verdict against the pre-registered band: FINDING** — |AUC_synth − AUC_berka| = 0.291 vs tolerance 0.1, Berka side taken from the secondary (censored) — primary not evaluable on the temporal split label set. Per §8.3 a miss is reported as a finding; nothing is retuned.

Nothing was tuned toward this gap in either direction (`latent_to_observable_correlation` and `label_noise_sigma` untouched).

## 5. Problems encountered

1. **Monsha'at gateway.** `statusCode 1016 Request Timeout` (HTTP 408, 8–12 s) on the first pass for 2025 Q2–Q4, then `1009 No Data Found` (HTTP 404, 0.1 s) for every Gregorian year 2022–2026 and Hijri year 1444–1447, every page size 5–100, with and without paging; `paginationIndex=0` → `1010 Validation Error` (so the index is 1-based); the unpaged URL read-timed out. Retried every five minutes for two hours (blocked_gateway). The national open-data portal returns a WAF "Request Rejected" page to programmatic access; the SME Monitor PDFs carry no activity × size table. Handling: Phase 1 declared blocked, scripts completed against the documented contract, nothing invented.
2. **Pagination semantics (SOP §3.2)** could therefore not be resolved: no page ever returned. `monshaat_pull.py` de-duplicates on (region, activity) and records duplicates and page counts as findings so the 250-vs-76 question is answered by the first successful pull.
3. **Column-label shift in the sector POS file** confirmed exactly as documented: `Transactions / Sales` holds the sector and `Sector` holds the indicator. Asserted in `calibration/sources.py` (the loader refuses a file where it does not hold), together with the BOM, the 96 × 17 × 2 grid, and sector sales summing to Total to 1e-9.
4. **Encoding.** `Restaurants & Café` is matched as the exact published label (with the accent) in both files; the Windows console renders it as mojibake, the code does not. Arabic labels in the ISIC map are stripped of bidi control characters before prefix matching (ruff flagged the raw control characters — replaced by `chr(0x200F)`).
5. **Eid in weekly data.** A 3-day window inside 7-day weeks over three years is weakly identified: NNLS put several sectors' Eid multiplier at exactly 0 and the retail Eid CI spans [0.19, 1.69]. Handled by taking Ramadan from the monthly fit (seven years), using the weekly fit only for the sub-monthly windows, and printing every CI into config comments.
6. **Generator-side recovery at quick scale.** With 80 retail businesses the sector-sum recovery was ~0.1 low in every window while F&B was exact; a generator-only test on 300 retail micro businesses recovered every window within 0.05. Cause: two medium-tier retailers' AR(1) lumpiness dominating the sum. The recovery estimator now equal-weights businesses (recorded before the full-scale run).
7. **Transactions file size.** Receipts at the measured ticket are ~70 M rows; resolved by thinning POS `sales` rows to 10% with a `sample_weight` column (schema change, both producers) rather than lowering base inflows. Full-scale `transactions.csv` stays ≈ 10.4 M rows.
8. **Pre-existing defect.** `eval/heldout_anomalies.py` had failed since the Phase 5 columns were added (rows built without `subfamily`, `value_date`, …); fixed in passing.
9. **ISIC activities that did not map cleanly** (to be confirmed on a real pull): M72 research & development, M73 advertising & market research, M75 veterinary — reported as borderline, not absorbed; I55 accommodation excluded from food service.
10. **Ramadan 1448 pinned one day late** in config (Umm al-Qura gives a 29-day Ramadan). Corrected.

## 6. Problems that remain

- **Sector and size mix remain author judgement (class C).** Monsha'at is the only public register with ISIC × size counts and it was unreachable. The 75.5/19.4/5.2 vs 87.0/11.5/1.4 aggregate gap is known and unresolved.
- **Financing share is uniform and ungrounded.** The SAMA credit shares are relative context; without the SME denominator the per-sector index is withheld. Even with it, the absolute level stays judgement (§7.4). The §21 NPL target remains `pending_week1_check` — bank credit by activity has no NPL field and no SME split.
- **POS measures consumer card spend.** Construction and professional-services seasonality and arrival rates stay class C; the POS lines that share their names measure consumers, not contractors or firms. Most B2B revenue moves by transfer and never touches a terminal.
- **Sector POS data past 2023 is weekly and starts 2020-05**; the weekly Eid window is weakly identified (three years), and no per-sector series exists for 2016–2019 at weekly resolution. Per-sector hold-out was possible for Ramadan, only a floor for Eid.
- **`base_monthly_inflow_sar` remains judgement**, so the calibration-derived revenue mix still differs from GASTAT 2022 (construction 60.9% vs 25.6%). The reclassification names this correctly as an input gap, not a validation miss; only a sourced base inflow or a sourced size mix moves it.
- **No clothing sector**, so the largest Eid effect in the data (β 1.90) is modelled only diluted inside the retail composite.
- **Ticket sizes are one bulletin edition** (four weeks, Aug–Sep 2026) pinned as the applied number; 2023–2025 editions differ by up to 20% (restaurants 29 → 35 SAR). Card adoption keeps changing the mix of what is paid by card; the number will need re-pinning each term.
- **The real-vs-synthetic gap is unchanged in direction** (see §4.4); nothing here was meant to move it, and nothing was tuned toward it.
- **`sample_weight` is a schema change awaiting §9 sign-off**; any downstream code that sums inflow amounts from `transactions.csv` must weight by it.

## 7. Evidence class summary

| item | before | after | why |
|---|---|---|---|
| Ramadan / Eid VALUE multipliers, retail_trade and food_beverage | C | **B** | SAMA POS Table 30d + weekly series, ≤2023 fit, 2024–2025 held out |
| Ramadan / Eid COUNT multipliers, retail_trade and food_beverage | did not exist (1.0 implicit) | **B** | same sources, count indicator |
| POS average ticket (receipt frequency), retail_trade and food_beverage | C (400 / 250 SAR implied) | **B** | SAMA weekly bulletin 12-Sep-2026 |
| `ramadan_calendar` 1448 | judgement | **B** | Umm al-Qura converter |
| Seasonality, construction and professional_services | C | C | POS does not measure them |
| Sector weights, tier splits | C | C | Monsha'at blocked |
| Financing share | C | C | denominator blocked; level is judgement regardless |
| `base_monthly_inflow_sar` | C | C | SOP §10.6 |
| Revenue-share metrics | "emergent target" (mislabelled) | calibration-derived check | closed form of the inputs (entry 12) |

Per-feature classes (A/B/C) are unchanged in `profile_engine/evidence.py`: feature 36 `ramadan_adjusted` stays C on Berka (calendar not covered), and the seasonality it gates is now measured on the synthetic side rather than assumed.

Registry counts after the run:

| **A — real_validated** | 43 | 1 `avg_monthly_inflow`, 2 `inflow_count_per_month`, 3 `inflow_regularity_score`, 4 `revenue_growth_rate_90d`, 5 `largest_single_source_ratio`, 6 `avg_monthly_outflow`, 7 `outflow_count_per_month`, 8 `recurring_expense_ratio`, 9 `expense_growth_rate_90d`, 10 `top_expense_category_share`, 11 `cash_flow_volatility`, 12 `inflow_outflow_ratio`, 13 `days_negative_balance_90d`, 14 `overdraft_events_90d`, 15 `volatility_index`, 16 `avg_daily_balance`, 17 `min_daily_balance_90d`, 18 `current_runway_days`, 18b `runway_days_avg_balance`, 19 `liquidity_trend_slope`, 20 `unique_counterparties_count`, 21 `counterparty_concentration_index`, 22 `new_counterparty_ratio_30d`, 26 `governance_transparency_score`, 32 `coverage_days_90d`, 33 `data_gap_ratio`, 41 `financing_outflow_ratio`, 42 `installment_capacity_sar`, 43 `inflow_break_recency_days`, 44 `net_flow_autocorr_lag7`, 45 `counterparty_persistence_ratio`, 46 `circular_counterparty_count`, 47 `downside_semideviation_90d`, 48 `upside_semideviation_90d`, 49 `flow_asymmetry_ratio`, 50 `revenue_shock_absorption_pct`, 51 `fixed_obligation_coverage_months`, 52 `liquidity_hazard_30d`, 53 `liquidity_hazard_60d`, 54 `liquidity_hazard_90d`, 60 `committed_monthly_outflow`, 61 `obligation_coverage_ratio`, 68 `max_consecutive_overdraft_days` | Predicts real outcomes |
| **B — grounded_synthetic** | 3 | 62 `ocr_forward_3m`, 62b `ocr_forward_6m`, 63 `obligation_horizon_months` | Behaves correctly under measured parameters |
| **C — demonstrated_only** | 25 | 23 `declared_mcc_code`, 24 `sharia_screen_status`, 25 `esg_proxy_score`, 27 `cash_and_equivalents_eom`, 28 `inventory_value_eom`, 29 `accounts_receivable_eom`, 30 `accounts_payable_eom`, 31 `short_term_liabilities_eom`, 34 `nisab_threshold_met`, 35 `hawl_completion_date`, 36 `ramadan_adjusted`, 37 `implied_dso_days`, 38 `implied_dio_days`, 39 `implied_dpo_days`, 40 `cash_conversion_cycle_days`, 55 `sector_relative_regularity_z`, 56 `sector_relative_volatility_z`, 57 `sector_relative_days_negative_z`, 58 `sector_relative_balance_z`, 59 `sector_relative_concentration_z`, 64 `mandate_cancellation_count_90d`, 65 `balloon_exposure_sar`, 66 `facility_utilisation`, 67 `headroom_days_of_burn`, 69 `emergency_line_present` | Implemented and functional; no public data exists to validate it |
