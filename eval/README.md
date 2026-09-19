# Evaluation harnesses

**Schema:** §12 (held-out anomalies), §19 (Week 3 gate), §21 (emergent validation), §30

Everything here runs against generator **output tables only**, never against the
generator's internal parameters — that is what makes the assertions capable of
failing. An earlier version of the Week 3 gate asserted properties that were
true by construction; see [`../DECISIONS.md`](../DECISIONS.md).

| File | Purpose | Exit code |
|---|---|---|
| `gate_week3.py` | Week 3 "Generator Accepted" gate — the three pass/fail criteria (§19) plus structural checks | 0 = PASS, 1 = FAIL |
| `validate_emergent.py` | §21 emergent macro validation against archived GASTAT figures, with tolerance bands pre-registered in `config.yaml` | always 0 — **findings are results, not gate failures** |
| `heldout_anomalies.py` | §12 held-out anomaly types, defined only here | 0, or raises on a §12 leak |
| `sweep_rho.py` | §14 sensitivity: AUC as a function of `latent_to_observable_correlation` (and, via `--param noise`, of label-noise level) | 0, or 1 if labels moved across the sweep |
| `signal_decomposition.py` | §14 attribution: where signal is lost between the hidden latent and the measured features, plus whether `p_default` varies enough to support the ceiling | 0 |
| `model_baseline.py` | What the feature set supports at this sample size — logistic vs tuned/untuned XGBoost on one protocol, as % of the oracle ceiling | 0 |

## The held-out rule (§12)

`round_trip_transfer` and `duplicate_payment` are defined in
`heldout_anomalies.py` and **must never appear in `config.yaml` or anywhere in
the `generator/` package**. `assert_held_out()` scans both and raises if they
do — it globs `generator/*.py`, so a new generator module is covered
automatically rather than escaping a hard-coded file list.

Precision-at-K must be reported **separately** for injected vs. held-out types.
Measuring only against types the generator was told to inject proves only that
the detector finds what it was told to hide.

## Still missing (Week 6–7)

Per schema §10, §13, §21 these harnesses do not exist yet: the
expanding-window *temporal* CV split (§13 — `sweep_rho.py` covers the
entity-level half, but its measurement is cross-sectional so the temporal half
does not apply to it), the holdout-shock detection-lead-time test (§10), SHAP
threshold table verification (§13), and the §25 within-sector fairness audit.
The AUC-vs-label-noise curve (§14) is implemented in `sweep_rho.py --param
noise` but has not been run and reported yet. The §23
minimum-cell rule (≥30 businesses **and** ≥10 default events) applies to every
per-cell metric they will report — `gate_week3.py` already implements it as a
loud `SKIP`, and that behaviour should be reused rather than reimplemented.
