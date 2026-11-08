# POS thinning and the transaction features (DECISIONS entry 30)

Population: quick mode, 600 businesses generated from `config.yaml`; **376** have thinned POS `sales` rows (sample rate 0.1, `sample_weight` = 10). Transactions: 664,780 rows as shipped, 4,614,773 rows in the full stream. `daily_aggregates` asserted identical between the two runs, so the sample rate is the only difference.

**How the true value was obtained.** The same population was regenerated with `output.pos_sales_transaction_sample_rate` = 1.0. Thinning uses its own RNG stream `[seed, business_id, 3]`, so every other draw is unchanged and the full stream is exactly the one the shipped file was sampled from. The engine's own `transaction_features` was then run on it.

| # | Feature | Role | Median true | Median pre-fix | Median weighted | Median abs. error pre-fix | Median abs. error weighted | Median ratio pre-fix ÷ true | Median ratio weighted ÷ true | Median shipped | Median ratio shipped ÷ true | Largest abs. error shipped | Businesses with true ≠ 0 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 20 | `unique_counterparties_count` | under test | 138.0000 | 103.5000 | 103.5000 | 22.0000 | 22.0000 | 0.8189 | 0.8189 | 138.0000 | 1.0000 | 0.00e+00 | 376 of 376 |
| 21 | `counterparty_concentration_index` | under test | 0.0335 | 0.1056 | 0.0346 | 0.0729 | 0.0009 | 3.2365 | 1.0174 | 0.0335 | 1.0000 | 2.78e-17 | 376 of 376 |
| 22 | `new_counterparty_ratio_30d` | under test | 0.0000 | 0.0029 | 0.0151 | 0.0028 | 0.0142 | 3.9158 | 20.7635 | 0.0000 | 1.0000 | 2.78e-17 | 132 of 376 |
| 5 | `largest_single_source_ratio` | control | 0.0385 | 0.0448 | 0.0448 | 0.0067 | 0.0067 | 1.1382 | 1.1382 | 0.0385 | 1.0000 | 4.16e-17 | 376 of 376 |
| 10 | `top_expense_category_share` | control | 0.7004 | 0.7004 | 0.7004 | 0.0000 | 0.0000 | 1.0000 | 1.0000 | 0.7004 | 1.0000 | 0.00e+00 | 376 of 376 |
| 45 | `counterparty_persistence_ratio` | control | 0.9992 | 0.9210 | 0.9210 | 0.0492 | 0.0492 | 0.9368 | 0.9368 | 0.9992 | 1.0000 | 2.22e-16 | 337 of 376 |
| 46 | `circular_counterparty_count` | control | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.0000 | n/a | n/a | 0.0000 | n/a | 0.00e+00 | 0 of 376 |

`shipped` is the engine as it now runs: `transactions.csv` for the rows, `counterparty_windows` for these features (entry 30).
The columns before it record what sampled rows alone give, and what weighting them would give.

## Reading the table (generated from the numbers above)

- **21 `counterparty_concentration_index`:** the pre-fix value is 3.24× the true value; weighting brings it to 1.02×. It pools inflow and outflow value per counterparty, so down-weighted POS inflows inflate the outflow side. Weighting fixes it.
- **22 `new_counterparty_ratio_30d`:** the true median is 0.0000 (244 of 376 businesses have a true value of 0). The pre-fix median is 0.0029; weighted, 0.0151. Thinning removes a customer's earlier receipts, so a customer the business already knew looks new in the last 30 days. Weighting multiplies exactly those false-new receipts by the weight, so it makes the bias worse. Weighting does not fix it.
- **20 `unique_counterparties_count`:** the pre-fix value is 0.82× the true value; weighting cannot change it (0.82×). A weight scales the amount of a row that was kept; it cannot bring back a customer none of whose receipts were kept. In the thinned file a median of **11.7%** of each business's true customers never appear at all (5th–95th percentile 0.0%–34.6%). The count depends on the sample rate, not on the business.
- **Controls.** 10 is unaffected (1.00×: it reads outflows, which are never thinned). 5 is 1.14× and 45 is 0.94×, and weighting changes neither: the likely causes are that the largest customer's share is noisier in a 10% sample, and that persistence loses prior-window customers that were thinned away. 46 has a non-zero true value for 0 of 376 businesses, so it cannot show a bias here.

Chart: `thinning_bias.png` (median of computed ÷ true, log scale; 1 = unbiased; n/a where every true value is 0; the median ratio is taken over businesses whose true value is not 0). Per-business values: `thinning_bias_per_business.csv`; this table: `thinning_bias_summary.csv`.

The engine now refuses a thinned business with no `counterparty_windows` rows, so the pre-fix column cannot recur silently.
