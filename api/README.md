# API read-paths — NOT BUILT

**Schema:** §8, §29 · **Due:** Week 5–7 (latency smoke test Week 7, not Week 10)

Five versioned routes. Three lenses run independently and simultaneously off one
shared profile — **no lens is gated on another's output** (§8). That
independence is the concrete evidence for the single-engine claim, so it must
hold in the routing, not just in a diagram.

| Route | Reads | Returns |
|---|---|---|
| `GET /profile/{business_id}` | `daily_aggregates.csv` | features 1–26, 32–33, 36, 40–59 — **not** 27–31, 34–35 (§7) |
| `GET /lenses/credit` | Profile | decision + terms + SHAP-based explanation |
| `GET /lenses/forecast` | Profile | 30/60/90-day projection + crunch alert |
| `GET /lenses/anomaly` | Profile | flagged transactions with `flag_reason` — **never** `fraud_reason`, and **never** raw anomaly scores (§29) |
| `GET /lenses/zakat` | Balance-sheet snapshot (separate) | annual Zakat liability |

## Non-negotiable constraints

- **Raw anomaly scores and thresholds are never exposed** (§29) — only the flag
  and a categorical `flag_reason`. Scores are strictly more informative to
  someone probing the decision boundary.
- **Minimal auth even for the demo** — a single shared API key. A real
  deployment needs per-business-owner authorization (a business may query only
  its own profile). State the distinction rather than shipping an open API.
- **Rate-limit per business ID.**
- Hazard-curve features 52–54 are computed **in the profile engine**, not in the
  forecast lens, so the credit lens reading them does not create a cross-lens
  dependency (§34).

**Week 7 latency smoke test** (§19): full serving path at N=1,000 — profile
computation + XGBoost inference + SHAP generation. Targets: API < 2s, SHAP < 1s.
Run it in Week 7, one week before the gate, with runway to fix it.
