# Feature 24: a value and a null reason at the same time (DECISIONS entry 31)

Data: `data\quick`. Businesses refused under §15 (`insufficient_data`): **32**. After `pipeline.week8.prepare`, **32 of 32** carry a feature 24 value *and* a feature 24 null row.

## The three businesses named in entry 31

| business_id | engine value (profiles.csv) | engine null reason (profile_nulls.csv) | value after prepare() | null reason after prepare() |
|---|---|---|---|---|
| 15 | — | insufficient_data | soft_flag_review | insufficient_data |
| 87 | — | insufficient_data | compliant | insufficient_data |
| 91 | — | insufficient_data | compliant | insufficient_data |

Engine columns are read from the files `profile_engine.compute` wrote; the `after prepare()` columns are what the API and the Week 8 object are built from. Every refused business: `feature24_seam.csv`.

## The code (`pipeline/week8.py`, `prepare`)

```
 141  def prepare(ctx: Context, tables: dict) -> Prepared:
 142      data_hash = {int(b): data_sha256(tables, int(b)) for b in tables["businesses"]["business_id"]}  # before the engine touches anything
 143      prof = run_profiles(tables, ctx.cfg)
 144      feats, nulls = prof["features"].set_index("business_id"), prof["nulls"]
 145  
 146      # Feature 24 — Sharia screening (compliance/sharia.py). Computed for every business,
 147      # including insufficient_data ones: it screens activity and income, not coverage.
 148      # Written into the shared profile so the credit lens reads it like any other feature (§8).
 149      rules, rules_sha = load_rules()
 150      tx = tables["transactions"]
 151      screens = {}
 152      for b in tables["businesses"].itertuples(index=False):
 153          b_id = int(b.business_id)
 154          screens[b_id] = screen(b.sector, b.declared_mcc_code, tx[tx["business_id"] == b_id], rules, rules_sha)
 155      feats = feats.astype({"sharia_screen_status": object})
 156      for b_id, scr in screens.items():
 157          feats.loc[b_id, "sharia_screen_status"] = scr["sharia_screen_status"]
 158      nulls = nulls[~((nulls["feature"] == "sharia_screen_status") & (nulls["reason"] == "not_implemented"))].reset_index(drop=True)
 159      return Prepared(tables, feats, prof["status"].set_index("business_id"), nulls, data_hash, screens)
```

The value is written for every business; the filter on the last null-handling line keeps every row whose reason is not `not_implemented`, so the `insufficient_data` row survives.

## Through the API (GET /profile, serving store)

Serving businesses refused under §15: **57**. Responses with both a `sharia_screen_status` value and a `sharia_screen_status` null reason: **57 of 57**.

| business_id | status | sharia_screen_status | null_reason |
|---|---|---|---|
| 10003 | insufficient_data | compliant | insufficient_data |
| 10026 | insufficient_data | compliant | insufficient_data |
| 10066 | insufficient_data | compliant | insufficient_data |

Nothing is changed by this finding; the options are in DECISIONS entries 31 and 32.
