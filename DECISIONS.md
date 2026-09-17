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

---

## 7. Berka Phase 0 viability probes — RECORDED (gate PASSED, 2026-09-15)

**Governed by:** `SOP_Data_Grounding_And_Dimensions.md` v2.0 §4. Run with
`python -m berka_adapter.probe` against the archived copy
(`sources/berka/the-berka-dataset.zip`, sha256 `dfd5e949…`, see
`sources/berka/SOURCE.md`). The original PKDD'99 host `sorry.vse.cz` did not
resolve on the access date; the Kaggle mirror `marceloventura/the-berka-dataset`
was pulled and archived the same day.

| Probe | Result | Decision |
|---|---|---|
| 1 — balances go negative? | 288 / 4,500 accounts (6.4%) ever < 0; median 24 days below zero among them; 1,577 `SANKC. UROK` rows on 264 accounts | **PASS** (≥ 5%). Features 13–15 stay **class A**. |
| 2 — `bank`+`account` a usable partner key? | populated on 100% of `PREVOD` rows, 0% elsewhere → 25.9% of all transactions; 7,664 distinct keys over 273,508 partnered rows (ratio 0.028, i.e. identities repeat); median repeat-partner share of inflow value 1.00 on a 20-account sample | **PASS**. Counterparty band (5, 20–22, 45, 46) stays **class A**, reported with coverage share. |
| 3 — structural | all 8 row counts match the published figures exactly; every date inside 1993–1999; `loan.status` A=203, B=31, C=403, D=45; `loan.duration` ∈ {12, 24, 36, 48, 60} at 130–145 each | **PASS**. Primary label set (A vs B) n=234 / **31 defaults** — below the ~25 line only barely, so both label sets are reported and the primary is led with its interval (§7.1). |
| 4 — multi-account clients? | every one of 5,369 clients holds exactly one account (`disp`: 4,500 OWNER + 869 DISPONENT rows, DISPONENT = second person on the *same* account); zero candidate own-account transfer pairs | **PASS (single-account safe)**. `business_id = account_id`. Phase 5c stays conditional. |

**Assumption recorded (SOP §11.1):** one account per business is assumed on
both sources. Own-account transfers between an SME's accounts would inflate
features 1 and 6 as phantom revenue and expense; our data contains no such case
by construction. Goes verbatim into the README honesty list.

**Known upload quirks (verified, handled in `berka_adapter/column_map.yaml` and
`build.py`):** `trans.type` carries a third value `VYBER` on 16,666 rows (a
withdrawal; treated as `VYDAJ`); `k_symbol` is blank on 481,881 rows and a
single space on 53,433; `order.k_symbol` contains `LEASING` (341 rows), which
never appears on `trans.k_symbol`. Berka has no time-of-day, so `hour` is a
constant 12 on every Berka transaction (a constant cannot carry signal).

Recorded by: generator owner  Date: 2026-09-15

---

## 8. Schema changes for real-data grounding (SOP_Data_Grounding §14) — PROPOSED

Each row below is implemented in `generator/schemas.py` and emitted by both
producers (`generator/generate.py`, `berka_adapter/build.py`). None removes or
renames an existing column; the Week 3 gate is re-run unchanged (entry 10).

| Change | Where | What |
|---|---|---|
| `data_source` enum gains `external_real` | §29 | `DATA_SOURCES` |
| `evidence_class` ∈ {A, B, C} on every row of every table | §8, SOP §1 | generator stamps `output.evidence_class` (B); adapter stamps A |
| null reason `not_available_in_source` | §15, §16 | `profile_engine.registry.NULL_REASONS`, plus `not_applicable`, `insufficient_events`, `no_break_detected`, `not_implemented`, `reference_stats_missing` so no null is ever bare |
| `transactions.counterparty_id` nullable | §7 | null = the source carries no partner identity (cash, bank-originated); the generator always populates it |
| `transactions.subfamily` (ISO 20022 BTC-style code) | §12.2 | `SUBFAMILIES`; generator maps from category, adapter from `k_symbol`/`operation` (Appendix B) |
| `transactions.own_transfer_flag` | SOP §5.3 | always False on both sources today (entry 7) — the column exists so netting can never be silent |
| `category` enum gains 7 bank-feed values | §7 | `cash_deposit`, `cash_withdrawal`, `bank_interest`, `bank_fee`, `household`, `insurance`, `pension` — never emitted by the generator |
| registry categoricals accept `not_available_in_source`; `declared_mcc_code` nullable | §7 | a real source has no sector/size/age/MCC; a sentinel is visible, a fake value is not |
| `balances_daily.csv` (5th table) | §7 | emitted by both; on the synthetic side it duplicates `daily_aggregates.eod_balance` on purpose (the engine reads `eod_balance`; the table is the explicit daily-balance contract) |
| `obligations.csv` (4th table) | §7, SOP §9.1 | Berka: the real `order` table; frequency **measured** from execution intervals ≤ observation date (5,311 monthly / 1,160 unknown), `final_date`/status history null because the source has none |
| `balances_monthly.csv` optional | §37.1 | `validate_engine_tables` requires transactions/daily/businesses only; a bank feed has no balance sheet |
| Berka label table | SOP §7.1 | `berka_labels_schema`: `label_primary` (A→0, B→1, C/D→null), `label_secondary` (A+C→0, B+D→1), `censored` |
| Features 60–65 | new §37 | `profile_engine.registry` — 62 split into `ocr_forward_3m` (62) and `ocr_forward_6m` (62b) |
| Feature 15 formula | §3 | **PROPOSED**: `100 × mean(min(1, σ_net/daily_outflow), clip(1 − inflow/outflow, 0, 1), days_neg/90, min(1, overdraft_events/5))` — the schema leaves the weighting open |
| Feature 46 threshold | §33 | fixed at 0.5% of the business's trailing-90-day total transaction value, floored at the §16 epsilon — scale-free so it means the same in CZK and SAR |
| Feature 33 calendar | §15 | operating days exclude Fri/Sat for `synthetic`/`sandbox`, Sat/Sun for `external_real` |
| `berka.cv_cut_date`, `profile_engine.*` config blocks | `config.yaml` | see entry 9 |
| §21 target `real_vs_synthetic_signal_strength` | `config.yaml` | registered 2026-09-16 before the first `eval.compare_real` run |

Berka-specific adapter facts worth knowing: Berka has no time-of-day
(`hour` = 12 on every row); the running balance chains exactly on 94.3% of
account-days and to within 0.1–0.2 CZK on the rest, all month-end days (interest
posting rounding) — the gate tolerance is 0.21 CZK and all 4,500 accounts pass;
14 zero-amount rows are dropped from `transactions.csv` (schema requires > 0).

**Sign-off:** ☐ profile engine owner (schemas, features 60–65, feature 15 formula) ☐ team

---

## 9. §15 eligibility threshold on real data — FINDING + PROPOSED source-labelled threshold

**Touches:** §15 hard eligibility rule; every Berka result.

**Finding (2026-09-16, before any model was run):** with `coverage_days_90d ≥ 60`
as written, **0 of 4,500 Berka accounts and 0 of 682 labelled accounts are
scorable.** The median account has 13 active days per 90 (5th–95th percentile
8–20, maximum 31). The 60-day rule encodes a daily-activity assumption
(POS-acquiring Saudi SMEs) that real 1990s Czech retail accounts do not meet.
This is a genuine result about the rule and is reported as such.

**Decision:** the threshold becomes `profile_engine.coverage_min_days_by_source`
in `config.yaml` — `synthetic: 60` (unchanged), `external_real: 10`. Ten was set
from a single criterion, chosen before any AUC existed: keep the great majority
of labelled accounts (615 / 682 = 90.2%; at 15 it is 58%, at 20 it is 21%) while
still requiring roughly one transaction day per week so the 90-day statistics
(interval CV, lag-7 autocorrelation, semideviations) are formed from real events.
Every Berka number carries the threshold it was computed under. **A deployment on
Saudi AIS must re-validate the 60-day rule against real activity levels before
relying on it; the synthetic thin-file population (~1,200 of 11,000) says nothing
about that.**

**Sign-off:** ☐ profile engine owner ☐ team

---

## 10. Real vs synthetic signal strength — FINDING (reported, not retuned); features 41 and 61 — PROPOSED §31 edits

**Touches:** §21 target `real_vs_synthetic_signal_strength` (registered in
`config.yaml` on 2026-09-16 before the first run); §31 features 41, 42 and the
underwriting rule; §14's 0.64-vs-≥0.85 contradiction.

**Run:** `python -m eval.compare_real` → `eval/out/real_vs_synthetic.md`.
config.yaml hash asserted unchanged across the run; two models, one feature
set (25 class-A scale-free features after runtime pruning of 5 that are
constant or >50% null on one side), two numbers; every Berka number with a
1,000-resample bootstrap interval. Final run on the post-Phase-5 tables
(base columns byte-identical, entry 11).

| | Synthetic (research, N=10,000, class B) | Berka (real, class A) |
|---|---|---|
| Comparison-set AUC, 95% CI | **0.594 [0.567, 0.621]** — 5 contiguous-ID entity folds, out-of-fold | **0.901 [0.835, 0.955]** — secondary (censored) label set, train loan_date < 1997-01-01, validate on 328 loans / 25 defaults |
| Primary label set (A vs B, no censoring) | — | temporal split not evaluable (3 defaults after the cut); expanding loan-date-quintile folds: **0.740 [0.558, 0.902]** over 167 loans / 17 defaults (secondary on the same folds: 0.873 [0.789, 0.938]) |
| Default rate | 0.041 | 0.096 (secondary) / 0.105 (primary) |

**Verdict against the pre-registered band: FINDING.** |0.594 − 0.901| = 0.31
against `tolerance_abs: 0.10`. Real accounts carry **more** outcome signal than
the generator's ρ = 0.6 / σ = 0.2 coupling produces, not less. Per §8.3 nothing
was retuned: `latent_to_observable_correlation` and `label_noise_sigma` are
untouched. What this does settle is the §14 contradiction the SOP names — gate
criterion 2 reports 0.64 in-sample while the proposal promised ≥ 0.85: the real
reference point sits at 0.74–0.90 with wide intervals, so the promise should be
restated as a range with its interval, not chased by tuning.

**Per-feature transfer (the table that matters):** on Berka the signal is
liquidity — `liquidity_hazard_30d` 0.76 [0.69, 0.82], `days_negative_balance_90d`
ρ = +0.49, `flow_asymmetry_ratio` 0.65, `volatility_index` 0.65 — and declared
commitment is *protective* (`recurring_expense_ratio` 0.30, i.e. accounts with
standing orders default less; `fixed_obligation_coverage_months` 0.22). On the
synthetic side almost every feature is univariately flat (0.45–0.58); the 0.60
emerges only multivariately. Counterparty and growth features transfer nothing
on either side.

**Feature 41 (`financing_outflow_ratio`) — PROPOSED §31 re-specification.**
Three structural facts: (1) no counterparty MCC exists in either dataset — the
generator assigns MCC to the business, Berka has none — so "financial-institution
MCC" is unimplementable as written and `counterparty_type` has been standing in
for it; (2) on Berka the point-in-time window ends the day before the loan, so
existing debt service is identically zero on every labelled account (pruned from
the comparison set for that reason — it cannot be validated against Berka
outcomes); (3) debt service moves by transfer/standing order, exactly where a
transaction code exists and an MCC does not. **Proposed wording:** "share of
recurring outflow value carried on loan-repayment transaction codes
(`subfamily = LOAN`)". The engine already emits both paths
(`financing_outflow_ratio`, `financing_outflow_ratio_code`); they agree on 100%
of synthetic businesses by construction.

**Feature 61 (`obligation_coverage_ratio`) — PROPOSED §31 underwriting-rule
change.** §31 tests affordability against net flow (`avg_monthly_inflow −
avg_monthly_outflow`), which includes discretionary spend a business could cut.
61 = `avg_monthly_inflow / committed_monthly_outflow` is now computed on both
sources (Berka from the real `order` table: median 2.4 on 3,160 accounts;
synthetic median 2.3). **Proposed:** `installment_capacity_sar` (42) becomes
`max(0, avg_monthly_inflow − committed_monthly_outflow) × (1 − k × flow_asymmetry_ratio)`
and the rule stays `monthly_installment ≤ 0.40 × capacity`. Not yet changed in
code — §9 process first.

**Sign-off:** ☐ credit lens owner (41, 42, 61) ☐ profile engine owner ☐ team

---

## 11. Phase 5 — obligations, facilities, sub-fields, MCC coverage — PROPOSED

**Touches:** `generator/dimensions.py` (new), `config.yaml` blocks
`grounded_from_berka` and `ungrounded`, schemas (`facilities.csv`,
transaction sub-fields), features 66–69 (proposed §38), §12.3.

**Additive by construction.** Every Phase 5 draw uses its own RNG stream
`[population seed, business_id, 2, purpose]`; the base tables are byte-identical
before and after (verified: `daily_aggregates.csv`, `balances_monthly.csv`,
`labels.csv`, `latents_hidden.csv` hashes and the pre-Phase-5 profile vector —
see the Week 3 gate re-run recorded at the end of this entry). The one
deliberate value change is §12.3's preferred option: `declared_mcc_code` is
nulled where a real acquirer would not have assigned one
(`ungrounded.mcc_coverage_share`: retail/F&B 0.90, construction 0.15,
professional 0.25). Obligation rows are **not** reconciled with the transaction
stream — a direct-debit row does not add collections to `transactions.csv` —
because adding transactions would move gate numbers, which §9.3 forbids. State
this limitation; do not hide it.

**Class B — measured on the Berka corpus, labels held out (`grounded_from_berka`):**

| Parameter | Measured | Used for |
|---|---|---|
| `loan.duration` months | 12/24/36/48/60 at 0.19/0.20/0.19/0.20/0.21 (n = 682) | loan standing-order `final_date` (features 62, 63) |
| standing orders per account | 1: 0.56, 2: 0.25, 3: 0.11, 4: 0.06, 5: 0.02; 83.5% of accounts have one | direct-debit count per business |
| order amount / monthly outflow | lognormal μ = −1.85, σ = 1.38 (median 0.20) | direct-debit magnitude |
| bank fee tiers (`SLUZBY`) | 14.6 / 30 / 100 CZK at 0.925 / 0.054 / 0.021 | `charge_amount` tier mix and multipliers (×1 / ×2.05 / ×6.85); the SAR level is judgement |
| standing-order execution amount CV | 0.00 | confirms DD *variability* has no ground — it stays class C |

Measurement script (re-run to verify): the block in this entry's commit —
`python - <<EOF` over `berka_adapter.io.load_table("trans"/"order"/"loan")`,
months = account history span / 30, share = order amount / monthly outflow.

**Class C — author judgement, each with a `basis:` string in config:** direct
debits (existence 0.55, variability 0.25, seasonality 0.30, cancellation
probability [0.02, 0.30] rising with latent risk), scheduled payments, balloon
share 0.20 × [3, 12]×, credit facilities (0.40 with a line; utilisation
[0.05, 0.85] by latent risk, σ 0.10; emergency line when > 0.90), value-date lag
{0: 0.6, 1: 0.3, 2: 0.1} on transfers, 50% charge probability, SAR 5 base fee,
MCC coverage shares.

**§10.2 assertions (`python -m eval.dimensions_check`):** obligations
terminate; cancellations correlate with latent distress (quick population:
ρ = 0.36, p = 2e-6); `final_amount ≠ amount` on every balloon row; utilisation
correlates with latent distress (ρ = 0.92); emergency lines exist; MCC coverage
within 0.05 of config per sector; evidence stamps correct. Full-population
numbers are in the gate re-run record below.

**§13.4 sensitivity (`python -m eval.sensitivity --all`):** class-C features
are reported as a range over low/central/high parameter settings —
`eval/out/sensitivity_*.md`. No class-C feature carries a single performance
number anywhere in this repository.

**Features 66–69 (proposed §38):** `facility_utilisation` (C),
`headroom_days_of_burn` (C), `max_consecutive_overdraft_days` (**A** — computable
on Berka from the real balance series), `emergency_line_present` (C). `own_funds`,
`facility_limit`, `facility_drawn`, `headroom` are separate columns so no
downstream code interprets a raw balance (§12.1 `Included` semantics).

**Week 3 gate re-run after Phase 5 (§9.3) — 2026-09-16, full scale, PASS,
unchanged.** Criterion 1: construction `implied_dso_days` 66.0 / 95.5 / 115.7
(min/median/max, n = 2,099), professional `implied_dio_days` max 3.58 (n = 2,405);
criterion 2: in-sample AUC **0.641**, sector differential **3.45×**, closest
cross-label pair **0.148 vs 0.438**; criterion 3: Ramadan **1.29×**, Eid **3.68×**;
1,213 thin-file exclusions. Identical to the values recorded in entry 1 and the
README. Stronger than the gate: sha256 of `daily_aggregates.csv`,
`balances_monthly.csv`, `labels.csv` and `latents_hidden.csv` are **byte-identical**
before and after the Phase 5 code landed (`384fa221…`, `f08e169d…`, `c07a11b2…`,
`396a5021…`). Full-population §10.2 assertions: cancellations ρ = 0.271
(p = 1e-93, n = 5,518), utilisation ρ = 0.925 (n = 4,010), 775 balloon rows,
1,018 emergency/temporary lines, 25,831 / 10,507 / 5,050 standing-order /
direct-debit / scheduled rows.

**Sign-off:** ☐ generator owner ☐ profile engine owner (66–69) ☐ team

---

## 12. §21 target list: the revenue-share metrics are calibration inputs, not emergent — RECLASSIFIED (2026-09-16, before any size-mix correction)

**Governed by:** `SOP_Saudi_Calibration_Sources.md` v1.0 §2.2–§2.3; Schema §21.
**Touches:** `config.yaml` `emergent_validation_targets` block; `eval/validate_emergent.py`;
new `eval/seasonal_recovery.py`.

**Why this comes first, in its own commit:** the same SOP goes on to correct
`sector_size_distribution` from the Monsha'at register. Done in the other order,
that correction would look exactly like tuning a parameter until a validation
target moved — even though it is not. So the reclassification is recorded and
committed before any calibration input changes.

**The derivation.** `revenue_share_medium_tier`, `sector_revenue_share` and
`within_sector_size_revenue_share` involve no simulation. With
`E[size_scale | s] = Σ_tier p_s(tier) · size_tier_scale[tier]`:

```
revenue_weight(s) = weight_s × base_monthly_inflow_sar_s × E[size_scale | s]

retail       0.35 × 60,000  × 1.67 =  35,070   → 13.8%   (harness reported 13.9%)
construction 0.20 × 180,000 × 4.30 = 154,800   → 60.9%   (harness reported 60.6%)
F&B          0.20 × 45,000  × 1.41 =  12,690   →  5.0%
prof         0.25 × 90,000  × 2.30 =  51,750   → 20.3%
```

The harness figures in entry 6 are reproduced to within rounding from four
config lines. A metric that can be computed before the generator runs is a
calibration input passed through a multiplication, whatever list it sits in.

**Decision.** The three metrics move to `calibration_derived_checks`. They are
still computed and still compared with GASTAT 2022, but under their own heading
as a consistency check on the inputs: a miss there says the inputs differ from
GASTAT, and the remedy is a sourced correction of the inputs (entry 6 step 1–3),
not a validation result in either direction. `validate_emergent.py` now prints
the closed form next to the realised value so the identity is visible every run.

**Registered in their place** (no closed form; the simulation must run;
`status_on_fail: report_as_finding` on every one):

| target | what it tests | reference | band |
|---|---|---|---|
| `days_negative_balance_distribution` | shape of days-negative over scorable research businesses (share ≥ 1, p50/p90/p99) | none exists for Saudi SMEs; Berka 6.4% ever-negative is directional context, `comparable: false` | none — reported |
| `realised_dso_vs_archetype` | median `implied_dso_days` per sector, recomputed by the harness after balance-sheet noise, sits inside the §24 archetype band | config-internal (machinery) | inside band |
| `ramadan_amplitude_recovered` | fit the §22 window decomposition to the generated data (OLS on log sector-daily totals, trend + day-of-week + window dummies) and recover the configured multipliers, value and count separately | config-internal (machinery) | ±0.08 abs |
| `aggregate_default_rate` | unchanged — still `pending_week1_check`, still unregistered | SAMA SME NPL series if one exists | none yet |
| `real_vs_synthetic_signal_strength` | unchanged (entry 10) | Berka | ±0.10 abs |

Day-of-week dummies in the recovery fit are not decoration: Eid 1447 (20–22 Mar
2026) is Fri–Sun, so for `sun_thu` sectors a raw window mean would confound the
Eid effect with the weekend.

**Recorded by:** generator owner, 2026-09-16.
**Sign-off (target-list change, §9):** ☐ team

---

## 13. Saudi national source calibration — SAMA measured, Monsha'at blocked (2026-09-16) — PROPOSED

**Governed by:** `SOP_Saudi_Calibration_Sources.md` v1.0. **Report:** `/maal/saudi_calibration_report.md`.
**Touches:** `config.yaml` (`seasonality_value_multiplier`, `seasonality_count_multiplier`,
`sector_economics.*.avg_inflow_ticket_sar`, `output.pos_sales_transaction_sample_rate`,
`ramadan_calendar` 1448), `generator/generate.py`, `generator/schemas.py` (`sample_weight`),
`berka_adapter/build.py`, `eval/gate_week3.py` criterion 3, `eval/heldout_anomalies.py`,
new `calibration/` package, new `sources/sama/`.

Every judgement call the SOP asks for a DECISIONS entry on is below. Every number cites
its archive (`sources/sama/*.meta.json`, SHA-256 recorded) and the JSON it was measured
into (`calibration/out/`). `python -m calibration.check_config` asserts config still equals
those measurements.

### 13.1 Sources: what was archived, what was not

| Source | Origin | Retrieval | Edition / span | Archive |
|---|---|---|---|---|
| POS by sector, monthly | SAMA (Monetary & Financial Statistics, Table 30d) | KAPSARC mirror, OpenDataSoft export API | 2016-01 → 2023-12, 17 sectors × sales/count | `pos_by_sector_monthly_2016_2023.csv`, sha256 `4aea3d0e…` |
| POS aggregate, monthly | SAMA | KAPSARC mirror | 1995-01 → 2026-07, 9 indicators | `pos_aggregate_1995_2026.csv`, `c08b693a…` |
| **POS by sector, weekly** (not in the SOP's inventory) | SAMA (Weekly Points of Sale Transactions) | KAPSARC mirror | 2020-05-10 → 2025-07-06, national total + 11 cities | `pos_by_sector_weekly_2020_2025.csv`, `4966f401…` |
| Bank credit by activity | SAMA | KAPSARC mirror | 2021Q3 → 2026Q2, 17 activities + Total | `bank_credit_by_activity_2021_2026.csv`, `10cefcf7…` |
| Weekly POS bulletin | SAMA website | direct PDF | week 6–12 Sep 2026 (four weeks shown) | `sama_weekly_pos_bulletin_2026-09-12.pdf`, `c2b285f3…` |
| Enterprises Statistics | Monsha'at | OpenData gateway | — | **NOT ARCHIVED — gateway unavailable, see 13.2** |
| GDP by institutional sector (s.a.) | GASTAT | — | — | **EXCLUDED — see 13.10** |

The three CSVs the team had downloaded by hand were byte-identical (same SHA-256) to the
API exports archived here, so the archive is the API pull and the retrieval path is recorded
as the mirror; the origin body cited is SAMA in every case (SOP §1.2).

### 13.2 Phase 1 BLOCKED: Monsha'at gateway — FINDING, nothing invented

Every request to `pservices.monshaat.gov.sa/…/EnterprisesStatistics/{Year}/{Quarter}?paginationIndex=&recordsPerPage=`
on 2026-09-16 returned either `statusCode 1016 "Request Timeout … before we receive any
response from the provider"` (HTTP 408, 8–12 s) or `statusCode 1009 "No Data Found"` (HTTP
404, 0.1 s). Tried: Gregorian 2022Q4–2026Q2, Hijri 1444–1447, page sizes 5–100,
`paginationIndex` 0 (rejected: 1010 Validation Error — so the index is 1-based) and 1, and
the unpaged URL (read timeout). A retry loop ran every five minutes for two hours. The
national open-data portal (open.data.gov.sa) rejects programmatic access with a WAF page,
and the Monsha'at SME Monitor PDFs (Q4 2024 – Q2 2025, downloaded and text-scanned) carry no
activity × size table.

Consequences, recorded rather than worked around:
- `sector_size_distribution` is **unchanged** and still class C. `calibration/monshaat_pull.py`
  and `sector_mix.py` are complete against the documented contract (paging required, 1-based,
  de-dup on region × activity, Arabic labels verbatim, large tier excluded, three quarters for
  stability) and write `calibration/out/phase1_sector_mix.json` → `proposed_config` the day the
  gateway answers. §3.2's pagination semantics (250 records vs 76 pages) remain unresolved.
- The Jazan sample in the SOP is one region and is **not** used (SOP §4.3: national figures only).
- Consistency finding that needs no Monsha'at pull: the current weights imply an aggregate
  micro/small/medium split of **75.5 / 19.4 / 5.2 %**; Monsha'at's published national split at
  Q4 2023 is **87.0 / 11.5 / 1.4 %** (1,138,588 / 150,788 / 18,723; SME Monitor Q4 2023). The
  outlier is construction's 45/40/15. Not rescaled by hand — allocating a national split across
  sectors without the register would be judgement wearing a source's name.
- Phase 4's per-business credit index is **withheld** (it needs the SME count denominator);
  `financing.share_of_businesses` stays uniform 0.35, class C. The generator already accepts a
  per-sector map so the change is a config edit when the denominator exists.

### 13.3 ISIC → four-sector map (judgement; membership as implemented in `calibration/sector_mix.py`)

Matching is by prefix on the normalised Arabic label; the labels actually matched are written
to the phase-1 JSON in full when a pull succeeds.

| Generator sector | ISIC divisions (Arabic prefix) | Choice recorded |
|---|---|---|
| `retail_trade` | G45 تجارة الجملة والتجزئة وإصلاح المركبات…; G46 تجارة الجملة…; G47 تجارة التجزئة… | **wholesale and vehicle trade/repair counted as retail trade** |
| `construction` | F41 تشييد المباني; F42 الهندسة المدنية; F43 أنشطة التشييد المتخصصة | **civil engineering counted as construction** |
| `food_beverage` | I56 أنشطة خدمات الأطعمة والمشروبات | accommodation (I55) excluded |
| `professional_services` | M69 الأنشطة القانونية وأنشطة المحاسبة; M70 أنشطة المكاتب الرئيسية…; M71 الأنشطة المعمارية والهندسية…; J62 أنشطة البرمجة الحاسوبية…; M74 الأنشطة المهنية والعلمية والتقنية الأخرى | **J62 (a section-J activity) counted as professional services, per SOP §4.2** |
| borderline, **not** mapped, reported | M72 البحث العلمي والتطوير; M73 الإعلان وبحوث السوق; M75 الأنشطة البيطرية | not in the SOP list; listed under "did not map cleanly" |

### 13.4 POS category → sector map and the retail composition rule (judgement)

- `food_beverage` ← **Restaurants & Café** (clean; the bulletin's Bakeries & Pastries line is
  reported, not modelled).
- `retail_trade` ← **value-weighted composite** of Clothing and Footwear + Beverage and Food
  (grocery) + Electronic & Electric Devices + Furniture + Jewelry — Σ value ÷ Σ count for
  tickets, Σ value per period for seasonality. A composite, not one line, because no POS line
  is "retail trade"; the five are the consumer-goods lines that map to ISIC G47.
- `construction` ← Construction & Building Materials **reported, never applied**: it measures
  consumers buying materials at POS, not contractor receipts. `professional_services` ← no
  monthly line at all; the bulletin's Professional & Business Services (53 SAR) is consumer-facing
  and is context only. Both sectors keep their author-judgement multipliers and arrival rates,
  labelled `evidence_class: C` in config (SOP §5.3, §12.5).

### 13.5 Seasonality: method, selection rule, and the direction correction

Method (`calibration/seasonality.py`): the §22 model `P_m ≈ T_m · Σ_h w_{m,h} β_h · exp(γ_g)` with
Umm al-Qura overlap weights (hijridate 2.6.0, pinned), β ≥ 0 by NNLS with mean 1, **Gregorian
month-of-year controls** fitted jointly by backfitting, and a LOWESS trend on the log series
that absorbs card adoption (terminals 267,827 in 2016-12 → 2,330,051 in 2025-12; fitted trend
×13 for restaurants, ×4 for Total). 2016–2023, **2020 excluded and asserted**. 95% intervals
by leave-one-year-out jackknife. Value and count fitted separately (§5.4).

Addition beyond the SOP: the weekly SAMA series lets a **window model** (pre_ramadan_10d /
ramadan / eid / post_eid_7d with day-overlap weights per week) resolve the three-day Eid the
monthly series cannot. Fitted on 2021–2023 only.

**Selection rule written to config:** `ramadan` from the monthly NNLS (seven Ramadans, tighter
interval); `pre_ramadan_10d`, `eid`, `post_eid_7d` from the weekly window model (the only series
that resolves them). Both ≤ 2023; 2024–2025 held out (13.7).

| Sector | β_Ramadan value [CI] | count [CI] | weekly Eid value [CI] | previous placeholder (value) |
|---|---|---|---|---|
| Restaurants & Café → `food_beverage` | **0.82 [0.76, 0.87]** — down in every one of 7 years | 0.70 [0.66, 0.73] | **1.66 [1.44, 1.89]** | ramadan 1.45, eid 1.80 — **direction wrong** |
| retail composite → `retail_trade` | 1.34 [1.28, 1.39] | 1.12 [1.05, 1.20] | 0.94 [0.19, 1.69] (wide) | ramadan 1.30, eid 2.20 |
| Clothing and Footwear (no generator sector) | **1.90 [1.77, 2.03]** | 1.72 | 1.49 [−0.76, 3.75] | — |
| Construction & Building Materials (reported only) | 0.71 [0.63, 0.78] | 0.90 | 0.00 (NNLS boundary) | — |
| Total POS | 1.11 [1.07, 1.15] | 0.98 | 0.82 [0.41, 1.22] | — |

Findings the report must carry: (a) food service **falls** in Ramadan (daytime closure is not
recovered by the evening surge) and spikes at Eid — the placeholder had both signs the other way;
(b) the Eid spike in the POS data is **clothing** (β 1.90 monthly; the weekly Eid window for
clothing is not identified), and no generator sector isolates it; (c) Total POS value ×1.11 while
count ×0.98 — the average ticket rises ~14% in Ramadan (fewer, larger baskets), which is why the
generator now carries two multipliers; (d) the retail Eid value interval is wide — a 3-day window
inside weekly data on three years — so `eid: 0.94` for retail is a measured point estimate with an
honest CI, not a precise number; (e) the weekly window model puts several sectors' Eid at exactly
0 (NNLS boundary), which is the model saying "not identified", and those sectors are not applied.

### 13.6 Ticket sizes and the count-versus-file-size resolution

Measured (`calibration/ticket_size.py`, value ÷ count, SAR): restaurants **29.0** (bulletin 4-week;
27.9 latest week; 32.5 weekly 2025; 34.9 monthly 2023), retail composite **61.5** (58.1 / 63.4 /
69.9), construction materials 129, professional & business services 53, Total 59. The config
implied **400** (retail) and **250** (F&B) — the SOP's "3–10× too high" confirmed.

Applied edition: the archived 12-Sep-2026 bulletin, four-week Σvalue ÷ Σcount (pinned edition,
SOP §1.3); the other three editions are the stability check and are in the JSON.

**Resolution of the conflict SOP §6.1 names (decouple, not lower inflows):** `avg_inflow_ticket_sar`
replaces `inflow_tx_per_day` for the two POS sectors; the receipt count is now base inflow ÷ ticket
(~33/day for a micro shop, ~50 for a micro restaurant) and `daily_aggregates.inflow_count` carries
the full count — feature 2 finally measures real POS frequency. That is ~70 M rows (~7 GB) at full
scale, so the **`sales` rows of POS-sector businesses in `transactions.csv` are an unbiased thinning
at `output.pos_sales_transaction_sample_rate` (0.10)**, each carrying a new column
**`sample_weight` = 1/rate** (1.0 on every other row and on every Berka row). `daily_aggregates`
stays authoritative (computed from the full stream); outflows and injected anomaly rows are never
thinned; the thinning uses its own RNG stream `[seed, id, 3]`. The gate now checks outflows exactly,
inflows exactly on un-thinned businesses, and Σ amount × sample_weight against inflow_total within
±2% on thinned ones. Transaction-derived features (5, 10, 20–22, 41, 45, 46) are ratios and
counts of counterparties, unbiased under thinning; anything that sums `transactions.amount` on
the inflow side must multiply by `sample_weight`. `base_monthly_inflow_sar` is **not** lowered
(SOP §10.6: it stays judgement). Schema change: one column, both producers, Pandera-enforced —
raised here for §9 sign-off.

### 13.7 Held-out 2024 and 2025 (never refitted) — `calibration/holdout_validate.py`

Aggregate (SOP §6.2 as written), Total POS, monthly fit on 2016–2023 predicting each held-out
year's within-year index: Ramadan-month index **actual 1.089 vs predicted 1.151 (2024), 1.126 vs
1.144 (2025)** for value; 0.982 vs 1.042 and 0.972 vs 1.018 for count; MAE over all 12 months
0.031–0.033. All inside ±0.10.

Per sector — possible because the weekly series runs to 2025-07, which the SOP expected to be
impossible: restaurants Ramadan **0.827 (2024) / 0.852 (2025) vs β 0.816**; retail composite
**1.280 / 1.433 vs 1.338**; Total 1.054 / 1.157 vs 1.111 — all within ±0.10. Construction &
Building Materials **misses** (0.814 / 0.906 vs 0.707) — a line the generator does not apply, but
reported. Eid-week actuals (a 3-day window diluted over 7-day weeks, so a floor): restaurants
1.21 / 1.22 vs the weekly-model 1.66 point estimate.

### 13.8 Gate criterion 3 redefined (supersedes the placeholder thresholds in entry 3)

The old check ("demo 10001 Ramadan/base > 1.15 and Eid > Ramadan") encoded the direction the
measurement contradicted for food service and tested one business. It is replaced by the
§21 target `ramadan_amplitude_recovered` run inside the gate: the §22 window decomposition
fitted to the research population per sector (equal-weighted across businesses, day-of-week
controlled) must recover the configured value **and** count multipliers within ±0.08 for the
class-B sectors, plus a direction check; class-C sectors are printed, not gated. The demo plot
stays. The recovery estimator equal-weights businesses because a raw sector sum at quick scale
was dominated by two medium-tier retailers' AR(1) lumpiness — a uniform 0.1 bias across all four
windows — while a generator-only test on 300 retail micro businesses recovered every window
within 0.05; the definition was fixed before the full-scale run and is recorded here.

### 13.9 Calendar correction from source

`ramadan_calendar` 1448: Ramadan 1448 has 29 days on the Umm al-Qura calendar, so Shawwal 1 is
2027-03-09, not 03-10 (config was one day late on `ramadan_end`, `eid_start`, `eid_end`). 1445–1447
matched exactly. Corrected; `calibration/hijri.py` now asserts every row against the converter.
Not in the 2026 window, so no generated number moved.

### 13.10 Excluded source: GASTAT seasonally-adjusted real GDP by institutional sector (2023=100)

Not used, for two reasons: (1) the export interleaves five `Unit` series (Index, SAR mn, Q-o-Q
growth, two contribution series) under one `Institutional Sector` label, which is why the
non-oil private sector reads 1.13 / 435,803 / 0.46 across consecutive quarters — not corrupt so
much as un-pivoted, but unusable as an index series without a cleaning step no SOP phase needs;
(2) "seasonally adjusted" removes exactly what Phase 2 measures, and oil / non-oil government /
non-oil private is far too coarse for a four-sector calibration.

### 13.11 Pre-existing defect fixed in passing

`eval/heldout_anomalies.py` built injected rows without the Phase 5 columns (`subfamily`,
`value_date`, `status`, `charge_amount`, `own_transfer_flag`, `evidence_class`) and had been
failing with a KeyError since entry 8 landed; it now fills them (and `sample_weight` = 1.0).

### 13.12 Evidence-class movement

Class C → **B**: the Ramadan/Eid value and count multipliers for `retail_trade` and
`food_beverage`; the POS average ticket (receipt count) for the same two sectors. Feature 36
(`ramadan_adjusted`) itself stays C on Berka (calendar not covered) but the seasonality it gates
is now measured on the synthetic side. Unchanged C: sector weights and tier splits (Monsha'at
blocked), `base_monthly_inflow_sar`, construction / professional seasonality and arrival rates,
financing share, everything in the `ungrounded` block. §21 NPL target: still unregistered.

### 13.13 Phase 5 re-run at full scale — results (2026-09-16, N = 10,000 research + 1,000 serving)

Order followed as the SOP requires: reclassification committed (`5c106da`), then the
calibration inputs (`43486c1`), then this re-run.

**Week 3 gate: PASS** (`eval/out/gate_week3_after_calibration.txt`). Structural: Pandera on all
tables; outflows equal Σ transactions exactly; inflows exact on the 4,997 un-thinned businesses;
Σ amount × sample_weight / Σ inflow_total = **1.0003** on the 6,003 thinned POS-sector
businesses (99.9% within ±20% per business). Criterion 1: construction `implied_dso_days`
66.0 / 95.5 / 115.7 (min / median / max, n = 2,099), professional `implied_dio_days` max 3.58
(n = 2,405) — unchanged. Criterion 2: sector differential **3.45×**, in-sample AUC **0.639**
(was 0.641), closest cross-label pair 0.180 vs typical 0.443 — labels and latents are drawn before
any inflow, so the label side did not move. Criterion 3 (redefined, 13.8): every class-B window
recovered — retail value 1.28 / 1.32 / 0.91 / 0.83 vs configured 1.28 / 1.34 / 0.94 / 0.84 and
count 1.09 / 1.11 / 0.92 / 0.85 vs 1.09 / 1.12 / 0.95 / 0.86 (n = 2,502); F&B value
1.00 / 0.82 / 1.70 / 0.99 vs 1.00 / 0.82 / 1.66 / 0.96 and count 1.00 / 0.70 / 1.00 / 0.95 vs
1.00 / 0.70 / 0.97 / 0.92 (n = 1,348); directions match. Class-C sectors recovered their
judgement values within 0.02 (reported, not gated). Restaurants now dip in Ramadan: the
seasonality wiring took. 1,208 thin-file exclusions (was 1,213). `transactions.csv`
10,395,208 rows / 1.19 GB (was 9,810,364 / 1.08 GB) at a 10% POS sales thinning.

**§21 (`eval/out/emergent_validation.md`): 0 emergent findings; 4 input-consistency misses.**
`days_negative_balance_distribution`: 14.4% of 8,909 scorable research businesses have ≥ 1
negative day (construction 34.4%, F&B 13.1%, retail 10.2%, professional 4.1%); p50/p90/p99
33 / 90 / 90 — reported, no Saudi comparator. `realised_dso_vs_archetype`: medians 14.9 / 95.4 /
5.1 / 34.5 all inside their bands. `ramadan_amplitude_recovered`: PASS in all 8 sector × kind rows
(max deviation 0.04, on the 3-day Eid). `aggregate_default_rate` 4.06% (406 / 10,000), still
unregistered. Calibration-derived checks: unchanged by construction — medium-tier share 0.440 vs
GASTAT 0.343, sector TV distance 0.519, F&B and professional size gradients off — because the
inputs they are a function of (`sector_size_distribution`, `base_monthly_inflow_sar`) did not
change (13.2).

**`eval.compare_real` (before → after):** synthetic comparison-set AUC **0.594 [0.567, 0.621] →
0.610 [0.584, 0.636]** (5 contiguous-ID entity folds, 25 class-A scale-free features, 9,424
scored); Berka unchanged at 0.901 [0.835, 0.955] (secondary, censored) / 0.740 [0.558, 0.902]
(primary, expanding folds). Gap **0.307 → 0.291**, still a FINDING against ±0.10. Nothing was
tuned toward it; the movement is the real POS receipt frequency now carried by feature 2 and the
count seasonality, not a coupling change (ρ = 0.6, σ = 0.2 untouched). Evidence table unchanged:
A 43 / B 3 / C 25 registry entries. `dimensions_check` PASS; `heldout_anomalies` self-test now
runs (13.11).

**Not moved, by design:** sector weights, tier splits, base inflows, financing share, and every
class-C dimension.

**Recorded by:** generator owner, 2026-09-16.
**Sign-off:** ☐ generator owner (13.3–13.8) ☐ profile engine owner (`sample_weight` column, feature 2 now at POS frequency) ☐ team (13.2 blocked status, 13.6 schema change)

---

## 14. Monsha'at unblocked: the v1.0 "blocked gateway" was a misdiagnosis — sector mix and financing shape now from the register (2026-09-17) — PROPOSED

**SOP:** `SOP_Monshaat_Unblock_And_Report_Corrections.md` v2.0, Workstream A. Supersedes 13.2.

### 14.1 Root cause, stated as it actually was

The gateway was never down. Entry 13.2's account is corrected on two points:

- **The v1.0 code sent real, non-empty paging values** (`probe_sources.monshaat_get` and the old
  `monshaat_pull.get_page` both formatted `?paginationIndex={page}&recordsPerPage={n}`). The empty
  template `?paginationIndex=&recordsPerPage=` that 13.2 and the v1.0 report quote was the *URL as
  documented*, not the URL as called. SOP v2.0 §A0 "Error 1" therefore does not describe this run;
  it is recorded here so the SOP can be corrected rather than the history rewritten.
- **The period range was the whole error.** The v1.0 probe called 2025 Q2, 2025 Q4 and 2026 Q1; the
  pull's auto-scan walked back twelve quarters from 2026 Q3 and stopped at 2023 Q4; the two-hour retry
  loop hit 2025 Q2 / 2024 Q2 / 2023 Q2. Every one of those quarters is outside the dataset, which
  the probe below shows to be **2019 Q2 – 2021 Q4** (eleven quarters) — not "2019 to 2022" as SOP
  v2.0 §A0 states either: 2022 Q1–Q4 return 1009. The one status that would have revealed this — a
  fast 1009 — was read as "gateway unavailable". The diagnostic rule now in code and docstring:
  **1009 in ~0.2 s is the service saying "no such period"; only 1011 / 1016 / HTTP 5xx / timeouts
  are transient**, and the two are never collapsed into one status again.

### 14.2 Endpoint contract as resolved by `calibration/monshaat_probe.py` (A2)

`calibration/out/phase1_monshaat_probe.json`, 2026-09-17:

| question | answer |
|---|---|
| periods with data | 2019 Q2 … 2021 Q4; 1009 confirmed at 2019 Q1 and at every quarter 2022 Q1 → 2026 Q3 |
| `totalRecords` | rows on the page (10 at 10/page, 100 at 100/page, 250 at 250/page) |
| `totalPages` | **not per quarter**: 188 at 100/page and 1877 at 10/page for every quarter, while a quarter ends after 17–18 pages at 100/page. Ignored; the loop stops at the first confirmed 1009 |
| page sizes | 250, 200, 100, 50 all returned data at some point; 150/200/250 also returned HTTP 500 `1011 Internal Server Error` intermittently — 1011 succeeds on retry (page 3 at 200: fail, pass, fail, pass). Default 100 with six-try backoff |
| ordering | deterministic — two full passes at 250/page and two at 100/page were identical row for row |
| `paginationIndex` | 1-based (0 → 1010 Validation Error) |
| rows per (region, activity) | **not a primary key**: the five large regions (Eastern 4 rows per key, Riyadh 3, Makkah 3, Madinah 2, Asir 2) return several rows with *different* counts; the eight small regions return one. The response names no sub-region field |

**Aggregation rule (judgement, evidenced):** sum every row. The repeats are additive components of a
hidden sub-region split, not revisions: summing 2021 Q4 gives **663,913 SMEs** (516,165 / 131,950 /
15,798), against Monsha'at's published 663,190 at end-Q3 2021 and 752,560 at end-Q1 2022
(599,790 / 136,740 / 16,030 — SME Monitor Q1 2022 p.14: small and medium within 4% of the pulled
quarter, micro on its 2021–22 growth path). Keeping the first occurrence per key gives 434 k, which
matches nothing. The v1.0 pull would have de-duplicated on (region, activity) and lost 40% of the
counts; that code path is gone.

### 14.3 What was pulled and archived (A3)

`sources/monshaat/` — the latest quarter and the same quarter one and two years earlier:

| archive | pages | rows | distinct region × activity | SMEs (Σ rows) | SHA-256 |
|---|---|---|---|---|---|
| `enterprises_2021Q4.json` | 18 | 1,756 | 1,051 | 663,913 | `b0601af6913dce85fa962a5aebcd72a83e62843c815a34beb9123fbbe5c4503a` |
| `enterprises_2020Q4.json` | 18 | 1,730 | 1,040 | 626,669 | `ace25ac282cf1e59f78dbcbce90688d94ea92e66c92b2b8af0e08ea3227255e8` |
| `enterprises_2019Q4.json` | 17 | 1,677 | 1,009 | 551,657 | `40427ec7bfb98ea2faef2878688a644991bafa589d8a9e87a901690bc77cb8ea` |

13 regions and 87 ISIC activities (Arabic labels verbatim) in every quarter; retrieval URL, page
count and the aggregation rule are in each `.meta.json`. Access date 2026-09-17.

### 14.4 ISIC → four-sector map — confirmed on the real labels (supersedes 13.3)

Two prefixes in 13.3 did not match the labels the gateway serves and were corrected before any
number was read: M71 is served as **أنشطة المعمارية والهندسية ، والاختبارات الفنية والتحليل** (13.3 had
الأنشطة …), and the borderline keys are served as **البحث والتطوير في المجال العلمي** (M72),
**أبحاث الإعلان والسوق** (M73) and **الإقامة** (I55). Full membership as matched, 2021 Q4 SME counts:

| sector | ISIC activities matched (label as served → count) |
|---|---|
| `retail_trade` | G47 تجارة التجزئة، باستثناء المركبات… 90,403; G46 تجارة الجملة ، باستثناء… 52,014; G45 تجارة الجملة والتجزئة ، وإصلاح المركبات… 34,606 → **177,023** |
| `construction` | F41 تشييد المباني 91,343; F43 أنشطة التشييد المتخصصة 49,297; F42 الهندسة المدنية 1,037 → **141,677** |
| `food_beverage` | I56 أنشطة خدمات الأطعمة والمشروبات → **63,424** |
| `professional_services` | M71 (architecture, engineering, testing) 4,436; M70 أنشطة المكاتب الرئيسية ، وألأنشطة الاستشارية 2,434; J62 أنشطة البرمجة الحاسوبية والخبرة الاستشارية 2,154; M69 الأنشطة القانونية وأنشطة المحاسبة 1,346; M74 الأنشطة المهنية والعلمية والتقنية الأخرى 1,114 → **11,484** |
| borderline, **excluded**, reported | M72 R&D 74; M73 advertising & market research 1,276; M75 veterinary 341; I55 accommodation 4,525 |

Choices carried from 13.3 and confirmed: wholesale and vehicle trade/repair count as retail trade;
civil engineering counts as construction; J62 counts as professional services (SOP §4.2);
accommodation is not food service. Four-sector SMEs are 393,608 = 59.3% of all SMEs. 71 other
activities are the rest of ISIC and are outside the generator's scope.

### 14.5 `sector_size_distribution` written from the register (class C → B)

| sector | weight before → **after** | micro / small / medium before → **after** | E[size_scale] before → after |
|---|---|---|---|
| retail_trade | 0.35 → **0.4498** | 0.85 / 0.13 / 0.02 → **0.7601 / 0.2191 / 0.0208** | 1.67 → 1.95 |
| construction | 0.20 → **0.3599** | 0.45 / 0.40 / 0.15 → **0.7429 / 0.2288 / 0.0283** | 4.30 → 2.08 |
| food_beverage | 0.20 → **0.1611** | 0.90 / 0.09 / 0.01 → **0.7564 / 0.2238 / 0.0198** | 1.41 → 1.95 |
| professional_services | 0.25 → **0.0292** | 0.75 / 0.20 / 0.05 → **0.6929 / 0.2766 / 0.0305** | 2.30 → 2.26 |

Rounded to four decimals with the residual placed on the largest share so each block sums to
exactly 1.0 (the generator asserts it). Stability over the three quarters: retail weight
0.446–0.454, construction 0.360–0.425, F&B 0.103–0.161, professional 0.026–0.029; micro share
0.64–0.76 in every sector (construction 0.67 → 0.74 as the micro tier grew). Register counts are
a census; the quarter-to-quarter range is the uncertainty statement, and the `.meta.json`
carries the edition.

**Two things this changes that are not tuning:** (1) professional services falls to 2.9% of the
population — ~290 businesses and roughly five defaults in N = 10,000, below the §23 minimum cell
(≥ 30 businesses and ≥ 10 defaults), so any per-sector check on that cell now reports
`insufficient_sample`; that is the register's shape, not a modelling choice. (2) The tier split
is far less skewed to micro (75/23/2) than Monsha'at's 2023 national 87/11.5/1.4 — the 2021
register predates the 2022–23 micro-enterprise surge, and it is the same vintage as the GASTAT
2022 revenue anchor, so the two inputs are at least contemporaneous.

**Direction versus SOP v2.0 §A3's expectation:** the SOP expected construction ~85/14/1 and
`E[size_scale]` falling from 4.30 to ~1.31. The register says 74/23/3 and 2.08. The expectation
was extrapolated from a one-region sample and the 2023 national aggregate; the census is used,
not the expectation.

### 14.6 `financing.share_of_businesses` sector-conditional (relative shape C → B; level stays C)

Credit per SME = SAMA bank credit by activity, 2026 Q2 (Individuals' Loans 42.6% of total
excluded, asserted) ÷ Monsha'at 2021 Q4 SME count per sector:

| sector | credit (SAR mn) | SMEs | credit per SME (SAR) | index (count-weighted mean 1) | share_of_businesses (level 0.35) |
|---|---|---|---|---|---|
| retail_trade | 220,795 | 177,023 | 1,247,268 | 1.10 | **0.384** |
| construction | 150,844 | 141,677 | 1,064,702 | 0.94 | **0.328** |
| food_beverage | 60,968 | 63,424 | 961,283 | 0.85 | **0.296** |
| professional_services | 14,672 | 11,484 | 1,277,592 | 1.12 | **0.394** |

The shape is nearly flat (0.85–1.12): the "retail carries 1.5× construction" of 13.2 was a share
of *credit*, and construction has almost as many SMEs as retail. Limitations, unchanged and stated
in the config comment: total bank credit, not SME credit, no SME/large split, no NPL field, and the
numerator (2026) and denominator (2021) are five years apart. The absolute level 0.35 is judgement.

### 14.7 Not changed

`base_monthly_inflow_sar`, `size_tier_scale`, seasonality, tickets, latents, ρ, σ. No validation
target was consulted while writing 14.5–14.6; the re-run results are in entry 15.

**Recorded by:** generator owner, 2026-09-17.
**Sign-off:** ☐ generator owner (14.2 aggregation rule, 14.4 map, 14.5) ☐ team (14.1 correction of 13.2, 14.6 level)

---

## 15. Workstream A re-run at full scale with the register-derived inputs (2026-09-17) — RESULTS, nothing retuned

**SOP:** `SOP_Monshaat_Unblock` §A4. Inputs: entry 14 (commit "Workstream A: Monsha'at pull, sector mix,
financing share"). N = 10,000 research + 1,000 serving; `transactions.csv` 12,537,615 rows (was
10,395,208 — 45% of the population is now retail at POS receipt frequency). Pre-Monsha'at outputs kept
as `eval/out/*_before_monshaat.*`.

**Week 3 gate: PASS with one loud SKIP** (`eval/out/gate_week3_after_monshaat.txt`). Structural and
thinning checks unchanged (Σ amount × sample_weight / Σ inflow_total = 1.0005 on 6,662 thinned
businesses). Criterion 1: construction `implied_dso_days` 65.9 / 94.2 / 118.2 (n = 3,679), professional
`implied_dio_days` max 3.39 (n = 261). Criterion 2: **the sector differential is `insufficient_sample`
for professional_services** — 237 research businesses, 3 defaults (rate 1.27%), below the §23 minimum
cell of ≥ 30 businesses and ≥ 10 defaults. That is the register's 2.9% weight showing through, not a
modelling choice (14.5); the check is skipped loudly, not passed. Sector default rates: construction
5.70% (n 3,334), food 4.71% (1,466), retail 4.07% (3,979); in-sample AUC on observables 0.610 (was
0.639). Criterion 3: every class-B window recovered within 0.04 (retail n = 3,296, F&B n = 1,160);
direction checks pass. 1,086 businesses `insufficient_data` (was 1,208).

**§21 (`eval/out/emergent_validation.md`): 0 emergent findings; 6 input-consistency misses (was 4).**
The calibration-derived checks moved because their inputs did — which is the point (SOP §A4):

| check | before (entry 13.13) | after | GASTAT 2022 |
|---|---|---|---|
| medium-tier revenue share (closed form / realised) | 0.415 / 0.440 — *high* | **0.189 / 0.197 — now low** | 0.343 |
| sector revenue share TV distance | 0.519 | **0.384** | band 0.10 |
| · retail / construction / F&B / professional | 0.140 / 0.609 / 0.048 / 0.204 | **0.264 / 0.639 / 0.068 / 0.028** | 0.600 / 0.256 / 0.106 / 0.038 |
| within-sector size KS: retail / construction / F&B / professional | 0.038 / 0.065 / 0.390 / 0.211 | **0.130 / 0.297 / 0.264 / 0.352** | band 0.10 |

Reading: with the count mix and tier splits now sourced, what remains is `base_monthly_inflow_sar` ×
`size_tier_scale`. Construction is 36% of businesses at a 180 k SAR base, so the closed form gives it
64% of revenue against GASTAT's 26%; retail at a 60 k base gets 26% against 60%. The medium-tier
share flipped from too high to too low because the register's medium shares (2–3%) replaced the
judgement 15% for construction. Both are statements about the two unsourced inputs (SOP_Saudi §10.6),
recorded here, not tuned. Emergent targets: days-negative 16.4% of 9,016 scorable (construction
31.6%, F&B 9.5%, retail 7.1%, professional 2.1%); realised DSO medians 13.3 / 94.2 / 4.7 / 32.0 all
inside their bands; `ramadan_amplitude_recovered` PASS in all 8 rows; aggregate default rate 4.78%
(478 / 10,000; was 4.06% — more construction).

**`eval.compare_real`, v1.0 protocol (before → after):** synthetic 0.610 [0.584, 0.636] → **0.578
[0.550, 0.607]** (9,495 scored / 449 defaults, 25 features); Berka unchanged 0.901 [0.835, 0.955]
(secondary, single temporal split); gap 0.291 → **0.323**, FINDING. The synthetic side fell because
the population is now dominated by retail and construction micro businesses, whose within-sector
observables carry less label signal than the previous professional-heavy mix. Not tuned; the same
comparison under one CV protocol on all three sources is entry 19 (Workstream B4).

`dimensions_check` PASS; `heldout_anomalies` OK; evidence table unchanged at this commit (A 43 / B 3 /
C 25 — the A1/A2 split is entry 16).

**Recorded by:** generator owner, 2026-09-17.
**Sign-off:** ☐ generator owner ☐ credit-lens owner (professional_services cell is below the §23 minimum at N = 10,000)

---

## 16. Evidence class A split into A1 (real-computed) and A2 (real-predictive) by a CI rule (2026-09-17) — Workstream B1

**SOP:** `SOP_Monshaat_Unblock` B1, priority highest. Nothing in the generator changed.

**The problem, as it stood.** `profile_engine/evidence.py` labelled 43 features class A with the
claim "Predicts real outcomes", while `eval/out/real_vs_synthetic.md` showed several of them at
chance on Berka (features 20–22 at 0.47–0.54, 4 and 9 at 0.45–0.50). "Computable on real data" and
"predicts real outcomes" are different statements; the registry made the stronger one.

**The rule, applied in code, no judgement.** `eval/feature_transfer.py` computes, for every typed-A
feature, the univariate AUC against each Berka label set on the 615 scored labelled accounts (209
with a primary label), with a 1,000-resample percentile bootstrap. **A2 ⇔ the 95% CI excludes 0.50
on at least one label set** (either direction; the sign is reported as Spearman ρ); **otherwise A1**,
including features not evaluable on Berka (constant or absent). `calibration/reclass_evidence.py`
writes the result to `profile_engine/feature_transfer.json`; `evidence.py` reads it at import and
resolves each typed A to A1/A2. If the file is absent every A is A1 — the weaker claim is the default.
The registry never carries a hand-typed A2.

**Result: 22 of 43 are A2; 21 are A1** (`eval/out/feature_transfer.md`).

| | features |
|---|---|
| **A2** (22) | 2, 3, 7, 8, 10, 12, 13, 14, 15, 16, 17, 22, 32, 33, 49, 50, 51, 52, 53, 54, 60, 68 |
| **A1** (21) | 1, 4, 5, 6, 9, 11, 18, 18b, 19, 20, 21, 26, 41, 42, 43, 44, 45, 46, 47, 48, 61 |

Strongest by folded AUC: 17 `min_daily_balance_90d` 0.85, 52–54 `liquidity_hazard_*` 0.74–0.76,
16 `avg_daily_balance` 0.74, 8 `recurring_expense_ratio` 0.70, 60 `committed_monthly_outflow` 0.67.
As the SOP expected, the counterparty family (5, 20, 21, 45, 46) and the growth features (4, 9) are
A1: 5, 45, 46 are constant on Berka (coverage), 20/21 sit at 0.47–0.54, 4/9 at 0.45–0.50. The
volatility family is split: 15 `volatility_index` A2 (0.65 on the secondary set), 11
`cash_flow_volatility` A1 (0.49) — consistent with entry 1's mechanism.

**One caveat the rule produces and the record keeps:** feature 22 `new_counterparty_ratio_30d`
qualifies as A2 on AUC 0.470 [0.45, 0.49] — an interval that excludes 0.50 only because the feature
is near-constant (ties dominate), i.e. a negligible effect measured precisely. The rule is applied
as written; the folded AUC is printed so the effect size is visible; an effect-size threshold would
be a second, judgement-bearing rule and is not added.

**Claim wording now in `CLASS_CLAIM`:** A2 "Computed on real bank data and predictive of real credit
outcomes (univariate AUC with CI in eval/out/feature_transfer.md)"; A1 "Computed on real bank data;
predictive performance reported per feature, not assumed". `eval.compare_real`'s comparison-set
assertion accepts A1 ∪ A2 (unchanged membership; the file itself changes in entry 19). A mixed metric
reports the weakest class in the order A2 > A1 > B > B-weak > C.

**Population caveat carried on every A2:** univariate, 1990s Czech accounts, eligible population
only (entry 19 shows the eligibility rule is selective on the label).

**Recorded by:** profile engine owner, 2026-09-17.
**Sign-off:** ☐ profile engine owner ☐ team (claim wording)

---

## 17. B-weak: a measured parameter whose interval contains the null is not class B (2026-09-17) — Workstream B2

**SOP:** `SOP_Monshaat_Unblock` B2. Applied values unchanged; labels only.

**Rule, implemented in `calibration/reclass_evidence.py` and asserted by `calibration/check_config.py`:**
a measured multiplier is **B** iff its 95% CI excludes 1.0; otherwise **B-weak** — measured and
applied (a weak measurement still beats an invented one), but not claimed as grounded. Applied to all
sixteen SAMA-measured seasonality parameters from the leave-one-year-out intervals in
`calibration/out/phase2_seasonality.json`. The two config blocks were rewritten by the script in block
style with the CI carried as data (`ci95`) next to a per-window `evidence_class` map, so the rule can
be re-checked mechanically (`check_config` fails if a label disagrees with its interval).

| parameter | value | CI | class |
|---|---|---|---|
| retail value pre_ramadan_10d | 1.28 | [0.68, 1.88] | **B-weak** |
| retail value ramadan | 1.34 | [1.28, 1.39] | B |
| retail value eid | 0.94 | [0.19, 1.69] | **B-weak** |
| retail value post_eid_7d | 0.84 | [0.73, 0.94] | B |
| retail count pre_ramadan_10d | 1.09 | [0.84, 1.35] | **B-weak** |
| retail count ramadan | 1.12 | [1.05, 1.20] | B |
| retail count eid | 0.95 | [0.75, 1.15] | **B-weak** |
| retail count post_eid_7d | 0.86 | [0.79, 0.94] | B |
| F&B value pre_ramadan_10d | 1.00 | [0.67, 1.32] | **B-weak** |
| F&B value ramadan | 0.82 | [0.76, 0.87] | B |
| F&B value eid | 1.66 | [1.44, 1.89] | B |
| F&B value post_eid_7d | 0.96 | [0.95, 0.98] | B |
| F&B count pre_ramadan_10d | 1.00 | [0.82, 1.19] | **B-weak** |
| F&B count ramadan | 0.70 | [0.66, 0.73] | B |
| F&B count eid | 0.97 | [0.92, 1.03] | **B-weak** |
| F&B count post_eid_7d | 0.92 | [0.87, 0.97] | B |

**Seven of sixteen are B-weak**, as the SOP's own table predicted. The retail Eid value multiplier
— the parameter entry 13.5 moved from 2.20 to 0.94 and labelled C → B — is the clearest case: the
data cannot distinguish it from no effect. What is grounded about retail at Eid is only the sign of
the change from the placeholder, not the value.

**What did not change.** Every multiplier value; the gate (criterion 3 gates the wiring on the
configured values and treats B-weak windows exactly like B ones — the test is that the generator
reproduces what it was given, not that the given number is grounded); the generator-parameter hash.
`check_config` now prints two hashes: the full-file sha256 (changed, `b26ee0c1…` → `9d60db77…`,
because labels and CIs are in the file) and the **generator-parameter hash** (config with
`evidence_class`, `ci95` and the §21/Berka blocks removed): **`a5b2bccab775fa71` before and after**.
The Week 3 gate re-run after the relabel (`eval/out/gate_week3_after_b2.txt`) is line-for-line
identical to `gate_week3_after_monshaat.txt` except timings.

**Report consequence (entry 20):** §2 and §7 of the calibration report no longer say "C → B" for
these sixteen; they say C → B for nine and C → B-weak for seven, with the interval on every row.

**Recorded by:** generator owner, 2026-09-17.
**Sign-off:** ☐ generator owner ☐ team (B-weak as a registry class)
