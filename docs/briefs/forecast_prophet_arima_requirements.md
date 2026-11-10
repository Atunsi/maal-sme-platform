# Prophet and ARIMA evaluation — requirements for the run (DECISIONS 49)

**For:** Faris Alsharifi, who runs it on another machine. **Owner of the result:** Abdulelah Alsalamah
(forecast lens). **Decided:** entry 49, option B: evaluate Prophet and ARIMA. Written 2026-11-10.

The one rule that makes this worth doing: **the protocol below is committed to `DECISIONS.md` before
anything is fitted, and the result is reported whichever way it goes.** The days 151–180 test window
in `data/` was used once (entry 27), so it cannot be the test again.

## 1. What you need

| Item | Requirement |
|---|---|
| Repository | `main` at or after the commit that adds this file; Python 3.13; `pip install -r requirements.txt` |
| New packages | `statsmodels` (ARIMA) and `prophet` (pulls in `cmdstanpy` and a Stan build). Pin the exact versions you install and record them in the entry. If Prophet will not install on Python 3.13, use a separate Python 3.12 virtual environment for this harness only, and record that |
| Data | `python -m generator.generate` (full scale, about 5 min, about 6 GB free RAM) then `python -m profile_engine.compute --dir data` |
| Disk | about 3 GB for `data/` plus about 1 GB for the Prophet/Stan install |
| Time | ARIMA with the order rule below: roughly 0.5–1 s per business; Prophet roughly 0.5–1 s per business. For 9,495 validation businesses plus 1,000 test businesses, plan 2–6 hours per method. Businesses are independent, so splitting them across processes by `business_id` is allowed and changes nothing |
| Not allowed | changing `config.yaml`, `lens_config.yaml`, the six existing candidates, the metric, or the windows after seeing any result |

## 2. Protocol to commit first (copy into the next free DECISIONS entry, then commit, then run)

1. **Candidates added** (to `lenses/forecast/methods.py`, so the evaluated code is the shipped code):
   - `arima`: `statsmodels` ARIMA on the daily net flow, fitted on the **last 90 days** before the origin
     (as every other candidate). Order chosen per business by lowest AIC over p ∈ {0, 1, 2}, d ∈ {0, 1},
     q ∈ {0, 1, 2}; no seasonal term. If no order converges, the candidate returns `naive90`'s projection
     and the count of such fallbacks is reported.
   - `prophet`: Prophet on the same 90 days; weekly seasonality on, yearly and daily off, no holidays,
     `changepoint_prior_scale` 0.05 (the library default), MAP fit (`mcmc_samples=0`). Fallback and its
     count as for ARIMA.
   - Nothing else is tuned. No grid over Prophet settings.
2. **Choosing (validation):** research population, origin at day 120, target days 121–150, the eight
   candidates (six existing plus two). Criterion unchanged from entry 27: lowest **median scale-free
   end-of-horizon error**, |projected − actual| / average monthly outflow. The validation table is the
   only thing that can change `lens_config.forecast.method`.
3. **Testing (reported once):** a **fresh population** never generated before: seed **44**, IDs
   **20001–21000**, generated in memory from `config.yaml` with only `populations` replaced and
   `demo_businesses` emptied, written to `data/forecast_holdout/` (git-ignored), profiled with
   `python -m profile_engine.compute --dir data/forecast_holdout`. Origin day 150, target days 151–180.
   Report the chosen method, `naive90` and `naive30`.
4. **Metrics, all reported:** median and mean scale-free error, share of businesses better than naive30,
   MAPE away from zero, crunch recall, false alarms (exactly the columns of
   `eval/out/forecast_selection.md`), plus fit failures per method and wall time per business.
5. **What ships:** if validation picks `arima` or `prophet`, `lens_config.forecast.method` changes to it
   in its own commit, the dependency goes into `requirements.txt`, and the Week 7 latency test is re-run
   (Prophet fits per request; the forecast route must stay under 2 s at its maximum). If validation keeps
   `naive90`, nothing ships. Either way the test row is reported.

## 3. What to produce

- A harness, e.g. `eval/forecast_prophet_arima.py`, writing `eval/out/forecast_prophet_arima.md`, built
  on `eval/forecast_selection.py` (reuse its `evaluate` and `summarise`, do not re-implement the metric).
- `tests/test_forecast.py`: each new candidate returns `horizon` finite values on a short synthetic
  series, and its fallback works.
- The DECISIONS entry's result section: both tables, package versions, platform, fallback counts.
- `docs/NUMBERS.md` rows for any number quoted, and `python -m eval.check_numbers` passing.
- A note under entry 49 that the evaluation is done, pointing to the new entry.

## 4. What to say if it is not run before submission

"Prophet and ARIMA were named in the plan and were not evaluated; the protocol is written down
(`docs/briefs/forecast_prophet_arima_requirements.md`) and needs a fresh test population because the
existing test window has already been used once." That sentence is already the report's position
(entry 49).
