# Handover walkthrough — forecast and anomaly (Abdulelah Alsalamah), 30 minutes

Run everything on your own machine, not on a screen share. Every command below was dry-run on
`data/quick` on 2026-11-10. Quick data has 300 businesses per population, so its numbers are for
seeing the code work, never for quoting; quote only `docs/NUMBERS.md`.

**Do not overwrite committed results.** The eval scripts write to `eval/out/` by default; use the
`--out` paths below. Never change `forecast.method` after reading a test table (entry 27).

## 0–5 min: run it

```bash
pip install -r requirements.txt
python -m generator.generate --quick                  # → data/quick/ (about 30 s)
python -m profile_engine.compute --dir data/quick     # needed by the two forecast scripts
python -m pipeline.week8 --dir data/quick --demo --out scratch_demo.json
python -m eval.forecast_selection --dir data/quick --out scratch_forecast_selection.md
python -m eval.forecast_backtest --dir data/quick --out scratch_forecast_backtest.md
python -m eval.anomaly_eval --dir data/quick --out scratch_anomaly_eval.md
python -m scenarios.run --scenario late_sudden_shock --out scratch_late_shock.json
python -m pytest tests/test_forecast.py tests/test_anomaly.py
```

In `scratch_demo.json`, business 10001: read `forecast` (projection beside its naive baseline, crunch
alert) and `anomaly.flags` (count them, read each `flag_reason`).

## 5–15 min: read

1. `lenses/forecast/methods.py` and `lenses/forecast/forecast.py` — the six candidates and the alert.
2. `lenses/anomaly/anomaly.py` — the forest, the rule order, the seasonal gate, the `exact` repeat check.
3. `lenses/lens_config.yaml` lines 63–109, the forecast and anomaly sections.
4. `eval/heldout_anomalies.py` — held-out types live only here (`assert_held_out`).
5. `DECISIONS.md` entry 36.5 (line 2553) and 37.5 (line 2764).

## 15–25 min: PROPOSED parameters (`lenses/lens_config.yaml`, entries 23.3, 27, 36, 37)

For each: keep, change through a new DECISIONS entry with its rule fixed first, or leave open.
- Forecast: `method: naive90`; horizons 30/60/90; fit window 90; naive window 30; hazard alert 0.5,
  watch 0.2.
- Anomaly: scan 180 days; contamination 0.01; `max_flags` 10; 200 trees; minimum 30 transactions;
  amount z 3.0 (one-sided); rare hour 0.01; new-counterparty z 2.0; rare category 0.01; 30-day
  burn-in; recurring at 3 occurrences within 10%; `seasonal_gate: true`; `repeat_payment_mode: exact`.

Your recorded position (36.5): no parameter changes this term, because every result has been seen.

## 25–30 min: sign-off lines (none of yours is ticked yet)

- Entry 23 (line 1704): "☐ forecast + anomaly owner (23.3 anomaly, forecast)"
- Entry 27 (line 1890): "☐ forecast + anomaly owner"
- Entry 29 (line 1973): "☐ forecast + anomaly owner (findings 3–4)"
- Entry 36 (line 2568): "☐ forecast + anomaly owner (36.1–36.5)"
- Entry 36 (line 2682): "☐ forecast + anomaly owner (36.6–36.8, and the open repeat-rule decision)"
- Entry 37 (line 2762): "☐ forecast + anomaly owner"
- Entry 49 (line 3308): "☐ forecast + anomaly owner"

## Demo findings that are yours to state (entries 29 and 46)

1. **A shock in the final three weeks is invisible.** `late_sudden_shock` is approved for 104,000 SAR
   against the baseline's 47,000, with no cash alert. `naive90` averages 90 days.
2. **The anomaly lens always returns its cap.** 10 flags in every scenario; across serving, 584 of 943
   businesses hit the cap and none returns fewer than 4 (NUMBERS §5d). Flags are a review queue.
3. **`naive90` warns later than the baseline**: median 15 vs 27 days on a 30% shock, with about half
   the false alarms (NUMBERS §5c).

Decision brief with options: `docs/briefs/brief_forecast_anomaly_abdulelah.md`.
