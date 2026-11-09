# Week 7 serving-path latency smoke test (§19)

Run 2026-11-09 · Windows-11-10.0.26300-SP0 · 20 logical CPUs · RAM 15.7 GB · serving store: 1000 businesses (§23 serving scale). Nothing cached between requests.

**Equivalence with the Week 8 CLI** (demo businesses, all four lenses): **identical**.

Targets: API response < 2 s, SHAP explanation < 1 s — **PASS requires the maximum under target**.

| route (in-process, FastAPI TestClient) | n | p50 ms | p95 ms | p99 ms | max ms |
|---|---|---|---|---|---|
| `/lenses/credit` |  1000 |     124 |     150 |     190 |     248 |
| `/lenses/forecast` |   100 |     125 |     158 |     239 |     250 |
| `/lenses/anomaly` |   100 |     314 |     478 |     982 |    1028 |
| `/lenses/zakat` |   100 |     126 |     153 |     242 |     252 |
| `/profile/{id}` |   100 |     125 |     155 |     240 |     244 |
| `/lenses/credit` over **real HTTP** (uvicorn) |    50 |     131 |     152 |     163 |     169 |
| SHAP generation alone (score + §13 explanation) |   194 |   0.160 |   0.176 |   0.201 |   0.225 |

`/lenses/credit` covered every one of the 1,000 serving businesses (statuses: {'scored': 754, 'insufficient_data': 57, 'partial_profile': 189}); the other routes a random 100. Wall time for the timed requests: 202 s.

## Verdict: API **PASS** · SHAP **PASS** · overall **PASS**

The model is regularised logistic regression (entry 21), so §19's "XGBoost inference" step is logistic
inference, and SHAP is the exact closed form `coef × z` — which is why it costs microseconds.
