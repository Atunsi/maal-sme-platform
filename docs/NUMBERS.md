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
| **On real bank outcomes the engine reaches AUC 0.721 [0.681, 0.770]**, against 0.574 on deliberately harder synthetic labels under the same protocol and features. | **Do not add "inside the published SME range" until a published benchmark is archived in `sources/` and cited** — the often-quoted 0.70–0.80 is not yet sourced (§21 source discipline; the same gap blocks entry 22 Path B).  Berka is Czech retail bank accounts from the 1990s, not Saudi SMEs, so it tests whether the engine extracts real signal, not Saudi calibration. n = 209 with 22 defaults. The eligibility rule removes riskier accounts (risk ratio 3.42), so this is measured on the eligible population and is optimistic. |
| **The credit lens reaches 88.8% of the best AUC any model could achieve on our synthetic data** (0.5912 of a 0.6660 ceiling). | The ceiling exists because the synthetic labels deliberately contain noise that nothing observable can predict (§14). That design is what makes the labels non-circular. |
| **AUC ≥ 0.85 on the synthetic data is impossible by construction**, so a result that high would indicate leakage, not skill. | Applies to the *synthetic* labels only. Real-data AUCs (e.g. Berka secondary 0.859) are not subject to it. |
| **22 of 43 engine features predict real defaults** with a 95% interval excluding 0.5. | Univariate, on Berka; the other 21 are computed on real data but not claimed to predict. |
| **Every decision is reproducible byte for byte**, and a saved decision can be verified: `python -m pipeline.verify`. | Covers the deterministic core only. Generated advisory text (if ever added, §36) is outside the receipt. |

---

## 2. Discrimination (AUC) — why there are several, and which to quote

| ID | AUC [95%] | Population | N / defaults | Features | Protocol | Source | Quote it for | Never quote it for |
|---|---|---|---|---|---|---|---|---|
| **A1** | **0.5912 [0.5841, 0.5985]** | research, scorable | 9,495 / 449 | 58 — the §8 `/profile` list minus 23–26 | repeated stratified group 5-fold × 20 (`unified_cv`) | `lenses/credit/model_v1.json` | **The credit lens's performance** | comparing with Berka (different features) |
| **A2** | **0.574 [0.568, 0.585]** | research, scorable | 9,495 / 449 | 25 scale-free real-computed features | same as A1 | `eval/out/real_vs_synthetic.md` | **Synthetic side of the real-vs-synthetic comparison** | the credit lens's performance |
| **A3** | **0.721 [0.681, 0.770]** | Berka primary label | 209 / 22 | same 25 as A2 | same as A1 | `eval/out/real_vs_synthetic.md` | **Real-data performance (headline)** | Saudi calibration |
| A4 | 0.859 [0.841, 0.880] | Berka secondary label (censored) | 615 / 59 | same 25 as A2 | same as A1 | `eval/out/real_vs_synthetic.md` | real-data performance, secondary label | the headline (label is censored) |
| A5 | 0.643 [0.554, 0.723] | serving (never trained on) | 943 / 45 | same 58 as A1 | A1 model scored once out of sample | `lenses/credit/model_v1.json` | out-of-sample sanity check on the disjoint demo population | a precise estimate (45 defaults) |
| A6 | 0.5959 | research, scorable | 9,495 / 449 | all 71 engine features incl. Zakat-only 27–31, + dummies | single stratified 5-fold | `eval/out/section14_rho_sweep.md` | the §14 sensitivity measurement at ρ = 0.6 | the credit lens (includes non-contract features) |
| A7 | 0.578 [0.550, 0.607] | research, scorable | 9,495 / 449 | same 25 as A2 | contiguous-ID entity 5-fold | `eval/out/real_vs_synthetic.md` | secondary protocol check | the headline |
| A8 | 0.901 [0.835, 0.955] | Berka secondary, temporal test | test 328 / 25 | same 25 as A2 | single temporal split at 1997-01-01 | `eval/out/real_vs_synthetic.md` | **leakage check only** | performance (single split; mixing it with A2 created a spurious 0.32 gap) |
| A9 | 0.610 | research + serving, scorable | 9,914 | 6 observables + sector | **in-sample** | `eval/out/gate_week3_after_monshaat.txt` | Week 3 gate criterion 2 (signal exists, labels not recoverable) | any performance claim |

**Why A1, A2 and A6 differ (0.591 / 0.574 / 0.596):** the same population, but 58 vs 25 vs 71 features. A2 drops absolute-currency features so the comparison with Berka is scale-free. A6 includes the balance-sheet features that §8 keeps out of the credit lens. The protocols are repeated vs single. None of the three is wrong; they answer different questions.

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
| Scale-up needed for a 0.85 ceiling | latent coefficients × 2.36 | — | `eval.latent_ceiling` |

The analytic form is **an approximation, not an identity**. It agreed to 0.0010 before calibration and to 0.0118 after, because the calibrated sector mixture is more lopsided.

---

## 4. §14 sensitivity — AUC as a function of ρ

Source: `eval/out/section14_rho_sweep.md` (`python -m eval.run_section14`). Protocol and features as A6. Labels identical at every ρ.

| ρ | 0.6 | 0.7 | 0.8 | 0.9 |
|---|---|---|---|---|
| logistic out-of-fold AUC | 0.5959 | 0.6059 | 0.5983 | 0.6050 |

**Flat**: the spread of 0.0100 is less than one standard error (0.0144) and the curve is not monotone. Up to 93% of the oracle-to-measured gap is the economics pipeline, not ρ. Model baseline at ρ = 0.6 under the same protocol: logistic 0.5959 beats early-stopped XGBoost 0.5865 and untuned XGBoost 0.5568. These are the A6 features, not the credit lens's.

---

## 5. Lens results (Week 8 v1s, DECISIONS entry 23)

| Lens | Number | Population / N | Source |
|---|---|---|---|
| Forecast — median scale-free error, model vs naive | **0.455 vs 0.376** (naive better for 63.1%) | research, scorable, 9,495; 30-day holdout | `eval/out/forecast_backtest.md` |
| Forecast — MAPE, model vs naive | 18.1% vs 15.0% | 7,525 with balance ≥ 1 month of outflow from zero | same |
| Forecast — crunch recall / false alarms | model 87.1% / 3.7%; naive 81.8% / 1.3% | 1,164 that went negative | same |
| Anomaly — held-out round-trip recall@10 | **0.92** (precision 0.2135 of a 0.2297 ceiling) | serving, 50 businesses | `eval/out/anomaly_eval.md` |
| Anomaly — held-out duplicate payment recall@10 | **0.06** (effectively missed) | serving, 50 businesses | same |
| Anomaly — injected types | both caught (ranks 1 and 7) | demo business 10001 | same |
| Sharia screen (feature 24) — research | **85.1% compliant / 14.9% soft_flag_review / 0.0% hard_flag** (soft flags all retail: MCC 5999 or no MCC) | research, 10,000 | `eval/out/sharia_screen.md` |
| Sharia screen — evidence basis / financing disclosure | declared MCC 60.3% · registered sector 39.7% · disclosure asked of 34.8% | research, 10,000 | same |
| Zakat — demo 10001 liability | SAR 5,963.26 (base 238,530.46 × 2.5%) | demo | `python -m pipeline.week8 --demo` |
| Zakat — nisab | 85 g gold × **placeholder** SAR 400/g | — | `lenses/lens_config.yaml` — **not a sourced figure** |

---

## 6. Data validity

| Number | Value | Source |
|---|---|---|
| Week 3 gate | PASS with one loud SKIP (professional services, 237 businesses / 3 defaults, below the §23 minimum cell) | `eval/out/gate_week3_after_monshaat.txt` |
| Construction `implied_dso_days` (gate criterion 1) | 65.9 / 94.2 / 118.2 min/median/max, n = 3,679 — all inside [60, 120] | same |
| Professional `implied_dio_days` | max 3.39, n = 261 — all < 5 | same |
| Scorable / excluded | 9,914 scorable; 1,086 `insufficient_data` | same |
| §21 | 0 emergent findings; 6 input-consistency misses (medium-tier revenue share 19.7% vs GASTAT 34.3%; sector TV distance 0.384) | `eval/out/emergent_validation.md`, entry 12 |
| SAMA POS ticket (calibration input) | retail 61.5 SAR, restaurants 29.0 SAR | `config.yaml`, `calibration/out/` |
| Seasonality held-out years 2024–2025 | 12 PASS / 8 BOUNDED / 0 FAIL / 16 NOT_APPLIED | `calibration/out/saudi_calibration_report.md` |
| §15 exclusion selectivity on Berka | excluded accounts default at 3.42× (primary) / 2.64× (secondary) the retained rate; 29.0% / 22.4% of defaults excluded | `eval/out/exclusion_selectivity.md` |
| Evidence classes | A2 22, A1 21, B 3, C 25 of 71 registry entries | `eval/out/evidence_table.md` |

---

## 6b. Serving path — Week 7 latency (§19)

Source: `eval/out/latency_week7.md` (`python -m eval.latency_test`). Serving store, 1,000 businesses (§23 serving scale); every request computes the profile and the lens from inputs — nothing cached. Timings vary run to run, so re-running the test means updating this section. Format: p50 / p95 / max.

| Path | Value | n |
|---|---|---|
| `/lenses/credit` — full §19 path (store → profile engine → model → SHAP → §13 text) | **109 / 138 / 312 ms** | 1,000 (every serving business) |
| `/lenses/credit` over real HTTP (uvicorn) | 108 / 130 / 133 ms | 50 |
| `/lenses/anomaly` — slowest route (per-business Isolation Forest) | 292 / 429 / 982 ms | 100 |
| SHAP explanation alone (exact log-odds, `coef × z`) | 0.162 / 0.176 / 0.209 ms | 194 |
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
| "The model beats any single observable channel" | true pre-calibration; false after (withdrawn, entry 21) | — |
| "Φ(sd/√2) is an identity / a proof" | agreement degraded to 0.0118 | "a good approximation" (§3) |
