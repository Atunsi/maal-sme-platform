# Handover walkthrough — credit lens (Abdulrahman Alharbi), 30 minutes

Run everything on your own machine, not on a screen share. Every command below was dry-run on
`data/quick` on 2026-11-10. Quick data has 300 businesses per population, so its numbers are for
seeing the code work, never for quoting; quote only `docs/NUMBERS.md`.

**Do not overwrite committed results.** The eval scripts write to `eval/out/` and `lenses.credit.train`
rewrites `lenses/credit/model_v1.json` by default. Use the `--out` paths below, and restore the model
after training.

## 0–5 min: run it

```bash
pip install -r requirements.txt
python -m generator.generate --quick                  # → data/quick/ (about 30 s)
python -m profile_engine.compute --dir data/quick     # profiles.csv, needed by train
python -m pipeline.week8 --dir data/quick --demo --out scratch_demo.json
python -m scenarios.run --scenario combined_crisis --out scratch_crisis.json
python -m pytest tests/test_lenses_unit.py tests/test_scenarios.py
# optional: see training run, then put the shipped model back
python -m lenses.credit.train --dir data/quick --repeats 2
git restore lenses/credit/model_v1.json
```

In `scratch_demo.json`, business 10001: read `credit`, `credit_explanation.public_tier` (three
sentences) and `credit_decision_detail` (`pd`, `risk_tier`, `decline_origin`).

## 5–15 min: read

1. `lenses/credit/model.py` — `decide` (tiers and §31 affordability), `explain` (line 165;
   `FEATURE_LABELS` line 53, `PHRASES` line 43), `apply_sharia_gate`.
2. `lenses/lens_config.yaml` lines 14–41, the credit section.
3. `lenses/credit/README.md` — contract, non-negotiables, the XGBoost comparison.
4. `DECISIONS.md` entries 43 (line 3034) and 47 (line 3175).
5. `eval/out/demo_exposure.md` — what all 943 serving businesses show.

## 15–25 min: PROPOSED parameters (`lenses/lens_config.yaml`, entry 23.3)

For each: keep, change through a new DECISIONS entry with its rule fixed first, or leave open.
- Tiers: PD < 0.03 → 5.0%, < 0.06 → 6.5%, < 0.10 → 8.0%; decline at PD ≥ 0.10.
- Affordability α 0.40; 12 months; round down to SAR 1,000; amount SAR 5,000–500,000.
- Explanation thresholds 0.3 / 0.1 log-odds; top 3 reasons.
- Excluded features 23–26; `base_markup_pct` null on a decline.

Never change one to move a measured result: that is retuning.

## 25–30 min: sign-off lines (tick only consequences you agree with)

- Entry 29 (line 1973): "☐ credit lens owner (findings 1–2)"
- Entry 35 (line 2440): "☐ credit lens owner (retrain after the rebuild)"
- Entry 46 (line 3171): "☐ credit lens owner (findings 1–2 as restated)"
- Entry 47 (line 3224): "☐ credit lens owner (choose A–D; withdraw the 'cannot shortcut' sentence)"
- Entry 49 (line 3308): "☐ credit lens owner"

Your lines on 1b, 10, 15, 19, 23, 26, 34, 38 and 43 are already ticked.

## Demo findings that are yours to state (entries 29 and 46)

1. **Collapses are declined by the affordability gate, not the risk model.** Across serving, 243 of
   281 declines are affordability and 38 are the risk model (NUMBERS §5d).
2. **The risk score does not follow how bad the scenario is.** Severe collapse 0.0390 (lowest),
   calm half-year 0.0663, baseline 0.0526, combined crisis 0.0656 (NUMBERS §5b).
3. **The first explanation sentence is a sector effect** for 834 of 943 serving businesses
   (entry 47, open). Business 10001 is told its regular takings raise its risk.

Decision brief with options: `docs/briefs/brief_credit_abdulrahman.md`.
