# API read-paths — v1 BUILT (Week 7 latency test PASSED)

**v1 (2026-10-11, DECISIONS entry 25).** `store.py` builds the serving store (DuckDB, the 1,000
serving businesses' input rows); `app.py` serves the five routes below plus `/health`. Every
request computes the profile and the lens from inputs — nothing is cached — through the same
code as the Week 8 CLI, so an API answer equals the CLI answer (asserted by the latency test).

```bash
python -m api.store --dir data --out data/serving.duckdb   # build once (git-ignored)
set MAAL_API_KEY=<secret>                                 # env var only — never commit or log it
uvicorn api.app:app --port 8000
curl -H "X-API-Key: <secret>" "http://127.0.0.1:8000/lenses/credit?business_id=10001"
python -m eval.latency_test                               # §19 Week 7 test → eval/out/latency_week7.md
python -m pytest tests                                    # API guarantees + lens unit tests
```

**Week 7 result (§19): PASS on the maximum.** `/lenses/credit` over all 1,000 serving businesses:
p50 109 ms, max 312 ms; over real HTTP max 133 ms; slowest route `/lenses/anomaly` max 982 ms;
SHAP 0.2 ms. Target < 2 s / < 1 s. Exact figures: [`../docs/NUMBERS.md`](../docs/NUMBERS.md) §6b.

**What v1 enforces:** refuses to start without `MAAL_API_KEY`; constant-time key check (401
otherwise); per-business rate limit (`MAAL_RATE_LIMIT_PER_MIN`, default 60 → 429); research
businesses return 404 (the store holds only the §23 serving population); `insufficient_data` is
an explicit status with `lens_not_run_reason`; anomaly flags carry `flag_reason` and no score;
`/profile` returns the §8 membership list only (no Zakat-only features); every response carries
a receipt. All asserted in `tests/test_api.py`.

**Left for the API owner:** per-business-owner authorisation (a business reads only its own
profile — §29 says state it, a shared key is the demo scope); the anomaly route is the closest to
budget (982 ms max) — the per-business forest is refitted on every call; rebuilding the store
when data is regenerated; wiring the UI (Week 10).

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
