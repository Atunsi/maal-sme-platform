# Credit lens (Base Murabaha) — v1 BUILT, owner to take over

**v1 (2026-10-11, DECISIONS entry 23):** `model.py` (scoring, §11 decision, §13 explanation), `train.py` (trains + exports `model_v1.json`). CV AUC 0.591 = 88.8% of the 0.666 ceiling; JSON scorer reproduces sklearn to 5e-15; tier default rates monotone. Parameters in [`../lens_config.yaml`](../lens_config.yaml) are PROPOSED — sign off or change them in entry 23. Retrain: `python -m profile_engine.compute --dir data && python -m lenses.credit.train`.

**Owner:** credit lens owner · **Schema:** §11, §13, §14, §17, §25, §26, §31 · **Due:** Week 5, SHAP Week 7

XGBoost PD model + SHAP explanation, trained on `data/labels.csv` against the
profile engine's feature vector.

## Output contract (§11) — fields present even when null

```json
{
  "decision": "approved",
  "amount_sar": 45000,
  "base_markup_pct": 6.0,
  "adjusted_markup_pct": null,
  "markup_fixed_at_inception": true,
  "late_penalty_policy": "charity_directed",
  "repayment_months": 12,
  "recourse": null,
  "stress": null
}
```

## Non-negotiables — do not implement around these

- **No `stressed_markup_pct`, ever**, and no mechanism that varies
  `base_markup_pct` / `adjusted_markup_pct` from stress, forecast, or any
  generated output (§34 constraint 2, SOP §2). Risk-tiering different
  businesses at different **fixed** rates is fine; repricing one business after
  signing is not. `markup_fixed_at_inception: true` is permanent.
- **`late_penalty_policy: "charity_directed"`**, always (§17).
- **No generated text in the Compliance View** (§10, §36.2) — it is the proof of
  non-black-box behaviour. Raw SHAP values + the exact §13 lookup table only.
- `adjusted_markup_pct` stays null unless the ESG module is built; `recourse`
  and `stress` likewise (§11 fail-soft pattern).

## Two numbers measured for you already (2026-09-20, post-calibration)

Reproduce with `python -m eval.latent_ceiling` (seconds) and
`python -m eval.run_section14` (~10 min). Recorded in
[`../../DECISIONS.md`](../../DECISIONS.md) entries 21 and 22.

**1. The achievable ceiling is AUC 0.665, and you will be at ~90% of it.**
Default labels come from hidden latents plus idiosyncratic noise (§14), so no
feature set can exceed the AUC of the latent itself. Measured: oracle 0.6660,
best measured model 0.5959 = 89.5% of ceiling. Published SME credit models
report 0.70–0.80, so a bare 0.60 will read as underperformance against
benchmarks when it is near-optimal here. **Report the ceiling alongside every
AUC** so the claim is a ratio, not a raw number. Whether to widen the latent
spread instead is an open decision with a **hard deadline of before you start
training** (entry 22) — deciding after you see your AUC makes it retuning.

**2. XGBoost is not a given at this sample size.** Entity-level 5-fold OOF,
9,495 businesses / 449 defaults / 82 features (71 engine + 11 dummies):

| model | OOF AUC | % of ceiling |
|---|---|---|
| logistic regression, L2 C=1.0 | **0.5959** | 89.5% |
| XGBoost, early-stopped (best of grid) | 0.5865 | 88.1% |
| XGBoost, untuned 400 trees | 0.5568 | 83.6% (in-sample 0.9918) |

Regularised logistic **beats** tuned gradient boosting, and untuned XGBoost
memorises almost completely (in-sample 0.99 vs 0.56 out-of-fold). Report the
logistic baseline as the number XGBoost has to beat; if it does not, that is a
result about what the feature set supports at this event rate, not a tuning
failure. Re-measure if you add features beyond the engine's current 71.

**3. Raising ρ will not help you.** AUC is flat across ρ ∈ {0.6, 0.7, 0.8, 0.9}
(spread 0.0100 = 0.69 SE, non-monotone). Up to 93% of the oracle-to-measured
gap is the economics pipeline, not the latent-to-observable correlation. At
ρ = 0.9 a single clean latent rank (0.6467) outperforms the whole 82-column
model (0.6050) — the feature pipeline is the binding constraint.

## Required, not optional

- **Expanding-window CV *and* an entity-level split** (§13) — no business may
  appear in both train and validation folds, because §14's labels come from
  per-business latents that persist across the window. Naming only
  "expanding-window CV" reads as if leakage is handled when it is not.
- **Random shuffling of time-series data is not permitted anywhere** (§13, SOP §2).
- **Report AUC as a function of label-noise level and of ρ** (§14), not a single
  headline number. `config.yaml` exposes `label_noise_sigma` and
  `latent_to_observable_correlation` for exactly this.
- **SHAP → plain language via the fixed §13 threshold table**, in log-odds
  units, direction-aware. Never an ad-hoc per-decision judgment.
- **§25 within-sector fairness audit.** Read
  [`../../DECISIONS.md`](../../DECISIONS.md) entry 1b before setting
  expectations: in the synthetic data, feature 11 / 56 carry near-zero signal
  **within construction** by an understood and recorded mechanism. The audit
  should expect the disciplined-operator signal through features 13, 16–19 and
  37–40. This is a signed-off property of the training data, not a bug to tune
  away.
