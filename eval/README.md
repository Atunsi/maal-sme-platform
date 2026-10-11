# Evaluation harnesses

**Schema:** §12 (held-out anomalies), §19 (Week 3 gate), §21 (emergent validation), §30 ·
**SOP_Data_Grounding:** §6 (coverage), §7–§8 (real-vs-synthetic), §10.2 (dimension assertions), §13.4 (sensitivity), §13.5 (evidence table)

Everything here runs against **output tables only**, never against the
generator's internal parameters — that is what makes the assertions capable of
failing. Reports are written to `eval/out/` and are committed: they are the
deliverables.

| File | Purpose | Exit code |
|---|---|---|
| `gate_week3.py` | Week 3 "Generator Accepted" gate — the three pass/fail criteria (§19) plus structural checks | 0 = PASS, 1 = FAIL |
| `validate_emergent.py` | §21 validation: section A prints the **calibration-derived** revenue-share checks next to their closed form (they are inputs, not emergent — DECISIONS.md entry 12); section B the emergent targets (`days_negative_balance_distribution`, `realised_dso_vs_archetype`, `ramadan_amplitude_recovered`, `aggregate_default_rate`, `real_vs_synthetic_signal_strength`) → `out/emergent_validation.md` | always 0 — **findings are results** |
| `seasonal_recovery.py` | shared by the gate (criterion 3) and §21: fits the §22 window decomposition to the generated data per sector (equal-weighted businesses, trend + day-of-week + window dummies) and compares recovered value and count multipliers with `config.yaml` | library |
| `heldout_anomalies.py` | §12 held-out anomaly types, defined only here | 0, or raises on a §12 leak |
| `latent_ceiling.py` | §14 label-side: oracle ceiling, p_default spread, logit variance decomposition. Replicates the generator's latent draws directly (`--verify` proves it exact), so it needs **no economics** and runs in seconds | 0, or 1 if `--verify` mismatches |
| `run_section14.py` | §14 driver: one generation per ρ, deriving the sweep row, the signal ladder and the model baseline from each — the engine is expensive, so it runs once per ρ | 0, or 1 if labels moved across the sweep |
| `sweep_rho.py` | §14 AUC as a function of `latent_to_observable_correlation` (and, via `--param noise`, of label-noise level) | 0, or 1 if labels moved |
| `signal_decomposition.py` | §14 attribution: where signal is lost between the hidden latent and the measured features | 0 |
| `model_baseline.py` | What the feature set supports at this sample size — logistic vs tuned/untuned XGBoost on one protocol, as % of the oracle ceiling | 0 |
| `week8_check.py` | Week 8 contract: §11 keys, fixed markup, charity penalty, no forbidden keys / scores, Zakat arithmetic, forecast-with-baseline, byte-identical re-run — asserted on real CLI output | 0 = PASS, 1 = FAIL |
| `anomaly_eval.py` | §12 anomaly lens recall@K / precision@K (with its ceiling), injected and held-out types reported separately | 0 |
| `forecast_backtest.py` | §10 model vs naive on a 30-day holdout: scale-free error, MAPE away from zero, crunch recall / false alarms | 0 |
| `berka_coverage.py` | Phase 2: coverage bands + evidence registry on the Berka engine output → `out/berka_coverage.md` | 0 = accepted |
| `compare_real.py` | Phase 4: real-vs-synthetic comparison under **one CV protocol on all three sources** (repeated stratified group 5-fold × 20; temporal split kept as a labelled leakage check; `--protocol temporal` = v1.0), per-feature transfer, §15 exclusion selectivity, §8.4 findings → `out/real_vs_synthetic.md`. Asserts config hash unchanged, no look-ahead (self-tested), real-computed (A1 ∪ A2) scale-free set, §21 target pre-registered. | 0 |
| `feature_transfer.py` | B1: univariate Berka AUC with 1,000-resample bootstrap CI for every typed-A feature, both label sets; the A1/A2 subclass by the CI rule → `out/feature_transfer.md/.json` | 0 |
| `exclusion_selectivity.py` | B4: default rate among accounts excluded by the §15 coverage rule vs retained, both label sets, Fisher exact → `out/exclusion_selectivity.md` | 0 |
| `dimensions_check.py` | §10.2 / §12: obligations terminate, cancellations ↔ latent distress, balloons exist, facilities ↔ latent distress, MCC coverage, evidence stamps | 0 = PASS |
| `sensitivity.py` | §13.4: class-C features as a RANGE over low/central/high parameter settings → `out/sensitivity_*.md` | 0 |
| `evidence_table.py` | §13.5: the three-column evidence table, generated from the registry → `out/evidence_table.md` | 0 |

## Rules these harnesses enforce (not merely describe)

- **Held-out anomalies (§12):** `round_trip_transfer` and `duplicate_payment` must never appear in `config.yaml` or `generator/`; `assert_held_out()` scans both.
- **No Berka number without an interval** — `compare_real` bootstraps every AUC (1,000 resamples).
- **No look-ahead** — `assert_no_lookahead` fires on `window_end ≥ loan_date`, and `self_test_lookahead_assertion` proves it fires on a deliberate violation before every run.
- **Two models, never one on both sources.** Comparison set is class A and scale-free, asserted against `profile_engine/evidence.py`.
- **No class-C feature with a single performance number** — `sensitivity.py` refuses any parameter outside the `ungrounded.` block, and the evidence table names the class of every feature.
- **§23 minimum-cell rule** (≥30 businesses and ≥10 defaults) — `gate_week3` reports thin cells as a loud `SKIP`; reuse it.
- **Thinned POS sales rows** — `transactions.sample_weight` is 1/rate on POS `sales` rows (SOP_Saudi_Calibration §6.1); the gate checks outflows exactly, inflows exactly on un-thinned businesses and Σ amount × sample_weight within ±2% elsewhere. Anything that sums inflow amounts from `transactions.csv` must weight by it.
- **Seasonality is gated on the population, not one business** — criterion 3 requires the configured value AND count multipliers to be recovered within ±0.08 for the SAMA-measured sectors (B and B-weak windows alike: the test is of the wiring); class-C sectors are printed only.
- **No feature claims prediction without a CI excluding 0.50** — `evidence.py` resolves A → A1/A2 only from `profile_engine/feature_transfer.json`, written by `calibration.reclass_evidence` from `feature_transfer.py`; nothing hand-typed.
- **No cross-source AUC comparison mixes CV protocols** — the headline row of `real_vs_synthetic.md` is one protocol on all three sources; every other row is labelled secondary.

## Still missing (Week 6–7)

Expanding-window + entity-level CV on the synthetic side for the credit lens (§13), **AUC-vs-label-noise (§14 — `sweep_rho.py --param noise` implements it but it has never been run; the ρ half is done, see DECISIONS entry 21)**, the holdout-shock lead-time test (§10), SHAP threshold-table verification (§13), the §25 fairness audit. `compare_real.py` already implements the Berka temporal/entity scheme (§7.3) and a contiguous-ID entity split for the synthetic snapshot; the credit lens should reuse those rather than write a third.
