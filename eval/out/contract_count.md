# The feature contract (64) against the credit model's inputs (58)

- **§8 contract** (`PROFILE_FEATURE_IDS`, what GET /profile returns): **64** IDs: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 18b, 19, 20, 21, 22, 23, 24, 25, 26, 32, 33, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 62b, 63, 64, 65, 66, 67, 68, 69.
- Not in the contract (the Zakat-only profile, `ZAKAT_PROFILE_FEATURE_IDS`): 27, 28, 29, 30, 31, 34, 35. Contract + Zakat-only = 71 = all registry features (71).
- **Excluded by the credit lens** (`lenses/lens_config.yaml` credit.excluded_feature_ids): 23, 24, 25, 26 → 60 candidates.
- **In the trained model** (`lenses/credit/model_v1.json`, trained 2026-10-11): **58** features.
- **Kept today by `build_xy` on `data`**: 58 features; identical to the model's list: **True**.

## The 2 candidates the model does not use

| # | Feature | Non-null rows | Distinct values | Values |
|---|---|---|---|---|
| 36 | `ramadan_adjusted` | 10,438 | 1 | False |
| 46 | `circular_counterparty_count` | 10,438 | 1 | 0.0 |

Rows: every business in `data` the engine did not refuse (10,438), as `build_xy` reads them. A column with no non-null value or fewer than 2 distinct values is dropped at run time:

```
lenses/credit/train.py (build_xy), the drop is line 71:
  66              continue
  67          name = FEATURE_NAMES[fid]
  68          if name not in df.columns:
  69              continue
  70          col = to_numeric(df[name])
  71          if col.notna().sum() == 0 or col.nunique(dropna=True) < 2:
  72              continue  # all-null or constant: no information, and a zero scale
```

So 64 − 4 excluded − 2 constant = 58 model inputs.
