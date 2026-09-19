# Credit lens (Base Murabaha) — NOT BUILT

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

## Two numbers measured for you already (2026-09-19)

Run `python -m eval.model_baseline` and `python -m eval.sweep_rho` to reproduce.
Both are recorded in [`../../DECISIONS.md`](../../DECISIONS.md) entries 7 and 8.

**1. The achievable ceiling is AUC 0.690, and you will be at ~92% of it.**
Default labels come from hidden latents plus idiosyncratic noise (§14), so no
feature set can exceed the AUC of the latent itself. Measured: oracle 0.6902,
best measured model 0.6336 = 91.8% of ceiling. Published SME credit models
report 0.70-0.80, so a bare 0.63 will read as underperformance against
benchmarks when it is near-optimal here. **Report the ceiling alongside every
AUC** so the claim is a ratio, not a raw number. Whether to widen the latent
spread instead is an open decision with a **hard deadline of before you start
training** (entry 8) — deciding after you see your AUC makes it retuning.

**2. XGBoost is not a given at this sample size.** Measured, entity-level
5-fold OOF, 8,904 businesses / 360 defaults / 27 features:

| model | OOF AUC | % of ceiling |
|---|---|---|
| logistic regression, L2 C=0.1 | **0.6336** | 91.8% |
| XGBoost, early-stopped (best of grid) | 0.6221 | 90.1% |
| XGBoost, untuned 400 trees | 0.5758 | 83.4% (in-sample 0.9645) |

Regularised logistic **beats** tuned gradient boosting here, and untuned
XGBoost loses badly — it memorises at a 4% event rate. Report the logistic
baseline as the number XGBoost has to beat. If XGBoost does not beat it, that
is a result about what the feature set supports, not a tuning failure. This was
measured on the 27-feature proxy; the full 59-feature engine may reorder them —
re-measure rather than assuming either way.

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
