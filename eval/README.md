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
| `validate_emergent.py` | §21 emergent macro validation against archived GASTAT figures, bands pre-registered in `config.yaml` | always 0 — **findings are results** |
| `heldout_anomalies.py` | §12 held-out anomaly types, defined only here | 0, or raises on a §12 leak |
| `berka_coverage.py` | Phase 2: coverage bands + evidence registry on the Berka engine output → `out/berka_coverage.md` | 0 = accepted |
| `compare_real.py` | Phase 4: real-vs-synthetic comparison-set AUC, per-feature transfer, §8.4 findings → `out/real_vs_synthetic.md`. Asserts config hash unchanged, no look-ahead (self-tested), class-A scale-free set, §21 target pre-registered. | 0 |
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

## Still missing (Week 6–7)

Expanding-window + entity-level CV on the synthetic side for the credit lens (§13), AUC-vs-label-noise and AUC-vs-ρ curves (§14), the holdout-shock lead-time test (§10), SHAP threshold-table verification (§13), the §25 fairness audit. `compare_real.py` already implements the Berka temporal/entity scheme (§7.3) and a contiguous-ID entity split for the synthetic snapshot; the credit lens should reuse those rather than write a third.
