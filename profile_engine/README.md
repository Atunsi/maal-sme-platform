# Profile engine — NOT BUILT

**Owner:** profile engine owner (SOP §3) · **Schema:** §1–§6, §15, §16, §30–§35
**Due:** Week 3–4 (scaffolding starts Week 2 against a hand-made sample, not generator output — SOP §7)

The single shared engine all three lenses read from. This is the "reuse is the
contribution" claim in concrete form: adding a lens means registering a route
against this engine, never changing it.

## What goes here

Computation of **features 1–59** from `data/daily_aggregates.csv` (§8 — *not*
from raw transactions, so the <2s API target holds), plus:

- **Explicit feature-ID membership list in code** (§8, SOP §8) — never a range
  like "1–36". `/profile` returns 1–26, 32–33, 36, 40–59. It does **not**
  return the balance-sheet features 27–31, 34–35; those live in a separate
  profile read only by the Zakat lens (§7).
- **`insufficient_data`** as a distinct state when `coverage_days_90d < 60`
  (§15) — an explicit refusal to score, never a low score or a silent null.
- **`partial_profile`** when coverage ≥ 60 but history < `min_history_days`
  (180 for features 4 and 9) — the business is still scored; that feature
  returns null with `reason: "insufficient_history"`, distinguishable from
  `reason: "near_zero_denominator"` (§15, §16).
- **Null conventions** (§16): `current_runway_days` null when not net-burning;
  epsilon floor of SAR 500 on growth-rate denominators, growth capped at ±300%.
- **Sector-relative z-scores** (features 55–59, §35) computed against a
  **pinned** `sector_reference_stats_v1.json`, built once on the N=10,000
  research population and **never recomputed at serving time**.
- **Pandera validation of all three input tables before they reach the feature
  engine** (§37.1) — reuse `generator/schemas.py`, do not write a second copy.

## Contract

Input: `data/daily_aggregates.csv`, `data/balances_monthly.csv` (Zakat path only).
Output: the feature vector behind `GET /profile/{business_id}` (§8).

The generator already guarantees no latent variable or label reaches these
tables, so the engine cannot accidentally consume one.
