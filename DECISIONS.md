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
