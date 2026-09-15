# SME Financial Health Platform — Standard Operating Procedure

**Version:** 1.0
**Governs:** day-to-day working rules for the team.
**Authority:** the Behavioral Profile Feature Schema is the source of truth. Where this SOP and the schema disagree, the schema wins. This document tells you how to work; the schema tells you what to build.

---

## 1. The One-Line Version

We build **one profile engine**. Three lenses and two governance modules read it. The reuse is the contribution — not any single feature.

---

## 2. Non-Negotiables

These are never traded away, for any reason, at any point in the term.

1. **The markup is fixed at signing.** No `stressed_markup_pct`. No field that varies `base_markup_pct` or `adjusted_markup_pct` from any stress, forecast, or generated output. Risk-tiering different businesses at different fixed rates is fine. Changing one business's rate after signing is not.
2. **Late penalties are charity-directed.** `late_penalty_policy: "charity_directed"`, always.
3. **Zakat and `sharia_screen_status` stay 100% deterministic.** No LLM anywhere near either, ever.
4. **No generated text in the Compliance View.** That view exists to prove non-black-box behavior. Generated text there kills the claim on the spot.
5. **No `eligible` field on the navigator.** Retrieved criteria plus a citation and a verify-directly pointer. Nothing else.
6. **No random shuffling of time-series data** for any train/test split, anywhere.
7. **Three analytical lenses.** Credit, Forecast, Anomaly. A fourth requires a schema change with sign-off, not a new module.

If you are about to write code that breaks one of these, stop and raise it. Someone proposing "dynamic risk-based pricing" in Week 10 is the expected failure mode, not a hypothetical one.

---

## 3. Roles

| Role | Owns |
|---|---|
| Generator owner | `config.yaml`, all three output tables, the Week 3 gate |
| Profile engine owner | Features 1–59, the `/profile` route, Pandera schemas |
| Credit lens owner | XGBoost, SHAP, threshold table, output contract |
| Forecast + anomaly owner | Prophet/ARIMA, Isolation Forest, hazard curve |
| Compliance owner | Sharia screening, Zakat, PDPL/consent note |

One person owns each. Shared ownership means nobody owns it.

---

## 4. Week 1 — Do These Before Any Generator Code

These touch the feature contract every lens reads. They cannot be retrofitted later.

- [ ] Lock the current schema version as the Week 1 baseline, signed off by the team
- [ ] Full `sector_size_distribution` — weights sum to 1.0 (the schema's example is an excerpt at 0.60)
- [ ] `age_tier` distribution, conditional on sector × size
- [ ] Sector-specific `Beta(α_s, β_s)` for `latent_market_shock_sensitivity` — construction must carry genuinely higher default risk than professional services, or the fairness audit passes trivially
- [ ] `latent_to_observable_correlation` set explicitly
- [ ] Two populations named in config: separate seeds **and** disjoint business-ID ranges (N=10,000 research / N=1,000 serving)
- [ ] One business with a Ramadan-overlapping `start_date`, one without
- [ ] One business with `zakat_seed`, one without
- [ ] `data_source` tag enforced at the point of generation

**Keep out of `config.yaml`:** the held-out anomaly type. It lives only in the eval harness. If it touches the config, precision-at-K is circular and proves nothing.

**Also start in Week 1 (external clocks, not your build hours):**
- [ ] SAMA sandbox application — parallel track, non-blocking
- [ ] SME owner outreach — 8–10 candidates, parallel channels, yield is low
- [ ] Check whether an SME-specific NPL series actually exists in a pinned, citable publication. If not, drop that validation target rather than asserting an untraceable number.

---

## 5. Gates

### Week 3 — Generator Accepted (pass/fail)

All three must hold against a manually inspected sample. "The script runs without erroring" is not a pass.

1. Balance sheets are sector-consistent — construction shows `implied_dso_days` in [60, 120]; professional/digital services show `implied_dio_days < 5`. Run as an assertion, not a visual check.
2. Two businesses with near-identical observable profiles can carry different default labels — proves the latent path is wired in, not bypassed.
3. POS/inflow curves qualitatively track the Ramadan/Eid pattern. A plot check is sufficient at this stage.

**If any fails:** the generator owner gets first call on all available team time in Week 4. Nothing downstream proceeds. Week 5's credit and forecast lenses are not achievable on a generator that hasn't cleared this.

### Week 7 — Latency Smoke Test

Full serving path at N=1,000: profile computation, XGBoost inference, SHAP generation. Check API < 2s and SHAP < 1s. Run it here, one week before the gate, so there's runway to fix it.

### Week 8 — Hard Gate

One CLI script or notebook ingests the three CSVs, runs the shared engine, and outputs **one JSON object** containing:

- Credit decision (`base_markup_pct` present, `adjusted_markup_pct` null unless ESG is built)
- Cash-flow forecast + crunch alert
- Anomaly flags
- Zakat liability
- `insufficient_data` as a distinct state, not a silent null

**No UI required.** No stretch-goal code is written before this gate is met.

**If missed:** all stretch goals are cancelled. Weeks 9–12 go to polish and documentation of the core. This is a planned outcome, not a failure.

---

## 6. Build Order and Cut Order

Two opposite-direction orders, so neither is ambiguous under pressure.

**Build (attempted in this sequence after Week 8):**
1. Counterfactual recourse
2. Survivability stress-testing
3. ESG scoring & markup adjustment
4. Generative financial health report
5. Monsha'at & Kafalah navigator
6. NLP sector classification

**Cut (abandoned in this sequence if time runs short):**
1. Navigator
2. Generative report
3. NLP
4. ESG
5. Stress-testing
6. Recourse — cut last

The two GenAI items rank last because they introduce a live external-API dependency on defense day that no other item carries.

**No re-prioritization without a recorded team decision.**

---

## 7. Working Rules

**Week 2 is generator-only.** Everyone else scaffolds the profile engine against a small hand-made sample dataset — not generator output. You stay busy without coupling to unvalidated data.

**Parallel work in Weeks 9–11.** The reproducibility receipt, Arabic templates, and the published-stats anchor slide touch nothing in the frozen core. Anyone off the stretch-goal critical path can build them simultaneously.

**Every reported number carries its population.** An AUC from N=10,000 and a response time from N=1,000 are both legitimate — only if labeled.

**Every backtest cites its config.** Show `config.yaml` in the demo. It's the difference between a tuned demo and a repeatable instrument.

**Archive sources on download, not on demand.** Save the PDF the day you pull it. Pin the exact edition — never "latest." A dead link in Week 12 makes a validation claim unverifiable at defense time.

**No per-cell metric below 30 businesses and 10 default events.** Thin cells report `insufficient_sample`.

---

## 8. Code Standards

- `ruff` with default rules, `ruff.toml` at project root
- Pandera schemas validate all three tables before data reaches the feature engine
- DuckDB: `SET threads TO 1` immediately after connecting, for any query feeding a receipted value
- Feature membership stated as an explicit ID list in code, never as a range like "1–36"
- Coding-assistant skills come from the built-in marketplace only — never an external download link
- Secrets in environment variables or a gitignored file. Never committed, never logged, never in a URL

---

## 9. Change Control

Changing the schema means re-touching every lens. So:

1. Raise the proposed change in writing, with the specific section it touches
2. Get team sign-off
3. Record it in the schema's change log with a version bump
4. Only then write code against it

A change that exists only in someone's module is not a change — it's a bug waiting for Week 11.

**The test before adding any new rule:** can this guarantee be edited away silently, or would breaking it require changing code someone owns? If it can only be found in a paragraph, it isn't done yet.

---

## 10. Honesty Rules for the Defense

State these proactively rather than defensively. Every one of them is stronger volunteered than extracted.

- Results are labeled by data source. Synthetic results are never presented as validated on real transactions.
- The demo population is disjoint from training — separate seed, separate ID range. Say so before you're asked.
- Zakat needs balance-sheet data, not just cash flow. We generate it separately; a real integration would pull from an accounting system.
- Calibration targets are 2–3 years old due to GASTAT's publication lag. The claim is a match to the most recent published census, not to the economy as of today.
- The registered-SME population, our simulated-forward defaults, and bank-lending NPL figures are three different populations. The comparison is directional and order-of-magnitude.
- `ramadan_adjusted` is a coarse gate, not a magnitude adjustment.
- Emergent targets outside their pre-registered band are reported as findings. Never retuned to match.
- Named scope cuts: geography sampling, penetration testing, encryption-at-rest, adversarial robustness, production key management. Deliberate, not missed.

---

## 11. Escalation

| Situation | Action |
|---|---|
| Week 3 gate fails | All hands to the generator in Week 4. Nothing downstream starts. |
| Week 7 latency misses target | Fix before Week 8. Do not carry it into UI work. |
| Week 8 gate missed | Cancel all stretch goals. Weeks 9–12 = polish and docs. |
| Someone proposes a non-negotiable violation | Stop, raise it, cite the schema section. Do not "fix it later." |
| Post-gate schedule tightens | Follow the cut order top-down. Do not improvise a new order. |
