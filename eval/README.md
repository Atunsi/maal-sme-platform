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

Per schema §10, §13, §21 these harnesses do not exist yet: expanding-window +
entity-level CV splits (§13), AUC-vs-label-noise and AUC-vs-ρ sensitivity
curves (§14), the holdout-shock detection-lead-time test (§10), SHAP threshold
table verification (§13), and the §25 within-sector fairness audit. The §23
minimum-cell rule (≥30 businesses **and** ≥10 default events) applies to every
per-cell metric they will report — `gate_week3.py` already implements it as a
loud `SKIP`, and that behaviour should be reused rather than reimplemented.
