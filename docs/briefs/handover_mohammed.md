# Handover walkthrough — Zakat and Sharia screening (Mohammed Alshaibani), 30 minutes

Run everything on your own machine, not on a screen share. Every command below was dry-run on
`data/quick` on 2026-11-10. Quick data has 300 businesses per population, so its numbers are for
seeing the code work, never for quoting; quote only `docs/NUMBERS.md`.

**Do not overwrite committed results.** `eval.sharia_report` writes to `eval/out/` by default; use
the `--out` path below. Zakat and the Sharia status stay 100% deterministic, with no LLM (SOP §2).

## 0–5 min: run it

```bash
pip install -r requirements.txt
python -m generator.generate --quick                  # → data/quick/ (about 30 s)
python -m pipeline.week8 --dir data/quick --demo --out scratch_demo.json
python -m eval.sharia_report --dir data/quick --out scratch_sharia.md
python -m scenarios.run --scenario severe_collapse --out scratch_collapse.json
python -m pytest tests/test_sharia.py tests/test_zakat.py tests/test_gold_price.py
```

In `scratch_demo.json`: business 10001 has a computed Zakat liability (seeded hawl), 10002 returns
`hawl_incomplete`, and 10003 is `insufficient_data`, where Zakat does not run. Read `zakat` and
`governance.sharia_screen` (rule trace, prompts, disclosures, hashes).

## 5–15 min: read

1. `compliance/sharia_rules.yaml` — every list, the 5% threshold, the prompts.
2. `compliance/sharia.py` — precedence hard → soft → compliant; no-MCC fallback.
3. `lenses/zakat/zakat.py` — the net-working-capital base, the nisab and hawl gates.
4. `lenses/lens_config.yaml` lines 43–61, the Zakat section.
5. `sources/zakat_nisab_gold_price.md` and `DECISIONS.md` entry 48 (line 3228).

## 15–25 min: PROPOSED parameters (entries 23.3, 26)

For each: keep, change through a new DECISIONS entry, or leave open for the Sharia advisor.
- Zakat: 85 g gold basis; SAR 491.291/g (2026-11-08 quotation, dated after every calculation date);
  2.5% per 354-day lunar year; hawl = nisab at start and end; skipped for `insufficient_data`.
- Sharia rule table v1.0 (`proposed_unverified`): hard and soft MCC lists; 5% financial-institution
  inflow threshold; retail with no MCC → soft flag; existing financing as a disclosure.

## 25–30 min: sign-off lines (none of yours is ticked yet)

- Entry 23 (line 1705): "☐ compliance owner + Sharia advisor (23.3 Zakat)"
- Entry 26 (line 1839): "☐ compliance owner ☐ Sharia advisor"
- Entry 31 (line 2150): "☐ compliance owner"
- Entry 32 (line 2188): "☐ compliance owner"
- Entry 48 (line 3272): "☐ compliance owner (choose; record the 2026-11-08 change) ☐ Sharia advisor"

## Demo findings that are yours to state (entry 29, finding 5)

1. **Zakat falls with revenue**: SAR 5,963.26 at baseline, 1,327.52 in the severe collapse,
   2,651.45 in the combined crisis (NUMBERS §5b).
2. **The Sharia status is compliant in every scenario**, because the retail MCC never changes.
3. **No generated business is ever hard-flagged** (0.0% of 10,000 research); that path is tested on
   crafted inputs only (NUMBERS §5).
4. **The nisab uses one unverified quotation** dated after the calculation dates (entry 48).

Decision brief and the Sharia-advisor question list: `docs/briefs/brief_compliance_mohammed.md`.
