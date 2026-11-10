# Numbers register

**Every headline number in this project, what it measures, and what it may be quoted for.**

> **Rules**
> 1. Any number on a slide, in the report or said at the defense comes from this file, quoted **with its population and protocol**.
> 2. When a number changes, its row changes **in the same commit**. `python -m eval.check_numbers` recomputes the checkable numbers from their source artifacts and fails if this file does not carry them.
> 3. Two AUCs from different rows of §2 are **not** comparable unless the row says so. They differ in feature set, protocol or population on purpose.
> 4. Section 7 lists retired numbers. If one of those appears anywhere, it is stale.

Data source of every synthetic number: `synthetic`. Research population = `business_id` 1–10,000 (training / CV); serving = 10,001–11,000 (disjoint seed and ID range, §23). Scorable = not `insufficient_data` (§15).

---

## 1. Approved headline sentences

Use these as written. Each carries the caveat that must travel with it.

| Claim | Caveat that must be said with it |
|---|---|
| **On real bank outcomes the engine reaches AUC 0.721 [0.681, 0.770]**, against 0.570 on deliberately harder synthetic labels under the same protocol and features. | **Do not add "inside the published SME range" until a published benchmark is archived in `sources/` and cited** — the often-quoted 0.70–0.80 is not yet sourced (§21 source discipline; the same gap blocks entry 22 Path B).  Berka is Czech retail bank accounts from the 1990s, not Saudi SMEs, so it tests whether the engine extracts real signal, not Saudi calibration. n = 209 with 22 defaults. The eligibility rule removes riskier accounts (risk ratio 3.42), so this is measured on the eligible population and is optimistic. |
| **The credit lens reaches 88.8% of the best AUC any model could achieve on our synthetic data** (0.5911 of a 0.6660 ceiling). | The ceiling exists because the synthetic labels deliberately contain noise that nothing observable can predict (§14). That design is what makes the labels non-circular. |
| **AUC ≥ 0.85 on the synthetic data is impossible by construction**, so a result that high would indicate leakage, not skill. | Applies to the *synthetic* labels only. Real-data AUCs (e.g. Berka secondary 0.859) are not subject to it. |
| **14 of 43 real-computed features separate confirmed defaults on Berka** (univariate AUC, 95% interval excluding 0.5 on the primary label); 22 of 43 do so on at least one of the two label sets. | Univariate, on Berka, with no correction for testing 43 features on two label sets. 8 of the 22 hold only on the secondary label, which is censored. 5 of the 43 are constant or have no rows on Berka, so 38 carry a value that varies there (entry 50). Do not say "22 features predict real defaults" without the label. |
| **Every decision is reproducible byte for byte**, and a saved decision can be verified: `python -m pipeline.verify`. | Receipt hashes are line-ending independent since `00ae025` (entry 40); a receipt made on Windows before that commit names its config, lens-config and data hashes as changed inputs, although the decision itself still reproduces. Covers the deterministic core only. Generated advisory text (if ever added, §36) is outside the receipt. |

---

## 2. Discrimination (AUC) — why there are several, and which to quote

| ID | AUC [95%] | Population | N / defaults | Features | Protocol | Source | Quote it for | Never quote it for |
|---|---|---|---|---|---|---|---|---|
| **A1** | **0.5911 [0.5842, 0.5996]** | research, scorable | 9,495 / 449 | 58 — the §8 `/profile` list minus 23–26 | repeated stratified group 5-fold × 20 (`unified_cv`) | `lenses/credit/model_v1.json` | **The credit lens's performance** | comparing with Berka (different features) |
| **A2** | **0.570 [0.563, 0.580]** | research, scorable | 9,495 / 449 | 25 scale-free real-computed features | same as A1 | `eval/out/real_vs_synthetic.md` | **Synthetic side of the real-vs-synthetic comparison** | the credit lens's performance |
| **A3** | **0.721 [0.681, 0.770]** | Berka primary label | 209 / 22 | same 25 as A2 | same as A1 | `eval/out/real_vs_synthetic.md` | **Real-data performance (headline)** | Saudi calibration |
| A4 | 0.859 [0.841, 0.880] | Berka secondary label (censored) | 615 / 59 | same 25 as A2 | same as A1 | `eval/out/real_vs_synthetic.md` | real-data performance, secondary label | the headline (label is censored) |
| A5 | 0.628 [0.536, 0.710] | serving (never trained on) | 943 / 45 | same 58 as A1 | A1 model scored once out of sample | `lenses/credit/model_v1.json` | out-of-sample sanity check on the disjoint demo population | a precise estimate (45 defaults) |
| A6 | 0.5936 | research, scorable | 9,495 / 449 | all 71 engine features incl. Zakat-only 27–31, + dummies | single stratified 5-fold | `eval/out/section14_rho_sweep.md` | the §14 sensitivity measurement at ρ = 0.6 | the credit lens (includes non-contract features) |
| A7 | 0.576 [0.550, 0.605] | research, scorable | 9,495 / 449 | same 25 as A2 | contiguous-ID entity 5-fold | `eval/out/real_vs_synthetic.md` | secondary protocol check | the headline |
| A8 | 0.901 [0.835, 0.955] | Berka secondary, temporal test | test 328 / 25 | same 25 as A2 | single temporal split at 1997-01-01 | `eval/out/real_vs_synthetic.md` | **leakage check only** | performance (single split; mixing it with A2 created a spurious 0.32 gap) |
| A9 | 0.610 | research only, scorable by the gate's own 60-day window (entry 39) | 9,016 | 6 observables + sector | **in-sample** | `eval/out/gate_week3_after_monshaat.txt` | Week 3 gate criterion 2 (signal exists, labels not recoverable) | any performance claim |

**Why A1, A2 and A6 differ (0.591 / 0.570 / 0.594):** the same population, but 58 vs 25 vs 71 features. A2 drops absolute-currency features so the comparison with Berka is scale-free. A6 includes the balance-sheet features that §8 keeps out of the credit lens. The protocols are repeated vs single. None of the three is wrong; they answer different questions.

---

## 3. The ceiling and the labels

| Number | Value | Population | Source |
|---|---|---|---|
| **Oracle ceiling** (AUC of the hidden latent itself) | **0.6660** | research, scorable (9,495) — use beside A1 | `lenses/credit/model_v1.json` |
| Oracle ceiling | 0.6648 | research, all 10,000 | `python -m eval.latent_ceiling` |
| Credit lens as share of ceiling | 88.8% | as A1 | `lenses/credit/model_v1.json` |
| Analytic approximation Φ(sd(logit)/√2) | 0.6766 (0.0118 from the measured 0.6648) | research, all | `eval.latent_ceiling` |
| Base default rate | 4.78% (478 / 10,000) all; 4.73% (449 / 9,495) scorable | research | `eval.latent_ceiling`; A1 |
| p_default decile risk ratio (p90 / p10) | 5.07× | research, all | `eval.latent_ceiling` |
| Logit variance from the latents | 90.4% (shock 63.3%, management 27.1%; label noise 9.6%; intercept 0%) | research, all | `eval.latent_ceiling` |
| Within-sector share of the shock term | 73.4% | research, all | `eval.latent_ceiling` |
| §25 fairness audit: construction's top-10 attributed features inside §25's liquidity / working-capital set | **not met** — 1 of 10 (schema 11–19); 2 of 10 (entry 1b, adds 37–40) | research, scored or partial_profile, construction 3,486; retrained model `79160cb` | `eval/out/within_sector_fairness.csv`; DECISIONS 43 (a finding, not a fairness claim) |
| Scale-up needed for a 0.85 ceiling | latent coefficients × 2.36 | — | `eval.latent_ceiling` |

The analytic form is **an approximation, not an identity**. It agreed to 0.0010 before calibration and to 0.0118 after, because the calibrated sector mixture is more lopsided.

---

## 4. §14 sensitivity — AUC as a function of ρ

Source: `eval/out/section14_rho_sweep.md` (`python -m eval.run_section14`). Protocol and features as A6. Labels identical at every ρ.

> **Re-run 2026-11-10** after entries 30, 35 and 38 changed ten of the 71 features (5, 20–22, 45, 55–59): both sweeps, eight full-scale generations, on the same machine as the originals (DECISIONS entry 52). The values before the re-run are retired in §7.

| ρ | 0.6 | 0.7 | 0.8 | 0.9 |
|---|---|---|---|---|
| logistic out-of-fold AUC | 0.5936 | 0.6040 | 0.6031 | 0.6087 |

**Nearly flat**: the spread is 0.0151, about one standard error (0.0144, Hanley–McNeil at this AUC and event count), and the curve is not monotone (0.6040 at ρ = 0.7, 0.6031 at 0.8). Before the engine changes the spread was 0.0100, under one standard error; say "about one standard error", not "less than". Up to 92% of the oracle-to-measured gap is the economics pipeline, not ρ (at ρ = 0.9: 0.0527 of 0.0572). Model baseline at ρ = 0.6 under the same protocol: logistic 0.5936 beats early-stopped XGBoost 0.5838 (best of the grid) and untuned XGBoost 0.5547. These are the A6 features, not the credit lens's.

## 4b. §14 sensitivity — AUC as a function of label noise

Source: `eval/out/section14_noise_sweep.txt` (`python -m eval.sweep_rho --param noise --values 0.0 0.2 0.5 1.0`, grid fixed before the run, DECISIONS entry 28). Protocol and features as A6, ρ = 0.6. Research scorable N = 9,495; defaults per σ from the seeded latent replication (all 10,000 research). σ = 0.2 is the shipped config.

| σ (label noise, logit units) | 0.0 | 0.2 | 0.5 | 1.0 |
|---|---|---|---|---|
| logistic out-of-fold AUC | 0.6135 | 0.5936 | 0.5954 | 0.5921 |
| oracle ceiling (scorable research) | 0.6691 | 0.6660 | 0.6646 | 0.6502 |
| research defaults (of 10,000) | 459 | 478 | 501 | 673 |

**Shallow**: from σ = 0 to 1.0 the logistic AUC moves 0.021 (under two standard errors of 0.0144, §4; re-run 2026-11-10, entry 52) and the ceiling 0.019; measured AUC stays at 89–92% of the ceiling throughout. Most of the label's unpredictability is the Bernoulli draw at a ~5% event rate, not σ. More noise also raises the default rate (expit is convex), so the σ = 1.0 column is not at the same base rate. The §14 circularity flag (≥ 0.85) is not reached at any σ.

---

## 5. Lens results (Week 8 v1s, DECISIONS entry 23)

| Lens | Number | Population / N | Source |
|---|---|---|---|
| Forecast — method shipped | **`naive90`** (trailing-90-day mean), chosen on the validation window (days 121–150) from 6 candidates fixed in advance | research, 9,495 | `eval/out/forecast_selection.md` |
| Forecast — test (days 151–180, never used to choose): median scale-free error, `naive90` vs naive30 | **0.323 vs 0.376** research (better for 58.5%); 0.344 vs 0.401 serving (better for 58.4%) | research 9,495; serving 943 | `eval/out/forecast_selection.md`, `eval/out/forecast_backtest.md` |
| Forecast — test MAPE, `naive90` vs naive30 | 13.0% vs 15.0% | 7,525 research with balance ≥ 1 month of outflow from zero | same |
| Forecast — test crunch recall / false alarms | `naive90` 79.4% / 0.5%; naive30 81.8% / 1.3% | 1,164 research that went negative | same |
| Forecast — Prophet and ARIMA on validation (days 121–150), median scale-free error; `naive90` stays chosen (entry 56) | arima 0.379, prophet 0.530, against naive90 0.345 and naive30 0.411 | research, 9,495 | `eval/out/forecast_prophet_arima.md` |
| Forecast — fresh-population test (seed 44, IDs 20001–21000, days 151–180, scored once; entry 56), median scale-free error | naive90 0.331, arima 0.348, naive30 0.374, prophet 0.467 | fresh population, 944 scorable of 1,000 | same |
| Forecast — fresh-population crunch recall / false alarms | naive90 83.5% / 0.4%; arima 85.8% / 1.8%; naive30 84.3% / 0.9%; prophet 89.8% / 3.8% | 127 that went negative / 817 that did not | same |
| Forecast — fit cost, median seconds per business (10 worker processes; 0 fallbacks for either) | arima 0.720 s, prophet 0.406 s | fresh population, 944 | same |
| Anomaly — held-out round-trip recall@10 (shipped: seasonal gate on, exact repeat check; entries 36.7, 37.5) | **0.93** (precision 0.2126 of a 0.2268 ceiling) | serving, 50 businesses | `eval/out/anomaly_eval.md` |
| Anomaly — same-day exact duplicate recall@10, exact repeat check shipped (entry 37.5) | **0.66** — **designed-for, not held-out**; never quote it as a general "duplicate recall" | serving, 50 businesses | same |
| Anomaly — late repeat charge recall@10 (1–7 days later, ±3%) | 0.00 — a seen type, used to choose the variant (entry 37) | serving, 50 businesses | same |
| Anomaly — duplicates the exact check was never shown (test, reported once, entry 37.5) | re-sent payment 0.00 with the check and without; vendor-record duplicate 0.04 with the check and without | serving, 50 per type | `eval/out/repeat_variants.md` |
| Anomaly — injected types | both caught (ranks 1 and 5) | demo business 10001 | same |
| Anomaly — repeat-payment rule, **evaluated, not shipped** (entry 36.8) | same-day duplicate 0.6 (**designed-for, not held-out**); held-out late repeat 0.02; round-trip falls to 0.86; 3.31 false hits per 1,000 transactions on clean businesses | serving, 50 per type; 861 clean | `eval/out/anomaly_eval_repeat_rule.md` |
| Anomaly — seasonal gate (entry 36.7): Ramadan share of false flags ÷ Ramadan share of transactions | **1.37 without the gate, 1.02 with it** | serving, 751, control series | `eval/out/anomaly_seasonal.md` |
| Sharia screen (feature 24) — research | **85.1% compliant / 14.9% soft_flag_review / 0.0% hard_flag** (soft flags all retail: MCC 5999 or no MCC) | research, 10,000 | `eval/out/sharia_screen.md` |
| Sharia screen — evidence basis / financing disclosure | declared MCC 60.3% · registered sector 39.7% · disclosure asked of 34.8% | research, 10,000 | same |
| Zakat — demo 10001 liability | SAR 5,963.26 (base 238,530.46 × 2.5%) | demo | `python -m pipeline.week8 --demo` |
| Zakat – nisab, valued at the calculation month (entry 54) | July 2026: 85 g × SAR 491.0625/g = **SAR 41,740.31**; January 2026 (demo 10002 only): SAR 48,708.99 | 10,999 of 11,000 businesses have a July 2026 calculation date | `lenses/zakat/gold_monthly_sar_per_gram.csv`: World Bank Pink Sheet monthly average (2026-11-03 edition) × 3.75 SAR/USD (checked against SAMA's archived bulletins, within 0.0008) ÷ 31.1034768 g; pending Sharia advisor review |

---

## 5b. Demo scenario library (DECISIONS entry 29)

Source: `eval/out/scenario_library_check.txt` (`python -m scenarios.run --check`). Business 10001 (serving) regenerated under each scenario in `scenarios/library.yaml`, with severities fixed before the first run. N = 1 business per scenario: these are demonstrations, not estimates. Every regenerate-and-run took under 0.5 s. Re-run on 2026-11-09 with the retrained model (`79160cb`); only the PD column moved (DECISIONS entry 46).

| scenario | credit decision | PD | cash alert | injected anomalies flagged | Zakat (SAR) |
|---|---|---|---|---|---|
| `baseline` | approved | 0.0526 | watch | 2 of 2 | 5963.26 |
| `calm_counterfactual` | approved | 0.0663 | none | 0 of 0 | 9031.05 |
| `mild_slowdown` | approved | 0.0743 | none | 2 of 2 | 6890.63 |
| `severe_collapse` | declined (affordability) | 0.0390 | crunch | 2 of 2 | 1327.52 |
| `late_sudden_shock` | approved | 0.0873 | none | 2 of 2 | 6568.57 |
| `fraud_pattern` | approved | 0.0960 | none | 5 of 5 | 4978.57 |
| `combined_crisis` | declined (affordability) | 0.0656 | crunch | 2 of 2 | 2651.45 |
| `thin_file_newcomer` | not decided (insufficient_data) | — | — | — | — |

Read with entries 29 and 46: the declines come from the §31 affordability gate, not from the risk model; **PD does not follow the severity of the disaster** (the severe collapse has the lowest PD, 0.0390, and the calm half-year, 0.0663, scores above the baseline, 0.0526); the late three-week shock is not seen by any lens; and the anomaly lens returns its 10-flag cap in every scenario, including the calm one.

---

## 5d. What the whole serving population shows in a demo (DECISIONS entries 29, 43, 47)

Source: `eval/out/demo_exposure.md` (`python -m eval.demo_exposure`). Serving, all 1,000 businesses through the shipped Week 8 code path; 943 scored or partial_profile, 57 `insufficient_data`. Counts of what the shipped lenses return; nothing is fitted or chosen.

| Number | Value | N | Caveat that must be said with it |
|---|---|---|---|
| First sentence of the customer explanation is about feature 3, `inflow_regularity_score` | **834 of 943**; feature 3 or its z-score 55 is among the three reasons for 943 of 943 | 943 | Within a sector the direction never varies: against the business for all 138 food and beverage and 373 retail cases, in its favour for all 298 construction and 25 professional services cases. The sentence describes the sector, not the business (entries 43, 47) |
| Declined | **281 of 943 declined**: 243 by the affordability gate, 38 by the risk model | 943 | The risk model decides few declines; say so before a judge finds it (entry 29) |
| Anomaly flags per business | **584 of 943 return the cap of 10 flags; the fewest is 4** | 943 | No business returns no flags. Flags are a review queue, not alarms |

---

## 5c. Forecast — §10 holdout shock and §16 Ramadan window (DECISIONS entry 36)

Source: `eval/out/holdout_shock.md` (`python -m eval.holdout_shock`). Serving, demo businesses and the `<1yr` tier excluded, N = 751. Shock from day 92; only shock-caused crunches count (the control stays at or above zero). Lead time = days between the first projected-negative warning and the actual negative balance; a miss is 0. Projection only — the liquidity hazard is not part of this test.

| Number | Value | N | Caveat that must be said with it |
|---|---|---|---|
| Lead time, neutral window, 30% shock: `naive90` vs naive30 | **median 15 vs 27 days**; detected 88.9% vs 96.3% | 27 crunches | The paired gap is −1 day [−4, 0]: small, and the interval reaches zero |
| False alarms on unshocked businesses, neutral window | `naive90` 3.8% vs naive30 8.3% | 636 | Say it with the lead time: the baseline's earlier warnings come with about twice the false alarms |
| Lead time, Ramadan window, 30% shock: `naive90` vs naive30 | **median 18 vs 32 days**; detected 84.6% vs 92.3%; false alarms 3.7% vs 10.4% | 26 crunches; 616 | Paired gap −6 days [−11, 0]; at 50% it is −9 [−17, −4]. `ramadan_adjusted` is a coarse flag, no seasonal correction |

---

## 6. Data validity

| Number | Value | Source |
|---|---|---|
| Week 3 gate | PASS with one loud SKIP (professional services, 237 businesses / 3 defaults, below the §23 minimum cell) | `eval/out/gate_week3_after_monshaat.txt` |
| Construction `implied_dso_days` (gate criterion 1) | 65.9 / 94.2 / 118.2 min/median/max, n = 3,679 — all inside [60, 120] | same |
| Professional `implied_dio_days` | max 3.39, n = 261 — all < 5 | same |
| Scorable / excluded, **by the gate's window** (90 days ending at the last month-end) | 9,914 scorable; 1,086 `insufficient_data`, of 11,000. The lenses use the engine's window (ending at the as-of date): 562 `insufficient_data`, research scorable 9,495 (entry 39) | same; `data/profile_status.csv` |
| §21 | 0 emergent findings; 6 input-consistency misses (medium-tier revenue share 19.7% vs GASTAT 34.3%; sector TV distance 0.384) | `eval/out/emergent_validation.md`, entry 12 |
| SAMA POS ticket (calibration input) | retail 61.5 SAR, restaurants 29.0 SAR | `config.yaml`, `calibration/out/` |
| Seasonality held-out years 2024–2025 | 12 PASS / 8 BOUNDED / 0 FAIL / 16 NOT_APPLIED | `calibration/out/saudi_calibration_report.md` |
| §15 exclusion selectivity on Berka | excluded accounts default at 3.42× (primary) / 2.64× (secondary) the retained rate; 29.0% / 22.4% of defaults excluded | `eval/out/exclusion_selectivity.md` |
| Evidence classes | A2 22, A1 21, B 3, C 25 of 71 registry entries | `eval/out/evidence_table.md` |
| A2 by label set | 14 of 43 on the primary label, 19 on the secondary, 11 on both; 5 of 43 constant or empty on Berka | `eval/out/feature_transfer.md` (entry 50) |

---

## 6b. Serving path — Week 7 latency (§19)

Source: `eval/out/latency_week7.md` (`python -m eval.latency_test`). **Re-run 2026-11-09** on the same 20-CPU machine as the 2026-10-11 run, with the current code: retrained credit model, entries 30, 35 and 38 in the engine, the anomaly seasonal gate and exact repeat check (entries 36.7, 37.5). Serving store, 1,000 businesses (§23 serving scale); every request computes the profile and the lens from inputs — nothing cached. Timings vary run to run, so re-running the test means updating this section. Format: p50 / p95 / max. Serving store, 1,000 businesses (§23 serving scale); every request computes the profile and the lens from inputs — nothing cached. Timings vary run to run, so re-running the test means updating this section. Format: p50 / p95 / max.

| Path | Value | n |
|---|---|---|
| `/lenses/credit` — full §19 path (store → profile engine → model → SHAP → §13 text) | **124 / 150 / 248 ms** | 1,000 (every serving business) |
| `/lenses/credit` over real HTTP (uvicorn) | 131 / 152 / 169 ms | 50 |
| `/lenses/anomaly` — slowest route (per-business Isolation Forest) | 314 / 478 / 1028 ms | 100 |
| SHAP explanation alone (exact log-odds, `coef × z`) | 0.160 / 0.176 / 0.225 ms | 194 |
| Targets (§19) | API < 2 s, SHAP < 1 s — **PASS on the maximum**, not just a percentile | — |
| API vs Week 8 CLI decisions (demo businesses, all four lenses) | identical | 3 |

For comparison, the Week 8 CLI takes ~30 s a call because it streams the full `transactions.csv`. The serving store is what changes that, not caching.

---

## 7. Retired numbers — stale if seen anywhere

| Retired | Why | Replaced by |
|---|---|---|
| Ceiling 0.6902; ρ curve 0.6323 → 0.6564 (monotone) | measured before the Monsha'at / SAMA calibration | §3, §4 |
| Model baseline 0.6336 logistic / 0.6221 XGBoost | 27-feature proxy, pre-calibration | §4, A1 |
| Within-sector share 56.8% | pre-calibration sector weights | 73.4% (§3) |
| Medium-tier revenue share 43.9% / 44.0% vs 34.3% | before the Monsha'at register | 19.7% vs 34.3% (§6) |
| "Synthetic 0.578 vs Berka 0.901, gap 0.32" | compared a CV estimate with a single temporal split | A2 vs A3 under one protocol |
| "§21 signal-strength tolerance missed by 0.30" (gap 0.307) | pre-calibration run, Berka side from the single temporal split | gap 0.152 primary / 0.289 secondary vs tolerance 0.10 (`eval/out/real_vs_synthetic.md`) |
| A2 0.574 [0.568, 0.585]; A7 0.578 [0.550, 0.607]; gap 0.147 primary / 0.285 secondary | measured on 2026-09-17 with counterparty features 20–22 computed from thinned POS rows, which entry 30 showed to be biased; re-run on 2026-11-09 after entries 30, 35 and 38. The Berka side reproduced exactly | A2 0.570, A7 0.576, gap 0.152 / 0.289 (§2) |
| "The model beats any single observable channel" | true pre-calibration; false after (withdrawn, entry 21) | — |
| Scenario PDs 0.0557 / 0.0690 / 0.0849 / 0.0483 / 0.0999 / 0.0953 / 0.0561, and "the collapses' PDs are no higher than the baseline's" | the model before the retrain of 2026-11-07; with the retrained model the combined crisis (0.0656) is above the baseline (0.0526) | §5b, entry 46 |
| Held-out round-trip recall 0.92 (precision 0.2135 of 0.2297) | true before the seasonal gate was switched on (entry 36.7); with it, 0.93 | §5 anomaly rows |
| Held-out duplicate payment recall 0.06 | true with no repeat detector; with the exact check (entry 37.5) the same-day type is designed-for and scores 0.66 | §5 anomaly rows |
| §14: A6 0.5959; ρ curve 0.5959 / 0.6059 / 0.5983 / 0.6050 ("spread 0.0100, less than one SE"; "up to 93%"); baseline 0.5959 / 0.5865 / 0.5568; σ curve 0.6123 / 0.5959 / 0.5974 / 0.5882 | measured 2026-10-11 and 2026-10-31, before entries 30, 35 and 38 | §2 A6, §4, §4b (entry 52) |
| Latency 110 / 138 / 252 ms (credit), 287 / 427 / 964 ms (anomaly), 0.156 / 0.168 / 0.177 ms (SHAP) | timed 2026-10-11, before the seasonal gate, the exact repeat check and the retrain | §6b, re-run 2026-11-09 |
| Nisab SAR 41,759.74 (SAR 491.291/g, LivePriceOfGold 2026-11-08) | dated after every calculation date (entry 48); replaced by the calculation month's price | §5 nisab row (entry 54) |
| "The forecast model loses to the naive baseline" (median error 0.455 vs 0.376; MAPE 18.1% vs 15.0%) | true of the v1 OLS-trend model, which was replaced (entry 27) | §5 forecast rows |
| "Φ(sd/√2) is an identity / a proof" | agreement degraded to 0.0118 | "a good approximation" (§3) |
