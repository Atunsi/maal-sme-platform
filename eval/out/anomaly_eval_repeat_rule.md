# Anomaly lens — §12 evaluation (injected vs held-out, reported separately)

**Evaluated with lens_config overrides: `repeat_payment_rule: True`** — not the shipped configuration.

Population: **serving** for held-out (business_id 10,001–11,000, §23); demo businesses for injected. Data source: synthetic. K = 10 flags per business. Held-out seed 7, 50 businesses per type.

## Injected types (the generator was told to create these)

| anomaly_type          |   businesses |   anomalous_rows |   recall_at_k |   precision_at_k |   precision_ceiling |   median_rank_when_caught | reasons          |   rule_hit_before_cap |
|:----------------------|-------------:|-----------------:|--------------:|-----------------:|--------------------:|--------------------------:|:-----------------|----------------------:|
| large_transfer        |            1 |                1 |             1 |              0.1 |                 0.1 |                         1 | amount_outlier×1 |                     1 |
| odd_hours_transaction |            1 |                1 |             1 |              0.1 |                 0.1 |                         5 | unusual_hour×1   |                     1 |

## Held-out types (defined only in eval/heldout_anomalies.py — unseen by generator, config and detector)

| anomaly_type        |   businesses |   anomalous_rows |   recall_at_k |   precision_at_k |   precision_ceiling |   median_rank_when_caught | reasons                                            |   rule_hit_before_cap | status                      |
|:--------------------|-------------:|-----------------:|--------------:|-----------------:|--------------------:|--------------------------:|:---------------------------------------------------|----------------------:|:----------------------------|
| duplicate_payment   |           50 |               50 |          0.6  |           0.0649 |              0.1049 |                         5 | repeat_payment×28, unusual_hour×2                  |                  0.78 | designed-for (not held-out) |
| late_repeat_charge  |           50 |               50 |          0.02 |           0.002  |              0.1016 |                         4 | repeat_payment×1                                   |                  0.04 |                             |
| round_trip_transfer |           50 |              100 |          0.86 |           0.1819 |              0.2099 |                         1 | amount_outlier×75, counterparty_both_directions×11 |                  0.77 |                             |

## Hard-rule hits on clean serving businesses (861 with no held-out row; every hit is a false positive)

| rule | hits | per 1,000 transactions | businesses with at least one |
|---|---|---|---|
| amount_z | 3,076 | 3.18 | 754 |
| rare_hour | 1,540 | 1.59 | 264 |
| repeat_payment | 3,209 | 3.31 | 754 |

`precision_ceiling` is the best precision@K achievable given how few anomalous rows each business holds;
read `precision_at_k` against it, never alone. `recall_at_k` is the headline: did the anomaly surface
among the flags an analyst would review. `rule_hit_before_cap`: share of the rows a hard rule fired on
before the list was cut to K — a row with a rule hit that is not caught was detected but cut by the cap.
