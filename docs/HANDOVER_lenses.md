# Lens handover — 30-minute walkthrough per owner

The generator owner built v1 of each module to unblock the Week 8 gate (DECISIONS 23).
Each module belongs to its SOP §3 owner. One walkthrough per owner, in this order:

1. **Run it yourself** (5 min). Do this on your own machine, not on a screen share.
   ```bash
   pip install -r requirements.txt
   python -m generator.generate --quick
   python -m pipeline.week8 --dir data/quick --demo --out demo.json
   python -m pytest tests
   ```
   Open `demo.json`. It has three businesses: 10001 (approved, cash warning, non-zero Zakat),
   10002 (approved, no warning, Zakat zero because the hawl is incomplete), and 10003
   (`insufficient_data`).
2. **Read the code** (10 min). Use the table below.
3. **Go through every PROPOSED parameter** (10 min) in `lenses/lens_config.yaml` and decide:
   keep it, change it with a new DECISIONS entry, or leave it open.
4. **Tick or annotate your sign-off line** (5 min). Tick it only for consequences you agree with.

Numbers are quoted from `docs/NUMBERS.md`, never from this file.

| Owner | Code | Run / check | PROPOSED parameters to own | Your sign-off | Left for you |
|---|---|---|---|---|---|
| **Credit:** Abdulrahman Alharbi | `lenses/credit/` (`model.py` scoring + §27 gate, `train.py`, `model_v1.json`) | `python -m lenses.credit.train`, `python -m eval.week8_check` | Tiers A/B/C and decline cut-off; affordability α 0.40; 12 months; excluded features 23–26; `base_markup_pct` null on a decline | 23 (credit), 26 (§27 gate), 1b, 10, 15, 19 | Human-readable feature names; §25 within-sector fairness audit; recourse (§27, now unblocked by feature 24). 23% of research businesses are declined on affordability; review that share |
| **Forecast + anomaly:** Abdulelah Alsalamah | `lenses/forecast/` (`methods.py`, `forecast.py`), `lenses/anomaly/anomaly.py` | `python -m eval.forecast_selection`, `python -m eval.forecast_backtest`, `python -m eval.anomaly_eval` | `forecast.method: naive90` (chosen on days 121–150); anomaly scan 180 days, 30-day burn-in, recurring rule, one-sided amount rule | 23 (anomaly, forecast), 27 | §10 holdout-shock lead time; §16 Ramadan-window run; duplicate detection (define a **new** held-out type in `eval/heldout_anomalies.py` first). Never change `forecast.method` by reading the test table |
| **Zakat + Sharia:** Mohammed Alshaibani | `lenses/zakat/zakat.py`, `compliance/sharia.py`, `compliance/sharia_rules.yaml` | `python -m eval.sharia_report`, `python -m pytest tests/test_sharia.py` | Nisab 85 g at **placeholder** SAR 400/g; hawl rule nisab at start and end; Zakat skipped on `insufficient_data`; the whole Sharia rule table (v1.0, `proposed_unverified`) | 23 (Zakat), 26 (with the Sharia advisor) | Sourced, archived gold price; Sharia advisor review of the rule table; Compliance View toggle (no generated text, SOP §2); PDPL note |
| **Profile engine:** Faris Alsharifi | `profile_engine/` (not a lens; listed because it feeds all of them) | `python -m profile_engine.compute --dir data` | — | 1b, 5, 8, 9, 11 (66–69), 13 (`sample_weight`), 16 | Schema edit for the `daily_aggregates` row count (entry 5) |
| **API:** no named owner yet | `api/` | `python -m api.store --dir data --out data/serving.duckdb`, `python -m eval.latency_test` | Rate limit 60/min per business | 25 | Per-owner authorisation (§29); the team must name an owner |

Non-negotiables while you change your module (SOP §2): no field that varies the markup after
signing; penalties are always `charity_directed`; Zakat and the Sharia status contain no LLM; no
generated text in the Compliance View; no random shuffling of time series.
