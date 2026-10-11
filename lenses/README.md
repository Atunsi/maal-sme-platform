# Analytical lenses

**Exactly three** (Credit, Forecast, Anomaly) — §37.5, SOP §2. A fourth
requires a schema change with sign-off, not a new module. The Zakat lens
(`zakat/`) is a **governance module**, not a fourth analytical lens; it is
grouped here because it is a route (§8), but it is deterministic end to end.

All three read the same profile and none is gated on another's output (§8).

| Directory | Owner (SOP §3) | Status |
|---|---|---|
| `credit/` | credit lens owner | **v1 built** (entry 23) |
| `forecast/` | forecast + anomaly owner | **v1 built** (entry 23) |
| `anomaly/` | forecast + anomaly owner | **v1 built** (entry 23) |
| `zakat/` | compliance owner | **v1 built** (entry 23) |

## Running the Week 8 path

```bash
python -m pipeline.week8 --demo          # one JSON per demo business
python -m eval.week8_check              # contract + non-negotiables on real output
```

All lens parameters live in [`lens_config.yaml`](lens_config.yaml) — kept out of `config.yaml` so the
generator config's hash, cited by the calibration receipts, is untouched.
