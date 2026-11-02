# Anomaly lens — repeat-payment detector variants (DECISIONS entry 37)

Population: **serving**, held-out seed 7, 50 businesses per type, K = 10,
seasonal gate on. Clean businesses (no anomaly row): 861. Data source: synthetic.

## Validation — the variants compared (used to choose)

| variant | same-day duplicate (seen) | late repeat (seen) | mean of the two | round-trip (held-out guard) | repeat flags per clean business | clean businesses with one | passes guard rails |
|---|---|---|---|---|---|---|---|
| `off` | 0.06 | 0.00 | 0.030 | 0.93 | 0.00 | 0 | yes |
| `exact` | 0.66 | 0.00 | 0.330 | 0.93 | 0.00 | 0 | yes |
| `rarity` | 0.18 | 0.00 | 0.090 | 0.90 | 0.46 | 272 | yes |
| `forest_feature` | 0.26 | 0.02 | 0.140 | 0.93 | 0.40 | 167 | yes |
| `window` (reference, not a candidate) | 0.60 | 0.02 | 0.310 | 0.86 | 2.44 | 684 | no |

Guard rails: round-trip recall ≥ 0.90; at most 1.0 repeat flag per clean business.
**Chosen by the entry 37.2 rule: `exact`.**

## Test — reported once (types defined in entry 37.3, injected only for this run)

| variant | type | rows | recall@10 | precision@10 | ceiling |
|---|---|---|---|---|---|
| `exact` | resent_payment | 50 | 0.00 | 0.0000 | 0.1120 |
| `exact` | vendor_record_duplicate | 50 | 0.04 | 0.0060 | 0.1169 |
| `off` | resent_payment | 50 | 0.00 | 0.0000 | 0.1120 |
| `off` | vendor_record_duplicate | 50 | 0.04 | 0.0060 | 0.1183 |

Recall on the seen types is a validation number, not a held-out result. Only the test table is held-out,
and only for the variants shown in it. `vendor_record_duplicate` uses a second counterparty ID, which no
counterparty-keyed variant can link (stated in entry 37.3 before this ran).
