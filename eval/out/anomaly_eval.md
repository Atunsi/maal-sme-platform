# Anomaly lens — §12 evaluation (injected vs held-out, reported separately)

Population: **serving** for held-out (business_id 10,001–11,000, §23); demo businesses for injected. Data source: synthetic. K = 10 flags per business. Held-out seed 7, 50 businesses per type.

## Injected types (the generator was told to create these)

| anomaly_type          |   businesses |   anomalous_rows |   recall_at_k |   precision_at_k |   precision_ceiling |   median_rank_when_caught | reasons          |
|:----------------------|-------------:|-----------------:|--------------:|-----------------:|--------------------:|--------------------------:|:-----------------|
| large_transfer        |            1 |                1 |             1 |              0.1 |                 0.1 |                         1 | amount_outlier×1 |
| odd_hours_transaction |            1 |                1 |             1 |              0.1 |                 0.1 |                         7 | unusual_hour×1   |

## Held-out types (defined only in eval/heldout_anomalies.py — unseen by generator, config and detector)

| anomaly_type        |   businesses |   anomalous_rows |   recall_at_k |   precision_at_k |   precision_ceiling |   median_rank_when_caught | reasons                                            |
|:--------------------|-------------:|-----------------:|--------------:|-----------------:|--------------------:|--------------------------:|:---------------------------------------------------|
| duplicate_payment   |           50 |               50 |          0.06 |           0.0087 |              0.1191 |                         2 | unusual_hour×3                                     |
| round_trip_transfer |           50 |              100 |          0.92 |           0.2135 |              0.2297 |                         2 | amount_outlier×75, counterparty_both_directions×17 |

`precision_ceiling` is the best precision@K achievable given how few anomalous rows each business holds;
read `precision_at_k` against it, never alone. `recall_at_k` is the headline: did the anomaly surface
among the flags an analyst would review.
