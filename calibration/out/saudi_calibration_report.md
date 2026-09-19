# Saudi national source calibration — report

**Repository:** `maal-sme-platform-main` · **SOPs:** `SOP_Saudi_Calibration_Sources.md` v1.0 (run 2026-09-16) and `SOP_Monshaat_Unblock_And_Report_Corrections.md` v2.0 (run 2026-09-17) · **Change record:** `DECISIONS.md` entries 12–20 · **Measurements:** `calibration/out/*.json` · **Archives:** `sources/sama/`, `sources/monshaat/`

Written for a defense reader. Every number below states what measured it, which edition, and whether it is measured (class B on the synthetic side), measured but not distinguishable from no effect (B-weak), judged (class C) or unknown. A finding that weakens the project is still a finding.

**Revision 2 (2026-09-17).** Corrections per SOP v2.0, applied in place; every superseded v1.0 figure is kept next to its replacement:

- Monsha'at Phase 1 and Phase 4 **completed**. v1.0's "blocked_gateway" was a misdiagnosis: the v1.0 run probed 2023 Q2 – 2026 Q1 against a dataset that covers 2019Q2 – 2021Q4, and read the fast `1009 No Data Found` as an outage. (The SOP v2.0 account of empty query parameters does not match the v1.0 code, which sent real values — DECISIONS.md 14.1.) §1, §3.1, §3.6, §5 problem 1 and §6 corrected.
- Class A split into **A1** (computed on real data) and **A2** (computed *and* predictive) by a CI rule: 22 of 43 are A2. §7 counts and claims regenerated.
- **7 of 16** seasonality parameters reclassified B → **B-weak** (interval contains no effect). Applied values unchanged. §2 and §7 regenerated.
- §3.7 held-out table now carries PASS / BOUNDED / FAIL / NOT_APPLIED (12 / 8 / 0 / 16). Restaurant Eid is **BOUNDED, not PASS**.
- §4.4 rerun under one CV protocol across all three sources; the protocol × source matrix replaces the single gap figure. The §15 exclusion is tested for label selectivity (it is selective).
- Ticket sizes reported across four editions with the spread (B5); the applied value stays the archived bulletin edition because the generator is frozen through Workstream B — re-pin recorded as a proposed change.

**One-paragraph summary.** All five defects the v1.0 SOP set out to fix now have a sourced answer. From SAMA: the food-service Ramadan direction (restaurants **fall** to 0.82× in Ramadan and spike to 1.66× at Eid; the placeholder had 1.45× / 1.80×), the ticket sizes (retail 61.5 SAR and restaurants 29.0 SAR against config-implied 400 / 250), and the held-out years (2024 and 2025 scored against the ≤2023 fit without refitting). From the Monsha'at register (2021 Q4, the newest edition the gateway serves): the sector count mix (retail 0.450, construction 0.360, food 0.161, professional 0.029) and the micro/small/medium split per sector, replacing judgement; and, divided into SAMA credit by activity, a sector-conditional financing shape. What the register did not fix — and the report says so — is the revenue mix against GASTAT: with the count mix sourced, the remaining gap is the two unsourced inputs `base_monthly_inflow_sar` and `size_tier_scale`. The real-versus-synthetic comparison, rerun under one protocol on all three sources, is in §4.4; the Berka side is estimated on an eligible population that the coverage rule selects toward lower risk.

## 1. What was done

**SAMA Monetary and Financial Statistics, Table 30d — Points of Sale Transactions by Sectors.** Origin: Saudi Central Bank (SAMA). Retrieved via KAPSARC Data Portal mirror (OpenDataSoft export API) on 2026-09-16; span 2016-01-01 → 2023-12-01, 3,264 tidy rows. Used for: Phase 2 — β_h per Hijri month per sector (the §22 decomposition); Phase 3 — 2023 ticket-size edition. Archive `sources/sama/pos_by_sector_monthly_2016_2023.csv`, SHA-256 `4aea3d0ed44ccd50b26f311c640e8ae609f96155e549e7341d8028adda49360c`.

**SAMA Monetary and Financial Statistics — Points of Sale Transactions (aggregate).** Origin: Saudi Central Bank (SAMA). Retrieved via KAPSARC Data Portal mirror (OpenDataSoft export API) on 2026-09-16; span 1995-01-01 → 2026-07-01, 1,683 tidy rows. Used for: Phase 2 — terminal counts for the adoption trend; Phase 3 — aggregate held-out 2024/2025 test; §5.4 value-vs-count divergence. Archive `sources/sama/pos_aggregate_1995_2026.csv`, SHA-256 `c08b693ad7f520d16415d437a9778480ead35a34b9c77bdf77383c95a1564f6e`.

**SAMA Monetary and Financial Statistics — Bank Credit by Economic Activity (17 sectors).** Origin: Saudi Central Bank (SAMA). Retrieved via KAPSARC Data Portal mirror (OpenDataSoft export API) on 2026-09-16; span 2021-07-01 → 2026-04-01, 360 tidy rows. Used for: Phase 4 — credit by activity with Individuals' Loans excluded; ÷ the Monsha'at SME count = credit per SME (§3.6). Archive `sources/sama/bank_credit_by_activity_2021_2026.csv`, SHA-256 `10cefcf7b76ac3e05fcaaafb2116c77966d1e7a57f00ef1e410150da896136af`.

**SAMA Weekly Points of Sale Transactions (by activity and city).** Origin: Saudi Central Bank (SAMA). Retrieved via KAPSARC Data Portal mirror (OpenDataSoft export API) on 2026-09-16; span 2020-05-10 → 2025-07-06, 9,720 tidy rows. Used for: Phase 2 — the weekly window model that resolves the 3-day Eid; Phase 3 — per-sector held-out 2024/2025 and the 2025 ticket edition. Not in the SOP's inventory; found on the same mirror. Archive `sources/sama/pos_by_sector_weekly_2020_2025.csv`, SHA-256 `4966f401e979564676236406b411a4de0093e2e9003ce8b2513b1e4d61f00d40`.

**SAMA Weekly Points of Sale Transactions bulletin, 12-Sep-2026 bulletin (four weeks: 16 Aug–12 Sep 2026).** Origin: SAMA. Direct PDF, retrieved 2026-09-16. Used for: Phase 3 ticket sizes at the finest activity split. Archive `sources/sama/sama_weekly_pos_bulletin_2026-09-12.pdf`, SHA-256 `c2b285f3aa57bc9c97f8874000139626ba50c4141f155477cd2021476d01e3cd`.

**Monsha'at Enterprises Statistics (region × ISIC × size).** Origin: Monsha'at. Retrieval path: the OpenData gateway `https://pservices.monshaat.gov.sa/BI/TaskService/OpenData/EnterprisesStatistics/{Year}/{Quarter}?paginationIndex={1-based}&recordsPerPage={n}`, both parameters required and non-empty. Dataset span as probed on 2026-09-17: **2019Q2 – 2021Q4** (11 quarters; 1009 at 2019Q1 and from 2022Q1 on). Pagination as resolved: `totalRecords` = rows on the page; `totalPages` is not a per-quarter figure (188 at 100/page for every quarter while a quarter ends after ~18 pages) and is ignored — the loop stops at the first confirmed 1009; 1011 / 1016 / HTTP 5xx are transient and retried, 1009 is final. Rows are summed, not de-duplicated: (region, activity) repeats 2–4× with different counts in the five large regions (a hidden sub-region split), and the summed national total matches Monsha'at's published figures (DECISIONS.md 14.2). Archived:

| archive | edition | pages | rows | distinct region × activity | SMEs (Σ rows) | SHA-256 |
|---|---|---|---|---|---|---|

*v1.0 (superseded):* "Not archived: the gateway answered 1016/1009 on every quarter tried." The quarters tried were 2023 Q2 – 2026 Q1; none exists in the dataset. Access date of the v1.0 attempt 2026-09-16; of the successful pull 2026-09-17.

**GASTAT seasonally-adjusted real GDP by institutional sector (2023=100).** Deliberately **excluded** (DECISIONS.md 13.10): the export interleaves five unit series under one label, and a seasonally-adjusted, three-sector series cannot inform a four-sector Hijri seasonality calibration.

## 2. Parameters changed

| parameter | old | new | source (edition) | class before → after |
|---|---|---|---|---|
| `seasonality_value_multiplier.retail_trade.pre_ramadan_10d` | 1.10 | **1.28** CI [0.68, 1.88] | SAMA weekly POS 2021–2023, window model | C → **B-weak** (v1.0 said B) |
| `seasonality_value_multiplier.retail_trade.ramadan` | 1.30 | **1.34** CI [1.28, 1.39] | SAMA Table 30d monthly 2016–2023 excl. 2020, §22 NNLS | C → **B** |
| `seasonality_value_multiplier.retail_trade.eid` | 2.20 | **0.94** CI [0.19, 1.69] | SAMA weekly POS 2021–2023, window model | C → **B-weak** (v1.0 said B) |
| `seasonality_value_multiplier.retail_trade.post_eid_7d` | 0.80 | **0.84** CI [0.73, 0.94] | SAMA weekly POS 2021–2023, window model | C → **B** |
| `seasonality_count_multiplier.retail_trade.pre_ramadan_10d` | 1.00 (implicit) | **1.09** CI [0.84, 1.35] | SAMA weekly POS (count), window model | C → **B-weak** (v1.0 said B) |
| `seasonality_count_multiplier.retail_trade.ramadan` | 1.00 (implicit) | **1.12** CI [1.05, 1.20] | SAMA Table 30d monthly (count), §22 NNLS | C → **B** |
| `seasonality_count_multiplier.retail_trade.eid` | 1.00 (implicit) | **0.95** CI [0.75, 1.15] | SAMA weekly POS (count), window model | C → **B-weak** (v1.0 said B) |
| `seasonality_count_multiplier.retail_trade.post_eid_7d` | 1.00 (implicit) | **0.86** CI [0.79, 0.94] | SAMA weekly POS (count), window model | C → **B** |
| `seasonality_value_multiplier.food_beverage.pre_ramadan_10d` | 1.05 | **1.00** CI [0.67, 1.32] | SAMA weekly POS 2021–2023, window model | C → **B-weak** (v1.0 said B) |
| `seasonality_value_multiplier.food_beverage.ramadan` | 1.45 | **0.82** CI [0.76, 0.87] | SAMA Table 30d monthly 2016–2023 excl. 2020, §22 NNLS | C → **B** |
| `seasonality_value_multiplier.food_beverage.eid` | 1.80 | **1.66** CI [1.44, 1.89] | SAMA weekly POS 2021–2023, window model | C → **B** |
| `seasonality_value_multiplier.food_beverage.post_eid_7d` | 0.85 | **0.96** CI [0.95, 0.98] | SAMA weekly POS 2021–2023, window model | C → **B** |
| `seasonality_count_multiplier.food_beverage.pre_ramadan_10d` | 1.00 (implicit) | **1.00** CI [0.82, 1.19] | SAMA weekly POS (count), window model | C → **B-weak** (v1.0 said B) |
| `seasonality_count_multiplier.food_beverage.ramadan` | 1.00 (implicit) | **0.70** CI [0.66, 0.73] | SAMA Table 30d monthly (count), §22 NNLS | C → **B** |
| `seasonality_count_multiplier.food_beverage.eid` | 1.00 (implicit) | **0.97** CI [0.92, 1.03] | SAMA weekly POS (count), window model | C → **B-weak** (v1.0 said B) |
| `seasonality_count_multiplier.food_beverage.post_eid_7d` | 1.00 (implicit) | **0.92** CI [0.87, 0.97] | SAMA weekly POS (count), window model | C → **B** |
| `sector_economics.retail_trade.avg_inflow_ticket_sar` (replaces `inflow_tx_per_day` 5.0) | implied 400 SAR/receipt | **61.5 SAR** (one edition; cross-edition mean 63.2, spread 19% — §3.5) | SAMA weekly bulletin 12-Sep-2026, Table 1, four-week Σvalue ÷ Σcount | C → B |
| `sector_economics.food_beverage.avg_inflow_ticket_sar` (replaces `inflow_tx_per_day` 6.0) | implied 250 SAR/receipt | **29.0 SAR** (one edition; cross-edition mean 31.1, spread 22% — §3.5) | SAMA weekly bulletin 12-Sep-2026, Table 1, four-week Σvalue ÷ Σcount | C → B |
| `sector_size_distribution.retail_trade` weight; micro/small/medium | 0.35; 0.85/0.13/0.02 | **0.4498; 0.7601/0.2191/0.0208** | Monsha'at Enterprises Statistics 2021 Q4 (register census, large tier excluded) | C → **B** (v1.0: blocked) |
| `sector_size_distribution.construction` weight; micro/small/medium | 0.20; 0.45/0.40/0.15 | **0.3599; 0.7429/0.2288/0.0283** | Monsha'at Enterprises Statistics 2021 Q4 (register census, large tier excluded) | C → **B** (v1.0: blocked) |
| `sector_size_distribution.food_beverage` weight; micro/small/medium | 0.20; 0.90/0.09/0.01 | **0.1611; 0.7564/0.2238/0.0198** | Monsha'at Enterprises Statistics 2021 Q4 (register census, large tier excluded) | C → **B** (v1.0: blocked) |
| `sector_size_distribution.professional_services` weight; micro/small/medium | 0.25; 0.75/0.20/0.05 | **0.0292; 0.6929/0.2766/0.0305** | Monsha'at Enterprises Statistics 2021 Q4 (register census, large tier excluded) | C → **B** (v1.0: blocked) |
| `financing.share_of_businesses.retail_trade` | 0.35 uniform | **0.384** (index 1.10 × level 0.35) | SAMA credit by activity 2026 Q2 ÷ Monsha'at SME count 2021 Q4 | C → **B (shape) / C (level)** (v1.0: blocked) |
| `financing.share_of_businesses.construction` | 0.35 uniform | **0.328** (index 0.94 × level 0.35) | SAMA credit by activity 2026 Q2 ÷ Monsha'at SME count 2021 Q4 | C → **B (shape) / C (level)** (v1.0: blocked) |
| `financing.share_of_businesses.food_beverage` | 0.35 uniform | **0.296** (index 0.85 × level 0.35) | SAMA credit by activity 2026 Q2 ÷ Monsha'at SME count 2021 Q4 | C → **B (shape) / C (level)** (v1.0: blocked) |
| `financing.share_of_businesses.professional_services` | 0.35 uniform | **0.394** (index 1.12 × level 0.35) | SAMA credit by activity 2026 Q2 ÷ Monsha'at SME count 2021 Q4 | C → **B (shape) / C (level)** (v1.0: blocked) |
| `output.pos_sales_transaction_sample_rate` | — (all rows emitted) | **0.1** with `transactions.sample_weight` = 1/rate on POS `sales` rows | decision, DECISIONS.md 13.6 | structural |
| `ramadan_calendar` 1448 `ramadan_end` / `eid_start` / `eid_end` | 2027-03-09 / 03-10 / 03-12 | **2027-03-08 / 03-09 / 03-11** | Umm al-Qura via hijridate 2.6.0 (Ramadan 1448 has 29 days) | judgement → B |
| `emergent_validation_targets`: revenue-share metrics | `targets` | `calibration_derived_checks` (closed form) | SOP §2.2, DECISIONS.md entry 12 | reclassified |
| `emergent_validation_targets.targets` | 2 | + `days_negative_balance_distribution`, `realised_dso_vs_archetype`, `ramadan_amplitude_recovered` | SOP §2.3 | registered |
| `seasonality_*_multiplier.construction / .professional_services` | unchanged | unchanged, labelled `evidence_class: C` | POS does not measure them (§5.3) | C |
| `base_monthly_inflow_sar`, `size_tier_scale` (all sectors) | unchanged | unchanged | SOP §10.6 — remain judgement; now the only unsourced inputs behind §4.2 | C |

## 3. Findings

### 3.1 Sector and size mix from the register (2021 Q4) — completed; v1.0 had it blocked

| sector | ISIC matched | SMEs | weight (four-sector) | micro / small / medium | weight range 2019Q4–2021Q4 | E[size_scale] before → after |
|---|---|---|---|---|---|---|
| retail_trade | G45 + G46 + G47 | 177,023 | **0.450** (was 0.35) | **0.760 / 0.219 / 0.021** (was 0.85/0.13/0.02) | 0.446–0.454 | 1.67 → 1.95 |
| construction | F41 + F42 + F43 | 141,677 | **0.360** (was 0.20) | **0.743 / 0.229 / 0.028** (was 0.45/0.40/0.15) | 0.360–0.425 | 4.30 → 2.08 |
| food_beverage | I56 | 63,424 | **0.161** (was 0.20) | **0.756 / 0.224 / 0.020** (was 0.90/0.09/0.01) | 0.103–0.161 | 1.41 → 1.95 |
| professional_services | M69 + M70 + M71 + M74 + J62 | 11,484 | **0.029** (was 0.25) | **0.693 / 0.277 / 0.030** (was 0.75/0.20/0.05) | 0.026–0.029 | 2.30 → 2.26 |

Four-sector SMEs 393,608 of 663,913 nationally (59.3%); large tier excluded (1,872). Borderline activities excluded and reported: M72 R&D, M73 advertising & market research, M75 veterinary, I55 accommodation (6,216 SMEs together). The register's aggregate micro/small/medium split is **75.1% / 22.5% / 2.4%** over the four sectors (77.7% / 19.9% / 2.4% over all activities), against v1.0's config-implied 75.5% / 19.4% / 5.1% and Monsha'at's 2023 national 87.0% / 11.5% / 1.4%. The 2021 register is less micro-skewed than the 2023 aggregate (the micro surge came after), and it is the same vintage as the GASTAT 2022 revenue anchor. **Two consequences that are not tuning:** professional services is 2.9% of the population, so its §23 cell (≥ 30 businesses, ≥ 10 defaults) is not met at N = 10,000 and the gate's sector-differential check reports `insufficient_sample` (§4.1); and construction's E[size_scale] falls from 4.30 to 2.08 — the SOP expected ~1.31 from a one-region sample, the census says 2.08.

*v1.0 (superseded):* "No national ISIC × size counts could be pulled … the config implies 75.5 / 19.4 / 5.2 % against Monsha'at's 87.0 / 11.5 / 1.4 %; construction's 45/40/15 is the outlier." The outlier diagnosis held: construction is 74/23/3 in the register.

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

**Food service falls in Ramadan — in every one of the seven calibration years.** Restaurants & Café β_Ramadan is 0.82 on value and 0.70 on count. The generator had food service **rising** 1.45× in Ramadan and 1.80× at Eid; it now falls to 0.82× (class B) and spikes to 1.66× at Eid (weekly window model, CI [1.44, 1.89], class B). The gate's old criterion 3 ("Ramadan > 1.15× baseline") encoded the wrong sign for this sector and was replaced (DECISIONS.md 13.8).

**Retail at Eid is not identified.** The retail Eid value multiplier moved 2.20 → 0.94 with CI [0.19, 1.69]: an interval spanning an order of magnitude and containing 1.0. It is applied (a weak measurement still beats an invented 2.20) and labelled **B-weak**, not B — v1.0 labelled it B. What is grounded is the sign of the correction from the placeholder, not the value.

**The Eid spike is clothing, and no generator sector captures it.** Clothing and Footwear β_Ramadan is 1.90 [1.77, 2.03], with Jewelry at 1.46. The retail composite dilutes it to 1.34. A clothing-retail sub-sector would be the honest way to show the spike; it is out of scope this term and named here.

### 3.3 Value versus count — the ticket-size effect

Total POS: β_Ramadan value **1.111**, count **0.978** → the average ticket rises **×1.14** in Ramadan. The generator carries value and count multipliers separately (the §21 `ramadan_amplitude_recovered` target checks both).

### 3.4 Weekly window model — what a monthly series cannot see

| generator sector ← POS series | window | value μ [CI] | class | count μ [CI] | class |
|---|---|---|---|---|---|
| food_beverage ← Restaurants & Café | pre_ramadan_10d | 1.00 [0.67, 1.32] | B-weak | 1.00 [0.82, 1.19] | B-weak |
| food_beverage ← Restaurants & Café | ramadan | 0.76 [0.50, 1.01] | B | 0.67 [0.55, 0.78] | B |
| food_beverage ← Restaurants & Café | eid | 1.66 [1.44, 1.89] | B | 0.97 [0.92, 1.03] | B-weak |
| food_beverage ← Restaurants & Café | post_eid_7d | 0.96 [0.95, 0.98] | B | 0.92 [0.87, 0.97] | B |
| retail_trade ← composite | pre_ramadan_10d | 1.28 [0.68, 1.88] | B-weak | 1.09 [0.84, 1.35] | B-weak |
| retail_trade ← composite | ramadan | 1.42 [0.73, 2.11] | B | 1.10 [0.86, 1.34] | B |
| retail_trade ← composite | eid | 0.94 [0.19, 1.69] | B-weak | 0.95 [0.75, 1.15] | B-weak |
| retail_trade ← composite | post_eid_7d | 0.84 [0.73, 0.94] | B | 0.86 [0.79, 0.94] | B |
| construction ← Construction & Building Materials (not applied) | pre_ramadan_10d | 1.00 [0.88, 1.13] | C | 1.10 [0.92, 1.28] | C |
| construction ← Construction & Building Materials (not applied) | ramadan | 0.79 [0.74, 0.83] | C | 0.97 [0.86, 1.08] | C |
| construction ← Construction & Building Materials (not applied) | eid | 0.00 [0.00, 0.00] | C | 0.40 [0.28, 0.52] | C |
| construction ← Construction & Building Materials (not applied) | post_eid_7d | 0.79 [0.65, 0.94] | C | 0.82 [0.78, 0.87] | C |

Intervals are leave-one-year-out over three years, so they are wide where the window is short. The class column is the B2 rule (B iff the CI excludes 1.0): 7 of the 16 applied parameters are B-weak. Several unapplied sectors sit at exactly 0.00 (the NNLS boundary — *not identified*). The restaurant Eid spike (1.66, CI [1.44, 1.89]) is identified.

### 3.5 Ticket sizes measured versus config-implied (SAR per receipt)

| sector | config-implied | bulletin 12-Sep-2026, latest week | bulletin, four weeks (**applied**) | weekly series Jan–Jul 2025 | monthly Table 30d 2023 | cross-edition mean (min–max, spread) |
|---|---|---|---|---|---|---|
| retail_trade | 400 | 58.1 | **61.5** | 63.4 | 69.9 | 63.2 (58.1–69.9, 19%) |
| food_beverage | 250 | 27.9 | **29.0** | 32.5 | 34.9 | 31.1 (27.9–34.9, 22%) |
| construction | 20000 | 127.6 | **129.3** | 197.2 | 250.3 | 176.1 (127.6–250.3, 70%) |
| professional_services | 6000 | 50.4 | **52.9** | — | — | 51.6 (50.4–52.9, 5%) |
| total | nan | 54.1 | **58.7** | 62.7 | 68.4 | 61.0 (54.1–68.4, 24%) |

**B5.** The applied value is one four-week edition; across the four editions the retail ticket spans 58.1–69.9 SAR (spread 19% of the mean) and the restaurant ticket 27.9–34.9 SAR (22%). Card adoption keeps moving the mix of what is paid by card, so the number needs re-pinning each term. Re-pin candidates: cross-edition mean {'retail_trade': 63.2, 'food_beverage': 31.1} or the 2023 annual mean {'retail_trade': 69.9, 'food_beverage': 34.9}; the applied {'retail_trade': 61.5, 'food_beverage': 29.0} is **left in place** because SOP v2.0 freezes the generator through Workstream B (non-negotiable 2) — the re-pin is a proposed config change (DECISIONS.md entry 20), not a silent edit. Bakeries & Pastries read 38.6 SAR (not modelled separately). Construction and professional tickets are consumer-facing POS lines and are context only.

### 3.6 Credit intensity by sector — completed; v1.0 had the index withheld

Latest quarter 2026-04-01: total bank credit 3.42 tn SAR, of which Individuals' Loans 42.6% — excluded and asserted. Business credit 1.96 tn SAR.

| generator sector ← activity | credit (SAR mn) | share of business credit | SMEs (Monsha'at 2021 Q4) | credit per SME (SAR) | index (count-weighted mean 1) | `share_of_businesses` |
|---|---|---|---|---|---|---|
| retail_trade ← Wholesale and Retail Trade | 220,795 | 11.2% | 177,023 | 1,247,268 | 1.10 | **0.384** |
| construction ← Construction | 150,844 | 7.7% | 141,677 | 1,064,702 | 0.94 | **0.328** |
| food_beverage ← Accommodation and Food Service Activities | 60,968 | 3.1% | 63,424 | 961,283 | 0.85 | **0.296** |
| professional_services ← Professional, Scientific and Technical Activities | 14,672 | 0.7% | 11,484 | 1,277,592 | 1.12 | **0.394** |

The per-SME shape is nearly flat (0.85–1.12): construction has almost as many SMEs as retail, so v1.0's "retail carries 1.5× construction's credit" was a share of credit, not of credit per business. The relative shape is measured (class B); the absolute level 0.35 stays judgement (class C). Hard limitations, unchanged: total bank credit rather than SME credit, no SME/large split, no NPL field, and the numerator (2026 Q2) and denominator (2021 Q4) are five years apart.

*v1.0 (superseded):* "converting shares into a per-business index needs the SME count per sector, which is the blocked Monsha'at pull. The index is therefore withheld."

### 3.7 Held-out 2024 and 2025 — fitted on ≤2023, never refitted (B3: one status per row)

| test | 2024 actual vs predicted | 2025 actual vs predicted | tolerance | status |
|---|---|---|---|---|
| Total POS value, Ramadan-month index (monthly fit) | 1.089 vs 1.151 (MAE all months 0.031) | 1.126 vs 1.144 (MAE 0.032) | ±0.1 | **PASS** |
| Total POS count, Ramadan-month index | 0.982 vs 1.042 (MAE all months 0.033) | 0.972 vs 1.018 (MAE 0.033) | ±0.1 | **PASS** |
| food_beverage sales, Ramadan window vs baseline (weekly series) | 0.827 vs β 0.816 | 0.852 vs β 0.816 | ±0.1 | **PASS** |
| food_beverage sales, Eid week vs baseline (weekly series — a floor on the 3-day multiplier) | 1.206 vs 1.66 | 1.221 vs 1.66 | one-sided | **BOUNDED** (direction consistent) |
| food_beverage count, Ramadan window vs baseline (weekly series) | 0.708 vs β 0.695 | 0.721 vs β 0.695 | ±0.1 | **PASS** |
| food_beverage count, Eid week vs baseline (weekly series — a floor on the 3-day multiplier) | 0.904 vs 0.97 | 0.979 vs 0.97 | one-sided | **BOUNDED** (direction consistent) |
| retail_trade sales, Ramadan window vs baseline (weekly series) | 1.280 vs β 1.338 | 1.433 vs β 1.338 | ±0.1 | **PASS** |
| retail_trade sales, Eid week vs baseline (weekly series — a floor on the 3-day multiplier) | 0.945 vs 0.94 | 0.713 vs 0.94 | one-sided | **BOUNDED** (direction consistent) |
| retail_trade count, Ramadan window vs baseline (weekly series) | 1.035 vs β 1.125 | 1.082 vs β 1.125 | ±0.1 | **PASS** |
| retail_trade count, Eid week vs baseline (weekly series — a floor on the 3-day multiplier) | 0.937 vs 0.95 | 0.853 vs 0.95 | one-sided | **BOUNDED** (direction consistent) |
| construction sales, Ramadan window vs baseline (weekly series) | 0.814 vs β 0.707 | 0.906 vs β 0.707 | ±0.1 | **NOT_APPLIED** |
| construction sales, Eid week vs baseline (weekly series — a floor on the 3-day multiplier) | 0.355 vs 0.00 | 0.433 vs 0.00 | one-sided | **NOT_APPLIED** (direction consistent; weekly floor above the prediction) |
| construction count, Ramadan window vs baseline (weekly series) | 0.964 vs β 0.905 | 1.037 vs β 0.905 | ±0.1 | **NOT_APPLIED** |
| construction count, Eid week vs baseline (weekly series — a floor on the 3-day multiplier) | 0.722 vs 0.40 | 0.656 vs 0.40 | one-sided | **NOT_APPLIED** (direction consistent; weekly floor above the prediction) |
| total sales, Ramadan window vs baseline (weekly series) | 1.054 vs β 1.111 | 1.157 vs β 1.111 | ±0.1 | **NOT_APPLIED** |
| total sales, Eid week vs baseline (weekly series — a floor on the 3-day multiplier) | 0.884 vs 0.82 | 0.780 vs 0.82 | one-sided | **NOT_APPLIED** (direction consistent) |
| total count, Ramadan window vs baseline (weekly series) | 0.905 vs β 0.978 | 0.948 vs β 0.978 | ±0.1 | **NOT_APPLIED** |
| total count, Eid week vs baseline (weekly series — a floor on the 3-day multiplier) | 0.931 vs 0.95 | 0.893 vs 0.95 | one-sided | **NOT_APPLIED** (direction consistent) |

**Status counts: PASS 12, BOUNDED 8, FAIL 0, NOT_APPLIED 16.** A BOUNDED row is not a pass: the restaurant Eid actuals (1.21 / 1.22 at weekly resolution) sit below the applied 1.66 because a 3-day window diluted over 7-day weeks is a floor, not a point estimate — the test can contradict the value (it does not) but cannot confirm it. Construction rows are NOT_APPLIED (v1.0 marked them ✗): the miss is real and is one more reason those multipliers never reach the generator.

*v1.0 (superseded):* every restaurant and retail row carried ✓, including the Eid rows the prose beneath described as a floor.

### 3.8 Hijri calendar

Every pinned row matches the Umm al-Qura converter.

## 4. Gate and validation results after the change

### 4.1 Week 3 gate at full scale (N = 10,000 research + 1,000 serving), register-derived inputs: **PASS (with a loud SKIP)** (v1.0 run, SAMA inputs only: PASS)

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
- PASS  daily_aggregates.inflow_total == Σ transactions[in] exactly on the 4338 businesses with no thinned rows
- PASS  Σ amount×sample_weight [in] / Σ inflow_total = 1.0005 on the 6662 thinned (POS-sector) businesses — within ±2% (unbiased thinning)
- PASS  per-business weighted inflow within ±20% of inflow_total for 99.9% of thinned businesses (> 95%)
- PASS  ALL construction implied_dso_days ∈ [60, 120]
- PASS  ALL professional_services implied_dio_days < 5
- PASS  construction DSO > retail DSO (medians)
- PASS  retail DIO > construction DIO (medians)
- SKIP  sector differential: insufficient_sample in ['professional_services'] (<30 businesses or <10 defaults) — run at full scale
- PASS  in-sample logistic AUC on observables strictly in (0.55, 0.95): 0.610
- PASS  closest cross-label pair is at least as close as a typical nearest neighbour
- PASS  ID 10001: window overlaps Ramadan
- ID 10001 (retail_trade): Ramadan/base = 1.51, Eid/base = 1.50  (one business — plotted, not gated)
- PASS  ID 10002: window contains no Ramadan days
- INFO  construction value: recovered/configured  pre_ramadan_10d 1.00/1.00  ramadan 0.80/0.80  eid 0.27/0.25  post_eid_7d 0.92/0.90  (class C, reported only)
- INFO  construction count: recovered/configured  pre_ramadan_10d 0.98/1.00  ramadan 1.00/1.00  eid 1.01/1.00  post_eid_7d 1.02/1.00  (class C, reported only)
- PASS  food_beverage value: recovered/configured  pre_ramadan_10d 1.03/1.00  ramadan 0.84/0.82  eid 1.62/1.66  post_eid_7d 0.95/0.96  — ramadan & eid within ±0.08 (class B, n=1160)
- PASS  food_beverage count: recovered/configured  pre_ramadan_10d 1.03/1.00  ramadan 0.72/0.70  eid 0.95/0.97  post_eid_7d 0.91/0.92  — ramadan & eid within ±0.08 (class B, n=1160)
- INFO  professional_services value: recovered/configured  pre_ramadan_10d 0.97/1.00  ramadan 0.85/0.90  eid 0.39/0.40  post_eid_7d 0.94/0.95  (class C, reported only)
- INFO  professional_services count: recovered/configured  pre_ramadan_10d 0.98/1.00  ramadan 0.97/1.00  eid 1.00/1.00  post_eid_7d 0.98/1.00  (class C, reported only)
- PASS  retail_trade value: recovered/configured  pre_ramadan_10d 1.28/1.28  ramadan 1.33/1.34  eid 0.92/0.94  post_eid_7d 0.83/0.84  — ramadan & eid within ±0.08 (class B, n=3296)
- PASS  retail_trade count: recovered/configured  pre_ramadan_10d 1.09/1.09  ramadan 1.11/1.12  eid 0.93/0.95  post_eid_7d 0.85/0.86  — ramadan & eid within ±0.08 (class B, n=3296)
- PASS  food_beverage: Ramadan VALUE direction down matches the measured direction (down)
- PASS  retail_trade: Ramadan VALUE direction up matches the measured direction (up)

The SKIP is the register showing through: professional services is 2.9% of the population (237 research businesses, 3 defaults), below the §23 minimum cell, so the sector-differential check is reported as `insufficient_sample` rather than passed. Criterion 3 is the population-level recovery of the configured value **and** count multipliers per sector (measured sectors gated at ±0.08 on the configured values — B-weak windows included, because the test is of the wiring, not of the number's grounding; class C reported).

### 4.2 §21 validation — after the register inputs (v1.0 figures alongside)

| calibration-derived check | v1.0 (SAMA inputs, judgement mix) | now (register mix) | GASTAT 2022 | band |
|---|---|---|---|---|
| medium-tier revenue share, closed form / realised | 0.415 / 0.440 | **0.189 / 0.197** | 0.343 | 0.15 rel |
| sector revenue share, TV distance | 0.519 TV | **0.384 TV** | — | 0.10 |
| within-sector size revenue share · food_beverage (micro/small/medium) | 0.59/0.29/0.12 → 0.390 KS | **0.36/0.46/0.18 → 0.264 KS** | 0.20/0.36/0.44 | 0.10 |

**B6 — the food-service size gradient.** GASTAT's section I puts 44% of accommodation-and-food revenue in medium firms; the generator's food_beverage puts 0.18 there. Three inputs drive that share: the tier split (now the register's 75.6 / 22.4 / 2.0 — v1.0 had 90 / 9 / 1), `size_tier_scale` (a medium firm at 15× a micro firm) and the ISIC scope. The register pull moved the KS from 0.390 KS to 0.264 KS — closer, still 2.6× the band — and it cannot close the rest: with 2% of firms medium, reaching a 44% revenue share would need a medium firm at ~55× a micro one, not 15×. Part of the gap is scope: GASTAT section I includes I55 accommodation (hotels, capital-heavy and mostly medium/large), which the generator deliberately excludes from food service (§3.1). The honest resolution is a sourced `size_tier_scale` (revenue per firm by tier from the same GASTAT workbook) plus a like-for-like I56-only anchor — both are `base_monthly_inflow_sar`-family inputs (SOP §10.6), not validation results.

**B7 — why the v1.0 distances moved with no input changed** (0.515 → 0.519 TV, 0.277 → 0.281 rel between the v1.0 *before* and *after* runs): the closed form was identical in both, because the inputs it reads did not change. The realised shares are computed from the generated tables, and the v1.0 *after* run carried the new seasonality multipliers — food service falling in Ramadan instead of rising — plus a fresh Poisson draw at the measured ticket, so the realised sector totals over the 180-day window shifted by a few tenths of a percent. That is regeneration under changed seasonality, not an undisclosed input change.

Full §21 output after the register inputs:

## A. Calibration-derived checks (closed form of the inputs — NOT emergent)

Research population, four modelled sectors. `closed form` = weight × base_monthly_inflow_sar × E[size_tier_scale] from config.yaml; no simulation involved.

| metric | closed form | realised | published (GASTAT 2022) | distance | band | status |
|---|---|---|---|---|---|---|
| revenue_share_medium_tier [modelled_sectors] | 0.189 | 0.197 | 0.343 | 0.427 rel | 0.15 | INPUTS DIFFER FROM GASTAT |
| revenue_share_medium_tier [all_sectors_context_only] | — | 0.197 | 0.470 | — | — | CONTEXT_ONLY (not like-for-like) |
| sector_revenue_share | — | — | — | 0.384 TV | 0.10 | INPUTS DIFFER FROM GASTAT |
| &nbsp;&nbsp;· retail_trade | 0.253 | 0.264 | 0.600 | | | |
| &nbsp;&nbsp;· construction | 0.650 | 0.639 | 0.256 | | | |
| &nbsp;&nbsp;· food_beverage | 0.068 | 0.068 | 0.106 | | | |
| &nbsp;&nbsp;· professional_services | 0.029 | 0.028 | 0.038 | | | |
| within_sector_size_revenue_share · retail_trade | 0.39/0.45/0.16 | 0.37/0.45/0.18 | 0.50/0.25/0.24 | 0.130 KS | 0.10 | INPUTS DIFFER FROM GASTAT |
| within_sector_size_revenue_share · construction | 0.36/0.44/0.20 | 0.33/0.46/0.21 | 0.16/0.34/0.50 | 0.297 KS | 0.10 | INPUTS DIFFER FROM GASTAT |
| within_sector_size_revenue_share · food_beverage | 0.39/0.46/0.15 | 0.36/0.46/0.18 | 0.20/0.36/0.44 | 0.264 KS | 0.10 | INPUTS DIFFER FROM GASTAT |
| within_sector_size_revenue_share · professional_services | 0.31/0.49/0.20 | 0.29/0.51/0.20 | 0.13/0.31/0.56 | 0.352 KS | 0.10 | INPUTS DIFFER FROM GASTAT |

6 input-consistency miss(es). These describe `sector_size_distribution`, `base_monthly_inflow_sar` and `size_tier_scale`; the resolution is a sourced correction of those inputs (DECISIONS.md entries 6, 12), not a validation result.

## B. Emergent targets (no closed form — the simulation had to run)

### days_negative_balance_distribution — REPORTED (pending_no_saudi_series)

Scorable research businesses n=9016: **16.4%** have ≥ 1 negative-balance day in the trailing 90; among those the 50/90/99th percentiles are 34 / 90 / 90 days. By sector: construction 31.6%, food_beverage 9.5%, professional_services 2.1%, retail_trade 7.1%.
Comparator: No Saudi SME source. Berka: 6.4% of accounts ever negative over their full history (Probe 1) — directional context only, different population and horizon. `comparable: false` — no Saudi SME series exists; nothing is judged against it.

### realised_dso_vs_archetype — machinery test against the §24 archetype bands

| sector | archetype dso_days band | realised median implied_dso_days | inside band? |
|---|---|---|---|
| retail_trade | [5, 25] | 13.3 | PASS |
| construction | [72, 108] | 94.2 | PASS |
| food_beverage | [1, 8] | 4.7 | PASS |
| professional_services | [25, 55] | 32.0 | PASS |

### ramadan_amplitude_recovered — §22 decomposition fitted to the generated data (tolerance_abs 0.08)

Research population, businesses operating for the full window; OLS on log sector-daily totals with trend + day-of-week + window dummies. exp(coef) vs the configured multiplier.

| sector | kind | pre_ramadan_10d | ramadan | eid | post_eid_7d | status |
|---|---|---|---|---|---|---|
| construction (n=2946) | value | 1.00 (cfg 1.00) | 0.80 (cfg 0.80) | 0.27 (cfg 0.25) | 0.92 (cfg 0.90) | PASS |
| construction (n=2946) | count | 0.98 (cfg 1.00) | 1.00 (cfg 1.00) | 1.01 (cfg 1.00) | 1.02 (cfg 1.00) | PASS |
| food_beverage (n=1160) | value | 1.03 (cfg 1.00) | 0.84 (cfg 0.82) | 1.62 (cfg 1.66) | 0.95 (cfg 0.96) | PASS |
| food_beverage (n=1160) | count | 1.03 (cfg 1.00) | 0.72 (cfg 0.70) | 0.95 (cfg 0.97) | 0.91 (cfg 0.92) | PASS |
| professional_services (n=208) | value | 0.97 (cfg 1.00) | 0.85 (cfg 0.90) | 0.39 (cfg 0.40) | 0.94 (cfg 0.95) | PASS |
| professional_services (n=208) | count | 0.98 (cfg 1.00) | 0.97 (cfg 1.00) | 1.00 (cfg 1.00) | 0.98 (cfg 1.00) | PASS |
| retail_trade (n=3296) | value | 1.28 (cfg 1.28) | 1.33 (cfg 1.34) | 0.92 (cfg 0.94) | 0.83 (cfg 0.84) | PASS |
| retail_trade (n=3296) | count | 1.09 (cfg 1.09) | 1.11 (cfg 1.12) | 0.93 (cfg 0.95) | 0.85 (cfg 0.86) | PASS |

### aggregate_default_rate — NOT REGISTERED (pending_week1_check)

Realised: **4.780%** (research, n=10000, 478 defaults). No citable SME-specific NPL series has been pinned; the target stays unregistered rather than asserting an untraceable number (§21). Bank credit by activity (Phase 4) has no NPL field.

### real_vs_synthetic_signal_strength — see `python -m eval.compare_real` → eval/out/real_vs_synthetic.md

Registered here (tolerance_abs 0.1); computed by the comparison harness, not repeated in this script.

source 'gastat_2022_sme_revenue_bn_sar': GASTAT, 'Operating Revenues by Economic Activity and Size 2022' — status: archived

**0 emergent FINDING(s)** (reported, never retuned) and 6 input-consistency miss(es) against GASTAT.

### 4.3 §21 validation — v1.0 run (SAMA inputs only), kept for comparison

| metric | closed form | realised | published (GASTAT 2022) | distance | band | status |
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
Scorable research businesses n=8909: **14.4%** have ≥ 1 negative-balance day in the trailing 90; among those the 50/90/99th percentiles are 33 / 90 / 90 days. By sector: construction 34.4%, food_beverage 13.1%, professional_services 4.1%, retail_trade 10.2%.
| sector | archetype dso_days band | realised median implied_dso_days | inside band? |
| retail_trade | [5, 25] | 14.9 | PASS |
| construction | [72, 108] | 95.4 | PASS |
| food_beverage | [1, 8] | 5.1 | PASS |
| professional_services | [25, 55] | 34.5 | PASS |
| sector | kind | pre_ramadan_10d | ramadan | eid | post_eid_7d | status |
| construction (n=1736) | value | 0.99 (cfg 1.00) | 0.82 (cfg 0.80) | 0.26 (cfg 0.25) | 0.90 (cfg 0.90) | PASS |
| construction (n=1736) | count | 0.99 (cfg 1.00) | 1.01 (cfg 1.00) | 1.01 (cfg 1.00) | 1.01 (cfg 1.00) | PASS |
| food_beverage (n=1348) | value | 1.00 (cfg 1.00) | 0.82 (cfg 0.82) | 1.70 (cfg 1.66) | 0.99 (cfg 0.96) | PASS |
| food_beverage (n=1348) | count | 1.00 (cfg 1.00) | 0.70 (cfg 0.70) | 1.00 (cfg 0.97) | 0.95 (cfg 0.92) | PASS |
| professional_services (n=1832) | value | 1.02 (cfg 1.00) | 0.90 (cfg 0.90) | 0.39 (cfg 0.40) | 0.96 (cfg 0.95) | PASS |
| professional_services (n=1832) | count | 1.02 (cfg 1.00) | 1.01 (cfg 1.00) | 0.99 (cfg 1.00) | 1.02 (cfg 1.00) | PASS |
| retail_trade (n=2502) | value | 1.28 (cfg 1.28) | 1.32 (cfg 1.34) | 0.91 (cfg 0.94) | 0.83 (cfg 0.84) | PASS |
| retail_trade (n=2502) | count | 1.09 (cfg 1.09) | 1.11 (cfg 1.12) | 0.92 (cfg 0.95) | 0.85 (cfg 0.86) | PASS |
Realised: **4.060%** (research, n=10000, 406 defaults). No citable SME-specific NPL series has been pinned; the target stays unregistered rather than asserting an untraceable number (§21). Bank credit by activity (Phase 4) has no NPL field.
**0 emergent FINDING(s)** (reported, never retuned) and 4 input-consistency miss(es) against GASTAT.

### 4.4 Real vs synthetic (`eval.compare_real`) — one protocol on all three sources (B4)

*v1.0 headline (superseded):* Comparison-set AUC, 95% CI · 0.610 [0.584, 0.636] (5 contiguous-ID entity folds, out-of-fold) · not evaluable (too few defaults in a split) (train loan_date < 1997-01-01, validate ≥) · 0.901 [0.835, 0.955] (same split; **censored**) → gap 0.291, three different protocols (cross-validated synthetic vs a single Berka temporal split with 25 test defaults).

| protocol | Synthetic (research, class B tables) | Berka primary (A vs B, finished contracts) | Berka secondary (A+C vs B+D, censored) |
|---|---|---|---|
| **Unified — repeated stratified group 5-fold × 20, out-of-fold pooled per repeat, median [2.5, 97.5 pct]** (HEADLINE) | **0.574 [0.568, 0.585]** (n 9495 / 449 defaults) | **0.721 [0.681, 0.770]** (n 209 / 22) | **0.859 [0.841, 0.880]** (n 615 / 59) |
| Temporal split at loan_date 1997-01-01 — single split, bootstrap CI (v1.0 Berka headline; kept as a **leakage check**) | — (one-window population; no temporal axis) | not evaluable (too few defaults in a split) (test 42 / 3) | 0.901 [0.835, 0.955] (test 328 / 25) |
| Expanding loan_date-quintile folds, bootstrap CI (secondary) | — | 0.740 [0.558, 0.902] (167 / 17) | 0.873 [0.789, 0.938] (492 / 39) |
| Contiguous-ID entity 5-fold, no shuffling, bootstrap CI (v1.0 synthetic headline; secondary) | 0.578 [0.550, 0.607] (n 9495 / 449) | — | — |

**Verdict against the pre-registered band: FINDING** — under one protocol on all three sources, |AUC_synth − AUC_berka| = **0.147** on the primary label set (0.574 vs 0.721; repeat bands do not overlap) and 0.285 on the secondary (0.859), vs tolerance 0.1. Per §8.3 a miss is reported as a finding; nothing is retuned.
**What the protocol changed.** The v1.0 headline compared a cross-validated synthetic AUC (0.578) with a single Berka temporal split (0.901 [0.835, 0.955], 25 test defaults) and reported a gap of 0.323. Under the same repeated stratified group k-fold on both sides the Berka primary estimate is 0.721 [0.681, 0.770] and the secondary 0.859 [0.841, 0.880]; the synthetic side is 0.574. The part of the v1.0 gap that was protocol rather than signal is the difference between the temporal-split row and the unified row on the Berka columns.

**§15 exclusion selectivity (B4):**

| label set | excluded n / defaults / rate | retained n / defaults / rate | risk ratio | Fisher p | share of defaults excluded |
|---|---|---|---|---|---|
| primary (A vs B, finished contracts) | 25 / 9 / 0.360 | 209 / 22 / 0.105 | **3.42** | 0.0018 | 29.0% |
| secondary (A+C vs B+D, censored) | 67 / 17 / 0.254 | 615 / 59 / 0.096 | **2.64** | 0.0007 | 22.4% |

The eligibility rule removes the thinnest accounts, and they default at 2.6–3.4× the retained rate. Every Berka AUC is an estimate on the eligible population; both the v1.0 number and the unified one carry that caveat.

Nothing was tuned toward this gap in either direction (`latent_to_observable_correlation` and `label_noise_sigma` untouched; generator-parameter hash unchanged through Workstream B, DECISIONS.md entry 17).

## 5. Problems encountered

1. **Monsha'at gateway — misdiagnosed in v1.0, resolved in v2.0.** *v1.0 said:* "1016 Request Timeout then 1009 No Data Found on every quarter tried … Phase 1 declared blocked." *What was true:* the dataset ends at 2021Q4 and begins at 2019Q2; the v1.0 run probed 2023 Q2 – 2026 Q1 with valid paging values and read the fast 1009 as an outage. SOP v2.0's "empty parameter values" does not describe the v1.0 code either (the empty template was in the documentation, not the calls). Diagnostic rule now in code: a 1009 in ~0.2 s is "no such period"; only 1011 / 1016 / HTTP 5xx / timeouts are transient. `calibration/monshaat_probe.py` scans 2018 Q1 → today before any loop runs.
2. **Pagination semantics (SOP §3.2 / v2.0 §A2)** — resolved on the live service: `totalRecords` = rows on the page; `totalPages` is not per quarter (188 at 100/page for every quarter, 18 pages actually served; 1877 at 10/page; 76 at 250/page — the SOP's "250 records / 76 pages" was this table-wide figure); page ordering deterministic; 250, 200, 100 and 50 per page all served data but 150/200/250 also returned HTTP 500 `1011` intermittently, which succeeds on retry. The loop uses 100 with a six-try backoff and stops at the first confirmed 1009.
3. **(region, activity) is not a primary key.** The five large regions return 2–4 rows per key with *different* counts and no field naming the split. Summing every row reproduces Monsha'at's published totals (663,913 vs ~663 k at end-2021; small and medium within 4% of the Q1 2022 Monitor); keeping the first occurrence gives 434 k. The v1.0 pull code would have de-duplicated on that key and lost 40% of the counts — it never ran, and the path is gone.
4. **Two ISIC prefixes in the v1.0 map did not match the labels the gateway serves** (M71, and the M72/M73/I55 borderline keys). Corrected before any number was read; the full membership as matched is in DECISIONS.md 14.4.
5. **Column-label shift in the sector POS file** confirmed exactly as documented and asserted in `calibration/sources.py`.
6. **Encoding.** `Restaurants & Café` is matched as the exact published label; Arabic labels are stripped of bidi control characters before prefix matching. The Windows console renders both as mojibake; the code does not.
7. **Eid in weekly data.** A 3-day window inside 7-day weeks over three years is weakly identified: NNLS put several sectors' Eid multiplier at exactly 0 and the retail Eid CI spans [0.19, 1.69]. Handled by taking Ramadan from the monthly fit, the sub-monthly windows from the weekly fit, and — v2.0 — labelling every interval that contains 1.0 as B-weak.
8. **Generator-side recovery at quick scale** was ~0.1 low for retail with 80 businesses; the estimator equal-weights businesses (DECISIONS.md 13.8) and recovers within 0.04 at full scale.
9. **Transactions file size.** Receipts at the measured ticket are ~70 M rows; resolved by thinning POS `sales` rows to 10% with a `sample_weight` column. With the register mix (45% retail) `transactions.csv` is 12.5 M rows.
10. **Pre-existing defects fixed in passing:** `eval/heldout_anomalies.py` (v1.0); `calibration/ticket_size.py` read a config key the v1.0 calibration had removed (v2.0).
11. **Ramadan 1448 pinned one day late** in config (Umm al-Qura gives a 29-day Ramadan). Corrected.
12. **A retry loop from the v1.0 session was still running** on the corrected pull script during the v2.0 run and overwrote the pull record once with its (correctly) empty result for 2023 Q2; stopped, record restored from the commit.

## 6. Problems that remain

- **`base_monthly_inflow_sar` and `size_tier_scale` remain judgement (class C)** and are now the whole of the revenue-mix gap against GASTAT 2022: with the count mix sourced, the closed form gives construction 65% of four-sector revenue (GASTAT 26%) and retail 26% (GASTAT 60%), and the medium-tier share has flipped from too high (0.44) to too low (0.20) against 0.34. Only a sourced base inflow or a sourced revenue-per-firm by tier moves it (SOP §10.6).
- **The register edition is 2021 Q4** — four years stale on the access date, the same vintage as the GASTAT 2022 anchor. The gateway serves nothing later; the 2023 SME Monitor aggregate (87 / 11.5 / 1.4) shows the micro tier has grown since. The weights need re-pulling the day a later quarter appears.
- **Professional services is below the §23 minimum cell at N = 10,000** (237 businesses, 3 defaults). Any per-sector claim about it is `insufficient_sample`; a larger N or a stratified research population is a change-control decision, not a generator edit.
- **Financing level is judgement.** The sector shape is measured; 0.35 is not. Total bank credit is not SME credit and has no NPL field; the §21 NPL target remains `pending_week1_check`.
- **7 of 16 seasonality parameters are B-weak.** They are applied because a weak measurement beats an invented one, and labelled so no reader takes the retail Eid value (0.94, CI [0.19, 1.69]) as grounded.
- **POS measures consumer card spend.** Construction and professional-services seasonality and arrival rates stay class C.
- **No clothing sector**, so the largest Eid effect in the data (β 1.90) is modelled only diluted inside the retail composite.
- **Ticket sizes are pinned to one edition** with a ~20% cross-edition spread; the re-pin to the cross-edition mean is a proposed change (entry 20), not applied, because Workstream B may not touch the generator.
- **The Berka side of every real-vs-synthetic number is an eligible-population estimate**: the coverage rule excludes 10% of labelled accounts that default at 2.6–3.4× the retained rate. The unified protocol's bands are fold-assignment spreads over 22 (primary) and 59 (secondary) defaults.
- **21 class-A features are A1, not A2**: computable on real data, not shown to predict real outcomes in this corpus. The counterparty family and the growth features are among them; their v1.0 "predicts real outcomes" claim is withdrawn.
- **The §21 target definition text in `config.yaml` still names the temporal split** as the Berka protocol; the sentence is superseded by B4 (entry 19) and left unedited so the config hash stays frozen through Workstream B. Amend at the next §9 change-control.
- **`sample_weight` is a schema change awaiting §9 sign-off.**

## 7. Evidence class summary

| item | v1.0 | now | why |
|---|---|---|---|
| Ramadan / Eid VALUE and COUNT multipliers, retail_trade and food_beverage (16) | C → B (all 16) | **9 B, 7 B-weak** | B2 rule: B iff the CI excludes 1.0; values unchanged |
| POS average ticket, retail_trade and food_beverage | C → B | B (one edition; spread reported) | SAMA weekly bulletin 12-Sep-2026; re-pin proposed |
| `ramadan_calendar` 1448 | judgement → B | B | Umm al-Qura converter |
| Sector weights, tier splits | C (blocked) | **B** | Monsha'at register 2021 Q4 (entry 14) |
| Financing share — relative shape / absolute level | C (blocked) | **B / C** | SAMA credit ÷ Monsha'at count; level is judgement |
| Seasonality, construction and professional_services | C | C | POS does not measure them |
| `base_monthly_inflow_sar`, `size_tier_scale` | C | C | SOP §10.6 — the remaining unsourced inputs |
| Revenue-share metrics | calibration-derived check (entry 12) | same | closed form of the inputs |
| Feature registry class A (43 features) | A "predicts real outcomes" | **A2 22 · A1 21** | B1 rule: A2 iff the univariate Berka AUC CI excludes 0.50 on ≥ 1 label set |

Claims now permitted per class — A2: "computed on real bank data and predictive of real credit outcomes (AUC with CI)"; A1: "computed on real bank data; predictive performance reported per feature, not assumed"; B: "behaves correctly under measured parameters"; B-weak: "behaves correctly under measured parameters whose interval contains no effect; applied, not claimed as grounded"; C: "implemented and functional; no public data exists to validate it".

**A2 (22):** 2 `inflow_count_per_month`, 3 `inflow_regularity_score`, 7 `outflow_count_per_month`, 8 `recurring_expense_ratio`, 10 `top_expense_category_share`, 12 `inflow_outflow_ratio`, 13 `days_negative_balance_90d`, 14 `overdraft_events_90d`, 15 `volatility_index`, 16 `avg_daily_balance`, 17 `min_daily_balance_90d`, 22 `new_counterparty_ratio_30d`, 32 `coverage_days_90d`, 33 `data_gap_ratio`, 49 `flow_asymmetry_ratio`, 50 `revenue_shock_absorption_pct`, 51 `fixed_obligation_coverage_months`, 52 `liquidity_hazard_30d`, 53 `liquidity_hazard_60d`, 54 `liquidity_hazard_90d`, 60 `committed_monthly_outflow`, 68 `max_consecutive_overdraft_days`.

**A1 (21):** 1 `avg_monthly_inflow`, 4 `revenue_growth_rate_90d`, 5 `largest_single_source_ratio`, 6 `avg_monthly_outflow`, 9 `expense_growth_rate_90d`, 11 `cash_flow_volatility`, 18 `current_runway_days`, 18b `runway_days_avg_balance`, 19 `liquidity_trend_slope`, 20 `unique_counterparties_count`, 21 `counterparty_concentration_index`, 26 `governance_transparency_score`, 41 `financing_outflow_ratio`, 42 `installment_capacity_sar`, 43 `inflow_break_recency_days`, 44 `net_flow_autocorr_lag7`, 45 `counterparty_persistence_ratio`, 46 `circular_counterparty_count`, 47 `downside_semideviation_90d`, 48 `upside_semideviation_90d`, 61 `obligation_coverage_ratio`.

Per-feature AUCs and intervals: `eval/out/feature_transfer.md`. Feature 22 qualifies on a hair-thin interval around a negligible effect (near-constant feature); the rule is applied as written and the effect size is printed.

Registry counts after the run (`eval/out/evidence_table.md`):

| **A2 — real_predictive** | 22 | 2 `inflow_count_per_month`, 3 `inflow_regularity_score`, 7 `outflow_count_per_month`, 8 `recurring_expense_ratio`, 10 `top_expense_category_share`, 12 `inflow_outflow_ratio`, 13 `days_negative_balance_90d`, 14 `overdraft_events_90d`, 15 `volatility_index`, 16 `avg_daily_balance`, 17 `min_daily_balance_90d`, 22 `new_counterparty_ratio_30d`, 32 `coverage_days_90d`, 33 `data_gap_ratio`, 49 `flow_asymmetry_ratio`, 50 `revenue_shock_absorption_pct`, 51 `fixed_obligation_coverage_months`, 52 `liquidity_hazard_30d`, 53 `liquidity_hazard_60d`, 54 `liquidity_hazard_90d`, 60 `committed_monthly_outflow`, 68 `max_consecutive_overdraft_days` | Computed on real bank data and predictive of real credit outcomes (univariate AUC with CI in eval/out/feature_transfer.md) |
| **A1 — real_computed** | 21 | 1 `avg_monthly_inflow`, 4 `revenue_growth_rate_90d`, 5 `largest_single_source_ratio`, 6 `avg_monthly_outflow`, 9 `expense_growth_rate_90d`, 11 `cash_flow_volatility`, 18 `current_runway_days`, 18b `runway_days_avg_balance`, 19 `liquidity_trend_slope`, 20 `unique_counterparties_count`, 21 `counterparty_concentration_index`, 26 `governance_transparency_score`, 41 `financing_outflow_ratio`, 42 `installment_capacity_sar`, 43 `inflow_break_recency_days`, 44 `net_flow_autocorr_lag7`, 45 `counterparty_persistence_ratio`, 46 `circular_counterparty_count`, 47 `downside_semideviation_90d`, 48 `upside_semideviation_90d`, 61 `obligation_coverage_ratio` | Computed on real bank data; predictive performance reported per feature, not assumed |
| **B — grounded_synthetic** | 3 | 62 `ocr_forward_3m`, 62b `ocr_forward_6m`, 63 `obligation_horizon_months` | Behaves correctly under measured parameters |
| **B-weak — grounded_synthetic_weak** | 0 |  | Behaves correctly under measured parameters whose interval contains no effect; the measurement is applied but not claimed as grounded |
| **C — demonstrated_only** | 25 | 23 `declared_mcc_code`, 24 `sharia_screen_status`, 25 `esg_proxy_score`, 27 `cash_and_equivalents_eom`, 28 `inventory_value_eom`, 29 `accounts_receivable_eom`, 30 `accounts_payable_eom`, 31 `short_term_liabilities_eom`, 34 `nisab_threshold_met`, 35 `hawl_completion_date`, 36 `ramadan_adjusted`, 37 `implied_dso_days`, 38 `implied_dio_days`, 39 `implied_dpo_days`, 40 `cash_conversion_cycle_days`, 55 `sector_relative_regularity_z`, 56 `sector_relative_volatility_z`, 57 `sector_relative_days_negative_z`, 58 `sector_relative_balance_z`, 59 `sector_relative_concentration_z`, 64 `mandate_cancellation_count_90d`, 65 `balloon_exposure_sar`, 66 `facility_utilisation`, 67 `headroom_days_of_burn`, 69 `emergency_line_present` | Implemented and functional; no public data exists to validate it |

*v1.0 (superseded):* A 43, B 3, C 25 — with every A carrying "Predicts real outcomes".
