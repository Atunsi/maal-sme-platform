# Week 7 serving-path latency smoke test (§19)

Run 2026-10-11 · Windows-11-10.0.26200-SP0 · 20 logical CPUs · RAM n/a · serving store: 1000 businesses (§23 serving scale). Nothing cached between requests.

**Equivalence with the Week 8 CLI** (demo businesses, all four lenses): **identical**.

Targets: API response < 2 s, SHAP explanation < 1 s — **PASS requires the maximum under target**.

| route (in-process, FastAPI TestClient) | n | p50 ms | p95 ms | p99 ms | max ms |
|---|---|---|---|---|---|
| `/lenses/credit` |  1000 |     109 |     138 |     179 |     312 |
| `/lenses/forecast` |   100 |     108 |     142 |     249 |     252 |
| `/lenses/anomaly` |   100 |     292 |     429 |     930 |     982 |
| `/lenses/zakat` |   100 |     107 |     138 |     244 |     246 |
| `/profile/{id}` |   100 |     107 |     139 |     243 |     247 |
| `/lenses/credit` over **real HTTP** (uvicorn) |    50 |     108 |     130 |     132 |     133 |
| SHAP generation alone (score + §13 explanation) |   194 |   0.162 |   0.176 |   0.182 |   0.209 |

`/lenses/credit` covered every one of the 1,000 serving businesses (statuses: {'scored': 754, 'insufficient_data': 57, 'partial_profile': 189}); the other routes a random 100. Wall time for the timed requests: 180 s.

## Verdict: API **PASS** · SHAP **PASS** · overall **PASS**

The model is regularised logistic regression (entry 21), so §19's "XGBoost inference" step is logistic
inference, and SHAP is the exact closed form `coef × z` — which is why it costs microseconds.
