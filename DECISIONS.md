# Generator — Change-Control Record

Per SOP §9 / Schema §28: a change that exists only in someone's module is not a
change. Every entry here is either **recorded** (team signed off), **proposed**
(implemented, awaiting sign-off), or **open** (needs a decision before a named
week). Schema section numbers are v2.9.

---

## 1. Volatility features carry latent signal via receipt lumpiness — PROPOSED

**Touches:** §14 observable mapping; downstream §35 feature 56
(`sector_relative_volatility_z`) and the §25 within-construction fairness audit.

**Problem found (2026-09-14):** after the schema-alignment rewrite, the
engine-computed `cash_flow_volatility` (feature 11) had Spearman ≈ 0.00 with the
hidden latent risk index in every sector. Feature 11 was noise in the synthetic
world. Because §35 derives feature 56 from it and §25 expects volatility /
liquidity-trend features to be the top within-construction attributions, an
audit run in Week 11 would likely have failed to find what §25 says a pass looks
like, with the cause seeded in Week 2.

**Rejected option:** damp recurring outflow spikes (payroll, rent) so the std of
net flow is less dominated by them. Makes the cash flows less realistic to make
a feature behave — backwards.

**Adopted option:** map the latent onto *receipt lumpiness*, a real-world
mechanism (poorly-managed businesses have feast/famine receipts), through two
channels driven by the same latent rank `u_vol`:

| channel | config key | what it models | where it matters |
|---|---|---|---|
| persistent AR(1) log-rate shock on inflow arrivals, φ = 0.85 (≈4-day half-life), stationary σ ∈ [0.15, 0.90] | `observable_mapping.inflow_dispersion_sigma`, `inflow_dispersion_persistence` | good weeks / bad weeks | high-frequency sectors (retail, F&B) |
| per-receipt amount dispersion × [0.7, 1.3] on the sector `daily_cv` | `observable_mapping.amount_dispersion_multiplier` | erratic invoice sizes | milestone-billed sectors (construction, professional) |

Sector `daily_cv` for construction was reduced 1.10 → 0.55 and professional
0.90 → 0.50: at σ = 1.1 a lognormal invoice distribution is so heavy-tailed that
a 90-day sample std is set by the single largest invoice, i.e. by luck, which
is why the original per-transaction mapping showed zero rank correlation.

**Result (Spearman vs `latent_risk_index`, micro tier, N=10,000 research):**

| observable | construction | retail | F&B | professional |
|---|---|---|---|---|
| `daily_inflow_cv` (≈ feature 3 basis) | 0.04 → **0.19** | 0.44 → **0.45** | **0.47** | 0.07 → **0.21** |
| `inflow_interval_cv` (feature 3 as defined) | 0.06 | 0.35 | 0.36 | 0.12 |
| `cash_flow_volatility` (feature 11 as defined) | −0.02 | 0.13 | 0.17 | 0.06 |
| `implied_dso_days` (37) | 0.39 | 0.52 | 0.52 | 0.50 |
| `balance_months_of_outflow` (≈16/18) | −0.31 | −0.36 | −0.33 | −0.29 |

Observable–observable correlations stay ≤ 0.33 in magnitude (independent noise
per observable confirmed; the residual is the shared latent, not shared noise).

**Honest limit — must be stated in the §25 write-up, not tuned away:** in
milestone-billed sectors, feature 11 *as literally defined* (std of daily net
flow) remains weak (≈0.0 construction) because ~27 receipts per 90 days of
Poisson count noise plus one monthly payroll spike dominate the std regardless
of management quality. Pushing the generator further to make feature 11
dominate within construction would be tuning the data to pass its own audit —
exactly what §21 forbids. Within construction the §25 "disciplined operator"
signal is therefore expected to surface through features 13 and 16–19
(days-negative, balance, runway, liquidity trend; −0.31 here) and 37–40
(working-capital cycle; 0.39–0.49), which the audit's own pass criterion also
names. If the Week 11 audit shows feature 56 near the top in construction, that
is a finding about the model, not something this generator made inevitable.

**Gate impact:** none. Week 3 gate re-run after the change: PASS (criterion 2
AUC 0.641; sector differential 3.45×).

### 1a. Mechanism — RECORDED (generator owner's call, not gated)

The two-channel mapping, the AR(1) parameters, the `daily_cv` correction, and
whether 0.19 on `daily_inflow_cv` in construction is adequate latent signal are
generator-internals questions. They are recorded here for traceability; the
other owners are not asked to evaluate them.

Recorded by: generator owner  Date: 2026-09-15

### 1b. Downstream consequence — PROPOSED, needs sign-off from the two owners it affects

What the credit lens and profile engine owners are asked to accept is the
**consequence**, not the mechanism:

> In the synthetic world, feature 11 (`cash_flow_volatility`) and therefore
> feature 56 (`sector_relative_volatility_z`) carry near-zero risk signal
> **within construction** (Spearman ≈ 0.0 vs. ground-truth latent). They carry
> modest signal in retail / F&B (0.13–0.17). The §25 within-construction audit
> should therefore expect the "disciplined operator" attribution to surface
> through features 13 and 16–19 (days-negative, balance, runway, liquidity
> trend) and 37–40 (working-capital cycle), which §25's pass criterion also
> names — not through 11 / 56. A Week 11 audit that finds 11 / 56 near the top
> in construction is a finding about the model and should be reported as such.

If either owner considers this an unacceptable property of the training data
(e.g. the credit lens design depends on feature 11 discriminating within
construction), that is a reason to reopen 1a — it is not a reason to tune the
generator until 11 looks better.

**Sign-off:** ☐ credit lens owner ☐ profile engine owner

---

## 2. Sector scope: four sectors; logistics not modelled — OPEN, decide in Week 1

**Touches:** `sector_size_distribution`, `balance_sheet_archetypes`,
`seasonality_multipliers`, `latents.market_shock_sensitivity`, `age_tier_distribution`,
and `schemas.SECTORS` — five coupled surfaces, which is why this cannot be
added quietly in Week 4.

**Current state:** `retail_trade`, `construction`, `food_beverage`,
`professional_services`. This is the same *count* as the pre-alignment
generator (which had `f_and_b`); nothing was added or removed.

**Why logistics is not in:** it appears only in the §20 config *excerpt*. §24
(sector-consistent balance sheets) defines archetypes for retail/trading,
construction, and professional/digital only; §22 seasonality gives no
logistics-specific guidance. Inventing an archetype to fill a config slot would
be the drift the schema warns against.

**Options:**
- **(A) Four sectors is the term's scope.** Record the cut in the final report
  in the same register as the geography stage cut (§20) and the security cuts
  (§29). Cost: zero. Risk: a reviewer notes the proposal's example named it.
- **(B) Add logistics with a real archetype.** Needs: a §24 archetype (moderate
  DSO 30–60, near-zero inventory, fleet-driven liabilities), a seasonality
  profile, a Beta(α_s, β_s), a size-tier split, and a source for its weight.
  At the schema's 0.05 weight, the N=10,000 cell is 500 businesses and ~25
  defaults — above the §23 minimum-cell rule, but every logistics × size tier
  except micro falls below it, so per-tier logistics metrics would report
  `insufficient_sample` anyway.

**Recommendation:** (A). The schema is internally ambiguous, the archetype
would be invented rather than sourced, and most logistics cells would be
unreportable under §23. Record it as a named cut. If the team chooses (B), it
must land before the Week 3 gate re-run, not after.

**Decision:** ☐ (A) ☐ (B)   Recorded by: ________  Date: ________

---

## 3. Harness thresholds — PROPOSED (numbers chosen by the generator owner)

The schema gives the *shape* of these checks but not the numbers. Recorded so
"why 1.5×?" has an answer.

| check | value | rationale |
|---|---|---|
| sector differential (criterion 2c) | construction ≥ 1.5 × professional | §14 says "genuinely higher"; 1.5× is well above sampling noise at n≈2,000 / ≈40–120 defaults and well below what would make sector a trivially dominant feature. Observed: 3.45×. |
| observables-not-labels band (2b) | in-sample logistic AUC ∈ (0.55, 0.95) | lower bound proves the latent path reaches the observables at all; upper bound proves labels are not recoverable. Observed: 0.64. |
| near-identical pair (2a) | min cross-label distance ≤ median NN distance in the largest sector×size cell | scale-free; passes only if opposite-label businesses are as close as any two neighbours. Observed: 0.148 vs 0.438. |
| Ramadan visibility (3) | Ramadan/base > 1.15 and Eid > Ramadan | placeholder until §22 β_h are estimated from mada bulletins. Observed: 1.29 / 3.68. |
| thin-file exclusion | coverage_days_90d < 60 excluded from criterion 1 | §15: the engine would refuse to score them, so the gate does not score them either. Reported count: 1,213 of 11,000. |

---

## 4. Items carried from the alignment rewrite — PROPOSED

- **Demo business IDs** moved from 9990/9991 (research population) to
  10001/10002/10003 in the *serving* population, so the demo slice is the
  out-of-sample one (§23).
- **`daily_aggregates` emits the full 180-day window**, not §7's "~90 rows".
  See entry 5 — proposed as a schema defect fix, not left as an open tension.
- **Ramadan/Eid Gregorian dates are a pinned table** (1445–1448) in config,
  not a runtime Hijri library. Verify against Umm al-Qura before the defense.
- **Seasonality multipliers are placeholders** until the §22 NNLS estimate.
- **§21 `revenue_share_medium_tier` published value (0.41)** is the schema's
  illustrative number, `source_status: unverified`. Emergent result: 0.437
  (medium tier = 5.4% of businesses). Do not report as a validated match until
  the GASTAT edition is pinned and archived.
- **`transactions.csv` is ~720 MB** at deliberately low transaction rates.
  Decide: accept, lower rates further, or gzip (schema names `.csv`).

---

## 5. Schema §7 / §12 conflict on `daily_aggregates` row count — PROPOSED SCHEMA EDIT

**Touches:** Schema §7 (data implication, table 2) and §12 ("Third output
table required"); no lens code.

**The conflict:** §7 and §12 both describe `daily_aggregates.csv` as "max ~90
rows per business". §12 also sets the generator default `window_days: 180`, and
three features in the committed contract require a *prior* 90-day window by
definition:

| feature | definition (schema) | needs |
|---|---|---|
| 4 `revenue_growth_rate_90d` | current 90d vs prior 90d | 180 days |
| 9 `expense_growth_rate_90d` | current 90d vs prior 90d | 180 days |
| 45 `counterparty_persistence_ratio` | current-90d counterparties ∩ prior-90d | 180 days |

§15's `partial_profile` state ("coverage ≥ 60 but total available history <
`min_history_days`") only has meaning if more than 90 days *can* be available.
§8 says `/profile` reads only `daily_aggregates`. A 90-row table therefore makes
4, 9, and 45 uncomputable for every business and collapses `partial_profile`
into a permanent state — which is a defect in the contract, not a judgment call.

**Read of the history:** the "~90 rows" wording predates `window_days: 180`
(§12) and the v2.7 additions of `min_history_days` / `partial_profile` (§15)
and feature 45 (§33). §7 is the stale one.

**Proposed edit (for the §9 process — raise in writing, sign-off, change-log
entry with a version bump, then code):**

> §7 table 2 / §12: `daily_aggregates.csv` — pre-aggregated daily summaries,
> **one row per calendar day of the generated window (`window_days`, default
> 180)**. The `< 2s` API target is met by the pre-aggregation itself (one row
> per day instead of raw transactions), not by capping the row count; 180 rows
> per business is well within that budget. Features 4, 9 and 45 read the prior
> 90 days from this same table; §15's `partial_profile` applies when fewer than
> `min_history_days` rows exist.

**Generator position until the edit lands:** emit the full window (current
behaviour). `output.daily_aggregates_trailing_days: 90` remains available so
the literal current wording can be produced on demand, but it should not be
the default — the default should not make three contract features
uncomputable.

**Recommendation:** adopt the schema edit. Cost is a wording change and a
version bump; the alternative is three dead features and a §15 state that
never varies.

**Raised by:** generator owner, 2026-09-15  **Sign-off:** ☐ profile engine owner
(owns features 1–59 and `/profile`) ☐ team

---

## 6. Sector revenue mix vs GASTAT 2022 — FINDING (reported, not retuned); base inflows unsourced — OPEN

**Touches:** `sector_economics.*.base_monthly_inflow_sar`, `size_tier_scale`,
`sector_size_distribution` (§20 calibration inputs); §21 emergent targets.

**Trigger (2026-09-15):** the team supplied GASTAT 2022 SME revenue by sector
× size tier (SAR bn). Pinned in `config.yaml` under
`emergent_validation_targets.published_sources`.

**Archived (2026-09-15) — §21 source discipline now satisfied:** the source
workbook (`GASTAT, "Operating Revenues by Economic Activity and Size 2022"`,
sheet `الايرادات التشغيلية`) is saved at
[`sources/gastat/SME_2022.xlsx`](sources/gastat/SME_2022.xlsx), alongside the
2021/2023/2024 editions and the companion PDF, for the trend context and to
pin which edition (2022) is the one actually cited. The four sector figures in
config were re-entered at full precision directly from the archived workbook
(thousand SAR → bn) and match the rounded figures the team supplied exactly —
confirming the number and the source agree, not just that a plausible number
was typed in. The all-sector `0.470` context figure is the workbook's own
Total row (all 18 ISIC activities, 1,456.38 bn SAR), not a separately-sourced
figure.

**Basis correction still stands:** the medium-tier share must be compared on
the *same four sectors the generator models*. On that basis GASTAT gives
**0.343**, not the all-economy 0.470 (which includes mining, manufacturing,
etc. the generator does not model). The all-sector figure is kept in config as
`comparable: false` context, never as a target.

**Findings (research population, N=10,000, four modelled sectors):**

| metric | generator | GASTAT 2022 | verdict |
|---|---|---|---|
| medium-tier revenue share | 0.439 | 0.343 | **FINDING** — +28% rel, outside 0.15 band (generator is *high*, not low) |
| sector revenue share — retail | 0.139 | 0.600 | **FINDING** |
| sector revenue share — construction | 0.606 | 0.256 | **FINDING** |
| sector revenue share — food & beverage | 0.052 | 0.106 | **FINDING** |
| sector revenue share — professional | 0.203 | 0.038 | **FINDING** |
| size gradient within construction (micro/small/medium) | 0.09/0.36/0.55 | 0.16/0.34/0.50 | close |
| size gradient within retail | 0.48/0.31/0.21 | 0.50/0.25/0.24 | close |
| size gradient within food & beverage | 0.59/0.29/0.13 | 0.20/0.36/0.44 | **FINDING** |
| size gradient within professional | 0.30/0.35/0.35 | 0.13/0.31/0.56 | **FINDING** |
| realised size multipliers (rev/business vs micro) | 1 : 4.3 : 17 in every sector | needs establishment counts | not yet checkable |

Exact distances and pass/finding status come from `validate_emergent.py`, which
reads the bands from config — nothing above was judged after the fact.

**Diagnosis:** the sector revenue mix is set almost entirely by
`base_monthly_inflow_sar` (retail 60k, construction 180k, professional 90k,
F&B 45k), which are **unsourced guesses**. The size gradients *within* a sector
are mostly right because the size-tier count splits already differ by sector
(§20). Professional's 0.25 *count* weight against a 3.8% *revenue* share is not
in itself wrong — count and revenue differ — but the generator currently makes
that claim implicitly; the establishment-count table makes it explicit either way.

**What was deliberately NOT done:** `base_monthly_inflow_sar` was not adjusted
to hit the GASTAT revenue shares. Doing so converts the §21 emergent target
into a calibration input wearing a validation label; the revenue-share test
would then be circular and would have to be deleted from the target list.

**Resolution path (in order):**
1. Pull the GASTAT 2022 **establishment counts** by sector × size (same portal,
   different table). Archive on download.
2. Set `sector_size_distribution` weights and `size_tiers` from the counts —
   these are calibration inputs by §21's own definition.
3. Source `base_monthly_inflow_sar` and `size_tier_scale` from something that
   is **not** the revenue table: §22's mada ticket-size × frequency method is
   the schema's named route. If no such source exists, the team must choose
   which of {base inflows} / {revenue-share test} is the input and which is the
   test — it cannot be both — and record that here.
4. Re-run `validate_emergent.py`. Whatever it says is the reported result.

**Interim state:** the generator passes the Week 3 gate (which tests structure,
not macro calibration) but its sector revenue mix is a known miscalibration.
Any number derived from cross-sector revenue totals (aggregate Zakat, portfolio
amounts) should not be shown until step 3 lands.

**Owner:** generator owner. **Blocked on:** establishment-count table (step 1).
**Sign-off on the input/test split (step 3):** ☐ team
