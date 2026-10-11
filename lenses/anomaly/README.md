# Anomaly lens — v1 BUILT, owner to take over

**v1 (2026-10-11, DECISIONS entry 23):** `anomaly.py` — per-business Isolation Forest + hard univariate rules, `flag_reason` only, scores withheld. `python -m eval.anomaly_eval`: injected types both caught; held-out round-trip recall 0.92; **held-out duplicate payment recall 0.06 (missed)**. If you add a duplicate detector, define a NEW held-out type in `eval/heldout_anomalies.py` first — otherwise the held-out test becomes circular (§12).

**Owner:** forecast + anomaly owner · **Schema:** §8, §12, §29, §33 · **Due:** Week 6

Isolation Forest over the shared profile, returning flagged transactions.

## Required

- **`flag_reason`, never `fraud_reason`** (§8). The system detects statistical
  anomalies, not fraud; the wording is a claim about what the model can support.
- **Never return raw anomaly scores or thresholds through the API** (§29) — only
  the flag and a categorical reason. This also constrains any generated
  explanation (§36.1): it may operate on `flag_reason` values only, never on
  scores, or natural language becomes a side channel for the threshold.
- **Precision-at-K reported separately for injected vs. held-out anomaly types**
  (§12). The injected types (`large_transfer`, `odd_hours_transaction`) are in
  `config.yaml`; the held-out types are in
  [`../../eval/heldout_anomalies.py`](../../eval/heldout_anomalies.py) and must
  never be added to the config. Measuring only against injected types proves
  only that the detector finds what it was told to hide.
- Feature 46 (`circular_counterparty_count`) gives a detection mechanism
  genuinely different from magnitude/timing outliers — which is what lets the
  held-out `round_trip_transfer` type be a real test rather than a relabelled
  version of an injected one (§33).
