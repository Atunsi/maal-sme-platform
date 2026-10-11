# Sharia screen (feature 24) across the populations

Rule table v1.0 (`compliance/sharia_rules.yaml`, sha256 `e90efd67c9ad…`, status **proposed_unverified**). Data source: synthetic. Deterministic: re-running gives the same table.

## research (n = 10,000)

| status | share |
|---|---|
| compliant | 85.1% |
| soft_flag_review | 14.9% |
| hard_flag | 0.0% |

| sector                |   compliant |   soft_flag_review |
|:----------------------|------------:|-------------------:|
| construction          |       1     |              0     |
| food_beverage         |       1     |              0     |
| professional_services |       1     |              0     |
| retail_trade          |       0.664 |              0.336 |

Evidence basis: declared MCC 60.3%, registered sector 39.7%. Existing-financing disclosure asked of 34.8%.

## serving (n = 1,000)

| status | share |
|---|---|
| compliant | 83.5% |
| soft_flag_review | 16.5% |
| hard_flag | 0.0% |

| sector                |   compliant |   soft_flag_review |
|:----------------------|------------:|-------------------:|
| construction          |       1     |              0     |
| food_beverage         |       1     |              0     |
| professional_services |       1     |              0     |
| retail_trade          |       0.622 |              0.378 |

Evidence basis: declared MCC 59.3%, registered sector 40.7%. Existing-financing disclosure asked of 37.5%.

## Rules triggered (all businesses)

| rule | businesses |
|---|---|
| `ACT-SOFT-5999` | 1,133 |
| `ACT-NOMCC-retail_trade` | 519 |

No hard flag occurs: the generator assigns only permissible MCCs. The hard-flag path is proven by
`tests/test_sharia.py` on crafted inputs, not by this population.
