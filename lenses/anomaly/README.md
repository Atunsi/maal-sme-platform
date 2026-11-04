# Anomaly lens — v1 BUILT, owner to take over

**v1 (2026-10-11, DECISIONS entry 23):** `anomaly.py` — per-business Isolation Forest + hard univariate rules, `flag_reason` only, scores withheld.

**2026-11-02 (DECISIONS entry 36):** the **seasonal gate is on** — the amount baseline is computed per Ramadan-to-Eid season, using the pinned windows feature 36 uses. Without it, Ramadan transactions took 37% more than their share of false flags (excess 1.37); with it, 1.02. `python -m eval.anomaly_seasonal`. Held-out results with the gate on (`python -m eval.anomaly_eval`): round-trip recall 0.93; same-day duplicate 0.06 (missed); new held-out type `late_repeat_charge` 0.00.

**Repeat-payment check — `exact` ships (2026-11-02, DECISIONS entry 37):** an outflow to the same counterparty, at the identical amount, on the same day as an earlier one. Four variants were compared on seen types and the winner tested once on two new types (`python -m eval.repeat_variants`). It catches 66% of same-day exact duplicates (designed-for, not a held-out number) with no false repeat flag on 861 clean businesses, and it catches **none** of the payments re-sent 1–2 days later or paid under a second supplier ID. Say exactly that; never quote a single "duplicate recall". Why others' tools do better: `docs/research/duplicate_payment_detection.md`.

The list is always 10 flags long: it is a review queue ordered by unusualness, not a count of alarms (entry 36.5).

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
