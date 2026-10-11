# Week 7 serving-path latency smoke test (§19)

Run 2026-10-11 · Windows-11-10.0.26200-SP0 · 20 logical CPUs · RAM n/a · serving store: 1000 businesses (§23 serving scale). Nothing cached between requests.

**Equivalence with the Week 8 CLI** (demo businesses, all four lenses): **identical**.

Targets: API response < 2 s, SHAP explanation < 1 s — **PASS requires the maximum under target**.

| route (in-process, FastAPI TestClient) | n | p50 ms | p95 ms | p99 ms | max ms |
|---|---|---|---|---|---|
| `/lenses/credit` |  1000 |     110 |     138 |     177 |     252 |
| `/lenses/forecast` |   100 |     110 |     151 |     249 |     254 |
| `/lenses/anomaly` |   100 |     287 |     427 |     916 |     964 |
| `/lenses/zakat` |   100 |     109 |     143 |     249 |     256 |
| `/profile/{id}` |   100 |     108 |     142 |     251 |     251 |
| `/lenses/credit` over **real HTTP** (uvicorn) |    50 |     110 |     136 |     148 |     158 |
| SHAP generation alone (score + §13 explanation) |   194 |   0.156 |   0.168 |   0.173 |   0.177 |

`/lenses/credit` covered every one of the 1,000 serving businesses (statuses: {'scored': 754, 'insufficient_data': 57, 'partial_profile': 189}); the other routes a random 100. Wall time for the timed requests: 181 s.

## Verdict: API **PASS** · SHAP **PASS** · overall **PASS**

The model is regularised logistic regression (entry 21), so §19's "XGBoost inference" step is logistic
inference, and SHAP is the exact closed form `coef × z` — which is why it costs microseconds.
