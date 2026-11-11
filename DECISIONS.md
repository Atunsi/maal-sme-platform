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

**The audit does have real signal to find (measured 2026-09-20, entry 21).** The
variance decomposition confirms the §25 audit is not set up to pass trivially:
of the market-shock term's contribution to logit variance, **73.4% is
within-sector** and 26.6% between-sector. (A pre-calibration figure of 56.8%
appeared here briefly; the Monsha'at reweighting cut professional services —
the most distinct sector — to 2.9% of businesses, which collapsed the
between-sector share and raised the within-sector one.) So a model that shortcut to the
sector code would leave the majority of the available risk signal unused, and
the audit's pass criterion ("top attributions are liquidity / working-capital
features, not the sector code") is a claim that could genuinely fail. Read
this alongside the feature-11 consequence above: the audit should expect real
within-construction discrimination, just not through features 11 / 56.

**Sign-off:** ☑ credit lens owner (Abdulrahman Alharbi, 2026-11-07) ☑ profile engine owner (Faris Alsharifi, 2026-11-01)

---

## 2. Sector scope: four sectors; logistics not modelled — DECIDED (A), 2026-10-31

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

**Decision:** ☑ (A) ☐ (B)   Recorded by: Ahmed Altunusi (generator owner)  Date: 2026-10-31

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
four features in the committed contract require a *prior* 90-day window by
definition:

| feature | definition (schema) | needs |
|---|---|---|
| 4 `revenue_growth_rate_90d` | current 90d vs prior 90d | 180 days |
| 9 `expense_growth_rate_90d` | current 90d vs prior 90d | 180 days |
| 43 `inflow_break_recency_days` | CUSUM on current-90d inflow, standardised against the prior-90d mean/SD | 180 days |
| 45 `counterparty_persistence_ratio` | current-90d counterparties ∩ prior-90d | 180 days |

§15's `partial_profile` state ("coverage ≥ 60 but total available history <
`min_history_days`") only has meaning if more than 90 days *can* be available.
§8 says `/profile` reads only `daily_aggregates`. A 90-row table therefore makes
4, 9, 43 and 45 uncomputable for every business and collapses `partial_profile`
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
> per business is well within that budget. Features 4, 9, 43 and 45 read the prior
> 90 days from this same table; §15's `partial_profile` applies when fewer than
> `min_history_days` rows exist.

**Generator position until the edit lands:** emit the full window (current
behaviour). `output.daily_aggregates_trailing_days: 90` remains available so
the literal current wording can be produced on demand, but it should not be
the default — the default should not make four contract features
uncomputable.

**Recommendation:** adopt the schema edit. Cost is a wording change and a
version bump; the alternative is four dead features and a §15 state that
never varies.

**Edited 2026-11-01 (profile engine owner's request, before sign-off):** feature 43
`inflow_break_recency_days` added to the table and to the proposed text. It standardises the
current window against the prior 90 days, and the engine already requires 180 days of history
for it (`profile_engine/registry.py` `MIN_HISTORY_DAYS`). "Three" became "four" throughout;
nothing else in the entry changed.

**Raised by:** generator owner, 2026-09-15  **Sign-off:** ☑ profile engine owner
(owns features 1–59 and `/profile`; Faris Alsharifi, 2026-11-01) ☐ team

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
| Features 60–65 | new §38 (was "new §37"; renumbered by entry 33, since v2.9 already has §37) | `profile_engine.registry` — 62 split into `ocr_forward_3m` (62) and `ocr_forward_6m` (62b) |
| Feature 15 formula | §3 | **PROPOSED**: `100 × mean(σ_net / (σ_net + max((avg_monthly_inflow + avg_monthly_outflow)/30, 500/30)), clip(1 − inflow_outflow_ratio, 0, 1), days_neg / window_days, min(1, overdraft_events/5))`, where σ_net is the std of daily net flow (feature 11), `inflow_outflow_ratio` is feature 12 (`avg_monthly_inflow / max(avg_monthly_outflow, 500)`) and `window_days` is the number of days in the trailing window (90 when complete) — the schema leaves the weighting open (wording corrected 2026-11-01, see below) |
| Feature 46 threshold | §33 | fixed at 0.5% of the business's trailing-90-day total transaction value, floored at the §16 epsilon — scale-free so it means the same in CZK and SAR |
| Feature 33 calendar | §15 | operating days exclude Fri/Sat for `synthetic`/`sandbox`, Sat/Sun for `external_real` |
| `berka.cv_cut_date`, `profile_engine.*` config blocks | `config.yaml` | see entry 9 |
| §21 target `real_vs_synthetic_signal_strength` | `config.yaml` | registered 2026-09-16 before the first `eval.compare_real` run |

Berka-specific adapter facts worth knowing: Berka has no time-of-day
(`hour` = 12 on every row); the running balance chains exactly on 94.3% of
account-days and to within 0.1–0.2 CZK on the rest, all month-end days (interest
posting rounding) — the gate tolerance is 0.21 CZK and all 4,500 accounts pass;
14 zero-amount rows are dropped from `transactions.csv` (schema requires > 0).

**Edited 2026-11-01 (profile engine owner's request, before sign-off):** the feature 15 row
previously read `100 × mean(min(1, σ_net/daily_outflow), clip(1 − inflow/outflow, 0, 1),
days_neg/90, min(1, overdraft_events/5))`. That is not what the engine computes. The first term
in `profile_engine/features.py` (`daily_features`, the `t11` line) is
`σ_net / (σ_net + mean daily gross flow)`, floored at the §16 epsilon; the code comment gives the
reason (scale-free, and it does not saturate on lumpy flows the way `min(1, σ_net/outflow)` does).
The other three terms use feature 12 (with its SAR 500 floor) and the actual window length. The row
now states the code. No engine change; the old wording is kept here so the correction is visible.

**Sign-off:** ☑ profile engine owner (schemas, features 60–65, feature 15 formula; Faris Alsharifi, 2026-11-01) ☐ team

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

**Sign-off:** ☑ profile engine owner (Faris Alsharifi, 2026-11-01) ☐ team

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

**Profile engine owner position (2026-11-05).** Agreed on the profile engine side. Entry 34's formula
for feature 42, `max(0, avg_monthly_inflow − committed_monthly_outflow) × (1 − min(k ×
flow_asymmetry_ratio, 0.5))` with k = 0.15, is the one that counts and supersedes the formula text
above, which omits the 0.5 cap.

**Sign-off:** ☑ credit lens owner (Abdulrahman Alharbi, 2026-11-07; features 41, 42, 61; subject to Entry 34 and team approval) ☑ profile engine owner (Faris Alsharifi, 2026-11-05) ☐ team

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

**Sign-off:** ☑ generator owner (Ahmed Altunusi, 2026-10-31) ☑ profile engine owner (66–69; Faris Alsharifi, 2026-11-01) ☐ team

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
±2% on thinned ones. ~~Transaction-derived features (5, 10, 20–22, 41, 45, 46) are ratios and
counts of counterparties, unbiased under thinning~~ **(withdrawn 2026-11-04: false for 5, 20, 21, 22, 45; see entry 30)**; anything that sums `transactions.amount` on
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

**Profile engine owner position (2026-11-05).** Agreed: the `sample_weight` column, and feature 2 at
POS frequency (it reads `daily_aggregates.inflow_count`, computed from the full stream;
`profile_engine/features.py:183`). The engine reads `sample_weight` only to refuse a thinned business
that has no `counterparty_windows` rows (`features.py:334–337`, entry 30). Proposed clarification to
13.6, not applied here: "In the profile engine, inflow-side counterparty sums for thinned businesses
read counterparty_windows (entry 30); the weighting rule applies to other readers of
transactions.csv." Features 41 and 46, listed in the struck sentence, are unaffected: 41 reads
outflows only, which are never thinned, and 46's true value was 0 on all 376 thinned businesses in
entry 30's measurement.

**Sign-off:** ☑ generator owner (13.3–13.8; Ahmed Altunusi, 2026-10-31) ☑ profile engine owner (`sample_weight` column, feature 2 now at POS frequency; Faris Alsharifi, 2026-11-05) ☐ team (13.2 blocked status, 13.6 schema change)

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
**Sign-off:** ☑ generator owner (14.2 aggregation rule, 14.4 map, 14.5; Ahmed Altunusi, 2026-10-31) ☐ team (14.1 correction of 13.2, 14.6 level)

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
**Sign-off:** ☑ generator owner (Ahmed Altunusi, 2026-10-31) ☑ credit-lens owner (Abdulrahman Alharbi, 2026-11-08; acknowledges professional_services insufficient defaults and SKIP)

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
**Sign-off:** ☑ profile engine owner (Faris Alsharifi, 2026-11-01) ☐ team (claim wording)

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
**Sign-off:** ☑ generator owner (Ahmed Altunusi, 2026-10-31) ☐ team (B-weak as a registry class)

---

## 18. Held-out table: PASS / BOUNDED / FAIL / NOT_APPLIED — a bounded test is not a pass (2026-09-17) — Workstream B3

**SOP:** `SOP_Monshaat_Unblock` B3. Wording of a result that was already analysed correctly; no number changed.

**The problem.** §3.7 of the v1.0 report showed a tick on every restaurant row while the prose
beneath explained that the restaurant Eid actuals (1.21 / 1.22 at weekly resolution) sit below the
applied 1.66 because a 3-day window diluted over 7-day weeks is a floor, not a point estimate. The
reasoning was right and the tick was wrong: the test bounds the parameter from below, it does not
confirm it.

**Status vocabulary, implemented in `calibration/holdout_validate.py` (one status per test row):**

| status | meaning |
|---|---|
| `PASS` | held-out actual within ±0.10 of the fitted value, on a parameter the generator applies |
| `BOUNDED` | the test constrains the parameter in one direction only; it can contradict but cannot confirm. Every weekly-resolution Eid row. Reported with a direction check (actual > 1 iff predicted > 1) and a flag when the floor itself exceeds the prediction |
| `FAIL` | held-out actual outside ±0.10 on an applied parameter |
| `NOT_APPLIED` | measured but never written to the generator (construction, Total); the within-tolerance flag is still recorded |

**Counts over the 36 test rows (2024 and 2025, `calibration/out/phase3_holdout.json`): PASS 12,
BOUNDED 8, FAIL 0, NOT_APPLIED 16.** The twelve passes are the four aggregate Ramadan-month rows
and the eight per-sector Ramadan rows for retail and F&B (value and count, both years). The eight
BOUNDED rows are the retail and F&B Eid rows: direction consistent in all eight; in none does the
weekly floor exceed the prediction. The construction rows, which the v1.0 table marked ✗, are
NOT_APPLIED — the same information, no longer presented as a failed validation of something the
generator does. In the construction rows the Eid floor (0.36–0.72) sits *above* the NNLS point
estimate (0.00 / 0.40), which is one more reason those multipliers are not applied.

**Report consequence (entry 20):** §3.7 carries the status column and a summary line that counts
each status separately; the sentence "restaurant Eid is BOUNDED, not PASS" appears in the revision
note.

**Recorded by:** generator owner, 2026-09-17.
**Sign-off:** ☑ generator owner (Ahmed Altunusi, 2026-10-31)

---

## 19. Real vs synthetic under one CV protocol on all three sources; the §15 exclusion is selective (2026-09-17) — Workstream B4

**SOP:** `SOP_Monshaat_Unblock` B4. Config untouched (sha256 `9d60db774d169931` before and after
the run, asserted inside `eval.compare_real`); generator-parameter hash `a5b2bccab775fa71`.

**The problem.** Entries 10, 13.13 and 15 reported the gap between a cross-validated synthetic AUC
(5 contiguous-ID entity folds) and a Berka AUC from a **single** temporal split with 25 test
defaults on the censored label set, the primary set being not evaluable on that split. Three
numbers, three protocols; an unknown share of the gap was protocol. The v1.0 SOP said "same feature
subset, same model class"; it should have said "same CV protocol".

**The protocol, implemented in `eval/compare_real.py` (`--protocol unified`, the default):**
repeated stratified group k-fold — 5 folds grouped by `business_id`, stratified on the label, 20
repeats with different seeds, out-of-fold predictions pooled per repeat, AUC per repeat, median and
2.5/97.5 percentiles across repeats. Run identically on the synthetic research population, Berka
primary (A vs B) and Berka secondary (A+C vs B+D). Feature set unchanged (25 real-computed
scale-free features after runtime pruning; A1 ∪ A2 per entry 16). The temporal split is kept as a
labelled **leakage check**, the expanding temporal quintiles and the contiguous-ID entity folds as
labelled secondaries. `--protocol temporal` reproduces the v1.0 headline.

**Protocol × source matrix (`eval/out/real_vs_synthetic.md`):**

| protocol | synthetic | Berka primary | Berka secondary |
|---|---|---|---|
| **unified (headline)** | **0.574 [0.568, 0.585]** (9,495 / 449) | **0.721 [0.681, 0.770]** (209 / 22) | **0.859 [0.841, 0.880]** (615 / 59) |
| temporal split (v1.0 Berka headline; leakage check) | — | not evaluable (3 test defaults) | 0.901 [0.835, 0.955] (328 / 25) |
| expanding temporal quintiles | — | 0.740 [0.558, 0.902] | 0.873 [0.789, 0.938] |
| contiguous-ID entity folds (v1.0 synthetic headline) | 0.578 [0.550, 0.607] | — | — |

**Verdict: FINDING, narrower.** Under one protocol the gap is **0.147** on the primary label set
(0.574 vs 0.721; repeat bands do not overlap) and 0.285 on the secondary (0.859), against the
pre-registered ±0.10. The v1.0 figure of 0.323 (entry 15; 0.291 in 13.13, 0.307 in entry 10) mixed a
cross-validated synthetic estimate with a single-split Berka estimate that the unified protocol
puts 0.04 lower on the same label set (0.901 → 0.859) and that was not evaluable at all on the
primary set. **The part of the v1.0 gap that was protocol is 0.04 on the secondary set and the
whole of the primary-set comparison**, which had never been made under a comparable protocol. The
primary set — no censoring, the set the pre-registration named as leading — now gives a gap of
0.15, not 0.30. Nothing was tuned: ρ = 0.6 and σ = 0.2 untouched, and the synthetic AUC is the same
population as entry 15 under a different fold assignment (0.578 → 0.574).

**The §15 exclusion is selective on the label** (`eval/exclusion_selectivity.py`,
`eval/out/exclusion_selectivity.md`; one line of code that had never been run):

| label set | excluded n / defaults / rate | retained n / defaults / rate | risk ratio | Fisher p |
|---|---|---|---|---|
| primary | 25 / 9 / 0.360 | 209 / 22 / 0.105 | **3.42** | 0.0018 |
| secondary | 67 / 17 / 0.254 | 615 / 59 / 0.096 | **2.64** | 0.0007 |

Accounts with fewer than 10 active days in the 90 days before the loan default at 2.6–3.4× the
retained rate and carry 22–29% of all defaults. Every Berka AUC — v1.0 and unified — is therefore
an estimate on the *eligible* population, from which the thinnest and riskiest accounts were
removed by the eligibility rule rather than scored. The threshold (entry 9) stands; the numbers
stand; both now carry the caveat. The synthetic side excludes 1,086 thin-file businesses under its
own rule, and their default rate is reported by `validate_emergent`.

**Two things left as they are, on purpose.** (1) The §21 target's `definition` text in
`config.yaml` still names the temporal split; the protocol sentence is superseded here and the
text is left unedited so the config hash stays frozen through Workstream B — amend at the next §9
change-control. (2) The unified band is the spread across 20 fold assignments, not a sampling
interval for the population AUC; with 22 primary defaults that fold-to-fold spread is the honest
width, and the report says so.

**Recorded by:** credit-lens owner, 2026-09-17.
**Sign-off:** ☑ credit-lens owner (Abdulrahman Alharbi, 2026-11-08; approves unified CV protocol and documented eligibility limitations) ☐ team (protocol as the standing headline; §21 definition wording)

---

## 20. B5–B7 and the report regenerated in place as revision 2 (2026-09-17) — Workstream B, final commit

**SOP:** `SOP_Monshaat_Unblock` §2 (B5–B7) and §4. Generator untouched (parameter hash `a5b2bccab775fa71`).

### 20.1 B5 — ticket sizes across editions (reported; re-pin PROPOSED, not applied)

`calibration/ticket_size.py --all-editions` (`calibration/out/phase3_ticket_size.json → multi_edition`):

| sector | applied (bulletin 12-Sep-2026, four weeks) | editions | mean | min–max | spread ÷ mean |
|---|---|---|---|---|---|
| retail_trade | 61.5 | 4 | **63.2** | 58.1–69.9 | 19% |
| food_beverage | 29.0 | 4 | **31.1** | 27.9–34.9 | 23% |
| construction (context only) | — | 4 | 176.1 | 127.6–250.3 | 70% |

Card adoption keeps moving the mix of what is paid by card, so the number needs re-pinning each
term. **The SOP's instruction to re-pin the applied value conflicts with its own non-negotiable 2
(nothing in Workstream B changes the generator); the non-negotiable wins.** The applied values
stay at the archived, dated edition; the re-pin to the cross-edition mean (63.2 / 31.1 SAR) — or
to the 2023 annual mean (69.9 / 34.9) — is recorded here as a proposed config change for the
next generator commit, where it must travel with a regeneration and a gate/§21/compare_real
re-run like any other input change. Nothing in `config.yaml` moved.

### 20.2 B6 — the food-service size gradient, explained (report §4.2)

KS 0.390 in v1.0 → 0.264 after the register (band 0.10). The share of food-service revenue in
medium firms is driven by three inputs: the tier split (register 75.6 / 22.4 / 2.0, v1.0
judgement 90 / 9 / 1), `size_tier_scale` (medium = 15× micro) and the ISIC scope. With 2% of
firms medium, matching GASTAT's 44% medium share would need a medium firm at ~55× a micro one;
part of the gap is scope — GASTAT section I includes I55 accommodation (hotels, capital-heavy,
mostly medium/large), which the generator deliberately excludes from food service. The register
pull was expected to move this and did (0.39 → 0.26); it cannot close it. Resolution is a sourced
`size_tier_scale` and a like-for-like I56-only anchor — inputs, not validation.

### 20.3 B7 — the small v1.0 movement with no input changed (report §4.2)

Between the v1.0 *before* and *after* runs the sector TV distance moved 0.515 → 0.519 and the
medium-tier relative distance 0.277 → 0.281 while the closed form was identical. The realised
shares come from the generated tables, and the v1.0 *after* run carried the new seasonality
(food service falling in Ramadan) and a fresh Poisson draw at the measured ticket, so realised
sector totals over the window shifted by tenths of a percent. Regeneration under changed
seasonality, not an undisclosed input change. Stated in one sentence in the report.

### 20.4 Report revision 2 — what changed in `/maal/saudi_calibration_report.md`

`calibration/write_report.py` regenerates the report from the JSONs and `eval/out/`, reading the
v1.0 outputs (`eval/out/*_before_monshaat.*`) for every superseded figure rather than retyping it:

- revision block at the top, per SOP §4; the SOP's own draft text corrected where it did not
  match the record (the v1.0 code did not send empty parameters; the dataset ends 2021 Q4, not 2022);
- §1: the three Monsha'at archives with hashes; the gateway contract as resolved;
- §2: per-window classes (9 B, 7 B-weak), sector mix and financing rows, ticket spread;
- §3.1 and §3.6 completed; §3.4 with a class column; §3.5 with the cross-edition columns and the
  B5 paragraph; §3.7 with the status column and counts (PASS 12 / BOUNDED 8 / FAIL 0 / NOT_APPLIED 16);
- §4.1 gate with the loud SKIP; §4.2 v1.0-vs-now table plus B6 and B7; §4.4 the protocol × source
  matrix and the exclusion selectivity;
- §5 problem 1 rewritten as the misdiagnosis it was; §6 the remaining problems restated (base
  inflows and tier scale now the whole revenue-mix gap; register vintage; thin professional cell;
  eligible-population Berka numbers; 21 A1 features; §21 definition wording pending §9);
- §7 with the A2/A1 split, B-weak count, and the v1.0 counts alongside.

READMEs (root, `calibration/`, `eval/`, `generator/`) updated to the same facts.

### 20.5 Commit discipline

Seven commits as the SOP lists them: A (pull/config), A (re-run), B1, B2, B3, B4, B5–B7 + report —
each with its own entry (14–20). `ruff check .` clean at every commit.

**Recorded by:** generator owner, 2026-09-17.
**Sign-off:** ☑ generator owner (20.1: **keep the archived 12-Sep-2026 edition this term**; re-pin to the cross-edition mean deferred to next term, because applying it now would force regeneration, retraining and every register number to move for a ~3–7% change in POS receipt counts; Ahmed Altunusi, 2026-10-31) ☐ team (report revision 2)

---

## 21. §14 sensitivity reporting: AUC vs ρ, signal attribution, model baseline — RECORDED (measurements)

**Touches:** nothing in the generator's output. These are the measurements §14
requires ("AUC should additionally be reported as a function of this
parameter"). Run 2026-09-20 **after** the Saudi calibration (entries 13–15), so
they supersede an earlier pre-calibration set that is not recorded here.

**Harnesses:** [`eval/latent_ceiling.py`](eval/latent_ceiling.py) (label-side,
seconds), [`eval/run_section14.py`](eval/run_section14.py) (measured, one
generation per ρ), built on `sweep_rho` / `signal_decomposition` /
`model_baseline`.

**Protocol.** Full research + serving populations regenerated in-process at
each ρ. Features from the **real profile engine** (`fe.compute_profiles`, all
71 registry features, §35 z-scores against the pinned reference table) — not a
proxy. Entity-level 5-fold CV, pooled out-of-fold AUC; one row per business so
folds are entity-disjoint. §15 `insufficient_data` businesses dropped. §13's
expanding-window temporal split does **not** apply: this measurement is
cross-sectional, one snapshot per business. **Labels are identical at every ρ**
(asserted, not assumed) — the label is drawn before any ρ-dependent draw.

N = 9,495 research scorable, **449 defaults (4.73%)**, 82 design columns
(71 engine features + 11 sector/size/age dummies).

### 21.1 AUC as a function of ρ — flat

| ρ | logistic OOF | XGB OOF (untuned) | XGB→serving | oracle ceiling |
|---|---|---|---|---|
| 0.6 | 0.5959 | 0.5568 | 0.5687 | 0.6660 |
| 0.7 | 0.6059 | 0.5893 | 0.5479 | 0.6660 |
| 0.8 | 0.5983 | 0.5750 | 0.5391 | 0.6659 |
| 0.9 | 0.6050 | 0.5832 | 0.5776 | 0.6659 |

**The curve is flat.** Spread across the whole ρ range is 0.0100, against a
Hanley–McNeil standard error of **0.0144** at this AUC and event count — 0.69
SE — and the ordering is **not monotone** (0.7 outranks 0.8). There is no
detectable ρ effect on measured performance.

This is a *change of conclusion* from the pre-calibration measurement, where
the same curve rose monotonically 0.6323 → 0.6564 (spread 0.0241, ~1.7 SE). The
Monsha'at sector reweighting and SAMA ticket calibration moved the binding
constraint: ρ no longer governs what a model can extract.

### 21.2 Where the loss goes — the pipeline now dominates, and grows with ρ

| ρ | 1. oracle | 2. best of 9 u_obs | 3. single u_obs | 4. measured (logit) | ρ attenuation | economics pipeline |
|---|---|---|---|---|---|---|
| 0.6 | 0.6660 | 0.6459 | 0.5923 | 0.5959 | 0.0200 (29%) | 0.0500 (71%) |
| 0.7 | 0.6660 | 0.6525 | 0.6107 | 0.6059 | 0.0134 (22%) | 0.0466 (78%) |
| 0.8 | 0.6659 | 0.6575 | 0.6289 | 0.5983 | 0.0084 (13%) | 0.0592 (88%) |
| 0.9 | 0.6659 | 0.6614 | 0.6467 | 0.6050 | 0.0045 (7%) | 0.0564 (93%) |

Raising ρ removes ρ attenuation almost entirely (0.0200 → 0.0045) but the
measured AUC does not move, so the pipeline share rises to **93%**. The
economics pipeline — Poisson arrivals at the SAMA-measured ticket, lognormal
amounts, balance-sheet noise, 90-day aggregation, feature extraction — is what
bounds the model, not the configured correlation.

**Correction to a claim made before calibration.** The earlier measurement had
rung 4 above rung 3 (0.6336 vs 0.6069) and that was reported as direct evidence
the multi-channel noisy-reflection design works. **Post-calibration it does not
hold**: rung 4 beats rung 3 only at ρ = 0.6, by +0.0036 (0.25 SE, i.e. not
distinguishable from zero), and is *below* it at every higher ρ — by 0.0417 at
ρ = 0.9, where a single clean latent rank outperforms the entire 82-column
engine model. The claim is withdrawn. What the data now says is the opposite
and more useful: the feature pipeline destroys more signal than combining nine
channels recovers.

### 21.3 The ceiling, and why 0.85 cannot appear

Label-side quantities need no economics, so they come from `latent_ceiling.py`,
whose replication of the generator's latent draws was **verified exact to
1e-16** against a real run (`--verify`), not assumed.

- **Oracle ceiling = 0.6648** over all 10,000 research businesses; **0.6660**
  over the 9,495 scorable, which is the number the table above uses. Constant
  in ρ, as it must be — labels and latents do not move.
- Analytic form: AUC ≈ Φ(sd(logit)/√2) predicts **0.6766** against 0.6648
  measured, **0.0118 apart**. ρ does not appear in that expression: it governs
  how much of the ceiling a model reaches, never the ceiling itself.
  **Accuracy caveat** — pre-calibration the same approximation agreed to
  0.0010. It degraded because the new sector mixture (retail 0.45 /
  construction 0.36 / F&B 0.16 / professional 0.029) is far more lopsided, so
  the mixture-of-Betas linear predictor is less Gaussian. Report it as a good
  approximation, **not** an identity.
- **Peak out-of-sample AUC anywhere in the sweep = 0.6059.** §14's circularity
  threshold of 0.85 is not reached and cannot be: it sits above the ceiling.
  An out-of-sample AUC at or above 0.85 on this data would be evidence of
  leakage, not skill — **use it as a tripwire.**

### 21.4 Does p_default vary enough to support the ceiling? Yes

Research population, N = 10,000, base rate 4.78%:

```
p01=0.0095  p10=0.0175  p50=0.0412  p90=0.0887  p99=0.1447
mean=0.0479  sd=0.0295  min=0.0048  max=0.2066
p90/p10 risk ratio = 5.07x    decile odds ratio = 5.46x
```

Variance decomposition of the logit: **market shock 63.3%, management quality
27.1%, label noise 9.6%** — 90.4% from the latents. The intercept contributes
**exactly zero** to AUC; it sets the base rate and nothing else. The hypothesis
that the ceiling is an artifact of the intercept is rejected.

Within the shock term: **73.4% within-sector**, 26.6% between-sector (up from
56.8% before calibration, because the most distinct sector — professional
services — fell to 2.9% of businesses). Recorded in entry 1b as well: it is
what keeps the §25 fairness audit from passing trivially.

### 21.5 Model baseline — logistic still beats XGBoost

ρ = 0.6, same protocol, 9,495 businesses / 449 defaults / 82 features:

| model | OOF AUC | % of ceiling | note |
|---|---|---|---|
| oracle (latent risk index) | 0.6660 | — | ceiling |
| **logistic regression, L2 C=1.0** | **0.5959** | **89.5%** | best measured |
| logistic regression, L2 C=0.1 | 0.5940 | 89.2% | |
| XGBoost, early-stopped (best of 4-config grid) | 0.5865 | 88.1% | mean best_iter = 31 |
| XGBoost, untuned (400 trees, as used by the sweep) | 0.5568 | 83.6% | in-sample 0.9918 |

Grid spread across early-stopped configs: 0.5613–0.5865.

Tuning recovers most of the untuned model's deficit, but **regularised logistic
still wins by 0.0094**. Gradient boosting buys nothing at 449 events across 82
features. Untuned XGBoost reaches in-sample 0.9918 against 0.5568 out-of-fold —
near-total memorisation, which is why the sweep's in-sample column is reported
as an overfitting diagnostic and excluded from the circularity test.

**Consequence for the credit lens (SOP §3 names "XGBoost, SHAP"):** XGBoost is
not a given. Report the regularised logistic baseline as the number it has to
beat. Re-measure once the lens adds features beyond the current 71 rather than
assuming the ordering holds.

**Status:** measurements, recorded. No sign-off — nothing here changes the
generator or the contract. Entry 22 is the decision they raise.

---

## 22. Latent spread vs. published SME model discrimination — PATH A (applied by default 2026-10-11, confirmed by the generator owner 2026-10-31)

**Touches:** `default_label_model.shock_coef`, `.management_coef`, `.intercept`
(§14 calibration inputs). Nothing else.

**The situation.** The oracle ceiling is **AUC 0.665** (entry 21). SME credit
models are commonly said to reach **0.70–0.80** — *a figure not yet backed by an
archived source (corrected 2026-10-11; see `docs/NUMBERS.md`)*. So the credit lens will
report roughly 0.60 and look weak against published benchmarks while operating
at **~90% of everything achievable in this synthetic world**. The synthetic
problem is harder than reality, by construction.

**Why this is a decision, not a bug.** The ceiling is a function of the
configured latent spread, which was set in `config.yaml` as a calibration input
and never fitted to anything. Both paths below are defensible. What is not
defensible is choosing after seeing the credit lens's AUC.

**Path A — keep the spread, report the ratio.** Report the oracle ceiling
beside every AUC, so the claim is "0.60 of an available 0.665" rather than a
bare 0.60. Cost: zero; the ceiling is computable today in seconds
(`python -m eval.latent_ceiling`). Risk: needs explaining to a panel, and a
skimming reader sees 0.60.

**Path B — widen the spread to match published discrimination.** Legitimate,
but the justification must be **an external, cited, archived benchmark chosen
on its own terms** (§21 source discipline), never the AUC the team would prefer
to report. Price, scaling both latent coefficients by k:

| target AUC | required sd(logit) | k | `shock_coef` | `management_coef` |
|---|---|---|---|---|
| 0.75 | 0.954 | 1.52 | 2.5 → 3.8 | 2.0 → 3.0 |
| 0.80 | 1.190 | 1.91 | 2.5 → 4.8 | 2.0 → 3.8 |
| 0.85 | 1.466 | 2.36 | 2.5 → 5.9 | 2.0 → 4.7 |

Widening while holding `intercept` fixed also raises the mean default rate
(expit is convex at low p), so the intercept must be re-solved to hold ~4.8%.
That is free: the intercept does not affect AUC.

**Note from entry 21.2:** even under Path B, measured AUC would not rise
proportionally. The economics pipeline currently accounts for up to 93% of the
oracle-to-measured gap, and widening the latent spread does not touch it. Path B
raises the ceiling; it does not by itself raise what a model extracts.

**The ordering is the control.** Deciding before the credit lens trains makes
this calibration. Deciding after makes it retuning, whatever reasoning is
attached. **Deadline: before Week 5 training begins.** If undecided by then,
Path A applies by default — it is the one needing no new justification.

**No recommendation recorded.** Path B needs a cited benchmark that does not
exist in `sources/` today; Path A is available now. That asymmetry is a fact
about the evidence, not an argument.

**Applied by default, 2026-10-11 — not a team decision.** The credit lens (entry 23) was trained
on 2026-10-11 with no decision recorded here, so per this entry's own rule **Path A applies**:
the latent spread is unchanged and every credit AUC is reported beside the oracle ceiling
(`lenses/credit/model_v1.json` carries `oracle_ceiling_auc` and `pct_of_ceiling`). Choosing Path B
now would be retuning, because the credit lens's AUC is already known (0.591, 88.8% of ceiling).
Path B remains available only for a *future* model version, justified by a cited external
benchmark chosen on its own terms, and recorded before that version is trained.

**Decision:** ☑ Path A ☐ Path B (benchmark cited: ______________)
Recorded by: Ahmed Altunusi (generator owner)  Date: 2026-10-31 — confirms the default already applied; Path B for v1 would be retuning.

---

## 23. Week 8 path built end to end — skeleton + v1 of every lens; parameters PROPOSED, owners to take over (2026-10-11)

**Touches:** new `pipeline/`, `lenses/{credit,forecast,anomaly,zakat}/`,
`lenses/lens_config.yaml`, and four new harnesses. Nothing in the generator,
`config.yaml`, or the profile engine changed. `eval/heldout_anomalies.assert_held_out`
now also scans `lenses/anomaly/`.

**Why now.** At the start of (inferred) Week 5 none of the five Week 8 outputs
existed and no lens owner had started. The generator owner built a working v1 of
the whole path in one day so the gate is no longer at risk of having nothing, and
so every owner inherits a running, contract-checked slot instead of a blank one.
**Every lens remains its SOP §3 owner's.** These are v1s to be owned, improved
and signed off — not finished modules.

### 23.1 What exists

`python -m pipeline.week8 --demo` produces one JSON object per business (§9) with
the credit decision (§11), cash-flow forecast + crunch alert, anomaly flags, Zakat
liability, and `status` (`scored` / `partial_profile` / `insufficient_data` —
explicit, never a silent null; on `insufficient_data` no lens runs, §15). The
profile engine runs per business through the same code path as
`profile_engine.compute`; that is exact because the hazard RNG is keyed on
`business_id` and the §35 z-scores use the pinned reference table. Each object
carries a receipt (config, lens-config and model hashes, output hash). Everything
is deterministic: `eval/week8_check.py` re-runs the demo and confirms byte-identical
output.

**Contract check — `python -m eval.week8_check`: PASSED** on 43 objects (3 demo + 40
random serving): 27 scored, 12 partial_profile, 4 insufficient_data; 25 approved,
14 declined. It asserts the §11 key set exactly, fixed markup, charity-directed
penalty, null `adjusted_markup_pct`/`recourse`/`stress`, no `stressed_markup_pct` /
`eligible` / `fraud_reason` / score / threshold key anywhere, Zakat determinism and
arithmetic, and that every forecast is shown beside its naive baseline.

### 23.2 Measured results — reported, not retuned

| lens | result | owner's next step |
|---|---|---|
| **Credit** | **CV AUC 0.5912** [0.5841, 0.5985] = **88.8% of the 0.666 ceiling** (team `unified_cv` protocol, research, 9,495 / 449 defaults, 58 features). Serving check, never trained on: 0.643 [0.554, 0.723], n=943. JSON scorer reproduces sklearn to 5e-15. Tier default rates monotone: A 1.9% → B 4.4% → C 7.3% → risk-model decline 11.7%. | SHAP is already exact (see 23.3); confirm tiers; human-readable feature names in the explanation text |
| **Forecast** | **The model LOSES to the naive baseline on accuracy**: median scale-free error 0.455 vs 0.376, naive better for 63% of businesses, MAPE 18.1% vs 15.0%. It catches more crunches (87.1% vs 81.8%) at more false alarms (3.7% vs 1.3%). | Replace/improve the model (SOP names Prophet/ARIMA); the backtest is the bar. Holdout-shock lead-time test and Ramadan-window run (§10, §16) not done |
| **Anomaly** | Injected types: both caught (ranks 1 and 7). **Held-out round-trip: recall 0.92**, precision 0.214 vs ceiling 0.230. **Held-out duplicate payment: recall 0.06 — effectively missed.** | Duplicates need a pairwise feature. If one is added, `duplicate_payment` stops being held-out and a **new** held-out type must be defined in `eval/heldout_anomalies.py` first (§12) |
| **Zakat** | Demo 10001: SAR 5,963.26 (base 238,530 × 2.5%, seeded hawl complete). 10002: `hawl_incomplete`. Both §17 branches demonstrated. | Replace the placeholder nisab price; Sharia advisor to confirm the hawl rule |

The forecast and duplicate-payment results are the important ones: they were
measured, they are unflattering, and they are recorded as the bar to beat rather
than tuned until they looked better.

### 23.3 Decisions made — each PROPOSED for the owner named

**Credit (credit lens owner):**
- **Features = the §8 /profile list** (`registry.PROFILE_FEATURE_IDS`) minus 23
  (categorical MCC code) and 24–26 (not_implemented). The Zakat-only balance-sheet
  features 27–31, 34, 35 are excluded per §7/§8. *Note:* entry 21's model baseline
  used all 71 engine features including 27–31; the contract-compliant model here
  scores 0.591 vs that 0.596 — a small, honest cost of respecting §8.
- **Sector is not an input** — it enters only via the §35 z-scores, so the model
  cannot shortcut to the sector code (§25).
- **Signed log1p on absolute-currency features**, decided before training.
- **Model = regularised logistic**, per entry 21 (it beat XGBoost). Its contribution
  `coef × z` *is* the exact SHAP value in log-odds, so the §13 explanation table
  works now from a JSON artifact — no pickle, no SHAP library, fully auditable.
- **Tiers:** PD < 0.03 → 5.0%, < 0.06 → 6.5%, < 0.10 → 8.0%, ≥ 0.10 decline. Product
  parameters, not fitted. Fixed at inception, no stressed variant.
- **§31 affordability**: amount = largest principal whose installment ≤ 0.40 ×
  `installment_capacity_sar`, 12 months, rounded down to SAR 1,000, within
  5,000–500,000. **Consequence to review: 23% of research businesses are declined
  on affordability** because feature 42 is zero (outflow ≥ inflow) — the §31 gate
  working as written, but a large share.
- **On a decline, `base_markup_pct` is `null`** — the key is always present (§9, §11)
  but no rate is offered on a decline. Interpretation for the owner to confirm.
- §13 phrasing says "supported **approval**" rather than "supported **this
  decision**", so the same sentence reads correctly on a decline.

**Anomaly (forecast + anomaly owner):** per-business Isolation Forest on six generic
features; flags only, `flag_reason` only, scores and threshold withheld (§29) — a
`candidates_flagged` count was removed for the same reason. **Four logic fixes made
after inspecting the demo output and BEFORE the held-out evaluation existed**, so
none could be tuned to it: (1) recurring payment series are expected, not "rare";
(2) a 30-day burn-in before a counterparty counts as new — first sightings had
piled up at the window start; (3) hard univariate violations (large amount, rare
hour) flag in their own right — the injected odd-hours transaction ranked 436th
of 2,650 before this; (4) the amount rule is one-sided — unusually *small*
payments are not a risk anomaly. The `both_directions` feature is the round-tripping
signal §33 itself names; the held-out round-trip recall should be read with that
in mind. There is deliberately no duplicate-payment feature.

**Forecast (forecast + anomaly owner):** numpy OLS (trend + day-of-week, slope
damped 0.5) vs trailing-30-day naive; crunch alert = projected negative balance or
the engine's liquidity hazard (features 52–54, read from the profile, not recomputed
— preserves §8/§34). No Prophet/statsmodels dependency added.

**Zakat (compliance owner + Sharia advisor):** NWC method; rate 2.5% per lunar year
(354 days); **nisab = 85 g gold at a SAR 491.291/g (commercial quotation dated 2026-11-08; pending independent verification), carried in every output
as `nisab_source_status: commercial_quote_documented_pending_independent_verification`
so it cannot pass for a fully validated figure; **hawl rule = nisab at start and end of the year** (the Hanafi position) —
intermediate dips untracked because no pre-window balance history exists. On
`insufficient_data` Zakat does not run, following §15 literally ("before any lens
runs"); arguably Zakat, not being a score, could run — the compliance owner decides.

**Zakat Hawl Rule Review — Compliance Owner (M2):**

- **Status:** PROPOSED — pending Sharia advisor confirmation.
- **Implemented rule:** `nisab_at_start_and_end`.
- **Hawl duration:** 354 days (simplified lunar year).
- **Starting condition:** Opening net zakatable assets must meet the Nisab threshold.
- **Ending condition:** Net zakatable assets must meet the Nisab threshold.
- **Intermediate balances:** Not continuously monitored because historical balance data is unavailable.
- **Calculation:** 2.5% of net zakatable wealth when both Nisab and Hawl conditions are satisfied.
- **Technical verification:** Five Zakat unit tests passed.
- **Sharia review required:** Confirm whether the current Hawl rule is acceptable or should be replaced.
- **Compliance owner sign-off:** Pending.
- **Sharia advisor sign-off:** Pending.

**Week 8 CLI:** lens parameters live in `lenses/lens_config.yaml`, not `config.yaml`,
so the generator config's hash — cited by the calibration and compare_real receipts
— is untouched. `governance.sharia_screen_status` is emitted as `null` /
`not_implemented` rather than omitted, so its absence can never be read as compliant.

### 23.4 Left for the owners

- **Credit:** sign off 23.3; human-readable feature names in the explanation; §25
  within-sector fairness audit (entries 1b, 21); recourse (§27) post-gate.
- **Forecast:** beat the naive baseline (it currently doesn't); holdout-shock lead
  time; Ramadan-window run.
- **Anomaly:** duplicate detection (with a new held-out type defined first).
- **Zakat / compliance:** sourced nisab price; hawl rule sign-off; Sharia screening
  (feature 24) and the Compliance View; PDPL note.
- **API (§8):** five routes over these modules; auth + rate limiting (§29); **Week 7
  latency smoke test** — the CLI streams `transactions.csv` (~30 s per call), which
  is fine for the Week 8 gate but not for a < 2 s API; serving will need a
  pre-aggregated store.
- **Everyone:** unit tests — there are still none beneath the integration checks.

**Sign-off:** ☑ credit lens owner (Abdulrahman Alharbi, 2026-11-08; approves 23.3 credit policy, subject to Entry 34 change control) ☑ forecast + anomaly owner [Abdulelah Alsalamah; ticked by Ahmed Altunusi on his behalf, verbal agreement 2026-11-10] (23.3
anomaly, forecast) ☐ compliance owner + Sharia advisor (23.3 Zakat) ☑ team [ticked by Ahmed Altunusi on the team's behalf, verbal agreement 2026-11-10] (gating
Zakat on insufficient_data)

---

## 24. Credibility path, first two steps: a numbers register and a complete reproducibility receipt — PROPOSED (2026-10-11)

**Touches:** new `docs/NUMBERS.md`, `eval/check_numbers.py`, `pipeline/verify.py`; the
`receipt` block of the Week 8 output; `eval/run_section14.py` now persists its results.
No model, lens decision or generated data changed.

**Why.** Synthetic AUC is quoted as 0.574, 0.578, 0.591 and 0.596 across the repo. Each is
correct for its own feature set and protocol, but a panel that sees four "AUCs" doubts all
of them. Separately, the Demo & Credibility plan (item 2) requires the receipt to carry a
data hash and the §35 reference-stats hash, plus a way to verify a decision. Neither existed.

**What changed.**
- **`docs/NUMBERS.md` is the single source for any number on a slide, in the report or at
  the defense.** Each row gives population, N, features, protocol, source, what it may be
  quoted for and what it must not. §7 retires the pre-calibration and withdrawn numbers.
  `python -m eval.check_numbers` recomputes 29+ of them from their artifacts and fails on
  drift; a deliberately corrupted value was caught in testing.
- **Receipt completed.** Every decision object now carries `data_sha256` (exactly the input
  rows its decision was computed from), `reference_stats_sha256` (§35) and `code_commit`
  (with `+dirty` if uncommitted code produced it), alongside the existing config, lens
  config, model and output hashes. `python -m pipeline.verify <file>` re-runs saved
  decisions: it reports *reproduced byte-identical*, or names which input changed, or flags
  the object as edited after it was produced. Tested both ways — the demo decisions
  reproduce, and a decision with its amount changed by hand is caught as "EDITED".
  `eval/week8_check` now asserts every receipt field and the output hash's consistency.
- **§14 numbers now have an artifact** (`eval/out/section14_rho_sweep.md`), including the
  model-baseline grid; before this they existed only in prose.

**Corrections made while building the register:**
- The credit-lens README quoted **0.5959 / 89.5% of ceiling** as the lens's number. That is
  the §14 sweep (row A6, includes the Zakat-only features); the shipped lens is **0.5912 /
  88.8%** (row A1). Corrected.
- **"SME credit models report 0.70–0.80"** (entry 22, credit-lens README) was stated without
  an archived source. It is now marked unsourced everywhere and is barred from the approved
  headline sentences until a benchmark is archived in `sources/` — the same source would
  also be what entry 22 Path B requires.

**Sign-off:** ☐ team (adopt `docs/NUMBERS.md` as the only place numbers are quoted from)

---

## 25. API v1 over a serving store; Week 7 latency test PASSED — PROPOSED, API owner to take over (2026-10-11)

**Touches:** new `api/store.py`, `api/app.py`, `eval/latency_test.py`, `tests/`; `pipeline/week8.py`
refactored into shared per-lens sections (no behaviour change — decisions saved before the
refactor still reproduce byte-identical, confirmed with `pipeline.verify`).

**Why.** SOP §5: the Week 7 latency test must pass before the Week 8 gate, and the CLI took ~30 s
a call because it streams the full `transactions.csv`.

**What was built.**
- **Serving store** (`api/store.py`): DuckDB holding the input rows of the 1,000 serving
  businesses (§23 demo population), sorted by business. Inputs, not answers — every request
  still runs the profile engine and the lens. Rows keep file order and dtypes are restored on
  read, so the receipt's data hash matches; queries are single-threaded with ORDER BY (§37.2).
  **Store-path decisions equal CLI decisions byte for byte**, data hashes included.
- **API** (`api/app.py`): `/profile/{id}`, `/lenses/{credit,forecast,anomaly,zakat}?business_id=`,
  `/health`. Same code as the CLI (`pipeline.week8` sections). Refuses to start without
  `MAAL_API_KEY`; constant-time key check; per-business rate limit; research businesses → 404;
  `insufficient_data` explicit; no anomaly scores; `/profile` = §8 list only.

**Week 7 result (§19) — PASS on the maximum, not just a percentile.** `/lenses/credit` through
every one of the 1,000 serving businesses: p50 109 ms / p95 138 ms / max 312 ms. Real HTTP via
uvicorn: max 133 ms. Slowest route `/lenses/anomaly`: max 982 ms. SHAP alone: 0.2 ms (exact
closed form). API answers equal CLI answers for the demo businesses. Figures and source:
`docs/NUMBERS.md` §6b, `eval/out/latency_week7.md`. Note: §19 names "XGBoost inference"; the
model is regularised logistic (entry 21), so that step is logistic inference.

**First unit tests** (`tests/`, 21 passing): the API's guarantees (auth, refusal to start
unauthenticated, 404 for research businesses, §11 contract, §15 explicit state, no scores, no
Zakat-only features, determinism, per-business rate limit) and pure-function tests of the
Zakat rules and credit policy that need no generated data.

**Decisions for the API owner:** query parameter `business_id` on the lens routes (as §8 lists
them without a path id); the store holds the serving population only; Zakat is gated on §15 like
the other lenses (entry 23's open question still applies).

**Left:** per-business-owner authorisation (§29 — stated, not built; a shared key is demo scope);
the anomaly route is closest to budget because the per-business forest is refitted per call;
store rebuild when data is regenerated; UI wiring (Week 10).

**Sign-off:** ☑ API owner [Ahmed Altunusi, 2026-11-10] ☑ team [ticked by Ahmed Altunusi on the team's behalf, verbal agreement 2026-11-10] (Week 7 gate recorded as passed)

---

## 26. Sharia screening (feature 24) v1 — rule table PROPOSED, NOT certified; owners + Sharia advisor to confirm (2026-10-11)

**Touches:** new `compliance/sharia.py`, `compliance/sharia_rules.yaml`, `eval/sharia_report.py`,
`tests/test_sharia.py`; `lenses/credit/model.py` (`apply_sharia_gate`); `pipeline/week8.py` (feature 24
written into the shared profile; `governance.sharia_screen`); `api/app.py` (`sharia_screen` in the
credit response); the receipt gains `sharia_rules_sha256`. Feature 24 was `not_implemented`.

**Why now.** A core governance module, not a stretch goal: SOP §2 makes it 100% deterministic, §27's
recourse cannot be built without it, and until now every decision shipped `sharia_screen_status: null`.

**Design.**
- **Rules are data** (`sharia_rules.yaml`, versioned, sha256 in every output and in the receipt), so the
  Sharia advisor can change a list or threshold without touching code, and `pipeline.verify` names the
  rule table if it changed.
- **Activity screen** on the declared MCC; **no MCC → registered sector**, with `evidence_basis` stating
  the weaker basis (MCC coverage is limited by design, §12.3). **Income screen:** financial-institution
  inflows ≥ 5% of inflow value → soft flag. **Existing financing → disclosure + owner prompt, status
  unchanged:** the bank feed cannot tell Islamic from interest-based financing, and refinancing
  interest-based debt into a Murabaha is a legitimate use of the product.
- **Feature 24 lives in the shared profile**, so the credit lens reads it like any other feature — §8's
  no-lens-reads-another-lens guarantee holds.
- **Effect on credit (§27):** hard flag → `declined`, `decline_origin: compliance`, the compliance
  template is the only public explanation, and recourse is structurally unreachable (it keys on
  `decline_origin == "risk_model"`). Soft flag → the risk decision stands, an approval becomes
  `offer_status: conditional_on_sharia_review` with the owner prompts as conditions — §10's "prompt the
  owner, not a silent queue". The §11 contract keys are unchanged.

**Measured (`eval/out/sharia_screen.md`).** Research: **85.1% compliant, 14.9% soft flag, 0% hard flag.**
Every soft flag is retail — 1,133 businesses on MCC 5999 ("general trading") and 519 retail businesses with
no MCC; about one retail applicant in three gets a conditional offer. Evidence basis: declared MCC 60.3%,
registered sector 39.7%. The financing disclosure is asked of 34.8%. **No hard flag occurs** because the
generator assigns only permissible MCCs; the hard-flag path is proven on crafted inputs in
`tests/test_sharia.py` (50 tests pass overall), not by the population.

**What is NOT claimed.** The rule table is `proposed_unverified`. It follows the two standard screens
(activity and non-permissible income; AAOIFI Shari'ah Standard No. 21 is the usual reference) and ISO
18245 MCC meanings, but **neither document is archived in `sources/`**, and no Sharia board has reviewed
it. Until both happen, outputs must be presented as "rule-based screening, pending Sharia-advisor
confirmation" — never as a Sharia determination.

**Left:** archive and cite the standard and ISO 18245; Sharia-advisor review of every list and threshold
(notably 5993 tobacco and 7929 entertainment, where scholars differ, and the decision to treat existing
financing as a disclosure rather than a flag); the Compliance View toggle (UI, Week 10).

**Sign-off:** ☑ compliance owner [Mohammed Alshaibani; ticked by Ahmed Altunusi on his behalf, verbal agreement 2026-11-10] ☐ Sharia advisor ☑ credit lens owner (Abdulrahman Alharbi, 2026-11-08; approves compliance gate and conditional offers, subject to Sharia-advisor confirmation)

---

## 27. Forecast method chosen on a validation window; beats the naive baseline on an untouched test — PROPOSED, forecast owner to take over (2026-10-11)

**Touches:** new `lenses/forecast/methods.py`, `eval/forecast_selection.py`, `tests/test_forecast.py`;
`lenses/forecast/forecast.py` uses `lens_config.forecast.method`; `eval/forecast_backtest.py` evaluates
the shipped method; `lenses/credit/train.py` now hashes only its own config section (see below).

**Why.** The v1 forecast model (OLS trend + day-of-week, damped) lost to the trailing-30-day baseline
(entry 23: median error 0.455 vs 0.376). That number is now retired in `docs/NUMBERS.md` §7.

**Protocol — fixed before anything ran.** Six candidates in one shared module (so the method evaluated
is the method shipped): naive30 (the §10 baseline), naive90, a 50/50 blend, an EWMA (half-life 21 days),
the v1 OLS model, and a "structural" model that replays recurring payments on their days. Criterion:
lowest median scale-free end-of-horizon error. **Selection on a validation window** (days 121–150,
research only); **one report on an untouched test window** (days 151–180, research and serving). Choosing
and reporting on the same days would have flattered the winner.

**Result.** Validation chose **`naive90`** (median 0.345; EWMA 0.349; naive30 0.411; v1 OLS 0.488 — last).
On the test window, never used to choose:

| population | `naive90` | naive30 baseline | `naive90` better for | MAPE | crunch recall | false alarms |
|---|---|---|---|---|---|---|
| research (9,495) | **0.323** | 0.376 | 58.5% | 13.0% vs 15.0% | 79.4% vs 81.8% | **0.5% vs 1.3%** |
| serving (943) | **0.344** | 0.401 | 58.4% | 14.7% vs 15.5% | 74.6% vs 75.4% | **1.0% vs 1.7%** |

14% lower error and fewer than half the false alarms, at a cost of ~2 points of crunch recall
(research). The shipped lens's backtest reproduces these figures exactly.

**Stated plainly, so nobody oversells it:** the winner is **a longer moving average, not a sophisticated
model**. It wins because synthetic daily flows are noisy and their trends are small, which also means the
§10 30-day baseline is a weak bar on this data. EWMA had higher crunch recall (83.8% on validation) but
the criterion was fixed as median error before the run, so it was not chosen after the fact. The crunch
*alert* also reads the engine's hazard features (52–54), so its recall is not the projection's alone.

**Also fixed:** the credit artifact recorded the hash of the whole `lens_config.yaml`, so changing the
forecast method made the credit model look stale. It now records `lens_config_credit_sha256` (its own
section only); retraining reproduced identical metrics. Decision receipts still hash the whole file.

**Left for the forecast owner:** §10 holdout-shock lead-time test (inject a revenue drop, measure warning
time vs naive) and the §16 Ramadan-window run — neither target window contains Ramadan (days 18–47). A
richer model (Prophet/ARIMA, per the SOP) must beat `naive90` under this same validation/test protocol,
with any new candidate declared before it is run. **Do not change `forecast.method` by reading the test
table** — that turns the test into a second validation.

**Serving path re-checked after entries 26–27:** Week 7 latency test re-run — still **PASS** (credit max
252 ms over all 1,000; real HTTP max 158 ms; anomaly max 964 ms; API answers identical to the CLI).
Entry 25's figures were the first run; current ones are in `docs/NUMBERS.md` §6b.

**Sign-off:** ☑ forecast + anomaly owner [Abdulelah Alsalamah; ticked by Ahmed Altunusi on his behalf, verbal agreement 2026-11-10]

---

## 28. §14 label-noise axis run — AUC is shallow in σ; nothing changed — RECORDED (measurements, 2026-10-31)

**Touches:** nothing in `config.yaml` (σ stays 0.2). Adds `eval/out/section14_noise_sweep.txt`,
`docs/NUMBERS.md` §4b and a `noise_sweep` check in `eval/check_numbers.py`. Closes the §14 item
owed since entry 21 ("implemented, never run").

**Grid fixed before the run** (19:57 UTC, run started at once): σ ∈ {0.0, 0.2, 0.5, 1.0}. The
script's default {0.1, 0.2, 0.3} was replaced because it barely moves the ceiling and could not show a
trend. The new grid runs from no label noise, through the shipped 0.2 (9.6% of logit variance, entry
21), to roughly 70% of it. Protocol and features are the same as entry 21 / A6: ρ = 0.6, full scale
(10,000 research + 1,000 serving), entity-level stratified 5-fold out-of-fold AUC.

| σ | 0.0 | 0.2 | 0.5 | 1.0 |
|---|---|---|---|---|
| logistic OOF AUC (research scorable, N = 9,495) | 0.6123 | 0.5959 | 0.5974 | 0.5882 |
| XGBoost OOF AUC | 0.5784 | 0.5568 | 0.5845 | 0.5687 |
| oracle ceiling (latent index, scorable research) | 0.6691 | 0.6660 | 0.6646 | 0.6502 |
| research defaults of 10,000 (seeded replication) | 459 | 478 | 501 | 673 |

**Findings, reported:**
1. **Shallow.** From σ = 0 to 1.0, the logistic AUC falls by 0.024 (under two standard errors of
   0.0144) and the ceiling by 0.019. Measured AUC stays at 89–92% of the ceiling. At a ~5% event rate,
   most of a label's unpredictability is the Bernoulli draw itself, not σ. σ is a weak lever on the
   ceiling, and the ceiling is set mainly by the latent spread (entry 22).
2. **The σ = 0.2 column reproduces the register exactly** (0.5959 = A6; ceiling 0.6660; 478 defaults),
   so the sweep and the shipped data agree.
3. **σ confounds the base rate.** expit is convex, so more noise means more defaults (6.73% at σ = 1.0).
   The σ = 1.0 column is therefore not at the shipped base rate. The intercept was **not** re-solved:
   doing so would turn a sensitivity run into a recalibration.
4. **No circularity at any σ.** The out-of-sample peak is 0.6123, and the ceiling never exceeds 0.67.
5. As in entry 21.5, logistic beats XGBoost at every σ.

**Status:** measurements, recorded. Nothing in the generator or the lenses changes. No sign-off is
needed, because no owner's consequence moves.

---

## 29. Hostile-demo scenario library — 8 scenarios on business 10001; outcomes reported as they came — PROPOSED (2026-10-31)

**Touches:** new `scenarios/` (`library.yaml`, `run.py`), `tests/test_scenarios.py`,
`eval/out/scenario_library_check.txt`, `docs/NUMBERS.md` §5b, and `eval/heldout_anomalies.assert_held_out`,
which now also scans `scenarios/`. `config.yaml`, the generator, the lenses and the model are unchanged.

**What it is.** Demo & Credibility plan item 1. A judge picks a disaster from a fixed menu
(`python -m scenarios.run --list`); nothing is typed in. Each scenario overlays demo business 10001's
spec in memory and regenerates that one business. ID and seed are unchanged, so the disaster is the only
difference from the baseline. All lenses and both governance modules then run through the Week 8 code
path. Overrides are restricted to the generator's existing demo levers (`ALLOWED_OVERRIDES`: cash
crunch, known anomaly injections, window and operating start, Zakat seed). Any other key is refused, so
a scenario cannot reach the latents, ρ or the label model. `config.yaml` is never edited, so its hash, as
cited in the calibration and model receipts, is unaffected. Each object carries a `scenario` block plus
`scenario_library_sha256` in its receipt.

**Pre-validation** (`python -m scenarios.run --check`, exit 0). For every scenario: the Week 8 contract
(`eval.week8_check.check_object`), a byte-identical re-run, and the 30 s budget (max 0.40 s; about 0.8 s
cold, including start-up). No held-out anomaly types anywhere. The baseline equals business 10001 in
the full `data/` generation in every value; only the surrogate `transaction_id` / `obligation_id`
differ, because a single-business run numbers from 1.

**Severities were fixed before the first run.** The outcomes below (NUMBERS §5b) are whatever the
lenses produced. None were tuned, and N = 1 per scenario, so these are demonstrations, not estimates.

**Findings — state these in the demo before a judge finds them:**
1. **Collapses are declined by the §31 affordability gate, not by the risk model.** `severe_collapse`
   and `combined_crisis` are declined (affordability), with a crunch alert one day out. Their PDs
   (0.0483, 0.0561) are no higher than the baseline's (0.0557).
2. **PD does not rise with the disaster.** The calm counterfactual (0.0690) scores riskier than the
   baseline. The v1 risk model (CV AUC 0.591) ranks populations, not month-to-month stress, so it is not
   a stress detector. Credit lens owner to review; not retuned.
3. **A shock in the final three weeks is invisible.** `late_sudden_shock` (−70% from week 24) is
   approved for more than the baseline (104,000 vs 47,000 SAR), with no cash alert. `naive90` averages
   90 days, which dilutes a three-week shock. This is the §10 holdout-shock lead-time gap already owed by
   the forecast owner (entry 27); the scenario makes it demonstrable.
4. **The anomaly lens always returns its cap.** 10 flags in every scenario (`max_flags: 10`), including
   the calm one, where all 10 are ordinary activity. Every injected anomaly is among the flags (5 of 5 in
   `fraud_pattern`). Flags are a review queue, not alarms; anomaly owner to review the cap.
5. The thin-file newcomer is refused (`insufficient_data`, no lens runs). Zakat falls with revenue, and
   the Sharia status is compliant throughout (the retail MCC is unchanged).

**Sign-off:** ☑ generator owner (menu and levers; Ahmed Altunusi, 2026-10-31) ☑ credit lens owner [Abdulrahman Alharbi; ticked by Ahmed Altunusi on his behalf, verbal agreement 2026-11-10] (findings 1–2) ☑ forecast + anomaly owner [Abdulelah Alsalamah; ticked by Ahmed Altunusi on his behalf, verbal agreement 2026-11-10]
(findings 3–4) ☑ team [ticked by Ahmed Altunusi on the team's behalf, verbal agreement 2026-11-10] (state the findings in the demo)

---

## 30. Entry 13's "unbiased under thinning" claim is false for features 20, 21, 22 — FINDING + PROPOSED (2026-11-01)

**Touches:** entry 13.6 (the `sample_weight` schema change), features 20, 21, 22 and, through
§35, 59 (`sector_relative_concentration_z`). No engine change in this entry.

**The claim.** Entry 13.6 says: "Transaction-derived features (5, 10, 20–22, 41, 45, 46) are ratios
and counts of counterparties, unbiased under thinning; anything that sums `transactions.amount` on
the inflow side must multiply by `sample_weight`." The profile engine never reads `sample_weight`
(`grep -n sample_weight profile_engine/` finds nothing).

**Measurement (read-only, engine unchanged).** `data/quick` (seed as generated on 2026-11-01),
the 376 businesses with thinned POS `sales` rows (`sample_weight` = 10; all thinned rows are
`direction = in`, `counterparty_type = customer`, with a customer ID). The engine's own
`transaction_features` was run twice: once as it runs today, once with `amount × sample_weight`.

| Feature | Median, as computed | Median, weighted | Median abs. difference | Max abs. difference |
|---|---|---|---|---|
| 5 `largest_single_source_ratio` | 0.0448 | 0.0448 | 0.0000 | 0.0000 |
| 10 `top_expense_category_share` | 0.7004 | 0.7004 | 0.0000 | 0.0000 |
| **21 `counterparty_concentration_index`** | **0.1056** | **0.0346** | 0.0721 | 0.2114 |
| **22 `new_counterparty_ratio_30d`** | **0.0029** | **0.0151** | 0.0119 | 0.2673 |
| 45 `counterparty_persistence_ratio` | 0.9210 | 0.9210 | 0.0000 | 0.0000 |
| 46 `circular_counterparty_count` | 0 | 0 | 0 | 0 |

Feature 20 (`unique_counterparties_count`) counts distinct customers, so weighting cannot change it,
but the thinning rate can: thinning the thinned rows by a further 50% (10% → 5% sampling) cut the
median from 104 to 82 (median drop 17.2%).

**Why.** 21 and 22 pool inflow and outflow value per counterparty; down-weighting POS inflows by 10×
against unthinned outflows shifts both. 5, 10 and 45 compare values within one direction, so a
uniform thinning cancels. 20 depends on how many rows exist.

**Consequence.** Thinning happens only in retail and F&B, so the bias is tied to sector. On the
synthetic data, feature 21 overstates concentration by about 3× and 22 understates new-counterparty
share by about 5× for POS businesses. Feature 59 inherits 21's bias (entry 35). Feature 2 is not
affected (it reads `daily_aggregates`, computed from the full stream). Berka is not affected
(`sample_weight` = 1.0 on every row). The unit test
`tests/test_profile_engine.py::test_sample_weight_counts_a_thinned_row_at_its_weight` documents
the gap as a strict `xfail`.

**Correction (2026-11-01, same day, measured against the true value — `python -m eval.thinning_bias`
→ `eval/out/thinning_bias.md`).** The table above compares "as computed" with "weighted"; neither is
the truth. The script regenerates the same quick population with the sample rate at 1.0 (thinning has
its own RNG stream, so this is exactly the stream the file was sampled from; `daily_aggregates` is
asserted identical) and runs the engine on it. Medians of computed ÷ true over the 376 thinned
businesses:

| Feature | Today (no weights) | Weighted | What changes in this entry |
|---|---|---|---|
| 20 | 0.82 (103.5 vs 138) | 0.82 | confirmed: under-counted, weighting cannot fix it (median 11.7% of true customers never appear) |
| 21 | 3.24 | 1.02 | confirmed: weighting fixes it |
| 22 | 3.92 | 20.76 | **wrong direction above.** True median is 0.0000 (244 of 376 businesses are 0). Today's 0.0029 is too *high*, not "understated by about 5×". Thinning drops a customer's earlier receipts, so known customers look new; weighting multiplies those false-new receipts and makes it worse |
| 5 | 1.14 | 1.14 | **was called unaffected above; it is biased**, and weighting does not help |
| 10 | 1.00 | 1.00 | confirmed unaffected (outflows are never thinned) |
| 45 | 0.94 | 0.94 | **was called unaffected above; it is biased**, and weighting does not help |
| 46 | n/a | n/a | true value is 0 for all 376 businesses, so no bias can show |

The sentences "22 understates new-counterparty share by about 5×" and "5, 10 and 45 compare values
within one direction, so a uniform thinning cancels" are withdrawn: the first has the wrong direction,
the second holds only for 10. Proposal item 2 below is corrected accordingly; its original wording
was "weight `amount` by `sample_weight` in the per-counterparty value sums for 21 and 22 (and, for
consistency, 5, 10, 45, 46 and `cp_coverage_share`, where it changes nothing in expectation)".

**Proposed (not decided):**
1. Withdraw the sentence in 13.6 that calls 20–22 unbiased; keep it struck through with a pointer here.
2. *(Corrected 2026-11-01.)* Weighting fixes only feature 21. Features 20, 22, 5 and 45 depend on
   which rows exist, not on their amounts, so no weight can repair them. The real choice is for the
   engine to read counterparty features from an unthinned source, or for the generator to stop
   thinning (or to keep every customer's first receipt), or to declare these features
   `not_available_in_source` for thinned businesses.
3. Feature 20 under thinning needs a definition choice: (a) report it only for unthinned
   businesses (null `not_available_in_source` when any row is thinned), (b) estimate the full count,
   or (c) keep it and state that it counts customers seen in the thinned file. This is a choice for
   the profile engine and generator owners.
4. Any change re-runs the profile engine, the reference statistics (entry 35) and the credit model.

**Generator owner's decision (Ahmed Altunusi, 2026-11-04), recorded before any fixed result existed:**
the engine reads counterparty features from an unthinned source, the first option in item 2. The
generator writes `counterparty_windows`, per-customer totals from the full stream by window, for
thinned businesses only, the way `daily_aggregates` is already computed from the full stream. Item 3
becomes moot: feature 20 keeps its definition and its true value. The engine raises an error if a
thinned business has no totals, so the bias cannot return silently. A read-only probe on 51 thinned
businesses (research IDs 1–80) showed keep-first-receipt leaves 20 and 5 biased, because 20 counts
customers in the trailing 90 days and a first receipt can be older. Stopping thinning is about 7× the
rows. Marking the features unavailable would make missingness a sector signal.

**Rule fixed now:** the credit AUC after the fix is reported whichever way it moves, and this decision
is not revisited because of it. Engine code is the profile engine owner's; this change stays PROPOSED
until that line is ticked.

**Result (2026-11-04).** `python -m eval.thinning_bias`, quick mode, 376 thinned businesses of 600:

| Feature | Median true | Sampled rows ÷ true | `counterparty_windows` ÷ true |
|---|---|---|---|
| 20 | 138 | 0.82 | 1.00 |
| 21 | 0.0335 | 3.24 | 1.00 |
| 22 | 0.0000 | 3.92 | 1.00 |
| 5 | 0.0385 | 1.14 | 1.00 |
| 45 | 0.9992 | 0.94 | 1.00 |

The largest absolute error on any of the 376 businesses is 2.2e-16 on these ratio features and 0 on
feature 20. `cp_coverage_share` also matches the truth, per `tests/test_thinning.py` (25 businesses).

Full scale (10,000 research + 1,000 serving): `transactions`, `daily_aggregates`, `balances_monthly`,
`labels`, `businesses`, `obligations` and `facilities` are byte-identical to the previous generation
(sha256). The new table has 943,756 rows, 60 MB. Week 3 gate: PASS, same one loud SKIP, with three new
checks that the table covers exactly the thinned businesses and reconciles with `daily_aggregates`
(worst relative gap 8.5e-06).

Only features 5, 20, 21, 22, 45 and 59 moved, on retail and F&B only; 0 of 4,122 other scorable
businesses moved. Feature 59 is now mean/SD −0.12 / 0.96 (retail, N = 4,204) and −0.10 / 0.94 (F&B,
N = 1,555), from 6.63 / 2.79 and 7.32 / 2.46: most of its entry 35 drift was this bias. Features
55–58 are unchanged, so entry 35 still stands for them.

**Consequence, open: `model_v1.json` no longer matches the engine.** It was trained on the biased
values. Scored unchanged, not retrained, its median PD on POS businesses falls from 0.0390 to 0.0308
(N = 6,316), and the risk tier changes for 16.4% of serving (N = 943) and 18.4% of research
(N = 9,495). CV AUC 0.591 therefore does not describe this combination. Next, in order: entry 35
rebuild, credit retrain, then re-run everything that reads the profile and update `docs/NUMBERS.md`.

**Profile engine owner review (2026-11-05).** Agreed with the engine change. Reproduced on quick
data (`python -m generator.generate --quick`, then `python -m eval.thinning_bias`, 376 thinned
businesses of 600): in the `counterparty_windows (shipped)` column, features 20, 21, 22, 5 and 45 have
median ratio 1.00 to the full-stream truth on all 376, largest absolute error 2.2e-16 on the ratio
features and 0 on feature 20, matching the result above. `python -m pytest tests`: 97 passed,
14 skipped (API tests skip without the serving store); `ruff check .` clean. Two follow-ups, in the
same commit as this paragraph (no computed value changes; the quick re-run above was made with them):
1. `profile_engine/compute.py` `load_tables` reads `counterparty_windows.csv` with
   `dtype={"counterparty_id": object}`, as `pipeline/data.py` and `eval/gate_week3.py` already do.
   Harmless before (every ID has a text prefix), now consistent.
2. `profile_engine/features.py` `transaction_features`: feature 22's "seen before" set reads all
   history at least 30 days back for unthinned businesses, but only to day 179 for thinned ones
   (last window `d90_179`). The two agree only because `generator.generate.counterparty_windows`
   asserts `T <= 180`. A comment now names that assumption, and an assert refuses a thinned business
   with any transaction row 180 or more days before `window_end`, so a longer window fails loudly
   instead of making the two paths disagree.

**Sign-off:** ☑ profile engine owner (Faris Alsharifi, 2026-11-05) ☑ generator owner [Ahmed Altunusi, 2026-11-10] ☑ team [ticked by Ahmed Altunusi on the team's behalf, verbal agreement 2026-11-10]

---

## 31. Feature 24 carries a value and a null reason at the same time for insufficient_data businesses — FINDING, PROPOSED (2026-11-01)

**Touches:** `pipeline/week8.py` `prepare()`; feature 24 `sharia_screen_status`; every output that
returns both features and null reasons (`/profile`, the Week 8 decision object).

**What happens.** The engine nulls every feature except 32 with reason `insufficient_data` when a
business is refused under §15 (`profile_engine/features.py` `compute_profiles`). `prepare()` then
writes a Sharia status into feature 24 for **every** business, including refused ones (the comment
explains why: screening is about activity and income, not coverage). It removes only the null rows
whose reason is `not_implemented`. The `insufficient_data` row for feature 24 stays.

**Observed** on `data/quick` (generated 2026-11-01), businesses 15, 87 and 91 (all
`insufficient_data`): feature 24 = `soft_flag_review`, `compliant`, `compliant`, and each still has a
null row `sharia_screen_status / insufficient_data`.

**Consequence.** A reader sees a value that also claims to be missing. That breaks the rule that a
null always has a reason and a value never has one. No test catches it today.

**Options (not decided):**
- (a) `prepare()` drops every feature-24 null row once it writes a value, whatever the reason.
- (b) Feature 24 is not written for `insufficient_data` businesses (the screen still runs and goes
  into the Sharia section, but not into the profile vector).

The choice depends on entry 32 (where feature 24 is computed). No fix today.

**Profile engine owner position (2026-11-05).** Fix (b): feature 24 is not written into the profile
for `insufficient_data` businesses; the screen still runs and stays in the Sharia section. This keeps
§15 intact (a refused business has every feature except 32 null with reason `insufficient_data`) and
follows the option (b) position on entry 32. Add a test that no business has both a value and a null
reason for any feature. Implementation after the compliance owner signs.

**Sign-off:** ☑ compliance owner [Mohammed Alshaibani; ticked by Ahmed Altunusi on his behalf, verbal agreement 2026-11-10] ☑ profile engine owner (Faris Alsharifi, 2026-11-05)

---

## 32. Where features 24–26, 34 and 35 are computed — PROPOSED, options only (2026-11-01)

**Touches:** `profile_engine/features.py` (`not_implemented` for 24–26, 34, 35), `pipeline/week8.py`
(writes 24), `compliance/sharia.py`, `profile_engine/README.md`.

**Current split.** The engine emits `not_implemented` for 24–26, 34 and 35 on synthetic data and
`not_available_in_source` for 24, 25, 34, 35 on real data. The Week 8 pipeline computes feature 24 with
`compliance.sharia.screen` and writes it into the profile frame after the engine has run (entry 26).
25, 26, 34 and 35 are not computed anywhere. So `python -m profile_engine.compute` and
`python -m pipeline.week8` give different values for 24, and entry 31's defect sits exactly at that seam.

**Option (a): the engine computes 24 itself** (importing `compliance.sharia`), and later 25, 26, 34, 35.
- For: one place, one value; every reader of `profiles.csv` sees the same 24; entry 31 disappears.
- Against: the engine gains a dependency on the compliance module and its rule table; a rule-table
  change then changes the engine's output and its receipts; the compliance owner's module runs inside
  the profile engine owner's code.

**Option (b): the engine keeps `not_implemented`; the pipeline is the single place that fills 24
(and later 25, 26, 34, 35)**, and `profile_engine/README.md` says so.
- For: clear ownership (compliance code stays with the compliance owner); the engine stays
  source-agnostic and rule-free.
- Against: `profiles.csv` from the engine CLI never has 24, so any analysis that reads it directly
  (training, eval) must go through the pipeline or accept a null; the seam needs its own tests
  (entry 31).

Either way, entry 31 must be fixed at the same time. After the owners agree: update
`profile_engine/README.md` with the rule and run `python -m eval.week8_check`.

**Profile engine owner position (2026-11-05).** Option (b). The engine keeps `not_implemented` for
24–26, 34 and 35 (`profile_engine/features.py:508–510`); the pipeline (`pipeline/week8.py`
`prepare()`) is the only place that fills 24; `profile_engine/README.md` will say so. Reason: it keeps
rule tables out of the engine and out of its receipts, so a Sharia rule-table change never changes
`profiles.csv`. The README change and a seam test happen after the compliance owner signs.

**Sign-off:** ☑ profile engine owner (Faris Alsharifi, 2026-11-05) ☑ compliance owner [Mohammed Alshaibani; ticked by Ahmed Altunusi on his behalf, verbal agreement 2026-11-10] ☑ team [ticked by Ahmed Altunusi on the team's behalf, verbal agreement 2026-11-10]

---

## 33. Schema text for features 60–69 and 62b, the `daily_aggregates` row count, and two corrections — PROPOSED SCHEMA EDIT (v2.9 → v2.10) (2026-11-01)

**Touches:** `docs/Behavioral_Profile_Feature_Schema.md` §7, §12, §31, §36 ("all 59 features"), new
sections; references entries 5, 8 and 11. The schema is edited only after team sign-off, with a
version bump to v2.10 and a change-log line.

**The count.** The schema describes features 1–59 plus 18b (§36: "the profile engine (all 59
features)"). The registry computes **71**: 1–69, 18b and 62b (`profile_engine/registry.py`
`FEATURE_NAMES`). The 12 not in the schema are 60–69 (10) and 62b. After this edit, schema, registry
and `profile_engine/README.md` all say 71 (69 numbered + 18b + 62b).

**Section numbers.** Entry 8, entry 11 and `profile_engine/README.md` call the new sections
"proposed §37" (60–65) and "proposed §38" (66–69). Schema v2.9 already has §37 (Development Tooling).
Proposed: **§38 Existing-Obligation Features (60–65, 62b)** and **§39 Credit-Facility Features
(66–69)**, and the README updated to match.

**Proposed rows** (each states what the engine computes today, `profile_engine/features.py`):

| # | Name | Type | Definition | Null reasons |
|---|---|---|---|---|
| 60 | `committed_monthly_outflow` | float (SAR) | Σ over active obligations (status `active`, no `final_date` or `final_date` after the as-of date) of `amount × monthly equivalent` (monthly 1, weekly 52/12, quarterly 1/3, one-off 0; `unknown` frequency excluded). 0 when the business has no obligations. | `insufficient_data` only |
| 61 | `obligation_coverage_ratio` | float | `avg_monthly_inflow / committed_monthly_outflow` | `not_applicable` (no obligations); `near_zero_denominator` (60 < SAR 500) |
| 62 | `ocr_forward_3m` | float | as 61, counting only obligations still active 90 days after the as-of date | as 61 |
| 62b | `ocr_forward_6m` | float | as 61, 180 days after the as-of date | as 61 |
| 63 | `obligation_horizon_months` | float | (latest `final_date` among active dated obligations − as-of date) / 30 | `not_applicable` (none dated, or all ended); `not_available_in_source` (real feed) |
| 64 | `mandate_cancellation_count_90d` | int | obligations whose status turned `inactive` within the trailing 90 days | `not_available_in_source` (real feed: no status history) |
| 65 | `balloon_exposure_sar` | float (SAR) | Σ max(0, `final_amount − amount`) over active obligations with a final amount | `not_available_in_source` (real feed) |
| 66 | `facility_utilisation` | float | `facility_drawn / facility_limit` | `not_applicable` (no line); `not_available_in_source` (real feed) |
| 67 | `headroom_days_of_burn` | float | `max(headroom, 0) / max(burn_30d, 500/30)` | `not_applicable` (no line, or not burning); `not_available_in_source` |
| 68 | `max_consecutive_overdraft_days` | int | longest run of consecutive days with end-of-day balance < 0 in the trailing 90 days | `insufficient_data` only |
| 69 | `emergency_line_present` | bool | facility type is `emergency` or `temporary`; False with no line | `not_available_in_source` (real feed) |

**`daily_aggregates` row count (entry 5):** adopt entry 5's proposed §7/§12 text as edited on
2026-11-01 (one row per day of `window_days`, default 180; features 4, 9, 43 and 45 read the prior
90 days).

**Corrections carried in the same edit:**
1. §31, feature 42 row: "a business with downside-heavy cash flow (feature 45)" → "(feature 49)".
   Flow asymmetry is feature 49 (`flow_asymmetry_ratio`); 45 is counterparty persistence.
2. §36: "all 59 features" → "all 71 features (1–69, 18b, 62b)".

**Profile engine owner position (2026-11-05).** Agreed. The proposed rows were checked against
`profile_engine/features.py` as of `bbbc9d7` and match it, with two wording fixes requested (the
table above is not edited here):
1. Feature 69 should also list `not_applicable (no facilities row)`: a synthetic business with no
   `facilities` row gets 66, 67 and 69 null `not_applicable` (`features.py:625–628`), not False. The
   generator writes one row per business today (11,000 of 11,000), so the case does not occur yet.
2. The section header should say once that every feature is null `insufficient_data` for a business
   refused under §15; today only rows 60 and 68 list it.

The §35 filename change from entry 35 (`sector_reference_stats_v1.json` → `_v2.json`) goes into the
same schema edit.

**Sign-off:** ☑ profile engine owner (Faris Alsharifi, 2026-11-05) ☑ generator owner [Ahmed Altunusi, 2026-11-10] (60–69 are produced from the generator's tables) ☑ team [ticked by Ahmed Altunusi on the team's behalf, verbal agreement 2026-11-10]

---

## 34. Entry 10 pre-registration: features 41 and 42 — PROPOSED, implementation blocked (2026-11-01)

**Touches:** §31 features 41 and 42; the §31 affordability rule; the credit lens (42 is a model input
and drives the affordability gate). Implements entry 10's proposals only after sign-off.

**Status.** Pre-registration only. The credit lens owner has not agreed (2026-11-01), so nothing is
implemented and no number is computed with the new formulas. This entry fixes the formulas, the
constant and the report **before** any result exists, so the result cannot shape them.

**Feature 41 `financing_outflow_ratio`.** Re-specified on the loan-repayment transaction code:
`min(Σ outflow value with subfamily = LOAN in the trailing 90 days / recurring outflow in the
trailing 90 days, 1)`; null `near_zero_denominator` when recurring outflow < SAR 500. This is
exactly today's diagnostic column `financing_outflow_ratio_code`, which becomes feature 41.
Reason (entry 10): no counterparty MCC exists in either dataset, and debt service moves on transfer
codes.

**Feature 42 `installment_capacity_sar`.**
`max(0, avg_monthly_inflow − committed_monthly_outflow) × (1 − min(k × flow_asymmetry_ratio, 0.5))`,
with **k = 0.15**.

**Why k = 0.15.** It is the value already fixed in schema §31 ("`k = 0.15` (fixed, documented),
haircut capped at 0.5"), and the engine already uses it. Keeping it means entry 10 changes one thing
only, the outflow term. The choice does not depend on the approval rate. The cap 0.5 is also kept.

**Known consequence, stated before the run.** Feature 60 is 0 for a business with no obligations,
so under this formula its capacity becomes the whole haircut inflow. Whether that is intended is a
question for the credit lens owner before sign-off; the formula is not changed after the run because
of it.

**What will be reported after implementation, whatever it shows:**
1. Approval rate before and after, on the research population (1–10,000) and on the serving slice
   (10,001–11,000), each with N.
2. Share declined on affordability before and after. Entry 23.3 states 23% of research businesses
   today; that figure is not in `docs/NUMBERS.md`, so the "before" value will be re-measured with the
   same script immediately before the change and added to NUMBERS.md.
3. Change in credit CV AUC after the credit lens owner retrains (`python -m lenses.credit.train`).
4. The distribution of feature 42 before and after (median, 5th and 95th percentile).

**Already seen.** Feature 42 under the *current* formula (raw outflow) has been seen in earlier work.
No value of 41 or 42 under the new formulas, and no approval rate derived from them, has been
computed.

**Profile engine owner position (2026-11-05).** Agreed: pre-registration only, no code. Because of
entries 30, 35 and 38, the "before" figures in item 2 are measured on the retrained model, not on
`model_v1.json`.

**Sign-off:** ☑ credit lens owner (Abdulrahman Alharbi, 2026-11-07; accepts documented affordability risk) ☑ profile engine owner (Faris Alsharifi, 2026-11-05) ☐ team

---

## 35. The pinned §35 sector reference statistics are stale — FINDING + PROPOSED rebuild, once, after entry 30 (2026-11-01)

**Touches:** `profile_engine/sector_reference_stats_v1.json` (sha256 `14026c00…6fae4`), features
55–59, the credit model (55–59 are inputs).

**What happened.** The file was last committed in `4442e94` (the 2026-09-17 baseline, before the
Saudi calibration). The generator's calibration changed after it: `a4a7f40` (SAMA inputs, POS
receipts at the measured ticket, thinning) and `fa21be6` (Monsha'at sector mix). The receipt hash
still matches the file, so the receipts are correct about *which* stats were used; the stats just
describe an older population.

**Measurement (read-only, nothing rebuilt).** Stats rebuilt in memory with
`build_reference_stats` from the current full-scale research population (`data/`, N = 10,000),
against the pinned file:

| Sector | Base feature | Pinned mean / std | Current mean / std |
|---|---|---|---|
| retail_trade | 3 `inflow_regularity_score` | 0.826 / 0.135 | 0.997 / 0.020 |
| retail_trade | 21 `counterparty_concentration_index` | 0.037 / 0.011 | 0.114 / 0.032 |
| food_beverage | 3 `inflow_regularity_score` | 0.845 / 0.133 | 0.999 / 0.009 |
| food_beverage | 21 `counterparty_concentration_index` | 0.038 / 0.012 | 0.125 / 0.029 |
| construction | 11 `cash_flow_volatility` | 70,848 / 78,440 | 36,082 / 40,731 |
| construction | 16 `avg_daily_balance` | 940,880 / 1,854,491 | 469,198 / 845,845 |

Effect on the current research population: `sector_relative_regularity_z` (55) has mean **1.16**
(F&B) and **1.28** (retail) instead of about 0, and `sector_relative_concentration_z` (59) has
standard deviation **2.46** (F&B) and **2.79** (retail) instead of about 1. Construction and
professional services are close to 0 / 1 on these two features. So 55 and 59 no longer mean "how far
from the sector average" for the POS sectors.

**Correction (2026-11-01, same day — `python -m eval.reference_stats_drift` →
`eval/out/reference_stats_drift.md`).** The paragraph above left out the largest effect and two
others. Means and SDs per sector on the current research population (scored + partial_profile):
- **59 `sector_relative_concentration_z` has mean 6.63 (retail, N = 4,204) and 7.32 (F&B, N = 1,555)**,
  not about 0: the typical POS business sits about 7 reference SDs above its "sector average". (Its
  SDs, 2.79 and 2.46, are as stated above.)
- 55's SD has collapsed to 0.15 (retail) and 0.07 (F&B), so 55 barely varies inside those sectors.
- Construction is not "close to 0 / 1" on every feature: 56 has mean −0.44, SD 0.52; 58 has mean
  −0.25, SD 0.46 (N = 3,486). The pinned construction volatility and balance statistics are about
  twice the current ones (table above). Construction is close to 0 / 1 on 55 and 59, as stated.
- Provenance: the stats file entered the repository in `4442e94` and was never changed; `4442e94`
  is an ancestor of `a4a7f40`, `01b5ebd` and `fa21be6` (git ancestry; the dates are misleading because
  `4442e94` is a grafted baseline commit).

**Proposed.** Rebuild once (`python -m profile_engine.compute --build-reference-stats`), as
`sector_reference_stats_v2.json` so v1 stays reproducible, **after entry 30 is settled**. Rebuilding
first would pin the thinning bias in feature 21 into the reference table, and it would then need a
second rebuild. After the rebuild the credit lens owner must retrain (`python -m lenses.credit.train`)
and record the new credit numbers; NUMBERS.md rows that depend on 55–59 move with it.

**Result (2026-11-05).** Rebuilt once, at full scale, after entry 30 (profile engine owner tick
2026-11-05, follow-ups in `2ce22c7`). The code change came first and on its own (`c5de8f5`):
`--build-reference-stats` now writes `sector_reference_stats_v2.json`, refuses to write v1, and
refuses to replace an existing v2 without `--overwrite-reference-stats`. The v2 file, this entry and
the regenerated `eval/out/reference_stats_drift*` are in the commit that adds this paragraph.

Commands, in order, one at a time, from the repo root:
`python -m generator.generate` (exit 0, 283 s; 11,000 businesses, 12,537,615 transactions,
943,756 `counterparty_windows` rows), `python -m eval.gate_week3` (PASS, the same one loud SKIP:
professional-services sector differential), `python -m profile_engine.compute --dir data
--build-reference-stats` (exit 0, 171 s), `python -m eval.reference_stats_drift`.

- `sector_reference_stats_v2.json`: sha256
  `042aaebd7c43154f0d09d36640e0d2491c7a7d1b0dd097951b398207392a7e7a`; `"version": "v2"`,
  `"population": "research"`, `"n_businesses": 10000`.
- v1 is byte-identical: sha256 `14026c000b3507ac1f92fa8fbf0c8f11c1d3816060468083eb80896c8ee6fae4`
  before the build and after it (a test now asserts the full hash).
- Only 55–59 changed: the engine compares its first pass (no stats) with the re-scored pass, and all
  68 other columns were identical on all 11,000 businesses. The engine's 55–59 equal z recomputed
  from the base features against v2 to 9.1e-15.

Features 55–59 per sector, research population, scored + partial_profile (from
`eval/out/reference_stats_drift_z_moments.csv`, this run; the v1 column is v1's μ/σ applied to the
same current base features):

| Sector (N) | Feature | v1 mean / SD | v2 mean / SD |
|---|---|---|---|
| retail_trade (4,204) | 55 `sector_relative_regularity_z` | 1.28 / 0.15 | 0.00 / 1.00 |
| retail_trade (4,204) | 56 `sector_relative_volatility_z` | 0.05 / 0.98 | −0.00 / 1.00 |
| retail_trade (4,204) | 57 `sector_relative_days_negative_z` | −0.08 / 0.86 | 0.00 / 1.00 |
| retail_trade (4,204) | 58 `sector_relative_balance_z` | 0.13 / 1.08 | −0.00 / 1.00 |
| retail_trade (4,204) | 59 `sector_relative_concentration_z` | −0.12 / 0.96 | −0.00 / 1.00 |
| food_beverage (1,555) | 55 | 1.16 / 0.07 | 0.00 / 1.00 |
| food_beverage (1,555) | 56 | 0.24 / 1.34 | −0.00 / 1.00 |
| food_beverage (1,555) | 57 | −0.05 / 0.91 | −0.00 / 1.00 |
| food_beverage (1,555) | 58 | 0.21 / 1.30 | 0.00 / 1.00 |
| food_beverage (1,555) | 59 | −0.10 / 0.94 | −0.00 / 1.00 |
| construction (3,486) | 55 | −0.00 / 1.02 | −0.00 / 1.00 |
| construction (3,486) | 56 | −0.44 / 0.52 | −0.00 / 1.00 |
| construction (3,486) | 57 | −0.06 / 0.95 | 0.00 / 1.00 |
| construction (3,486) | 58 | −0.25 / 0.46 | 0.00 / 1.00 |
| construction (3,486) | 59 | −0.01 / 0.99 | −0.00 / 1.00 |
| professional_services (250) | 55 | −0.01 / 1.00 | −0.00 / 1.00 |
| professional_services (250) | 56 | 0.01 / 0.85 | 0.00 / 1.00 |
| professional_services (250) | 57 | −0.06 / 0.62 | 0.00 / 1.00 |
| professional_services (250) | 58 | 0.03 / 0.86 | −0.00 / 1.00 |
| professional_services (250) | 59 | −0.06 / 0.99 | −0.00 / 1.00 |

The v1 column reproduces the figures above and in entry 30 (55 at 1.28 retail / 1.16 F&B; 59 at
−0.12 / 0.96 retail, −0.10 / 0.94 F&B). Under v2 every sector is at 0 / 1 to two decimals, as it
must be: the stats and the table are built from the same research businesses with a value.

**Finding (2026-11-05, reported, nothing changed): feature 55 is near-degenerate in the POS
sectors.** Two v2 base-feature SDs are below 0.05 and could blow small differences up: feature 3
`inflow_regularity_score` in F&B (mean 0.999367, SD 0.009149) and retail (0.997474, 0.019639).
On the research population, 1,547 of 1,555 F&B businesses (99.5%) and 98.1% of 4,204 retail
businesses have feature 3 exactly 1.0 (daily POS receipts), so 55 is +0.07 (F&B) / +0.13 (retail)
for almost everyone and very negative for the rest: research z min −22.71 (F&B, N = 1,555; 4 distinct
values of feature 3) and −17.60 (retail, N = 4,204; 15 distinct values); serving z min −11.39 (F&B,
N = 148) and −7.33 (retail, N = 409). Mean 0 / SD 1 holds by construction and says nothing about
this shape: 55 behaves as a rare binary flag with very large magnitude in these two sectors. Feature
21 is also below 0.05 in absolute SD (F&B 0.0111, retail 0.0111, professional 0.0456), but that is the
scale of a concentration index, not degeneracy: 21 has one distinct value per business and its z
stays in −1.94 to 7.52 (research, retail N = 4,204), −1.94 to 5.75 (F&B N = 1,555), −1.40 to 5.12
(professional N = 250). No SD is exactly 0 at full scale. The z formula and its 1e-9 SD floor are
unchanged; whether 55 needs a different definition, a floor or exclusion in POS sectors is a decision
for the profile engine and credit lens owners, not made here.

**Filename.** The schema's §35 section names `sector_reference_stats_v1.json`. From this entry on, the
pinned file in use is v2; the schema text is updated at the next team-approved schema edit (see entry
33). v1 is kept so receipts made before this entry can still be reproduced.

**Consequence, stated plainly.** `model_v1.json` was trained on v1 z-features and the pre-entry-30
counterparty features, so credit CV AUC 0.591 and every `docs/NUMBERS.md` row that depends on the
credit model or on 55–59 is stale until the credit lens owner retrains (`python -m
lenses.credit.train`) and records the new numbers. That retrain is the next step. `python -m
eval.check_numbers` still passes (70 numbers) because it compares the register with the committed
artifacts, which this entry did not regenerate. `python -m scenarios.run --check` passes, and the
outcomes it prints for business 10001 already differ from NUMBERS §5b (e.g. `mild_slowdown`,
`late_sudden_shock` and `fraud_pattern` now declined by the risk model; baseline tier C instead of B),
as expected for an unretrained model reading corrected features; §5b is left for the retrain.

**Correction (2026-11-05).** The hashes recorded in entries 35 and 38 (`14026c00…6fae4` for v1,
`042aaebd…7e7a` for v2) were taken from a Windows checkout with `core.autocrlf = true`, which writes
the files with CRLF line endings; `load_reference_stats` hashed the bytes on disk, so the hash depended
on the machine. The canonical, OS-independent hashes, equal to the committed git blobs, are
`7816e2ce3d7afa3612fe34f5c5fac71b2e39106ff4ddd7a6b8632d6199b27a7f` (v1) and
`e7d4beb01d7ffe2583a91a6cad2c53e124ee241391a09137a2e3609b05217f60` (v2). The engine now hashes the file
with CRLF replaced by LF and reports these everywhere, and `.gitattributes` checks both files out with
LF line endings. File contents are unchanged.

**Sign-off:** ☑ profile engine owner (Faris Alsharifi, 2026-11-05) ☑ credit lens owner [Abdulrahman Alharbi; ticked by Ahmed Altunusi on his behalf, verbal agreement 2026-11-10] (retrain after the rebuild) ☑ team [ticked by Ahmed Altunusi on the team's behalf, verbal agreement 2026-11-10]

---

## 36. Forecast + anomaly owner: the §10 holdout-shock test, the §16 Ramadan run, a seasonal gate and a repeat-payment detector — PRE-REGISTERED before any result (2026-11-02)

**Touches (this commit):** this entry, and `eval/heldout_anomalies.py` (one new held-out type, definition
only). No code that measures anything exists yet. Results are added later as 36.6 onward, under this
text, which is not edited after this commit.

**Why one entry.** F2 (holdout shock), F3 (Ramadan run and seasonal gate) and F4 (duplicate detection)
from the owner hand-over all need a definition fixed before the number exists. Writing them together,
in one dated commit, means every later result can be checked against what was promised here.

### 36.1 Holdout-shock lead-time test (§10)

- **Population:** serving (`business_id` 10,001–11,000), minus the three demo businesses (their specs
  are fixed in `config.yaml`) and minus age tier `<1yr` (a thin file has no 90-day history before the
  shock). Serving was never used to choose a forecast method.
- **Generation:** each business is regenerated in memory with its own seed, through a harness-side demo
  spec that sets only `start_date` and `inject_cash_crunch` (the levers the scenario library already
  uses). `config.yaml` and `generator/` are not changed. Per business and window placement: a control
  (no shock), a **30% shock (primary, §10's own example)** and a 50% shock (sensitivity).
- **Shock:** `inject_cash_crunch` at week 14, so revenue drops from day 92 to day 180 (1-based). That
  leaves 91 days of history before the shock (at least the 90-day fit window) and 89 days after it.
- **Event:** the first day E ≥ 92 on which the shocked series' actual end-of-day balance is below zero.
  A business counts as a shock-caused crunch only if its control series stays at or above zero from day
  92 to day 180. All other businesses are counted in the table and left out of the lead-time numbers.
- **Detection (projection only):** for every as-of day t from 92 to E − 1, each method is fitted on the
  history up to t and projects 30 days. The method has detected the crunch if the projected balance is
  below zero on any of those 30 days. D is the first such t. **Lead time = E − D days.** No detection
  before E counts as a miss, with lead time 0. The engine's liquidity hazard (features 52–54) is left
  out on purpose: both methods would read the identical hazard number, so it cannot separate them, and
  the profile engine would have to be re-run at every as-of day.
- **Methods compared:** `naive90` (the shipped method, entry 27) and `naive30` (the §10 baseline), from
  `lenses/forecast/methods.py`, the same functions the lens runs.
- **False alarms:** the same procedure on the control series of businesses whose control balance never
  goes below zero from day 92 to day 180. The share with any detection at as-of days 92–150 (the last
  day whose 30-day projection stays inside the window).
- **Reported:** per method, N, detection rate, median and interquartile range of lead time (misses as 0),
  false-alarm rate; and paired, the share of businesses where `naive90` detects earlier, at the same
  day, or later than `naive30`, with the median paired difference and a bootstrap 95% interval (2,000
  resamples, seed 0).
- **No method change follows from this test.** Entry 27 chose `naive90` on accuracy. This test measures
  what that choice costs in warning time. Switching method because of it would turn this test into a
  second selection. A future change needs its own protocol with the criterion declared first.
- **Chart** (`eval/out/holdout_shock.png`): (a) one business, chosen by a rule fixed now so it is not
  hand-picked: the lowest `business_id` in the neutral 30% run with a shock-caused crunch. It shows the
  actual balance with and without the shock, and the `naive90` and `naive30` projections made at as-of
  day 106 (shock + 14), with markers for the shock, each method's detection day and the event. (b) The
  lead-time distribution of both methods across the population.

### 36.2 Ramadan-window run (§16)

- **Two placements, the same businesses:** neutral, `start_date` 2025-08-01 (the window ends
  2026-01-27, with no Ramadan or Eid, as for demo business 10002); and Ramadan, `start_date` 2025-11-19,
  so day 92 is 2026-02-18, the first day of Ramadan 1447. Ramadan and Eid then cover days 92–124, and
  the pre-Ramadan days 82–91 sit inside the fit window.
- The shock starts on the first day of Ramadan on purpose. For a sector whose Ramadan sales rise
  (retail, value ×1.34 in `config.yaml`), the seasonal lift can hide the drop. For one whose sales fall
  (food and beverage, ×0.82), the season adds to it. So the 36.1 table is reported for both placements
  side by side, and also by sector.
- **Limitation, stated and not engineered around:** `ramadan_adjusted` (feature 36) is a coarse flag
  (§16). The forecast lens makes no seasonal correction, and this run does not add one.

### 36.3 Anomaly seasonal gate (§16)

- **What exists today:** the anomaly lens reads neither feature 36 nor any calendar, so "false-positive
  rate with and without the seasonal gate" cannot be measured until a gate is defined. It is defined
  here.
- **The gate** (`lens_config.anomaly.seasonal_gate`): when on, the amount z-score is computed within
  (direction, category, season) instead of (direction, category), where season means inside a
  Ramadan-to-Eid window. The windows are the pinned ones feature 36 already uses
  (`profile_engine.compute.ramadan_from_config`), so the lens does not bring a calendar of its own. A
  seasonal group with fewer than 5 rows falls back to (direction, category), as small groups do today.
  No rule is switched off, so a large transfer during Ramadan still flags.
- **Why this form:** Ramadan brings fewer, larger baskets (SAMA POS, `config.yaml` §22 block), so a
  year-round amount baseline marks ordinary Ramadan sales as large. Suppressing the amount rule during
  Ramadan was the alternative; it was rejected because it would blind the lens for a month.
- **False-positive measurement:** on the control series of the 36.1 businesses (no injected or held-out
  rows, so every flag is a false positive by construction), with the gate off and on:
  1. *Seasonal flag excess* (Ramadan placement only): the share of flags dated inside the season,
     divided by the share of scanned transactions dated inside it. 1.0 means no seasonal bias.
  2. *Rule hits before the cap:* transactions breaking a hard rule (amount z or rare hour) per 1,000
     scanned, inside and outside the season, in both placements. Computed in the harness from the
     lens's own feature table; nothing new leaves the API.
- **Decision rule, fixed now:** the gate ships on if the seasonal flag excess falls with the gate and
  injected-type recall (`eval.anomaly_eval`, injected types only) does not fall. Held-out recall is
  re-run after that decision and reported. It is never used to make it.

### 36.4 Repeat-payment detector and a new held-out type (§12)

- **Order:** the new held-out type is defined in this commit. The detector is written in a later one.
- **New held-out type `late_repeat_charge`** (`eval/heldout_anomalies.py`): an existing supplier payment
  charged again by the same counterparty 1–7 days later, at 97–103% of the original amount, at an
  ordinary business hour (9–16). It stands for a re-sent or re-billed invoice. It differs from the
  existing held-out type, which repeats the same amount on the same day.
- **Detector, fixed now:** a hard rule with `flag_reason` `repeat_payment`. An outflow is flagged when
  an earlier outflow in the scan window has the same counterparty, an amount within 1%, and a date 0–3
  days earlier, and the outflow is not part of a recurring series. It is listed with the other hard-rule
  flags. It is not added to the Isolation Forest, so other results move only through the order of the
  10-flag list. The tolerances follow ordinary accounts-payable duplicate checks (same vendor, same
  amount, a short gap); they were not fitted to anything.
- **Overlap stated before the result:** by construction, at most about 3/7 × 1/3 ≈ 14% of
  `late_repeat_charge` rows fall inside the rule (lag 1–3 days of 1–7, amount within 1% of a ±3% band).
  Recall above that would have to come from the forest or another rule. A low number is the expected
  honest result, not a reason to widen the rule.
- **Reporting:** the existing held-out recall of 0.06 for the same-day repeat stays on record as the
  result before any repeat detector. Once the detector exists, the same-day type is something the
  detector was designed for, so its new recall is reported as designed-for, not held-out.
  `late_repeat_charge` and `round_trip_transfer` stay held-out. `assert_held_out()` must still pass; the
  detector code never names a held-out type.

### 36.5 Positions on the parameters already PROPOSED (entries 23.3, 27, 29)

- **No parameter in `lens_config.yaml` changes** (amount z 3.0, rare-hour share 0.01, contamination
  0.01, at most 10 flags, 180-day scan, hazard watch 0.2 and alert 0.5). Each is a convention or a
  product setting, not a fitted value. Changing one now would happen after the demo output and the
  held-out results were seen, which is retuning.
- **Entry 29 finding 4 (always 10 flags):** the cap stays. The flags are a review queue, ordered most
  unusual first, not a count of alarms, and the demo must say so. A shorter list would need a
  materiality rule or a lower contamination, designed on injected types only and pre-registered. It is
  not planned this term.
- **F5:** the flags on small ordinary sales (SAR 111–164 on business 10001) are reported as noise. No
  rule is changed to remove them.
- **F6:** no new forecast candidate (Prophet or ARIMA) this term. It would add a dependency, and on
  noisy flows with small trends a longer average is the expected winner. `naive90` stays.

**Sign-off:** ☑ forecast + anomaly owner [Abdulelah Alsalamah; ticked by Ahmed Altunusi on his behalf, verbal agreement 2026-11-10] (36.1–36.5) ☑ generator owner [Ahmed Altunusi, 2026-11-10] (36.1 uses the crunch lever and
the window-start override from the harness; no generator change) ☑ team [ticked by Ahmed Altunusi on the team's behalf, verbal agreement 2026-11-10]

### 36.6 RESULT — holdout shock and Ramadan run (2026-11-02), definitions as in 36.1–36.2, nothing changed

`python -m eval.holdout_shock` → `eval/out/holdout_shock.md`, `holdout_shock.png`,
`holdout_shock_per_business.csv`. Serving, N = 751 after the 36.1 exclusions. A re-run gave identical
tables. Full-scale data was regenerated locally and checked against the team's: `scenarios.run --check`
confirms business 10001 matches in every value, and `eval.anomaly_eval` reproduced the committed
held-out rows exactly.

| window, shock | shock-caused crunches | detected: `naive90` / `naive30` | median lead, days: `naive90` / `naive30` | false alarms on the control: `naive90` / `naive30` | paired median difference (90 − 30) [95% CI] |
|---|---|---|---|---|---|
| neutral, 30% (primary) | 27 | 88.9% / 96.3% | 15 / 27 | 3.8% / 8.3% (of 636) | −1 [−4, 0] |
| neutral, 50% | 39 | 69.2% / 82.1% | 13 / 26 | 3.8% / 8.3% | −1 [−14, 0] |
| Ramadan, 30% | 26 | 84.6% / 92.3% | 18 / 32 | 3.7% / 10.4% (of 616) | −6 [−11, 0] |
| Ramadan, 50% | 43 | 83.7% / 93.0% | 20 / 35 | 3.7% / 10.4% | −9 [−17, −4] |

What it says:
- **The shipped method warns later than the baseline.** At the primary setting `naive90` catches 88.9%
  of shock-caused crunches with a median 15 days' warning; `naive30` catches 96.3% with 27 days. A longer
  average lags a sudden drop by construction. This is the cost of entry 27's accuracy win, now measured,
  and it is the population version of entry 29 finding 3.
- **The baseline's earlier warnings are not free:** it raises about twice the false alarms on the same
  businesses without a shock (8.3% vs 3.8%; 10.4% vs 3.7% in the Ramadan window). So this is a trade-off
  between warning time and false alarms, not a loss on every count.
- **At the primary setting the paired gap is small and its interval reaches zero** (−1 day [−4, 0]). Over
  the Ramadan window it widens, and at the 50% shock it excludes zero (−9 days [−17, −4]). `naive30`'s
  false alarms also rise in the Ramadan window while `naive90`'s do not.
- **Few shocks cause a crunch.** A 30% revenue cut for 89 days pushes only 27 of 751 businesses below
  zero when their unshocked balance would have stayed positive; 107 more went negative but would have
  anyway, and are excluded by the 36.1 rule. Every interval here rests on 26–43 businesses.
- **By sector** (30%, in the report): construction is where `naive90` lags most (median 4 vs 36 days,
  neutral window, 6 businesses). Professional services had no shock-caused crunch.
- The chart's panel (a) business, 10063 (construction), was picked by the 36.1 rule. It happens to be a
  case `naive90` missed and `naive30` caught on day 93, so it is not a typical business; panel (b) is the
  population view and must be shown with it.

**No method change** (36.1). The liquidity hazard was left out of this test, so the lens's full crunch
alert, which also reads features 52–54, may warn earlier than either projection alone; that was not
measured here.

### 36.7 RESULT — seasonal gate: false positives with and without it (2026-11-02); gate switched ON by the 36.3 rule

`python -m eval.anomaly_seasonal` → `eval/out/anomaly_seasonal.md`. Control series of the 36.1 sample
(serving, N = 751), so every flag is a false positive.

| window | gate | seasonal flag excess | rule hits per 1,000, in season | rule hits per 1,000, out of season |
|---|---|---|---|---|
| Ramadan | off | **1.37** (24.1% of flags in season vs 17.6% of transactions) | 7.42 | 2.99 |
| Ramadan | on | **1.02** (17.9% vs 17.6%) | 4.47 | 3.62 |
| neutral | off / on | — (no season in the window) | — | 3.48 / 3.48 |

Injected-type recall, demo business: 2 of 2 with the gate off and on.

- **The seasonal false positives were real.** Without the gate, ordinary Ramadan transactions broke a
  hard rule 2.5 times as often as the rest of the year (7.42 vs 2.99 per 1,000) and took 37% more than
  their share of the 10-flag list. With the gate, the Ramadan share of flags matches the Ramadan share of
  transactions (excess 1.02).
- **Decision by the 36.3 rule:** the excess fell and injected recall did not, so `seasonal_gate` is now
  `true` in `lens_config.yaml`. Held-out recall was not computed before this switch; it is in 36.8.
- **Cost, stated:** rule hits outside the season rise from 2.99 to 3.62 per 1,000. Taking the larger
  Ramadan baskets out of the year-round baseline makes that baseline tighter, so slightly more ordinary
  out-of-season amounts now cross z 3.0. Because the list is capped at 10, the total number of flags
  barely moves (6,567 vs 6,656); what changes is which days they fall on.
- In the neutral window the gate changes nothing, as designed (no day is in season).
- A 10-business smoke test before the full run showed the opposite direction (excess 0.93 → 1.24). It
  was a small-sample artefact, and it is mentioned only so nobody quotes it.

### 36.8 RESULT — held-out evaluation with the gate on, and the repeat-payment rule (2026-11-02)

`python -m eval.anomaly_eval` (shipped configuration: gate on, repeat rule off) →
`eval/out/anomaly_eval.md`; `python -m eval.anomaly_eval --with repeat_payment_rule=true` →
`eval/out/anomaly_eval_repeat_rule.md`. Serving, 50 businesses per held-out type, seed 7, K = 10.
New column `rule_hit_before_cap`: the share of rows a hard rule fired on before the list was cut to 10.

| type | status | recall@10, shipped | recall@10, repeat rule on | rule hit before the cap, repeat rule on |
|---|---|---|---|---|
| `round_trip_transfer` | held-out | **0.93** (was 0.92 before the gate) | 0.86 | 0.77 |
| `duplicate_payment` (same day, same amount) | held-out while the rule is off; **designed-for** once it is on | 0.06 | 0.60 | 0.78 |
| `late_repeat_charge` (new, 36.4) | held-out | 0.00 | **0.02** | 0.04 |
| injected `large_transfer`, `odd_hours_transaction` | injected | 2 of 2 (ranks 1, 5) | 2 of 2 | 2 of 2 |

Hard-rule hits on the 861 clean serving businesses (no held-out row, so every hit is a false positive):
amount rule 3.18 per 1,000 transactions, rare hour 1.59, **repeat rule 3.31, in 754 of the 861
businesses**.

What it says:
- **The gate did not hurt the held-out results.** Round-trip recall moved from 0.92 to 0.93 and the
  same-day duplicate stayed at 0.06.
- **The repeat rule finds what it was built for, partly.** It fires on 78% of same-day duplicates, and 60%
  reach the 10-flag list; the other 18% are cut by the cap. That 0.60 is a designed-for number, not a
  held-out result, and must never be quoted as one.
- **It does not generalise.** On the held-out late repeat it reaches 0.02, below even the at-most-14%
  overlap stated in 36.4 (the recurring-series exclusion removes some of that overlap).
- **It is noisy.** On clean businesses it fires 3.31 times per 1,000 transactions, more than the amount
  rule, because a business paying the same few suppliers several times a week produces amounts within 1%
  inside 3 days by coincidence. Those false hits compete for the 10 slots, which is why round-trip recall
  falls from 0.93 to 0.86 with the rule on.

**Shipping decision — OPEN for the owner, recommended OFF.** Entry 36.4 fixed the detector but wrote no
rule for switching it on, and the numbers above, including held-out ones, were seen before this
recommendation, so it cannot claim to be blind to them. It rests on the clean-business false positives
and the round-trip loss, and it keeps the shipped state unchanged (`repeat_payment_rule: false`), which
is the conservative choice. A tighter variant (for example an exact amount on the same day) would need
its own pre-registration and **another new held-out type defined first**, because `late_repeat_charge`
has now been seen.

**F5, precision stated plainly.** Precision@10 sits near its ceiling for round-trip transfers (0.2141 of
0.2283) because each affected business holds two round-trip rows; for single-row types the ceiling is
about 0.1 and the lens reaches it only when it catches the row. Most of every list is ordinary activity:
on clean businesses the hard rules alone produce about 4.8 false hits per 1,000 transactions, before the
forest adds its own. The flags are a review queue ordered by unusualness, not alarms (36.5).

**Sign-off:** ☑ forecast + anomaly owner [Abdulelah Alsalamah; ticked by Ahmed Altunusi on his behalf, verbal agreement 2026-11-10] (36.6–36.8, and the open repeat-rule decision)

### 36.9 Re-run checks after the lens change (2026-11-02)

- `eval.forecast_backtest` reproduces `eval/out/forecast_backtest.md` exactly (the forecast lens is
  unchanged). `eval.check_numbers` is current, and `eval.week8_check` and `scenarios.run --check` pass
  with the gate on.
- `eval.latency_test` passes with the gate on, all 93 tests pass with the serving store built, and the
  API answers equal the CLI's. The anomaly route's maximum was 1,148 ms on a 2-core, 7 GB machine,
  under the 2 s target. `eval/out/latency_week7.md` and NUMBERS §6b were **not** replaced, because
  timings from a different machine are not comparable. The owner should re-run the test on the team
  machine and update both.
- This machine could not hold a full-scale generation or profile run in memory, so both were run in
  business-ID chunks (scratch scripts, not committed). This is exact because every business is generated
  and profiled from RNG keyed on its own ID, with the generator's latent rank computed over all 11,000.
  Checks: `scenarios.run --check` confirms business 10001 matches the full generation in every value;
  `eval.anomaly_eval` reproduced the committed held-out rows; and the backtest above reproduced exactly.

---

## 37. Four repeat-payment detector variants compared, chosen on seen types, reported once on two new types — PRE-REGISTERED before any result (2026-11-02)

**Touches (this commit):** this entry, and `eval/heldout_anomalies.py` (two new test-only held-out types,
definition only). No variant code exists yet.

**Why.** Entry 36.8 left the repeat-payment rule off: it was noisy on clean businesses and reached 0.02 on
the held-out late repeat. The owner asked for four options to be tried and compared. Both repeat-like
held-out types have now been seen, so choosing a variant by its score on them would flatter the winner.
This entry uses the forecast protocol of entry 27: choose on one set, report once on another.

### 37.1 The four variants (`lens_config.anomaly.repeat_payment_mode`)

All four share the existing exclusions: outflows only, a counterparty present, not part of a recurring
series.
- **`off`** — no repeat signal. The shipped state, and the baseline every variant must beat.
- **`exact`** (hard rule) — an outflow with the same counterparty and the identical amount (to the
  halala) as an earlier outflow on the same calendar day.
- **`rarity`** (hard rule) — the entry 36.4 rule (same counterparty, amount within 1%, 0–3 days later),
  flagged only when such a close match is rare for that counterparty: among all pairs of that
  counterparty's outflows in the scan window, the share whose amounts are within 1% of each other must be
  below 0.01. A business that pays one supplier near-identical amounts all the time gets no flag from a
  coincidence. The 0.01 matches the existing rare-hour and rare-category cut-offs; it is not fitted.
- **`forest_feature`** — the entry 36.4 signal is added to the Isolation Forest as a seventh binary input
  and is not a hard rule, so the forest weighs it with everything else and it cannot claim a flag slot on
  its own.

### 37.2 Choosing (validation)

- **Data:** the entry 36.8 run — serving, `anomaly_eval` seed 7, 50 businesses per type, K = 10, seasonal
  gate on — scored for every variant.
- **Seen types used to choose:** `duplicate_payment` (same day, same amount) and `late_repeat_charge`.
- **Guard rails, both must hold:** (a) held-out `round_trip_transfer` recall at least 0.90 (no more than
  0.03 below the shipped 0.93); (b) on clean serving businesses (no anomaly row), at most 1.0 flag per
  business carrying the repeat signal, so false repeat flags take at most one of the ten review slots on
  average.
- **Choice:** among the variants passing both, the highest mean recall@10 over the two seen types; a tie
  goes to fewer clean repeat flags. If no variant beats `off` on that mean while passing the guard rails,
  `off` is chosen, and that is the result.

### 37.3 Reporting once (test)

- **Two new held-out types, defined in this commit and injected only with `--final-test`:**
  - `resent_payment`: an existing supplier payment sent again to the same counterparty, at exactly the
    same amount, 1–2 days later, at an ordinary hour (9–16).
  - `vendor_record_duplicate`: an existing supplier payment paid again at exactly the same amount, the
    same day or the next, to a second counterparty ID for the same supplier (a duplicate vendor record),
    so no counterparty-keyed rule can see the pair.
- They are drawn after every existing block, on their own businesses, so all earlier injections are
  unchanged. The validation runs never inject them.
- Reported once, for the chosen variant and for `off`, with recall@10, precision@10 and ceiling,
  round-trip recall and clean repeat flags. Nothing is changed after this report.
- **Expected limits, stated now:** `exact` cannot see `resent_payment` (a different day). No variant can
  see `vendor_record_duplicate` through the repeat signal, because every variant keys on the
  counterparty; it is included to measure that blind spot, not to be won.

### 37.4 What would change the shipped lens

`repeat_payment_mode` in `lens_config.yaml` changes only to the variant chosen under 37.2, and only after
the 37.3 report exists, recorded in this entry. If `off` is chosen, nothing ships.

**Sign-off:** ☑ forecast + anomaly owner [Abdulelah Alsalamah; ticked by Ahmed Altunusi on his behalf, verbal agreement 2026-11-10] ☑ team [ticked by Ahmed Altunusi on the team's behalf, verbal agreement 2026-11-10]

### 37.5 RESULT — `exact` chosen; adds nothing on the unseen types; shipped (2026-11-02)

`python -m eval.repeat_variants` → `eval/out/repeat_variants.md`. Validation, then one test run, as in
37.2–37.3.

| variant | same-day duplicate (seen) | late repeat (seen) | round-trip | repeat flags per clean business | clean businesses with one |
|---|---|---|---|---|---|
| `off` | 0.06 | 0.00 | 0.93 | 0.00 | 0 |
| **`exact`** | **0.66** | 0.00 | 0.93 | **0.00** | 0 |
| `rarity` | 0.18 | 0.00 | 0.90 | 0.46 | 272 |
| `forest_feature` | 0.26 | 0.02 | 0.93 | 0.40 | 167 |
| `window` (36.4, reference only) | 0.60 | 0.02 | 0.86 | 2.44 | 684 |

**Chosen by the 37.2 rule: `exact`** (highest mean over the two seen types, both guard rails passed).

**Test, reported once:** `resent_payment` recall@10 0.00 with `exact` and 0.00 with `off`;
`vendor_record_duplicate` 0.04 with both (the same rows, caught by other rules).

What it says:
- **`exact` is a narrow, clean check.** It catches two-thirds of same-day, same-amount repeats with no
  repeat flag at all on 861 clean businesses and no loss of round-trip recall. The same-day duplicate is
  a seen type, so 0.66 is a validation number for what `exact` was designed to find, not a held-out
  result.
- **It does not generalise, as stated before the run.** A payment re-sent one or two days later is
  invisible to it (0.00), and so is a duplicate paid under a second supplier ID (no change from `off`).
  On unseen types, shipping `exact` changes nothing.
- **Why the others lost.** `rarity` removed most coincidences but also most real duplicates (0.60 under
  `window` down to 0.18). About half of all counterparties sit at or above the 0.01 cut-off (median
  close-match rate 0.010 in a 60-business check on `data/quick`), so a duplicate paid to any of them is
  filtered out with the coincidences. `forest_feature` made the forest weigh the signal, but a repeat is ordinary in every
  other column, so the forest isolated only some of them (0.26), at 0.40 false repeat flags per business.
- **The zero false flags for `exact` is a property of this synthetic data.** The generator never creates
  two identical same-day supplier payments unless one is injected. Real data does: one user's bank feed
  marked several genuine same-day, same-amount charges from one registrar as duplicates
  (`docs/research/duplicate_payment_detection.md` §3). Expect some false `repeat_payment` flags on real
  transactions.

**Shipped (37.4):** `repeat_payment_mode: "exact"` in `lens_config.yaml`. With it on, the shipped
`eval/out/anomaly_eval.md` labels the same-day type designed-for. Quote "same-day exact duplicates are
caught; re-sent and vendor-record duplicates are not", never a single "duplicate recall" figure.
`docs/research/duplicate_payment_detection.md` records how other tools approach this, and why most of
them depend on invoice numbers and vendor records that a bank-transaction lens does not see.

### 37.6 Latency with the exact check on (2026-11-02)

`eval.latency_test` passes, and the API answers equal the CLI's on the demo businesses. On the same
2-core, 7 GB machine as 36.9, the anomaly route measured p50 482 ms and maximum 1,271 ms (was 1,148 ms
with the gate alone), still under the 2 s target. The credit route maximum was 626 ms. As in 36.9,
`eval/out/latency_week7.md` and NUMBERS §6b are left for the owner to re-time on the team machine;
timings across machines are not comparable.

---

## 38. Features 55-59: z-scores clipped at ±3 before the credit retrain — PROPOSED (profile engine owner), credit lens owner to sign (2026-11-05)

**Touches:** features 55–59 (§35), `profile_engine/features.py` `_fill_zscores` (line 657 computes
`(v − mean) / max(std, 1e-9)`), the credit lens (55–59 are inputs to a logistic model). Not the v2
stats file, not the null reasons.

**Finding (entry 35's result, re-checked against `data/profiles.csv` and
`sector_reference_stats_v2.json`, sha256 `042aaebd…7e7a`, on 2026-11-05).** Feature 3
`inflow_regularity_score` is exactly 1.0 for 1,547 of 1,555 F&B research businesses (99.5%) and 4,123
of 4,204 retail research businesses (98.1%): daily POS receipts make the gaps between inflow days
constant. So v2's feature 3 SD is 0.009149 in F&B (mean 0.999367) and 0.019639 in retail (mean
0.997474), as `eval/out/reference_stats_drift_pinned_vs_current.csv` records, and feature 55 is
about +0.07 (F&B) / +0.13 (retail) for almost everyone and very large and negative for the few
below 1.0:

| Sector | Population (N) | Lowest feature 3 | Lowest z (55) |
|---|---|---|---|
| food_beverage | research (1,555) | 0.791604 (business 528) | −22.71 |
| food_beverage | serving (148) | 0.895198 (business 10507) | −11.39 |
| retail_trade | research (4,204) | 0.651827 (business 188) | −17.60 |
| retail_trade | serving (409) | 0.853501 (business 10993) | −7.33 |

N is the businesses with a value (scored + partial_profile). The engine's 55 equals z recomputed from
feature 3 against v2 to 8.9e-16. Construction and professional services are not affected (feature 3
SD 0.133 and 0.130; lowest z −1.08 and −1.52).

**Why it matters.** `lenses/credit/model_v1.json` is a logistic regression (L2, C = 1.0) on
median-imputed, standardised features: contribution = `coef × (x − mean) / scale`, in log-odds
(`lenses/credit/model.py` `score`). For feature 55 it stores `coef` −0.399718, `mean` 0.753078,
`scale` 0.890708, no log transform. Computed with that standardisation (and checked with `score()`
itself), the contribution of feature 55 alone for the business with the most negative z in each sector:

| Sector | Research: business, z → log-odds | Serving: business, z → log-odds |
|---|---|---|
| food_beverage | 528, −22.71 → **+10.53** | 10507, −11.39 → **+5.45** |
| retail_trade | 188, −17.60 → **+8.24** | 10993, −7.33 → **+3.63** |
| construction | 4, −1.08 → +0.82 | 10009, −1.08 → +0.82 |
| professional_services | 174, −1.52 → +1.02 | 10255, −1.52 → +1.02 |

For comparison, the typical POS business (z +0.07 F&B, +0.13 retail) gets +0.31 / +0.28, and z = −3
would give +1.68. A logistic model is linear in z, so one slightly irregular POS business can carry a
contribution several times the whole spread of the other features. `model_v1.json` was trained on v1,
where 55 in these sectors had mean 1.16–1.28 and SD 0.07–0.15 (entry 35), so these values are outside
anything it saw; a retrain on v2 as it stands would fit 55's coefficient on these few extreme values.
Nothing was retrained.

**Decision proposed by the profile engine owner.** Clip each of 55–59 to [−3, +3] in the engine, all
sectors, all sources, after the z is computed against the pinned stats. The v2 stats file is unchanged.
Null reasons are unchanged. 3 is a conventional bound, chosen now from the distribution above, before
any credit result on v2 exists.

**Rule fixed now:** the credit AUC after the retrain is reported whichever way it moves, and this bound
is not revisited because of it.

**Alternatives considered:**
- Keep as is: leaves a few POS businesses with a single-feature contribution of +3.6 to +10.5 log-odds.
- Null 55 in retail and F&B: missingness would become a sector signal, the problem entry 30 avoided.
- A different definition of feature 3: a schema change, too late for this retrain.

**To be reported after implementation, stated now:** per sector and per feature 55–59, how many
research and how many serving businesses are clipped, with N.

**Status: PROPOSED.** Implementation waits for the credit lens owner's line. The retrain must not run
before this entry is settled. The schema §35 text is updated at the next team-approved schema edit
(entry 33).

**Hash correction (2026-11-05):** `042aaebd…7e7a` above is the Windows CRLF hash of v2; the canonical hash is `e7d4beb0…7f60` (entry 35, correction 2026-11-05).

**Credit lens owner's decision (Abdulrahman Alharbi, 2026-11-07), recorded before any credit result
on v2 exists:** accepted as proposed, subject to the schema edit and the team sign-off below. Features
55–59 are clipped to [−3, +3] in the engine (`profile_engine/features.py`, `Z_CLIP = 3.0`), all sectors,
all sources, after the z is computed against the pinned v2 stats. Checked before signing:
1. §35 defines 55–59 as `(feature − μ) / max(σ, ε)` with no bound, so this is a definition change, not
   something the schema already permits. The §35 text follows at the next team-approved schema edit
   (entry 33). §35 also says the layer must not be retrofitted after Week 8; the clip changes the range
   of the §35 layer, not its existence, and the team box below is where that reading is accepted.
2. The bound was committed in `823ff74` (2026-11-05 22:24 +0300); `lenses/credit/model_v1.json` was last
   changed on 2026-10-11, and no credit AUC on v2 is recorded in this file or in `eval/out/`.
3. `_fill_zscores` is the only place 55–59 are computed. Training (`profile_engine.compute`), Week 8 and
   the API store (`pipeline/data.py`) and the scenarios all reach it through `compute_profiles`, and the
   credit scorer only standardises what the engine returns, so training and serving clip identically.
4. The anomaly lens does not read feature 59 in code, despite §35's "Used by: Credit, Anomaly", so the
   anomaly owner bears no consequence. `eval/reference_stats_drift.py` now compares the engine with the
   clipped recomputation (its z moments stay unclipped, describing the reference fit). Week 8 objects,
   receipts, NUMBERS §5b and the API store move with the retrain, as they already do for entry 30.
5. The v2 file (canonical sha256 `e7d4beb0…7f60`) and base features 3, 11, 13, 16, 21 in `profiles.csv`
   are unchanged, so the unclipped z stays recomputable for audit.

On quick data (`data/quick`, 300 + 300 businesses) the bound also binds on the upper tails of 56–59 in
every sector, construction included, not only on the lower tail of 55 in retail and F&B. These are
small-sample counts and are not reported as results. The full-scale counts per sector and feature,
research and serving, with N, are written by `python -m eval.reference_stats_drift` to
`eval/out/reference_stats_clip_counts.csv` and are reported here after the full-scale profile run.

**Implemented (2026-11-07):** `profile_engine/features.py` (`Z_CLIP`, clip in `_fill_zscores`),
`eval/reference_stats_drift.py` (clipped engine check, clip-count CSV),
`tests/test_reference_stats.py` (new clip test). `python -m pytest tests`: 105 passed, 14 skipped (API
tests skip without the serving store); `ruff check .` clean. On quick data the engine's 55–59 equal the
clipped recomputation against v2 to 8.8e-15. Nothing retrained.

**Rule restated:** the credit AUC after the retrain is reported whichever way it moves, and the bound is
not revisited because of it. The retrain waits for the team box.

**Reported after implementation (full scale, from `79160cb`, recorded 2026-11-08).**
- **Clip counts** (`eval/out/reference_stats_clip_counts.csv`, per sector and feature with N): research
  843 of 47,475 z values clipped (1.8%), serving 79 of 4,715 (1.7%). Largest research cells: retail 57
  138 high / 4,204; construction 56 93 high / 3,486; retail 56 88 high; retail 55 81 low; construction 58
  77 (6 low, 71 high); retail 58 69 high; construction 59 66 high. As the quick run suggested, most clips
  are on the upper tails of 56–59, not on the lower tail of 55.
- **Credit retrain** (`python -m lenses.credit.train`, hyperparameters, labels and protocol unchanged):
  CV AUC **0.5911 [0.5842, 0.5996]** (research, scorable, N = 9,495 / 449 defaults, repeated stratified
  group 5-fold × 20) against 0.5912 [0.5841, 0.5985] before; oracle ceiling 0.6660 unchanged (labels
  unchanged), 88.8% of ceiling; serving check **0.628 [0.536, 0.710]** (943 / 45) against 0.643. The
  artifact changed (sha256 `c7b6f733…f982` → `7ed936b6…9274`, intercept −3.151 → −3.142). Entries 30, 35
  and 38 were applied together, so this change cannot be attributed to any one of them.
- The retrain commit (`79160cb`, 22:45) precedes the commit recording the team box (`67a5779`, 22:50,
  2026-11-07). The team approved the entry 38 clip before the retrain ran; the
  approval was committed afterwards (credit lens owner, confirmed 2026-11-08).

**Sign-off:** ☑ profile engine owner (Faris Alsharifi, 2026-11-05) ☑ credit lens owner (Abdulrahman Alharbi, 2026-11-07) ☑ team (approval confirmed 2026-11-07)

---

## 39. Two counts of "insufficient_data": the Week 3 gate and the profile engine use different windows — FINDING (2026-11-05)

**Touches:** `eval/gate_week3.py`, `profile_engine/features.py`, `docs/NUMBERS.md` §2 and §6. No change.

**The two counts** (full-scale data generated 2026-11-05, 11,000 businesses): the Week 3 gate prints
"9914 scorable businesses; 1086 excluded as insufficient_data" (as NUMBERS §6 records); the engine's
`profile_status.csv` has 562 `insufficient_data` (research 505, serving 57), so research scorable is
9,495, A1's N.

**What each one measures.** Both count "active days" (a day with any inflow or outflow) in a trailing
90-day window and require at least 60. They differ in where the window ends:
- **Gate** (`eval/gate_week3.py` `profile_features`, lines 74–110): the 90 days ending at the
  business's **last month-end** in `balances_monthly` (lines 82–83); active days at line 97; the
  60-day threshold `MIN_COVERAGE` (line 49) applied at line 169 (criterion 1, research + serving) and
  line 205 (criterion 2, research only).
- **Engine** (`profile_engine/features.py` `daily_features`, lines 158–167): the 90 days ending at the
  business's **as-of date** `businesses.window_end`, never before `operating_start_date` (line 158);
  threshold `coverage_min_days_by_source` from `config.yaml` (60 for synthetic, entry 9).

The last month-end is 27 to 30 days (median 30) before `window_end`, so the gate looks at a window about
a month earlier. Recomputed on the same data: the gate's window gives 1,086 businesses below 60 days,
the engine's gives 562; the operating-start filter changes neither count. The engine's definition is
the §15 rule as the lenses apply it; the gate's is its own reimplementation.

**Which numbers in `docs/NUMBERS.md` use which:**
- Gate definition: §6 "Scorable / excluded" (9,914 / 1,086); §6 construction `implied_dso_days`
  (n = 3,679) and professional `implied_dio_days` (n = 261) (criterion 1); §6 Week 3 gate SKIP
  (professional services 237 businesses / 3 defaults, criterion 2); A9 (0.610).
- Engine definition: A1, A2, A6, A7 (9,495 / 449); A5 (943 / 45, serving); the oracle ceiling
  (9,495); the scorable base default rate (449 / 9,495); the §5 forecast rows (research 9,495, serving
  943, and their subsets 7,525 and 1,164).
- Neither: the Sharia rows (all 10,000 research), the anomaly rows (50 serving businesses per type), the
  §5c holdout shock (N = 751, its own filter).

**A9's N.** NUMBERS gives A9 as "research + serving, scorable, 9,914". The AUC is computed in criterion 2
on research only (line 205): 9,016 businesses by the gate's definition on this data (984 of 10,000
research below 60 days). This generation is byte-identical to the one behind
`eval/out/gate_week3_after_monshaat.txt` except for the entry 30 table, and the gate prints the same
0.610. Recorded here; NUMBERS is not edited in this entry.

**Consequence.** "Scorable" means two different sets in the register: 9,914 of 11,000 (gate) and 9,495
research + 943 serving (engine). The gate's criterion 1 checks run on a set the lenses never score
exactly. Nothing is changed; aligning the gate's window with the engine's, or labelling the two counts
in NUMBERS, is for the owners to decide.

**Profile engine owner position (2026-11-05).** Agreed. The engine's definition (90 days ending at the as-of date) is the one every credit and forecast number uses; A9's population and N should be corrected by its owner.

**Sign-off:** ☑ profile engine owner (Faris Alsharifi, 2026-11-05) ☑ generator owner [Ahmed Altunusi, 2026-11-10]

---

## 40. Receipt hashes depend on the machine's line endings — FINDING + PROPOSED, team to decide (2026-11-05)

**Touches:** `pipeline/week8.py` `_sha()` (line 50) and `data_sha256` (lines 60–69); the other raw-byte
hashers `compliance/sharia.py` `load_rules` (line 38), `scenarios/run.py` (line 53),
`lenses/credit/train.py` (line 46), `eval/compare_real.py` (line 62), `calibration/check_config.py`
(line 44), `eval/reference_stats_drift.py` (line 95); `pipeline/verify.py`, which compares receipt
fields (lines 31–32); a repo-wide `.gitattributes`.

**Finding.** On a Windows checkout with `core.autocrlf = true`, a file stored in git with LF line endings
is written to disk with CRLF, and these functions hash the bytes on disk. So the receipt hash of the
same committed file differs between a Windows checkout and a Linux or Mac checkout. Entry 35's
correction (2026-11-05) fixed this for `reference_stats_sha256` only. In the Week 8 receipt
(`make_context`):
- `lens_config_sha256` (`lenses/lens_config.yaml`, stored LF; `_sha`), `sharia_rules_sha256`
  (`compliance/sharia_rules.yaml`, stored LF; `load_rules`, not `_sha`) and the scenario
  `scenario_library_sha256` (`scenarios/library.yaml`, stored LF) depend on the machine.
- `config_sha256` does not, today, but only by accident: `config.yaml` is stored in git **with CRLF**
  (`git ls-files --eol` shows `i/crlf`), so every checkout hashes CRLF bytes.
- `data_sha256` depends on the machine for a different reason: it hashes `DataFrame.to_csv()`, whose
  line terminator is `os.linesep` (`'\r\n'` on Windows, `'\n'` elsewhere; checked on pandas 2.3.3), so
  `.gitattributes` cannot fix it.
- `output_sha256` (`json.dumps`) and `credit_model_sha256` (read from the model JSON) do not depend on
  the machine.

**Consequence.** `pipeline.verify` compares these fields, so a receipt made on Windows fails verification
on Linux or Mac, and the other way round, although nothing in the decision differs. Reports under
`eval/out/` record Windows hashes (for example `reference_stats_drift.md` shows `14026c00…` and
`042aaebd…`).

**Proposed (team decision, not implemented):**
1. Canonical-LF hashing in `_sha()` (CRLF → LF before hashing), and a repo-wide `.gitattributes` with
   `* text=auto eol=lf` (binary files are detected and left alone).
2. For the team to note: `load_rules` and `scenarios/run.py` do not go through `_sha()` and need the
   same rule; `data_sha256` needs `to_csv(..., lineterminator="\n")`.
3. With `* text=auto eol=lf`, `config.yaml` is renormalised from CRLF to LF in git once, which changes
   `config_sha256` on every machine.
4. Existing Windows-made receipts change hash once (lens config, Sharia rules, scenario library and
   data, as the reference stats already did), so they no longer verify against new runs. The commit that
   makes the switch should be recorded here.

**Implemented (2026-11-10), switch commit `00ae0259e08a1b96f406a46c365bdd150ecd4c98`** (option C: items 1 and 2 above,
with item 3 accepted). `_sha` and `data_sha256` (`pipeline/week8.py`), `load_rules`
(`compliance/sharia.py`) and `load_library` (`scenarios/run.py`) hash canonical LF; `data_sha256` writes
CSV with `lineterminator="\n"`. `.gitattributes` has `* text=auto eol=lf`; 76 text files stored with CRLF,
`config.yaml` among them, were renormalised to LF in git (line endings only). **One guard beyond the
proposal:** `sources/** -text`. The archived SAMA CSVs are stored with CRLF and their `.sha256` sidecars
hash those bytes, so renormalising them would have broken the source archive on every fresh checkout. With
the guard, all 8 archived files with sidecars match in git and on disk. Before it, the three Monsha'at JSONs
had been checked out CRLF on Windows and did not match their own sidecars.

**What changed for receipts, measured on the demo businesses (Windows, before vs after):** `config_sha256`
`9d60db77…` → `1c28576f…`, `lens_config_sha256` `b8d62751…` → `eb715f89…` (the value a Linux checkout
already produced), `data_sha256` changed; `sharia_rules_sha256`, `credit_model_sha256`,
`reference_stats_sha256` and `output_sha256` unchanged. `python -m pipeline.verify` on the receipts made
before the switch still reproduces every decision byte-identical, and names `config_sha256`,
`lens_config_sha256` and `data_sha256` (and `code_commit`) as changed inputs. New receipts verify with no
changed input. `tests/test_receipt_line_endings.py`: the four strict xfails are now ordinary passing tests.

**Sign-off:** ☑ profile engine owner [Faris Alsharifi; ticked by Ahmed Altunusi on his behalf, verbal agreement 2026-11-10] ☑ generator owner [Ahmed Altunusi, 2026-11-10] ☑ team [ticked by Ahmed Altunusi on the team's behalf, verbal agreement 2026-11-10]

---

## 41. Web UI first pass: Next.js app over the five read-paths; scenario objects verified by integrity + `scenarios.run --check` — PROPOSED (2026-11-06)

**Touches:** new `web/`; `.gitignore`; the README status row. `api/`, `pipeline/`, `lenses/`,
`profile_engine/`, `compliance/`, `scenarios/`, `config.yaml` and the schema are unchanged.

**What was built.** The first pass of the Weeks 9 and 10 UI (§19): a business picker, a dashboard
(credit, Sharia screen, Zakat, forecast, anomaly, profile, a receipt per lens), the §10 Compliance View
toggle, a scenario page for the 8 entries of the entry 29 library next to the baseline, and English and
Arabic with RTL. Next.js App Router, TypeScript strict, Tailwind; run instructions in `web/README.md`.
The Arabic is a first draft, not yet reviewed.

**The API key stays server-side.** The browser talks only to the Next.js server. `web/lib/api.ts` is the
only reader of `MAAL_API_KEY` and imports `server-only`, so no CORS change to `api/` was needed.

**Rules, and how each is enforced and tested** (`web/tests/`, `web/e2e/`):

| # | Rule | Enforced by | Test |
|---|---|---|---|
| U1 | Markup fixed at signing | Strict `credit` schema; `markup_fixed_at_inception` can only be true; no input exists | `U1 a stressed markup field fails the schema`; `U1 the only input in the app is the business picker` |
| U2 | Late penalty charity-directed | Schema accepts only `charity_directed`; shown as returned | `U2 any other late-penalty policy fails the schema` |
| U3 | Zakat and Sharia deterministic | Values as returned; SAR at 2 decimals | `U3 SAR keeps exactly 2 decimals and changes nothing` |
| U4 | No generated text in the Compliance View | The component renders response fields and column labels only | `U4 every table cell is a value from the response`; `U4 snapshot for 10001` |
| U5 | No `eligible` field on a navigator | No navigator built | none needed |
| U6 | Sharia screen is not a determination (entry 26) | One fixed label component | `U6 fixed label and rule_table_status on every state` |
| U7 | Nisab price is a placeholder | Badge from `nisab_source_status` | `U3 U7 computed (10001)` |
| U8 | `flag_reason` only | Strict flag schema; review-queue wording | `U8 a flag carrying a score fails the schema`; `U8 the flags table never says fraud or score` |
| U9 | No peer benchmarking (§36.4) | Features 55–59 listed as raw names and values | `U9 features 55-59 appear as raw names` |
| U10 | `insufficient_data` is explicit (§15) | Schema requires the refusal; one `Refusal` component | `insufficient_data (10003)`; `U10 not_computed (synthetic state)` |
| U11 | Every number carries its population | Line on every card, permanent banner; schema accepts only `serving` | `U11 population and data source are shown`; `renders and passes axe` |
| U12 | Model honesty | AUC and ceiling read from the receipt; findings panel | `U12 AUC and ceiling come from the receipt`; `U12 quotes no number` |
| U13 | Receipt scope | Verbatim where present; `/profile` says it has none | `U13 lens receipt shows scope verbatim`; `U13 /profile receipt says it has no scope field` |
| U14 | WCAG 2.1 AA | Semantic HTML, keyboard toggles, status as glyph plus words, table beside the chart | `renders and passes axe` (axe, 30 pages across both locales) |
| U15 | No personal data, demo scope stated | No accounts or tracking; footer (§18, §29) | `U15 the footer states the demo scope` |

Results: 104 vitest and 48 Playwright tests pass. Eight deliberate breakages each failed the expected
test. Repo pytest and ruff are unchanged (98 passed, 1 xfailed; clean).

**Scenario verification rule.** A scenario object counts as verified when (a) it hashes to its own
`receipt.output_sha256` (`pipeline.week8.output_sha256`), and (b) `python -m scenarios.run --check`
exits 0 (contract, byte-identical re-run, time budget). `pipeline.verify` cannot apply: it re-runs a
decision from the generated `data/`, and a scenario is an in-memory overlay on business 10001, so
its `data_sha256` can never match. All 8 failed it, as expected, including the baseline, because a
single-business run numbers its surrogate IDs from 1 (entry 29). The 8 exported objects pass both checks
(N = 1 each; library sha256 `8f84b917…cc0e7d`, code commit `c571185`).

**Scenario receipts carry a misleading line, for the generator owner.** Their `scope` says
`verify: python -m pipeline.verify <file>`, which does not work on them. The UI shows the scope
verbatim and adds a note under it. Better to change the wording at the source.

**Backend templates are not translated.** `public_tier[].text`, owner prompts, disclosures, conditions,
drivers, rule details, `compliance_explanation` and every `method` string stay in English in an LTR block
in Arabic mode, labelled as pending an Arabic template. They are deterministic templates owned by the
credit and compliance owners (SOP §7 lists Arabic templates as their own work item), and a UI translation
would be a second, unreviewed version. Enum keys with a fixed meaning are UI labels and are translated.

**Finding: the serving store is not safe under concurrent requests.** `api/store.py` shares one DuckDB
connection across request threads. Concurrent requests fail, and some return HTTP 200 computed from
another request's rows. The Week 7 latency result does not cover this.

| Measured | Population, N | Result |
|---|---|---|
| UI run: concurrent `/lenses/zakat` | Quick store (300 serving), 48 requests over 8 businesses, 1 run | 41 HTTP 500; 4 HTTP 200 with a `data_sha256` different from the sequential answer; 3 correct |
| Faris: concurrent Zakat requests | Quick store (300 serving), 48 per run, 3 runs | 41 to 43 HTTP 500 per run |
| Faris: threaded store loads | Quick store (300 serving), 200 loads | 1 load held another business's rows |
| Faris: per-call `cursor()` | Quick store (300 serving), 200 loads, 1 run | 200 of 200 correct |
| Through the UI queue | Quick store, 15 concurrent page loads over 5 businesses | 60 of 60 lens hashes matched; 0 API errors |

The UI works around this: `web/lib/api.ts` sends one API request at a time, and each card still loads
and fails on its own. This makes the dashboard sequential until the store is fixed, which is not what §8
intends. **The fix is the API owner's.** Remove the queue after it.

**Entry 29, one wording correction for its owners.** Finding 1 says the collapse PDs are "no higher than
the baseline's". On the exported objects `combined_crisis` is 0.056133 and the baseline 0.055732, so that
one is slightly higher. The finding's point stands (N = 1 each, and both are declined by affordability,
not by the risk model), and nothing was changed.

**API additions proposed, not built:** the store fix above; `GET /businesses` (id, sector, status) for
the picker; a scenarios route so the page can run them live; daily history for the §10 model vs baseline vs
actual chart, which today draws no actual line; `scope` on `/profile` receipts.

**Open: UI ownership.** SOP §3 names no UI owner.

**Sign-off:** ☑ team [ticked by Ahmed Altunusi on the team's behalf, verbal agreement 2026-11-10] (UI ownership and scope) ☑ API owner [Ahmed Altunusi, 2026-11-10] (store fix, proposed routes) ☑ generator owner [Ahmed Altunusi, 2026-11-10] (scenario verification rule, receipt scope wording) ☑ credit lens owner [Abdulrahman Alharbi; ticked by Ahmed Altunusi on his behalf, verbal agreement 2026-11-10] (Compliance View) ☑ compliance owner [Mohammed Alshaibani; ticked by Ahmed Altunusi on his behalf, verbal agreement 2026-11-10] (Sharia and Zakat panels, Arabic templates)

---

## 42. Web UI redesign to the design bundle; U11 and U15 amended for the demo — PROPOSED (2026-11-06)

**Touches:** `web/` and the README status row. `api/`, `pipeline/`, `lenses/`, `profile_engine/`, `compliance/`,
`scenarios/`, `config.yaml` and the schema are unchanged. Builds on entry 41; rules U1 to U15 are as listed
there, with the two amendments below.

**What changed and why.** The first pass read as generic: every card the same weight, everything on one
long page, no brand on the first screen. The design bundle (`web/docs/design/`) replaces that with Faris's
Arabic logo and an English companion wordmark in every header, light and dark themes, one page per lens
plus an overview, lens visuals with motion, a scenario diff sheet, a public landing page, a demo sign-in and
an admin list. The bundle's competitor review found three things worth acting on: Saudi lenders sell speed
and trust but never show why; underwriting tools show evidence visually; and brand-led fintechs repeat
one motif. So the pages lead with the reason for a decision, and "pending Sharia-advisor confirmation"
is shown more prominently, not less. The landing page uses counts of what the demo contains, not
performance claims.

**U11 amended, word for word.** The yellow synthetic-data banner is removed. Instead, every page shows
population and data source: the footer of every page reads "Synthetic data only. Population: serving." (and
its Arabic), and the landing, sign-in and admin pages say "synthetic data" in their body copy. Every number
still carries its population where the old rule required it.

**U15 amended, word for word.** A demo sign-in page is allowed, front-end only: it chooses a role (Business
owner or Admin) and routes to the right page. Both roles need the demo password `pass`, compared in the
browser only; the registration number and username are not read, and the username is any text, not an
email. It creates no account or session, stores nothing, sets no cookie and sends nothing to the API. The
password is in the page's code, so it keeps out nobody. The page says so in plain words. Everything
else in U15 stands (no tracking, analytics or logging of business data; the PDPL and SAMA Open Banking
footer note).

**New rules.**
- No symbol characters in UI text: no check marks, crosses, exclamation marks, arrows, delta signs, middle
  dots, ellipses or em dashes in any rendered text, in either language. Status is a word on a plate.
- No hash-derived visual patterns ("seals" or "fingerprints") anywhere. Receipts stay plain text.
- Theme preference may be kept in `localStorage` only (no cookie), defaulting to the system
  `prefers-color-scheme`.

**Logo files.** `web/docs/design/logo/maal-ar.svg` (sha256 `75d20f0cc5bbdffb8f2eec20612f05522a83714a834a41beb1a32b2f40263311`)
and `web/docs/design/logo/maal-en.svg` (sha256 `3e103bda95aee4c0745566147a6d389fcb124bacd6ca64d273a4265180229771`).
`tests/brand.test.tsx` checks both hashes, and that the React components hold the same path data
coordinate for coordinate. `maal-ar.svg` is one compound path, not the two paths the bundle README
describes; the app splits it at its last subpath (the madda) so the two parts can animate. No coordinate
changes.

**Figures.** Every figure comes from an API response or an exported scenario object. Positions, widths and
dates in the visuals are computed from the response at render time. The landing card reads the exported
`baseline` scenario object; its counts come from code (the lens list, the scenario index, the locale list).
`tests/visuals.test.tsx` fails if any of the mockups' 10001 figures appears in a source file.

**Could not be built as designed.**

| Element | What happens instead | Why |
|---|---|---|
| "N of cap" on the review queue ("10 of 10 slots") | The count and the transactions scanned; no cap | The cap is `max_flags` in `lens_config.yaml`, and no response carries it. Hard-coding it is not allowed. Proposed: add it to the anomaly response |
| Legend text "Model, naive90" and "Naive baseline, trailing 30-day mean" | "Model" and "Naive baseline"; the page shows the API's `method` string verbatim under the table | Those details exist only inside that free-text string, and parsing it for a legend would be fragile |
| Reem Kufi for Arabic accents in the mockups | IBM Plex Sans Arabic | SOP lists four IBM Plex families only |
| Mockup wording "Every result is signed with a receipt" | "Every result carries a receipt" | A receipt is a list of hashes, not a signature |
| The `.ink` plate's white text; the forecast cover rectangle | Plate text uses the page ground colour; a clip reveals the lines | Mockup defects: white on `--ink` fails contrast in the dark theme, and the cover would hide the chart under reduced motion |

**Where the symbol rule stops.** Backend text is verbatim by U4 and U13 and is not UI text. One real
template holds an em dash: the Sharia rule detail for MCC 5921 ("package stores — beer, wine, liquor"), reached
only by a hard flag, which no demo business has (it appears in a synthetic-state fixture). It stays as
returned. Scenario labels hold one too ("Severe revenue collapse — inflows down 60% from week 14"); the
dash there is a separator, so the UI shows the two parts on separate lines, as the design does, and drops no
word. The generator owner may prefer to change the source label.

**Time axes stay left to right in Arabic** (forecast chart, review timeline, hawl track), following entry
41's chart rule. Non-time bars mirror, so credit and zakat bars grow from the right.

**One rule test had to widen.** `U1 the only input in the app is the business picker` now also allows
`SignInForm.tsx`, because the U15 amendment adds inputs. U1's point stands: no input can change terms. New
tests check that the sign-in fields have no name, that only the password is read, that a wrong password
stays on the page, and that the form sends and stores nothing.

**The demo role proves nothing.** It rides in the URL (`?as=`) and gates nothing, so `/admin` is open to any
visitor. That is fine for synthetic data and would not be for real data.

**The request queue stays** (entry 41). The overview makes the five requests of the first-pass dashboard, and
each lens page makes one.

**Follow-up (2026-11-08).** One rule-test change from the `788bcef` follow-ups was not listed above. The
reduced-motion test `U6 the Sharia frame and its outline stand without animation` used to check four
separate edge pieces; the frame is now one rounded outline drawn as an SVG rectangle, so the test checks that
outline is visible with its stroke fully drawn (`stroke-dashoffset` 0) under reduced motion. U6 is unchanged:
the fixed label and its frame still stand on the page with every animation off.

**Sign-off:** ☑ team [ticked by Ahmed Altunusi on the team's behalf, verbal agreement 2026-11-10] (redesign, U11 and U15 amendments) ☑ compliance owner [Mohammed Alshaibani; ticked by Ahmed Altunusi on his behalf, verbal agreement 2026-11-10] (Sharia and Zakat pages, Arabic copy) ☑ credit lens owner [Abdulrahman Alharbi; ticked by Ahmed Altunusi on his behalf, verbal agreement 2026-11-10] (Credit and Compliance views)

---

## 43. §25 within-sector fairness: construction's top attributions are not liquidity / working-capital features — FINDING (2026-11-08)

**Owner:** credit lens owner (Abdulrahman Alharbi). **Touches:** §25, the report's limitations, any
fairness claim made in the demo or report.

**Status: FINDING.** The §25 pass criterion is **not met**. This is recorded as a result about the model,
not explained away, and it goes into the report's limitations. No fairness-approved claim is made.

**Why a finding and not an explanation.** An argument that the criterion is wrong for construction
would be made after seeing the result, which is retuning the test (CLAUDE.md, "decide calibration before
the result exists"). Entry 1b settled this in advance on 2026-09-20: "A Week 11 audit that finds 11 / 56
near the top in construction is a finding about the model and should be reported as such." Any revised
criterion is a separate PROPOSED entry, applies only to a later model and audit, and does not turn this
result into a pass.

**Method.** `python -m eval.within_sector_fairness` on the research population, scored or
partial_profile (N = 9,495; construction 3,486). Attribution is coefficient × standardised feature value,
which is exactly the SHAP value of a linear model with the mean as baseline (§13's "SHAP
infrastructure" reduces to this for the logistic lens; intercept + contributions reproduce the logit,
tested on 100 profiles). Features are ranked within each sector by mean |contribution| (impact) and by
the SD of the contribution within the sector (variation).

**Which model: the retrained one (confirmed 2026-11-08).** The committed `model_v1.json` is identical in
`79160cb` (the retrain, artifact sha256 `7ed936b6…9274`, trained 2026-11-07, after entries 30, 35 and 38)
and `4482491` (the audit commit); `e36bc85`, `bbbc9d7` and the entry 38 clip commit are ancestors of
`79160cb`. The credit lens owner's diagnostics below report feature 3's coefficient as +1.294436, which is
the retrained artifact's value (the earlier model's was +1.467769). The committed outputs did not record
the model; the script now prints the artifact's sha256, its training date and the largest |z| over 55–59
in `profiles.csv`, so later runs state this themselves.

**Construction result, as committed.**
- **By the schema's text** (§25 names features 11–19): **1 of the top 10** by impact is in the set
  (15 `volatility_index`, rank 2).
- **By entry 1b's reading** (11–19 plus 37–40, recorded 2026-09-20 before any audit): **2 of 10**
  (adds 39 `implied_dpo_days`, rank 6). Both readings fail. The schema text and entry 1b disagree on 37–40;
  the schema wording follows at the next team-approved schema edit (entry 33).
- **By within-sector variation** (top 10: 15, 6, 3, 55, 52, 68, 53, 14, 66, 49): 2 of 10 by the schema's
  text (15, 14), 2 by entry 1b's. Still fails. This ranking is reported because the script already
  computes it, not chosen as the test after the fact.
- **Rank 1 is feature 3 `inflow_regularity_score`**, mean contribution −1.585 log-odds with SD 0.407:
  it moves almost every construction business by the same amount (|mean| / mean |contribution| = 1.00).
  Features 6, 10, 39 and 60 behave the same way (≥ 0.98). A near-constant contribution across a whole
  sector is a sector-level offset, which is the pattern §25 asks to rule out.
- **Why, from the model's own parameters.** Within one sector, feature 55 is feature 3 rescaled:
  `(x − μ_s) / σ_s` with v2's construction μ = 0.144, σ = 0.133 (retail 0.998 / 0.020, F&B 0.999 / 0.009).
  The owner measured r = 0.9995 between 3 and 55 in construction (N = 3,486; not exactly 1 because of
  the ±3 clip and imputation) and VIF ≈ 1,022 for both there. A model holding both can therefore give
  each sector its own slope and its own constant: an implicit sector term. In construction, ignoring the
  clip (which binds above 0.54), the retrained model's slope on feature 3 is +3.054 log-odds per unit
  through feature 3 and −2.702 through feature 55, net **+0.35 per unit** (≈ 0.05 log-odds per
  within-construction SD). The two large attributions (SD 0.41 and 0.36) almost cancel inside the sector;
  what remains of feature 3's −1.585 is the gap between construction's regularity level and the pooled
  population's (retail and F&B sit near 1.0). The same pairing exists for 11/56, 13/57, 16/58 and 21/59.
  This is a mechanism for the failure, not a reason to discount it.
- Summed mean contributions by sector (the average sector-level offset in log-odds, intercept excluded):
  construction +0.242, food & beverage −0.001, retail −0.115, professional services −1.431. No sector-code
  feature is in the model (58 features, §8 list minus 23–26); indirect sector effects are not ruled out.

**Further diagnostics (credit lens owner, 2026-11-08, on the retrained model; scripts not yet committed,
so these numbers are not quoted in the report until they are).** In construction (N = 3,486): feature 3
vs `default_label` Spearman ρ = −0.0076, single-feature AUC 0.4907; vs the latent risk index ρ = −0.0857;
vs latent management quality ρ = +0.0385. Feature 3's coefficient is +1.294 with feature 55 present and
+0.379 without it; feature 55's is −0.012 without feature 3. VIF for feature 3: 66.1 overall, 1,022.5 in
construction; feature 55: 3.39 overall, 1,022.1 in construction. So the top construction attribution
carries almost no standalone signal about default in construction.

**Ablation: not recorded.** The credit lens owner ran a feature-group ablation in a working session,
but which features the group contained was not recorded, so its numbers are not stated here or used
anywhere. If it is re-run, the script is committed first with the feature list, and any change to the
feature set is a new PROPOSED entry with its selection rule fixed before it is evaluated. The shipped
model and A1 stay as they are.

**Serving-population calibration (943 businesses, 45 defaults), predicted vs observed default rate.**
Construction 360 / 25 defaults: 5.64% vs 6.94% (−1.31 pp, under-predicted). Food & beverage 148 / 5:
4.61% vs 3.38% (+1.23 pp). Retail 409 / 15: 4.22% vs 3.67% (+0.56 pp). Professional services 26 / 0:
1.00% vs 0.00%. Default counts are small; calibration differences do not establish fairness either way.

**For the report's limitations (wording to use).** "The §25 within-sector audit did not pass. In
construction, only 1 of the 10 most influential features (2 under the wider working-capital reading of
entry 1b) is a liquidity or working-capital feature; the most influential, inflow regularity, shifts
nearly every construction business by the same amount, which is a sector-level effect rather than an
assessment of individual risk. Inflow regularity also enters through its sector-relative z-score, and
together the two let the model set a separate baseline per sector. We therefore make no claim that the model rewards disciplined operators
within volatile sectors."

**Reproduction:** `python -m eval.within_sector_fairness` → `eval/out/within_sector_fairness.{csv,md}`,
`within_sector_calibration.csv`, `within_sector_serving_calibration.csv`.

**Sign-off:** ☑ credit lens owner (Abdulrahman Alharbi, 2026-11-08; finding recorded — not fairness
approval) ☐ team (the finding and the limitations wording)

---

## 44. API additions: GET /businesses, anomaly max_flags, GET /scenarios and POST /scenarios/run — PROPOSED (2026-11-09)

**Faris Alsharifi acted for the API owner for this work** (SOP_web_ui_enhancements section 1a). The API owner
should review this entry and the code (`api/app.py`, `api/store.py`, `api/scenario_bounds.py`) before it counts
as the API's own. Nothing outside `api/` and `tests/` changed; `pipeline/`, `lenses/`, `scenarios/`, `generator/`,
`config.yaml` and the schema are untouched, and no existing route's logic or output changed.

**`GET /businesses`.** Query `offset` (whole number from 0, default 0), `limit` (1 to 50, default 25), `sector`
(one of the sectors in the store), `q` (digits: the start of a business ID). Any other parameter, or a bad value,
is a 422 in the existing `{"detail": "<reason>"}` format. Response:
`{"population": "serving", "data_source": "synthetic", "total", "offset", "limit", "businesses": [{"business_id", "sector"}]}`,
in ID order; `total` counts after filters. No lens runs. Serving only, twice over: the store holds the serving
population, and the route also keeps only IDs inside config's serving `id_range` whose stored population is
serving. Same key check as every route; the per-business rate limiter counts it against one bucket of its own.

**`max_flags` in the anomaly response: stopped (S9).** The cap comes from `lenses/lens_config.yaml` (`max_flags`).
`receipt.output_sha256` hashes the whole response except the `receipt` key (`pipeline.week8.output_sha256`), so
no envelope sits outside the hash: a `limits` object anywhere at the top level changes the anomaly response's
`output_sha256` and every captured anomaly fixture hash. The SOP says to stop there. Options for the API owner:
(a) accept the new hashes once and record the switch here; (b) put the cap inside the receipt, which is outside
the hash, and say so in the receipt contract; (c) serve it from a small separate route (for example
`GET /limits`), which changes no hash. The UI already reads `limits.max_flags` when present.

**`GET /scenarios`.** The library entries (name, label, story), `scenario_library_sha256`, `max_shocks` (3), and for
each shock type its parameters with `min`, `max`, `step` and `unit`, plus any fixed value.

**`POST /scenarios/run`.** Body `{"shocks": [{"type", "params"}]}`, one to three shocks; anything else is a 422.
The scenario is built on the library's base business by the same functions `scenarios.run` uses
(`scenario_config`, `generate`, `prepare`, `decision_object`, `receipt`) on an in-memory copy of the library;
`scenarios/` is not edited. The result has the shape of an exported scenario object, with
`scenario.source: "custom"`, `scenario.label: "Custom scenario"`, the shocks echoed back, and a receipt carrying
`scenario_library_sha256` and an `output_sha256` the object hashes to (entry 41's integrity rule). The same
request gives the same bytes; nothing is stored or cached. Past the `scenarios.run` budget (30 s) it answers 503.
A lever no shock names keeps the base business's own demo spec, as library scenarios do.

**Bounds** (`api/scenario_bounds.py`, read from `scenarios/library.yaml` at import; nothing typed in):

| Shock type | Parameter | Library values | Bound | Reason |
|---|---|---|---|---|
| `cash_crunch` | `week` | 12, 14, 18, 24 | 12 to 24, step 1 | smallest and largest in the library |
| `cash_crunch` | `severity_pct` | 15, 60, 70 | 15 to 70 percent, step 1 | smallest and largest in the library |
| `large_transfer` | `week` | 6, 13, 16, 22, 23 | 6 to 23, step 1 | smallest and largest in the library |
| `odd_hours_transaction` | `week` | 9, 17 | 9 to 17, step 1 | smallest and largest in the library |
| `newcomer` | `operating_start_date` | 2026-06-20 | fixed | not numeric; fixed at the library value |

At most one `cash_crunch` and one `newcomer`. Only the anomaly types the library uses are offered, so held-out
types never appear. No parameter names a term of an offer (asserted at import; U1). The generator owner should
confirm or change these bounds.

**N6, receipts stay reproducible.** `pipeline.verify` on the business 10001 decision object (quick data,
N = 300 serving businesses) before and after this work: both "REPRODUCED byte-identical", output hash
`ed7d4de3…` unchanged. `scenarios.run --check` exits 0; `eval.check_numbers` reports the register current.

**The store bug is still open.** `ServingStore` shares one DuckDB connection across request threads.
`GET /businesses` reads through that same connection (a new `business_list()` on the store, like `load()`), so it
shares the connection exactly as the existing routes do and adds no new way to hit the bug. `GET /scenarios` and
`POST /scenarios/run` never read the store. The UI still queues every call (entry 41).

**Tests.** `tests/test_api_businesses.py`: `new routes require the api key`, `businesses route returns serving ids
only`, `businesses pagination totals add up`, `businesses sector and q filters`, `businesses bad params return 422`,
`businesses runs no lens`. `tests/test_api_scenarios.py`: `scenarios route lists the library with bounds`, `custom
scenario rejects out of bound params`, `custom scenario rejects unknown shock types`, `custom scenario integrity hash
matches its receipt`, `custom scenario is byte identical on re-run`, `custom scenario result is labelled custom`,
`custom scenario has the shape of a library object`, `custom scenario has no terms parameters`, `scenarios run
check still exits 0`. 39 tests in all, every one passing.

**Sign-off:** ☑ API owner [Ahmed Altunusi, 2026-11-10] (routes and contracts; Faris Alsharifi acted for this SOP) ☑ generator owner [Ahmed Altunusi, 2026-11-10] (custom scenario bounds and labelling) ☑ team [ticked by Ahmed Altunusi on the team's behalf, verbal agreement 2026-11-10]

## 45. Web UI review fixes: defects B1 to B22, clarity C1 to C8, interactions I1 to I10, U7 widened, N3 enforcement changed — PROPOSED (2026-11-09)

**What this is.** The fixes from the review "Ma'al web UI review: errors, improvements and interactivity"
(2026-11-09, made at `faris/web-ui` `5e6599f`), built on `faris/web-ui` under `SOP_web_ui_review_fixes.md` v1.
Everything changed is under `web/`, apart from this entry, the README row and the merge of `main`. Rules U1 to U15
(as amended in entry 42) and N1 to N7 (entry 51) still apply to every page.

**The merge of `main` (B22).** `origin/main` at `812fe41` (7 commits: GoldAPI nisab price, hawl review note, MCC
validation in `compliance/sharia.py`, `pipeline/week8.py`, `lenses/lens_config.yaml`, this file) was merged with a
normal merge commit (`bfca14a`), with no conflicts. Before it, branch `faris/web-ui-pre-review-merge` and tag
`pre-review-merge` were pushed at `5e6599f`. What it changed for the UI:
- `nisab_source_status` is now `commercial_quote_documented_pending_independent_verification` (nisab 85 g gold ×
  SAR 491.291/g = SAR 41,759.74). The UI compared the status with `placeholder_unverified`, so the U7 plate
  disappeared. B22 fixed that first (below).
- A receipt carries `gold_quote` only when `pipeline.week8 --gold-quote` is given. The API calls `make_context()`
  without one, so served receipts do not carry it; the UI's `Receipt` schema is a loose object and would parse it.
- No response shape changed (`nisab_source_status` was already `z.string()`).
- `_mcc()` now rejects anything that is not exactly four ASCII digits. None of the five demo states moved
  (10001 approved unconditional, 10004 declined on affordability, 10037 conditional on Sharia review with one
  owner prompt, 10040 partial profile, 10003 insufficient data), so `DEMO_BUSINESSES` is unchanged.
- The 8 scenario objects were re-exported; all pass their integrity check, and `scenarios.run --check` exits 0.
  The library sha256 is unchanged.

**Decisions taken for this work (SOP section 1a), word for word.**
1. **Merge `origin/main` first.** `origin/main` is at `812fe41` with 7 commits the branch lacks (GoldAPI nisab price, hawl review note, MCC validation in `compliance/sharia.py`, `pipeline/week8.py`, `lenses/lens_config.yaml`, `DECISIONS.md`). Phase A0 merges it with a normal merge commit, the same way the enhancements SOP did.
2. **U7 is widened, never narrowed.** The nisab plate shows for every `nisab_source_status` that is not an explicitly verified value. Each known status gets its own words from the catalogue. An unknown status shows a generic plate ("Nisab price not independently verified") with the raw code beside it. Only a status named in the catalogue as verified hides the plate, and no such status exists today.
3. **Demo sign-in (B1).** The page shows the demo password in plain text next to the field. The field and the browser-only check stay as DECISIONS 42 describes.
4. **Conditional approval word (B2).** "Approved, conditional" (Arabic draft: «موافقة مشروطة»), on every plate and heading that shows a credit decision.
5. **Digits (B3, B20).** The choice stays in `localStorage` only (DECISIONS 51, decision 3, unchanged). N3 keeps its effect: hashes, commands, URLs and business IDs inside links stay Latin. Its enforcement changes from "skip every `a` element" to "skip what is marked `data-latin`, plus `code`, `pre`, `[lang=en]` and form fields". Business IDs inside links get `data-latin`.
6. **Probabilities (C3).** Shown as a percentage with one decimal, followed by the exact value as returned in a smaller mono span: `34.6% (0.346)`. `formatRaw` and its test stay unchanged. The Compliance View and receipts keep the exact value only.
7. **Motion (M1).** On every page except the landing page and sign-in, no entrance delay is longer than 0.4 s and no entrance duration longer than 0.6 s. The landing page and sign-in keep their full sequence. No new storage of any kind is added for motion.
8. **No new storage.** Nothing in this SOP adds a cookie, `sessionStorage`, `localStorage` key or IndexedDB use. Theme and digits stay the only stored values.
9. **New inputs are named in the U1 allowlist.** The business switcher (I1), the Ctrl+K search (I8) and the builder's range sliders (I5) are added to the named allowlist in `tests/wording.test.tsx`, each with one line saying why it can't reach a term. No general relaxation.
10. **I6 (compare) is conditional.** Build it only if `origin/main` contains a fix for the shared DuckDB connection in `api/store.py` when Phase E starts. Otherwise skip it and say so in the report.
11. **Fonts (B19).** Self-host the four IBM Plex families with `next/font/local`, using the woff2 files from the Fontsource npm packages (SIL Open Font License). Commit the font files and the licence text. No runtime or build-time call to Google.
12. **Fixed text.** Every new string exists in English and Arabic, every new Arabic string is marked draft for review in the catalogue (existing convention), and no rendered text uses the banned symbol characters. N1 (no digits) still applies to the tour, glossary and how-it-works catalogues.

**New rules R1 to R8, how each is enforced, and its test.**

| # | Rule | Enforced by | Test |
|---|---|---|---|
| R1 | Different states never share a word; colour is never the only difference between two plates | `lib/decision.ts` (`decisionState`, `decisionWord`, `decisionPlate`, `creditPlate`) used by every decision plate and heading; catalogue groups with one word per state | `every plate state has its own word` (`tests/plates.test.tsx`: every plate group in both locales, plus a scan that no component indexes `m.enums.decision` directly) |
| R2 | With Arabic-Indic digits on, every eligible number converts, including inside links and before `%` | `lib/digits.ts` (links no longer skipped; `data-latin` on ID links) and `formatPct` | `arabic digits convert every eligible number` (`tests/digits-render.test.tsx`; `e2e/digits.spec.ts` on overview, credit, zakat, review for 10001) |
| R3 | A toggle with `aria-pressed` keeps one fixed label | `ThemeToggle`, `DigitsToggle`, the changed-rows and reason toggles; Play all dropped `aria-pressed` because its label says what a press does | `pressed toggles keep one label` (`tests/brand.test.tsx`) |
| R4 | Every element with a click handler has a keyboard path | Buttons and links; the review row keeps its mouse click beside a date-cell button | `every click handler has a keyboard path` (`tests/keyboard.test.tsx`, a source scan with one named exception) |
| R5 | No raw enum code in user-facing text outside receipts, the Compliance View, `BackendText` and the profile features table | `lib/labels.ts` `label()`, with a code fallback for unknown values | `no raw codes outside receipts` (`tests/labels.test.tsx`, credit, zakat and review for 10001, both locales) |
| R6 | Entrance delay at most 0.4 s and duration at most 0.6 s outside the landing page and sign-in | `--d-0` to `--d-4` in `globals.css`, `lib/motion.ts` `delay()`, capped CSS durations; `data-motion="full"` restores the landing page and sign-in | `entrance motion stays under the cap` (`tests/motion.test.ts` source and CSS scan; `e2e/motion.spec.ts` animation timings on overview, zakat, review) |
| R7 | The nisab plate shows for every status not named verified in the catalogue | `lib/nisab.ts` `nisabPlate()` and `NisabPlate`, used by `ZakatCard`, `Readouts`, `ScenarioCompare` and the print sheet; no component compares the status with a literal | `nisab plate shows for every unverified status` (`tests/nisab.test.tsx`) |
| R8 | The header fits one row at 1280 px and 1440 px in both locales | Header layout: a "Display" button for the theme and digits toggles from 768 px up, a "Business" button for the switcher, slightly tighter header spacing | `header fits one row on laptops` (`e2e/header.spec.ts`) |

R6 names one timer that is not an entrance: Play all's 8 s progress fill (I4), which the test checks equals
`PLAY_STEP_MS`.

**U7 widened.** Before, the plate showed for exactly one status string; any new status hid it. Now it shows for
every status except one the catalogue names as verified (`zakat.nisabVerified`, empty today), with its own words
for each known status and generic words plus the raw code for an unknown one. A new backend status can only add
a plate, never remove one, so the rule is stronger.

**N3 enforcement changed.** The rule is unchanged: hashes, commands, URLs and business IDs inside links stay Latin.
Enforcement moves from skipping every `a` element (which also left readout-card figures and counts inside links
Western, the B3 defect) to skipping `[data-latin]`, `code`, `pre`, `[lang=en]` and form fields, with `data-latin`
on every link whose text shows a business ID (the admin demo table, the full business list, the landing strip,
the switcher, the refusal link). The test of that name passes; its sample link now carries `data-latin`, like the
app's own ID links. B20 also skips `[aria-live]` regions and watches the header and `<main>` (and regions mounted
later into `<body>`) instead of every node.

**U1 allowlist entries added (`tests/wording.test.tsx`).** Each is named, with its reason:
- `BusinessSwitcher.tsx` (I1): digits of a business ID; it searches serving IDs and opens that business.
- `CommandPalette.tsx` (I8): matches typed text against fixed lists of pages, scenarios, glossary terms and serving
  IDs, and only navigates.
- `CustomScenarioForm.tsx` sliders (I5): the file was already listed; its range sliders edit the same bounded shock
  values as its number fields. `tests/custom.test.tsx`'s input names add `<type>.<parameter>.slider`.
- `ScenarioControls.tsx` (I4): the phone `<select>` picks one of the library's fixed scenarios and only navigates.
  This is a fourth entry beyond the three 1a.9 names; I4 step 3 requires the native select.
None can reach a term of an offer.

**Calls to the API.** Every new call (I1 plates and search, I3 profile, I9 strip) is made from the server through the
queue in `lib/api.ts`. I1 and I3 use server actions in `app/actions.ts`; the key-leak guard stops its client import
graph at a `"use server"` module (Next sends the browser a reference, never the code) and checks that every such
module is marked.

**Sharia with no MCC (C6).** `compliance/sharia.py` `screen()`, branch (a): with no merchant code the screen uses the
registered sector, and a sector that the rule table's `no_mcc_by_sector` marks compliant triggers no rule. The Sharia
page now says so in one fixed sentence, shown only for compliant, registered-sector screens with no MCC.

**Items left out.**
- **I6 (compare two businesses): skipped under 1a.10.** `origin/main` holds no fix for the shared DuckDB connection
  in `api/store.py`. It can be built once the API owner's fix is merged.
- **B10 and B11 (review lanes and clusters): built, then reverted at Faris's request (2026-11-09).** The review
  timeline is back to one track with one mark per transaction, colour and height both marking the reason, as
  before this work. Marks that sit close together can still overlap; the table lists the same transactions. The
  legend filters, table sort, row buttons and mark-to-row scrolling stay.
- No S2, S3, S4, S5, S6, S8 or S9 stop was hit. I3's feature mapping (`compliance_tier.contributions`), I5's
  "Start from" shocks (`scenario.overrides` in the exported objects) and C6's sentence were all buildable from what
  the API returns or what is under `web/`.

**Next steps for other owners.**
- **C4 (credit lens owner):** human factor names in the credit templates ("Your inflow regularity score..." reads
  the raw feature name). Not built here; the UI shows the template verbatim (U4).
- **Store concurrency fix (API owner):** `ServingStore` still shares one DuckDB connection across request threads.
  Once fixed, I6 can be built and the request queue in `lib/api.ts` removed.

**Sign-off:** ☑ team [ticked by Ahmed Altunusi on the team's behalf, verbal agreement 2026-11-10] (fixes and scope) ☑ compliance owner [Mohammed Alshaibani; ticked by Ahmed Altunusi on his behalf, verbal agreement 2026-11-10] (nisab plate wording, Sharia no-MCC sentence, Arabic copy) ☑ credit lens owner [Abdulrahman Alharbi; ticked by Ahmed Altunusi on his behalf, verbal agreement 2026-11-10] (conditional approval word, factor expanders)

## 46. Scenario library re-run on the retrained credit model; entry 29's findings 1–2 restated — RECORDED (measurement, 2026-11-09)

**Touches:** `eval/out/scenario_library_check.txt`, `docs/NUMBERS.md` §5b and §7. `config.yaml`,
`lenses/lens_config.yaml`, `lenses/credit/model_v1.json` and `scenarios/library.yaml` are unchanged.

**Numbering.** Numbers 41, 42, 44 and 45 are used on the unmerged branch `origin/faris/web-ui`, which
also carries a different entry 43 (web UI enhancements) from the one on `main` (§25 fairness). This
entry takes 46 so a third collision is not added. The two entries numbered 43 have to be renumbered
when that branch is merged. **Update (2026-11-10):** resolved at the merge of `faris/web-ui`; its 43 is now 51 and every
reference in `web/` follows (entry 51).

**Why.** NUMBERS §5b and the report behind it were last produced on 2026-10-31, before entries 30, 35
and 38 changed ten features and before the credit model was retrained (`79160cb`, 2026-11-07). Entry
38 said §5b "moves with the retrain"; it was not re-run. `eval.check_numbers` compares the register
with the committed report, and both were stale, so the check passed.

**Result** (`python -m scenarios.run --check`, exit 0; business 10001, N = 1 per scenario, severities
unchanged since 2026-10-31). Decisions, amounts, tiers, cash alerts, anomaly flags and Zakat are the
same as on 2026-10-31. Only the PD moved:

| scenario | decision | PD on 2026-10-31 | PD now |
|---|---|---|---|
| `baseline` | approved, 47,000 SAR, tier B | 0.0557 | 0.0526 |
| `calm_counterfactual` | approved, 242,000 SAR, tier C | 0.0690 | 0.0663 |
| `mild_slowdown` | approved, 173,000 SAR, tier C | 0.0849 | 0.0743 |
| `severe_collapse` | declined (affordability) | 0.0483 | 0.0390 |
| `late_sudden_shock` | approved, 104,000 SAR, tier C | 0.0999 | 0.0873 |
| `fraud_pattern` | approved, 159,000 SAR, tier C | 0.0953 | 0.0960 |
| `combined_crisis` | declined (affordability) | 0.0561 | 0.0656 |

**Entry 29's findings, restated for the shipped model:**
1. Collapses are still declined by the §31 affordability gate, not by the risk model. Entry 29's
   sentence "Their PDs (0.0483, 0.0561) are no higher than the baseline's (0.0557)" no longer holds for
   `combined_crisis`: 0.0656 against 0.0526. It still holds for `severe_collapse` (0.0390), which has the
   lowest PD of the seven scored scenarios.
2. PD does not follow the severity of the disaster. The calm half-year with no shock and no anomalies
   (0.0663) scores above the baseline (0.0526) and above the combined crisis (0.0656); the severe
   collapse scores lowest. Say "the risk score does not track how bad the scenario is", not "PD does
   not rise": five of the six other scored scenarios now have a higher PD than the baseline, the calm
   one included.
3. Findings 3 to 5 are unchanged: the late three-week shock is approved for 104,000 SAR against the
   baseline's 47,000 with no cash alert, and the anomaly lens returns 10 flags in every scenario.

Nothing was retuned, and one business per scenario is a demonstration, not an estimate.

**Sign-off:** ☑ generator owner [Ahmed Altunusi, 2026-11-10] (scenario library re-run) ☑ credit lens owner [Abdulrahman Alharbi; ticked by Ahmed Altunusi on his behalf, verbal agreement 2026-11-10] (findings 1–2 as restated) ☑ team [ticked by Ahmed Altunusi on the team's behalf, verbal agreement 2026-11-10] (the wording used in the demo)

---

## 47. The customer explanation states a sector-level effect as the business's own trait — FINDING + PROPOSED, options only (2026-11-09)

**Touches:** `lenses/credit/model.py` (`explain`, `FEATURE_LABELS`, `PHRASES`), §13 (public tier), §25,
the demo, entry 23.3's sentence "the model cannot shortcut to the sector code", and the same comment in
`lenses/lens_config.yaml`. Nothing is changed by this entry.

**Finding** (`python -m eval.demo_exposure` → `eval/out/demo_exposure.md`, NUMBERS §5d; serving, all
1,000 businesses through the shipped code path, 943 scored or partial_profile):
- Feature 3 `inflow_regularity_score` is the **first** public reason for **834 of 943** businesses, and
  feature 3 or its z-score 55 is among the three public reasons for **943 of 943**.
- Where it is first, its direction is fixed by sector: against the business for all 138 food and
  beverage and all 373 retail cases, in its favour for all 298 construction and all 25 professional
  services cases.
- Demo business 10001, the first one shown, reads: "Your consistency of incoming payments was a major
  factor increasing the estimated credit risk." Its feature 3 contribution is +1.027583 log-odds
  (`python -m pipeline.week8 --demo`). It is a daily-POS retail shop, so its inflows are as regular as
  the feature can measure (entry 38: feature 3 is exactly 1.0 for 98.1% of retail research businesses).
  Its third sentence is "Your recent overdraft occurrences was a major factor supporting the credit
  assessment."

**Why it happens** is already recorded in entry 43: with features 3 and 55 both in the model, the pair
acts as a per-sector constant. Entry 43 drew the consequence for the §25 audit. It did not draw the
consequence for the customer text, which was written on 2026-11-08 and shows the largest contributions
first. The text is a fixed template (no generated text, SOP §2 holds). What it says is the problem: a
retail owner is told that being consistent raises their risk, and every owner in a sector is told the
same thing.

**A second sentence this contradicts.** Entry 23.3 and the comment in `lenses/lens_config.yaml` say
sector "enters only through the §35 z-scores, so the model cannot shortcut to the sector code (§25)".
Entry 43 measured summed sector-level offsets of +0.242 (construction) to −1.431 (professional services)
log-odds. The sentence should be withdrawn by the credit lens owner. Editing the comment changes
`lens_config_sha256` in every receipt, so it is left for the owner to do with the next lens-config change.

**Options (not chosen here; each is the credit lens owner's to pick):**
- **A. Keep the model and the text, and say it first.** State in the demo that the first reason is a
  sector effect for 834 of 943 businesses. Costs nothing; the sentence still misleads a real owner.
- **B. Change only what the public tier shows.** For example, leave out of the customer text any feature
  whose direction is the same for a whole sector, by a rule written before looking at which features it
  removes. The model, the PD and the compliance tier (all contributions) stay as they are.
- **C. Change the feature set** (for example, do not give the model both members of a pair such as 3
  and 55). This is a new model: entry 43 already requires the selection rule to be fixed and committed
  before it is evaluated, and A1 and every number downstream move.
- **D. Hold the public tier back from the demo** until one of the above is decided, and show the
  compliance tier with entry 43's wording.

**Not done, deliberately:** no label, phrase, threshold, feature or model file was changed. Choosing
B or C after seeing which sentences look bad is the retuning this project rules out, so the rule has
to be written first.

**Decision (2026-11-10, team, recorded by Ahmed Altunusi):** Option A. The model and the customer text are kept as they are, and the demo states that the first reason shown is a sector effect for 834 of 943 serving businesses (NUMBERS §5d). Nothing in `lenses/credit/model.py` changes. The sentence "the model cannot shortcut to the sector code" (entry 23.3 and the comment in `lenses/lens_config.yaml`) is withdrawn; because editing the comment changes `lens_config_sha256` in every receipt, the comment edit is **deferred to the next lens-config change** and is still open. Options B to D were not chosen and may be reopened by a new entry that fixes the rule first.

**Sign-off:** ☑ credit lens owner [Abdulrahman Alharbi; ticked by Ahmed Altunusi on his behalf, verbal agreement 2026-11-10] (choose A–D; withdraw the "cannot shortcut" sentence) ☑ team [ticked by Ahmed Altunusi on the team's behalf, verbal agreement 2026-11-10] (what is said in the demo)

---

## 48. Zakat nisab price changed without a numbered entry; the price is dated after every calculation date — FINDING + PROPOSED, options only (2026-11-09)

**Touches:** `lenses/lens_config.yaml` (`zakat.nisab`), `lenses/zakat/gold_price.py`,
`lenses/zakat/refresh_gold_price.py`, `pipeline/week8.py` (`--gold-quote`),
`.github/workflows/update-gold-price.yml`, `sources/zakat_nisab_gold_price.md`, entry 23.3, SOP §9.
Nothing is changed by this entry. The Zakat arithmetic itself is deterministic and unchanged (SOP §2
holds: no model and no LLM is involved).

**What happened.** On 2026-11-08 (`55c3547`, `82f86d6`) `price_sar_per_gram` went from the placeholder
400 to 491.291, from a LivePriceOfGold quotation of 2026-11-08 19:06 UTC, archived as a screenshot. The
nisab went from SAR 34,000.00 to SAR 41,759.74 (NUMBERS §5). Replacing the placeholder with a dated,
archived quotation is an improvement. Three things about how it was done are open:

1. **No numbered entry.** The change was written into entry 23.3's text in place. Entry 23 carries a
   signed line, and SOP §9 asks for a recorded change before code. The compliance owner's own line on
   entry 23 is still unticked.
2. **The price is later than every date it is applied to.** Every business's Zakat is calculated as of
   its `window_end`, and those run from 2026-01-27 to 2026-07-30 (`data/businesses.csv`, all 11,000). The
   nisab for all of them is valued at a price from 2026-11-08. The new code already treats this as an
   error on its other path: `pipeline/week8.py` raises "Gold quotation is newer than the Zakat
   calculation date" for a `--gold-quote` file. The default price in the lens config is not checked.
3. **The live-quote path cannot run on this project's data.** Any quotation GoldAPI returns today is
   dated after 2026-07-30, so it is refused for every generated business. Checked on 2026-11-09:
   `python -m pipeline.week8 --demo --gold-quote <a quote dated 2026-11-09>` stops with that error. The
   daily workflow fetches a quotation and publishes it to GitHub Pages; nothing on `main` reads it, and
   the quotations are written under `data/`, which is git-ignored, so they are not archived in
   `sources/` as the source rule requires. The pinned price and the fetched price also come from two
   different providers (LivePriceOfGold and GoldAPI.io).

**What it changes in results.** Demo business 10001's liability is unchanged at SAR 5,963.26 (its base
is far above either nisab). How many businesses cross the nisab threshold between 34,000 and 41,759.74
has not been measured.

**Options (not chosen here):**
- **A. Keep 491.291 as one pinned reference price** and state plainly, in the output and the report,
  that the nisab is valued at a single documented quotation and not at the price on the calculation
  date. Then either remove the date check on `--gold-quote` or apply the same check to the default.
- **B. Pin a price dated on or before the calculation dates**, from a source that can be archived in
  `sources/` with its edition (one price for the window, or one per month-end).
- **C. Keep the live path for a future real deployment only**, where the calculation date is today, and
  say that it is not exercised on the synthetic population. Decide whether the daily workflow and its
  public page belong in the capstone repository.
- In every case: the hawl rule and the gold basis still wait for the Sharia advisor (entry 23.3).

**Decision (2026-11-10, team, recorded by Ahmed Altunusi):** the Zakat nisab is valued at the gold price on the date the business's hawl completes (its Zakat calculation date), and that price is locked to that date. Neither the date of payment nor any later date changes it. Reason: the gold price decides only whether the nisab is met, not the amount (2.5% of the base), and a price on a later date can move a business across the threshold in either direction, so valuing at the payment date would let timing change the obligation. This is the direction of option B, with the price fixed per calculation date, and it agrees with the check already in `pipeline/week8.py` that refuses a quotation newer than the calculation date. **Not implemented.** Open work: (1) an archivable gold price for each calculation date (the windows end between 2026-01-27 and 2026-07-30), with its source and edition in `sources/`; (2) `lenses/lens_config.yaml`, `lenses/zakat/gold_price.py` and `pipeline/week8.py` to read the price for the calculation date and apply the same refusal to the default price; (3) tests; (4) a decision on the daily workflow. Until then 491.291 SAR/g (2026-11-08) stays as a **labelled reference price, dated after every calculation date**, and nothing about Zakat is presented as final. The Sharia advisor's line (basis and valuation date) is **not** ticked.

**Sign-off:** ☑ compliance owner [Mohammed Alshaibani; ticked by Ahmed Altunusi on his behalf, verbal agreement 2026-11-10] (choose; record the 2026-11-08 change) ☐ Sharia advisor (basis, valuation date) ☑ team [ticked by Ahmed Altunusi on the team's behalf, verbal agreement 2026-11-10]

---

## 49. The governing documents name XGBoost and Prophet/ARIMA; the shipped lenses are a logistic regression and a 90-day moving average — PROPOSED wording change, options only (2026-11-09)

**Touches:** `docs/SME_Platform_SOP.md` §3 and §5 (Week 7), `docs/Behavioral_Profile_Feature_Schema.md`
§13 and §19, the component READMEs, the proposal and the final report. No code.

**Finding.**
- SOP §3 gives the credit lens owner "XGBoost, SHAP" and the forecast owner "Prophet/ARIMA"; SOP §5's
  Week 7 test names "XGBoost inference"; schema §13 calls log-odds the "native XGBoost output scale".
- The shipped credit model is an L2 logistic regression (entry 23). XGBoost was measured and lost:
  logistic 0.5959 against early-stopped XGBoost 0.5865 and untuned XGBoost 0.5568, on the §14 feature
  set, research, N = 9,495 (NUMBERS §4, entry 21). The "SHAP" value is coefficient × standardised
  value, which is exact for a linear model (entry 43).
- The shipped forecast is `naive90`, a trailing 90-day mean (entry 27). The six candidates fixed in
  advance were `naive90`, `ewma`, `blend`, `naive30`, `structural` and `ols_damped`
  (`eval/out/forecast_selection.md`). **Prophet and ARIMA were never candidates**, so the project has
  no measurement of either.
- The same documents still say 59 features. The engine computes 69 numbered features plus 18b and 62b
  (71 registry entries), and the credit lens reads 58. That part is already entry 33 (PROPOSED schema
  edit v2.9 → v2.10) and is not re-opened here.

**Why it needs a decision.** A reader who compares the proposal with the repository finds a different
model in two of three lenses. For credit, the team has a measured reason. For forecasting it has none:
the promised methods were not tried.

**Options (not chosen here):**
- **A. Amend the wording** in the SOP, the schema (with entry 33's edit) and the report to what was
  built, with the reasons above, and say outright that Prophet and ARIMA were not evaluated.
- **B. Evaluate Prophet and ARIMA.** The test window (days 151–180) has been used once (entry 27), so a
  fair comparison needs the protocol and a new untouched window written down first; otherwise the test
  becomes a second validation.
- **C. Leave the documents and state the difference in the report's limitations only.**

**Update (2026-11-10):** re-measured after entries 30, 35 and 38, the baseline is logistic 0.5936
against 0.5838 and 0.5547 (entry 52); the comparison still goes the same way.

**Decision (2026-11-10, team, recorded by Ahmed Altunusi):** Option B, evaluate Prophet and ARIMA. **Not done.** The forecast test window (days 151 to 180) was used once in entry 27, so a fair comparison needs the protocol and a new untouched window written down first, and the result is reported whichever way it moves. Until it is run, the shipped forecast stays `naive90` and the documents keep their current wording; the report must say that Prophet and ARIMA have not been evaluated.

**Update (2026-11-10, later the same day): done, see entry 56.** Protocol committed first, then both
were evaluated; neither beats `naive90` on validation or on a fresh population, and `naive90` stays.
The report can now say they were evaluated and lost, with the numbers of 56.8.

**Sign-off:** ☑ credit lens owner [Abdulrahman Alharbi; ticked by Ahmed Altunusi on his behalf, verbal agreement 2026-11-10] ☑ forecast + anomaly owner [Abdulelah Alsalamah; ticked by Ahmed Altunusi on his behalf, verbal agreement 2026-11-10] ☑ team [ticked by Ahmed Altunusi on the team's behalf, verbal agreement 2026-11-10] (SOP and schema wording)

---

## 50. Five class-A1 features have no usable value on Berka, and "22 predict real defaults" rests partly on the censored label — FINDING + PROPOSED, options only (2026-11-09)

**Touches:** the evidence registry (entry 16's A1 / A2 rule), `eval/out/feature_transfer.md`,
`eval/out/evidence_table.md`, NUMBERS §1 and §6, the README honesty rules. No code and no class is
changed by this entry; the claim wording in NUMBERS §1 and the README was narrowed in the same pass.

**Finding** (counted from `eval/out/feature_transfer.md`, 43 class-A rows; Berka, primary label n = 209
with 22 defaults, secondary label n = 615 with 59, censored):
- **Five of the 43 "computed on real data" features carry no information there.** Features 5, 41, 45
  and 46 are constant on Berka on both label sets. Feature 26 has no rows at all (n = 0); it is
  `not_implemented` in the engine and is classed A1 because it "reuses features 3 and 11". So 38
  features have a value that varies on real data, not 43.
- **Of the 22 A2 features, 14 have an interval that excludes 0.50 on the primary label.** 19 do on the
  secondary label, 11 on both, and 8 only on the secondary label, which is censored
  (loans still running are counted as non-defaults). One of the 14, feature 22, is the "hair-thin" case the report already names (folded AUC
  0.530 on a near-constant feature).
- The rule tests 43 features on two label sets at 95% with no correction for the number of tests, so
  a few of the 22 are expected by chance alone.

**Options (not chosen here):**
- **A. Keep the classes; keep only the narrower wording** now in NUMBERS §1 ("14 of 43 on the
  confirmed-default label; 22 on at least one of two label sets").
- **B. Add a rule to entry 16**: a feature that is constant or has no rows on the real source is not
  A1 (it would be class C, or a new "real_degenerate" label). The counts in NUMBERS §6 and the evidence
  table then change by a rule, not by hand.
- **C. Require the primary label for A2**, so the headline count is 14.

**Sign-off:** ☑ profile engine owner [Faris Alsharifi; ticked by Ahmed Altunusi on his behalf, verbal agreement 2026-11-10] (registry rule) ☑ team [ticked by Ahmed Altunusi on the team's behalf, verbal agreement 2026-11-10] (claim wording)

---

## 51. Web UI enhancements: tour, print sheet, glossary, receipts, readouts, digits, mobile, how-it-works, play all, admin list, review cap, custom scenarios — PROPOSED (2026-11-09)

**Renumbered from 43 when `faris/web-ui` was merged into `main` (2026-11-10):** `main` had already given 43 to the §25 fairness finding. References to this entry in `web/` and in entries 41, 42, 44 and 45 now say 51.

**Touches:** `web/` only (the API side is entry 44). Builds on entries 41 and 42; rules U1 to U15 as amended in 42
still apply, with the rules below added. Done on `faris/web-ui` after merging `origin/main` at `f06639f`.

**What each enhancement does.**
- **E1 Guided tour** of business 10001: nine steps (verdict, credit factors, Compliance View, the pending Sharia
  frame, the Zakat waterfall, the forecast runway, the review timeline, the `severe_collapse` diff sheet, the
  receipt). The step is in the URL (`?tour=`); a non-modal panel at the bottom, focus on each step's title,
  Escape ends it. Captions say what to look at, never a value. A step whose target does not load says so and
  the tour goes on. Business and scenario are named once (`lib/tour.ts`).
- **E2 Print sheet** at `/business/[id]/sheet`: header and provenance, the verdict with the fixed-markup and
  charity lines, the public reasons verbatim, the Sharia screen with the U6 label and `rule_table_status`, Zakat
  with the U7 plate and "Not a ZATCA assessment", forecast figures and table, the review count and reasons, the
  credit receipt with the scope verbatim. A4 print CSS, light tokens, nothing interactive, no timestamp.
- **E3 Glossary**: 25 terms, each with a repo source; `<Term>` buttons at a term's first appearance on a page;
  `/glossary`. Murabaha is left out: the UI never shows the word.
- **E4 Receipts**: Copy beside every full hash and the commit; the scope's `verify:` command shown verbatim
  with Copy; "Check a hash" in the browser. Scenario receipts show `python -m scenarios.run --scenario <name>`.
- **E5 Readouts**: the forecast chart takes focus and steps between today and each horizon; Zakat bars and
  review marks show their value on hover, focus or tap; the cash-floor label is placed at render time.
- **E6 Play all** on the scenario page, every 8 s, with Pause, stopping at the end, on a visitor's pick and when
  the page is hidden.
- **E7 Phones and tablets**: a Menu below 768 px, the Arabic logo alone below 390 px, no sideways scroll at 360 px,
  the diff sheet stacked below 768 px, 44 px targets.
- **E8 Arabic-Indic digits**: a switch in the Arabic locale only, in `localStorage`, never a cookie.
- **E9 How Ma'al decides** at `/how-it-works`, each section linked to the matching page for 10001.
- **E10 Admin list** from `GET /businesses`, searched and paged through the URL.
- **E11 Review cap**: the UI shows "N of cap" when `limits.max_flags` is present and the count alone otherwise.
  The API side stopped (S9, entry 44), so every response today takes the fallback.
- **E12 Custom scenarios** at `/scenarios/custom`, built from `GET /scenarios`, run by `POST /scenarios/run`,
  labelled "Custom scenario, not part of the library" with the N = 1 caveat and a full receipt.

**Decisions Faris took for this work, word for word (SOP section 1a).**
1. Faris acts as API owner for this SOP. E10, E11 and E12 may edit `api/` and add API tests under `tests/`. The DECISIONS entry for the API additions must say plainly that Faris acted for the API owner and that the API owner should review it. Claude still ticks nothing; Faris ticks his own boxes after reading the entry.
2. The store concurrency bug is not fixed in this SOP. The request queue in `web/lib/api.ts` stays. Every new API call from the UI (including E10, E11 and E12) goes through the queue. New API routes must not make the bug worse: they use the store the same way existing routes do, and the report says whether they share the connection.
3. Digits (E8): Western digits stay the default. The switch appears in the Arabic locale only. The English locale always shows Western digits. The choice is kept in `localStorage` only, never a cookie, like the theme.
4. Fixed text only. Tour captions, glossary definitions, "How Ma'al decides" copy and any new labels are fixed UI text written by Claude, in both languages, with every new Arabic string marked draft for review in the catalogue (existing convention). No LLM call, no generated text, no machine translation.
5. No digits in fixed text. The tour captions, glossary entries and "How Ma'al decides" copy contain no digits (Western or Arabic-Indic). Any number those pages show comes from the API, a scenario object, or code (for example the count of lenses from the lens list).
6. Default locale stays English. Other open items from the redesign report (wordmark, looping motion, competitor claim, "Not scored" wording, PR timing, UI ownership) stay open and unchanged.

**New rules, how each is enforced, and its test.**

| # | Rule | Enforced by | Test |
|---|---|---|---|
| N1 | Fixed text has no digits | A catalogue check over the glossary, tour and how-it-works text in both languages | `fixed text catalogues contain no digits` (tests/glossary.test.tsx) |
| N2 | Glossary entries have a repo source | Every entry carries `source`; the first file it names must exist | `every glossary entry names a repo source` |
| N3 | Hashes, commands and IDs in code stay Latin | The digits rewrite skips `code`, `pre`, `a`, `[lang=en]`, form fields and `[data-latin]` | `arabic digits never touch hashes or commands` (unit and e2e) |
| N4 | New API routes are serving-only and keyed | Entry 44 | `businesses route returns serving ids only`, `new routes require the api key` |
| N5 | Custom scenarios are labelled and bounded | API validation (entry 44) and the warn plate | `custom scenario rejects out of bound params`, `custom scenario result is labelled custom` |
| N6 | Receipts stay reproducible | `pipeline.verify` on 10001 before and after | 10001 verified byte-identical both times, output hash `ed7d4de3…` unchanged |
| N7 | No page scrolls sideways on a phone | Playwright projects at 360 and 390 px | `no horizontal page scroll at mobile widths` |

**The U1 input allowlist.** The test `U1 the only input in the app is the business picker` keeps its named list
and gains four names: `CopyButton.tsx` (a read-only field holding a hash, shown only when the clipboard is
blocked), `HashCheck.tsx` (a pasted hash compared in the browser), `BusinessSearch.tsx` (the admin search) and
`CustomScenarioForm.tsx` (the builder: a checkbox and one bounded number per shock parameter; its own test fails
on any other input name or any name that holds a term word). U1's point is unchanged: no input can reach markup,
amount, months or any other term. The credit card and the Sharia panel still hold no input of any kind: their
receipt panels, which now carry the hash check, sit just below them on the credit and Sharia pages.

**Left out, and why.**
- **S5, the forecast readout steps between horizons, not days.** The response holds today and each horizon only;
  a value for any day in between would be invented.
- **S5, no re-run command for `fraud_pattern`.** The command would put the scenario's own name on screen, and U8
  keeps that word off it. Custom scenarios show no library command either: none re-runs them.
- **S9, the review cap in the API** (entry 44). The UI keeps its fallback.
- **The glossary is not in the Compliance View**: the U4 guard records exactly what that view composes.
- **Without JavaScript**, the admin page shows its loading state: it streams (its five demo rows already did),
  and streamed content needs a script to appear. Search, sector and paging are still handled on the server from
  the URL; a test reads the server's HTML to show it.

**Arabic.** Every new Arabic string is a draft: the catalogue's `_review` line names the new sections, and the
glossary, tour and how-it-works entries carry `draft: true`. The Arabic-Indic separators (٫ and ٬) are what
`Intl` produces with the `arab` numbering system.

**Sign-off:** ☑ team [ticked by Ahmed Altunusi on the team's behalf, verbal agreement 2026-11-10] (enhancements and scope) ☑ compliance owner [Mohammed Alshaibani; ticked by Ahmed Altunusi on his behalf, verbal agreement 2026-11-10] (glossary and how-it-works wording on Sharia and Zakat, Arabic copy) ☑ credit lens owner [Abdulrahman Alharbi; ticked by Ahmed Altunusi on his behalf, verbal agreement 2026-11-10] (credit wording in the tour, glossary and print sheet)

---

## 52. §14 sweeps re-run after entries 30, 35 and 38 — RECORDED (measurement, 2026-11-10)

**Touches:** `eval/out/section14_rho_sweep.md`, `eval/out/section14_noise_sweep.txt`, `docs/NUMBERS.md`
§2 (A6), §4, §4b and §7. `config.yaml`, the lenses and the model are unchanged.

**Why.** Both sweeps were measured before entries 30, 35 and 38 changed ten of the 71 features
(5, 20–22, 45, 55–59), and NUMBERS carried a caveat saying so. Re-run unchanged:
`python -m eval.run_section14` and `python -m eval.sweep_rho --param noise --values 0.0 0.2 0.5 1.0`,
both exit 0, eight full-scale generations, on the same machine as the originals. Labels are identical
at every value (asserted by the scripts). Research, scorable, N = 9,495, 449 defaults.

**Result.**

| | before | after |
|---|---|---|
| Logistic OOF AUC at ρ 0.6 / 0.7 / 0.8 / 0.9 | 0.5959 / 0.6059 / 0.5983 / 0.6050 | 0.5936 / 0.6040 / 0.6031 / 0.6087 |
| Spread across ρ | 0.0100 (0.69 SE) | 0.0151 (1.05 SE) |
| Economics pipeline share of the gap, at most | 93% | 92% (ρ = 0.9: 0.0527 of 0.0572) |
| Baseline at ρ 0.6: logistic / best early-stopped XGB / untuned XGB | 0.5959 / 0.5865 / 0.5568 | 0.5936 / 0.5838 / 0.5547 |
| Logistic OOF AUC at σ 0 / 0.2 / 0.5 / 1.0 | 0.6123 / 0.5959 / 0.5974 / 0.5882 | 0.6135 / 0.5936 / 0.5954 / 0.5921 |

The standard error is Hanley–McNeil at AUC 0.5936 with 449 of 9,495 defaults: 0.0144, as before.

**What changes in what is said.** Entry 21's "less than one standard error" no longer holds: the ρ
spread is now about one standard error, still non-monotone, so "nearly flat" replaces "flat". The
other conclusions hold: logistic still beats XGBoost; most of the gap is the pipeline, not ρ; the noise
axis is shallow (0.021 from σ = 0 to 1.0); 0.85 is not reached. Entries 21 and 28 are not edited;
the register carries the new values and retires the old ones. Nothing was retuned.

**Sign-off:** none needed (a re-measurement); recorded for the team.

---

## 53. Sign-off closure of 2026-11-10: lines ticked on the owners' behalf, and what stays open — RECORDED (2026-11-10)

**What this records.** On 2026-11-10 Ahmed Altunusi (generator owner and, per this entry, API owner) ticked the open sign-off lines
of entries 23, 25 to 27, 29 to 33, 35 to 37, 39 to 42 and 44 to 51 for the people named below, on the basis of the team's **verbal**
agreement given to him that day. Each such line carries the bracketed text "ticked by Ahmed Altunusi on his behalf, verbal agreement
2026-11-10" (or "on the team's behalf"), so it can be told apart from a line an owner ticked themselves. Each owner can confirm,
amend or withdraw their lines by a new entry. A written confirmation from each owner (a reply in the team chat is enough) is to be kept with the project records.

**Ticked on behalf of:** Faris Alsharifi (profile engine; entries 40, 50), Abdulrahman Alharbi (credit; 29, 35, 41, 42, 45, 46, 47, 49, 51),
Abdulelah Alsalamah (forecast and anomaly; 23, 27, 29, 36 twice, 37, 49), Mohammed Alshaibani (compliance; 26, 31, 32, 41, 42, 45, 48, 51) and
the team (every "team" line in those entries). **Ticked by Ahmed Altunusi himself:** the generator owner lines (30, 33, 36, 39, 40, 41, 44, 46) and the API owner lines (25, 41, 44).
Ahmed Altunusi takes the API owner role; entry 44 recorded that Faris Alsharifi had acted for it under the SOP.

**Not ticked, because no one on the team can sign them:**
- Entry 23, the combined line "compliance owner + Sharia advisor (23.3 Zakat)".
- Entry 26, "Sharia advisor".
- Entry 48, "Sharia advisor (basis, valuation date)".
There is no Sharia advisor on the project yet. Outputs stay labelled "rule-based screening, pending Sharia-advisor confirmation" (entries 23 and 26).

**A tick records agreement, not completed work.** Ticking does not change an entry's status heading, and several ticked entries describe changes that are
not made. Still to do, with the owner who raised it:
1. Entry 40 (line endings): canonical-LF hashing, `.gitattributes`, `data_sha256` line terminator. Approved, **not implemented**; existing Windows-made receipts will change once. (Faris Alsharifi, Ahmed Altunusi) **Update (2026-11-10): implemented in `00ae025`; see entry 40.**
2. Entry 47: option A chosen. The sentence "the model cannot shortcut to the sector code" in `lenses/lens_config.yaml` is still to be edited, at the next lens-config change because it alters every receipt hash. (Abdulrahman Alharbi) **Update: done in `81f2c4e` (entry 55).**
3. Entry 48: the nisab is to be valued at the gold price on each business's calculation date. Needs an archivable price series, code, tests, and a decision on the daily workflow. Until then 491.291 SAR/g is a labelled reference price. (Mohammed Alshaibani) **Update: implemented, entry 54.**
4. Entry 49: option B chosen, **evaluating Prophet and ARIMA is not done** and needs a new untouched test window written down first. Until it is run, the report states they were not evaluated. (Abdulelah Alsalamah) **Update: not run; protocol in `docs/briefs/forecast_prophet_arima_requirements.md` (entry 55).**
5. Entries 33 and 50: schema and registry edits approved in principle; check that each is actually applied before the report is written. **Update: 33 applied as schema v2.10 (`74997c2`); 50 = option A (entry 55).**
6. `python -m eval.demo_exposure` has not been re-run at full scale by anyone other than the branch author.
7. Entry 41 to 45 and 51 (web UI): the sign-offs approve scope and wording as written; they do not replace a read-through of the Arabic copy by a speaker of Arabic who is not its author.

**Nothing numeric changed.** No model, threshold, parameter, label, feature or number was altered by this entry.

**Sign-off:** ☐ team (confirmation of the above by each owner in writing)

---

## 54. Entry 48 implemented: the nisab is valued at the calculation month's gold price, from archived official sources — RECORDED (2026-11-10)

**Touches:** `lenses/zakat/zakat.py` (`nisab_price`), new `lenses/zakat/nisab_prices.py` and
`lenses/zakat/gold_monthly_sar_per_gram.csv`, `lenses/lens_config.yaml` (`zakat.nisab`), `requirements.txt`
(`xlrd==2.0.1`), new archives `sources/worldbank/CMO-Historical-Data-Monthly_2026-11-03.xlsx` and
`sources/sama/fx_bulletin_2026-01.xls` … `-07.xls` (each with `.sha256` and `.meta.json`),
`tests/test_nisab_prices.py`, `tests/test_lenses_unit.py`. The Zakat arithmetic (2.5% of the base) and
the hawl rule are unchanged; no model and no LLM is involved (SOP §2).

**What entry 48 decided:** the nisab is valued at the gold price on the calculation date, never a later
one. **What is implemented, and how it differs:** the price of the calculation **month** (the business's
`window_end` month), as the World Bank's monthly **average**. No archivable official daily SAR gold price
was found for these dates; the monthly average is the closest official series. Chosen by the generator
owner on 2026-11-10 before any Zakat result with it existed; the compliance owner is to confirm.

**Source chain, every number from an archived file:**
1. World Bank Commodity Price Data (Pink Sheet), "Updated on November 03, 2026", sheet "Monthly Prices",
   column "Gold" ($/troy oz), sha256 `3c8d9d8d…cde2`.
2. × 3.75 SAR per US dollar, the riyal's fixed dollar rate. **No official page stating 3.75 could be
   archived:** SAMA's site does not state it in fetchable form and the IMF refuses automated downloads.
   It is therefore checked, not cited: SAMA's own monthly rate bulletins (archived, one per calculation
   month) list SAR per UAE dirham, and that × the dirham's 3.6725 dollar peg reproduces 3.75 within
   0.0008 every month (3.74926 to 3.74988). The test tolerance is 0.001, about SAR 11 on the nisab at most.
   The dirham's peg is stated, not archived: a limitation.
3. ÷ 31.1034768 g per troy ounce.

| month | gold US$/oz | SAMA-implied SAR/US$ | SAR per gram | nisab (85 g), SAR |
|---|---|---|---|---|
| 2026-01 | 4,753 | 3.74988 | 573.0469 | 48,708.99 |
| 2026-07 | 4,073 | 3.74966 | 491.0625 | 41,740.31 |

(February to June are in the table; no business has a calculation date in those months.)

**Effect, measured on the full data (`data/`, 11,000 businesses, snapshot base at each `window_end`):**
10,999 businesses have a July 2026 calculation date and one (demo 10002) January. Against the flat
2026-11-08 quote (SAR 41,759.74): research, 7,309 → 7,310 businesses at or above nisab (1 of 10,000
changes side, not met → met); serving 730 → 730 (none of 1,000). Demo 10001: nisab SAR 41,740.31, liability
unchanged at SAR 5,963.26. Demo 10002: nisab SAR 48,708.99, liability unchanged at 0 (`hawl_incomplete`).
`scenarios.run --check`: every scenario outcome, Zakat included, unchanged.

**Behaviour.** A calculation month the table does not hold is refused, not filled. An explicit price
from a saved quotation (`pipeline.week8 --gold-quote`, still refused if newer than the calculation
date) takes precedence. Outputs carry `nisab_price_month`, `nisab_price_sar_per_gram` and
`nisab_source_status: world_bank_monthly_average_pending_sharia_advisor`. The 2026-11-08 commercial quote
(`sources/zakat_nisab_gold_price.md`) is kept as a record and no longer used.

**Still open:** the start-of-hawl nisab check uses the same calculation-month price, not a price at the
hawl start (for the Sharia advisor, with the hawl rule); the Sharia advisor's line on entry 48 (basis and
valuation date); the daily GoldAPI workflow (`.github/workflows/update-gold-price.yml`) has no use on
the synthetic population, and whether it stays is the compliance owner's decision. The web UI shows the
new status through its generic "not independently verified" plate (no wording added to `web/messages`).

**Sign-off:** ☐ compliance owner (monthly average in place of the day's price) ☐ Sharia advisor (basis, valuation date)

---

## 55. Submission close-out of 2026-11-10: entries 33, 47, 48, 49 and 50 — RECORDED

What was decided earlier (entries 47–50, 53) and what was done on 2026-11-10 to close it:

1. **Entry 47:** the comment "the model cannot shortcut to the sector code" in `lenses/lens_config.yaml`
   is replaced by a sentence saying how sector does reach the model (entry 43), in `81f2c4e`. Comment only;
   `lens_config_sha256` changes once in receipts.
2. **Entry 48:** implemented as entry 54 (`185a57d`): the nisab is valued at the calculation month's World
   Bank monthly average gold price. A monthly average in place of the day's price, for the compliance
   owner to confirm.
3. **Entry 33:** applied as schema v2.10 (`74997c2`): §38 and §39 for features 60–69 and 62b with the profile
   engine owner's two wording fixes, entry 5's row-count text in §7 and §12, the §31 and §36 corrections,
   and §35's v2 file name and ±3 clip (entries 35, 38). All 71 registry features now have a schema row.
   `config.yaml` `schema_version` is "v2.10". Entry 5's own team line was not ticked; its text is applied
   through entry 33, whose team line was (entry 53).
4. **Entry 50: option A**, keep the A1/A2 classes and the narrower headline already in NUMBERS §1 (14 of
   43 on the confirmed-default label). Chosen by Ahmed Altunusi (generator owner) on 2026-11-10 to close
   the entry for submission; the profile engine owner's line in entry 53 was ticked without an option,
   so his confirmation of A is asked for below.
5. **Entry 49: not run.** No time window in the generated data is untouched, and Prophet needs an install
   this machine could not hold. The protocol for running it elsewhere, with a fresh population (seed 44,
   IDs 20001–21000) as the test, is `docs/briefs/forecast_prophet_arima_requirements.md`; it must be
   committed as its own DECISIONS entry before anything is fitted. Until then the report states that
   Prophet and ARIMA were not evaluated.

**Sign-off:** ☐ profile engine owner (option A on entry 50) ☐ forecast + anomaly owner (the protocol for entry 49)

---

## 56. Prophet and ARIMA evaluation: protocol, committed before anything is fitted — RECORDED protocol (2026-11-10); result to be appended

Entry 49 chose option B (evaluate Prophet and ARIMA). This entry is section 2 of
`docs/briefs/forecast_prophet_arima_requirements.md`, copied here and committed **before `prophet` or
`statsmodels` is installed and before either candidate is fitted on anything**. Nothing in sections
56.1–56.6 may change after a result exists; the result is appended as 56.8 whichever way it goes.

The brief was written for a run on another machine. The run is instead made on the forecast owner's
machine (Abdulelah Alsalamah), which changes nothing in 56.1–56.5; the differences are listed in 56.7.

### 56.1 Candidates added

Added to `lenses/forecast/methods.py`, with the same signature as the six existing candidates
(`fn(hist, horizon, **_)` returning `horizon` daily net-flow projections), so the evaluated code is the
code that would ship.

- **`arima`**: `statsmodels` ARIMA on the daily net flow, fitted on the **last 90 days** before the
  origin (as every other candidate). Order chosen per business by lowest AIC over p ∈ {0, 1, 2},
  d ∈ {0, 1}, q ∈ {0, 1, 2} (18 orders); no seasonal term. If no order converges, the candidate returns
  `naive90`'s projection and the count of such fallbacks is reported.
- **`prophet`**: Prophet on the same 90 days; weekly seasonality on, yearly and daily off, no holidays,
  `changepoint_prior_scale` 0.05 (the library default), MAP fit (`mcmc_samples=0`). Fallback to
  `naive90` and its count as for ARIMA.
- Nothing else is tuned. No grid over Prophet settings.

### 56.2 Choosing (validation)

Research population (`data/`, IDs 1–10,000, scorable businesses), origin at day 120, target days
121–150, the eight candidates (six existing plus two). Criterion unchanged from entry 27: lowest
**median scale-free end-of-horizon error**, |projected − actual| / average monthly outflow. If no
candidate beats `naive30`, `naive30` is selected (entry 27's rule, unchanged). The validation table is
the only thing that can change `lens_config.forecast.method`.

### 56.3 Testing (reported once)

A **fresh population** never generated before: seed **44**, IDs **20001–21000**, generated in memory
from `config.yaml` with only `populations` replaced and `demo_businesses` emptied, written to
`data/forecast_holdout/` (git-ignored), profiled with
`python -m profile_engine.compute --dir data/forecast_holdout`. Origin day 150, target days 151–180.
Report the chosen method, `naive90` and `naive30`.

### 56.4 Metrics, all reported

Median and mean scale-free error, share of businesses better than naive30, MAPE away from zero, crunch
recall, false alarms (exactly the columns of `eval/out/forecast_selection.md`, computed by that
module's own `evaluate` and `summarise`), plus fit failures (fallbacks) per method and wall time per
business.

### 56.5 What ships

If validation picks `arima` or `prophet`, `lens_config.forecast.method` changes to it in its own
commit, the dependency goes into `requirements.txt`, and the Week 7 latency test is re-run (Prophet
fits per request; the forecast route must stay under 2 s at its maximum). If validation keeps
`naive90`, nothing ships. Either way the test row is reported.

### 56.6 Details the brief leaves open, fixed here before any fit

The brief does not pin these. They are set now, from library defaults and the existing harness, so
that none of them can be chosen by looking at a result.

1. **ARIMA.** `statsmodels.tsa.arima.model.ARIMA(y, order=(p, d, q))` with every other argument at the
   library default (so a constant when d = 0 and none when d = 1, stationarity and invertibility
   enforced, default optimiser and iteration limit). An order **converges** when the fit raises no
   exception, the optimiser reports convergence (`mle_retvals["converged"]`), the AIC is finite and the
   `horizon`-step forecast is finite. Among converged orders the lowest AIC wins; a tie goes to the
   first in the order p, then d, then q. The brief's rule compares AIC across d = 0 and d = 1, which
   are likelihoods of different series; that is the rule as written and is kept, and stated as a
   limitation of the result.
2. **Prophet.** `Prophet(weekly_seasonality=True, yearly_seasonality=False, daily_seasonality=False,
   changepoint_prior_scale=0.05, mcmc_samples=0, uncertainty_samples=0)`, no holidays, everything else
   at the library default (linear growth, additive seasonality, 25 potential changepoints).
   `uncertainty_samples=0` only skips the interval simulation; the point forecast (`yhat`), which is
   all the harness reads, is the same. The candidate falls back when the fit or the prediction raises,
   or returns a non-finite value.
3. **Fallback counting.** One fallback = one business × window where the candidate returned
   `naive90`'s projection. Counted per method, per window.
4. **Wall time.** Seconds spent inside the candidate's function, per business, measured in the worker;
   median and mean reported per method per window, with the number of worker processes running at the
   time. Businesses are independent, so they are split across processes by `business_id` (allowed by
   the brief); the numbers measured under that load are the ones reported.
5. **Check that the harness is the same harness.** The six existing candidates are re-scored on
   validation in the same run. Their rows must reproduce `eval/out/forecast_selection.md` section 1
   (N = 9,495; `naive90` median 0.345, `naive30` 0.411). If they do not, the run stops and the
   difference is reported before any Prophet or ARIMA number is read.
6. **Test rows.** As 56.3: the chosen method, `naive90` and `naive30`. **In addition, `arima` and
   `prophet` are both scored on the fresh population whatever validation chose**, in the same single
   run, so the report can state how each did on untouched data. Those extra rows are for information:
   they cannot change the choice, and the fresh population is not scored again afterwards.
7. **Fresh population name.** `forecast_holdout` in the `population` column; window dates as
   `config.yaml` (180 days from 2026-02-01), nothing else in the config touched. Only scorable
   businesses (profile status other than `insufficient_data`) are scored, as in entry 27.
8. **No second look.** The validation run and the test run are each made once with the code as
   committed. A crash is fixed and re-run from the start; a result is never a reason to re-run.

### 56.7 Differences from the brief's section 1 (environment only)

- Run on the forecast owner's machine, not the teammate's.
- Python **3.11** in a local virtual environment, not 3.13 (3.13 is not installed on this machine).
  `pandas`, `numpy` and `scipy` are at the versions pinned in `requirements.txt`. Exact `prophet`,
  `cmdstanpy`, `statsmodels` versions and the platform are recorded in 56.8.
- `data/` is the existing full generation of 2026-11-09. `config.yaml` and `generator/` have changed
  since only in the schema version string and line endings (entries 33, 40).
- The switch in 56.5 is **not** made as part of this run even if validation picks a new candidate: it
  waits for the forecast owner's say-so. The validation table that would justify it is reported.

### 56.8 Result (2026-11-10) — RECORDED (measurement)

**Neither Prophet nor ARIMA beats `naive90`. Validation keeps `naive90`; nothing ships (56.5).**
Run once, with the code of commit `88082df1`, after the protocol commit `935d543b`. Full output:
`eval/out/forecast_prophet_arima.md` (`python -m eval.forecast_prophet_arima report`).

**Validation — research, days 121–150, N = 9,495 scorable (1,167 went negative, 8,328 did not).**
The six existing rows reproduced `eval/out/forecast_selection.md` section 1 exactly before anything
was fitted (56.6.5).

| method | median error | mean error | better than naive30 for | MAPE (away from zero) | crunch recall | false alarms | fallbacks | median s per business |
|---|---|---|---|---|---|---|---|---|
| naive90 | 0.345 | 0.709 | 58.7% | 14.1% | 78.4% | 0.6% | — | < 0.001 |
| ewma | 0.349 | 0.732 | 59.8% | 14.4% | 83.8% | 1.4% | — | < 0.001 |
| blend | 0.363 | 0.737 | 63.3% | 14.7% | 78.2% | 0.8% | — | < 0.001 |
| **arima** | 0.379 | 1.264 | 54.1% | 15.5% | 83.4% | 1.8% | 0 | 0.717 |
| naive30 | 0.411 | 0.812 | — | 16.7% | 79.7% | 1.3% | — | < 0.001 |
| structural | 0.411 | 0.814 | 48.5% | 16.8% | 80.1% | 1.3% | — | < 0.001 |
| ols_damped | 0.488 | 0.905 | 41.5% | 19.8% | 87.1% | 4.1% | — | < 0.001 |
| **prophet** | 0.530 | 0.961 | 38.0% | 21.5% | 87.2% | 5.0% | 0 | 0.408 |

**Selected: `naive90`.**

**Test — fresh population (seed 44, IDs 20001–21000), days 151–180, N = 944 scorable of 1,000
(127 went negative, 817 did not), scored once.** `arima` and `prophet` are the information-only rows
of 56.6.6.

| method | median error | mean error | better than naive30 for | MAPE (away from zero) | crunch recall | false alarms | fallbacks | median s per business |
|---|---|---|---|---|---|---|---|---|
| naive90 | 0.331 | 0.446 | 55.9% | 13.2% | 83.5% | 0.4% | — | < 0.001 |
| arima | 0.348 | 0.512 | 52.0% | 13.5% | 85.8% | 1.8% | 0 | 0.720 |
| naive30 | 0.374 | 0.519 | — | 14.0% | 84.3% | 0.9% | — | < 0.001 |
| prophet | 0.467 | 0.664 | 35.2% | 18.7% | 89.8% | 3.8% | 0 | 0.406 |

What the numbers say, and what they do not:

1. **ARIMA** is more accurate than the 30-day baseline (0.348 against 0.374 on the fresh population)
   and less accurate than `naive90` (0.331). On validation its mean error (1.264) is the worst of the
   eight although its median is fourth: a few businesses get a very bad projection, which the median
   criterion does not see. It catches slightly more crunches than `naive90` (85.8% against 83.5%, of
   127) at about four times the false alarms (1.8% against 0.4%, of 817).
2. **Prophet** is the least accurate candidate on both windows (0.467 on the fresh population, better
   than naive30 for 35.2% of businesses). It has the highest crunch recall (89.8%) and the most false
   alarms (3.8%), the same trade the v1 trend model `ols_damped` made (entry 27): a fitted trend on 90
   noisy days extrapolates.
3. **`naive90` on untouched data.** The fresh-population result (0.331 against naive30's 0.374, better
   for 55.9%) is a second test of the shipped method, close to entry 27's (0.323 against 0.376
   research, 0.344 against 0.401 serving).
4. **Cost.** No fit failed and no order search came back empty: 0 fallbacks in 10,439 business-windows
   for each method. ARIMA takes a median 0.72 s per business (18 orders) and Prophet 0.41 s, measured
   with 10 worker processes on 12 logical CPUs; the existing candidates take under a millisecond.
   Wall time: validation 19 min, test 2 min.
5. **Limits.** These are the two libraries at the settings of 56.1 and 56.6, on 90 days of synthetic
   daily net flow: weekly seasonality only, no tuning, no Ramadan term, and neither target window
   contains Ramadan. It is not a statement about Prophet or ARIMA with a year of history or tuned
   settings. ARIMA's order rule compares AIC across d = 0 and d = 1 (56.6.1). The crunch-recall
   differences rest on 127 businesses. Nothing was retuned after either table was read.

**Environment.** Python 3.11.4, Windows 11 (build 10.0.26200; Python reports it as
`Windows-10-10.0.26200-SP0`), 12 logical CPUs. prophet 1.5.0, cmdstanpy 1.3.2, statsmodels 0.15.0,
numpy 2.3.4, pandas 2.3.3, scipy 1.16.3. Prophet installed from its wheel with the bundled Stan
model; no separate CmdStan build was needed.

**What changed in the repository.** `lenses/forecast/methods.py` (`arima`, `prophet` in
`EXTRA_METHODS`), `eval/forecast_prophet_arima.py`, `eval/forecast_selection.evaluate` takes an
optional method table (default and metric unchanged), tests. **Not changed:** `lens_config.yaml`, the
shipped method, `requirements.txt` (`statsmodels` and `prophet` are needed only to re-run this
harness; their tests skip without them), `config.yaml`. One side effect on the run machine:
`python -m profile_engine.compute --dir data` was run to obtain `profile_status.csv`, which adds
profile files to the git-ignored `data/`; the serving store was not rebuilt or touched.

**Sign-off:** ☐ forecast + anomaly owner (the protocol, before the result) ☐ team (the result)

## 57. Arabic templates from the backend, Arabic catalogue fixes, and the Saudi riyal sign — PROPOSED (2026-11-10)

**Touches:** `web/`, and additively six backend modules (`lenses/credit/model.py`, `compliance/sharia.py`,
`lenses/forecast/forecast.py`, `lenses/zakat/zakat.py`, `lenses/anomaly/anomaly.py`, `pipeline/week8.py`), one new
shared helper (`lenses/arabic.py`), six new Arabic template files, `eval/week8_check.py` (checks added only) and
`web/scripts/export-scenarios.mjs`. Done on `faris/arabic-riyal` from `origin/main` at `8eaa4b5`, following
`SOP_arabic_translation_and_riyal.md` v1 (written 2026-11-10 from the Arabic audit of the same day). Rules U1 to U15
(as amended in 42), N1 to N7 (51) and R1 to R8 (45) still apply, except where the decisions below change one on purpose.

**Decisions taken for this work, word for word (SOP section 1a).**
1. **Arabic for backend text comes from the backend.** DECISIONS 41 says a UI translation of a backend template would be a second, unreviewed version. So the backend emits an Arabic sibling for every template string it already emits: `text_ar` next to `text`, `units_ar` next to `units`, and so on (full list in Phase B). The UI shows the `_ar` field in Arabic mode and never translates backend text itself.
2. **The English output does not change.** Every existing field keeps its exact value. The `_ar` fields are additive. `output_sha256` changes for every object only because new keys are hashed. Model scores, PDs, decisions, amounts, zakat figures, forecasts and every number in `docs/NUMBERS.md` stay identical; Phase B step 9 proves it.
3. **Arabic template tables live in their own files**, so the hashes that need Sharia-advisor or owner review don't move:
   - `lenses/credit/templates_ar.yaml` (feature labels, phrases, units)
   - `compliance/sharia_templates_ar.yaml` (prompts, explanations, MCC labels, disclosure text). `compliance/sharia_rules.yaml` is untouched, so `rule_table_sha256` stays the same.
   - `lenses/forecast/templates_ar.yaml` (drivers, method labels)
   - `lenses/zakat/templates_ar.yaml` (nisab basis)
   - `lenses/anomaly/templates_ar.yaml` (method)
   - `scenarios/library_ar.yaml` (label and story per scenario name). `scenarios/library.yaml` is untouched, so `scenario_library_sha256` stays the same.
   - `pipeline/week8.py` gains `RECEIPT_SCOPE_AR` next to `RECEIPT_SCOPE`; the receipt gains `scope_ar`.
   Each file starts with a comment: "Arabic drafts, fixed template text only, never generated. Pending review by the owner named in DECISIONS <n>."
4. **Arabic templates take their numbers from the same placeholders as the English ones.** A template may not contain a digit the English one doesn't contain, and must contain every placeholder the English one has. Tests enforce both (rule A2).
5. **Register.** Formal Arabic (فصحى) for every backend template, every decision, Sharia, Zakat, compliance and receipt text, every error message and every legal or data notice. Saudi (Najdi) tone only in greetings, button labels, the tour and short guidance lines. This is the rule the `_review` note already states; this SOP applies it to every key.
6. **Terminology.** One Arabic term per concept, applied across `ar.json`, `lib/glossary.ts`, `lib/tour.ts`, `lib/howItWorks.ts` and every new template file (the final table is below).
7. **Counts use plural rules.** Every catalogue string that puts a number before a counted noun becomes a plural message with the six CLDR forms (`zero`, `one`, `two`, `few`, `many`, `other`), chosen with `Intl.PluralRules`. English gets `one` and `other`. Example for days: zero «لا أيام», one «يوم واحد», two «يومان», few «{n} أيام», many «{n} يومًا», other «{n} يوم».
8. **Saudi riyal sign.** SAMA's usage guide (eight rules, sama.gov.sa Guidelines.pdf) says the sign goes to the left of the number in every language, with a space between them, at text height, following the text direction. So:
   - Visible amounts in both locales read `⃁ 47,000.00`: U+20C1, a no-break space (U+00A0), then the number with exactly 2 decimals (U3 unchanged). A negative amount reads `-⃁ 23,054.75`.
   - In Arabic the amount stays inside its existing LTR wrapper (`Num`, a `bdi dir="ltr"`), so the sign renders on the left.
   - The glyph comes from the `riyal` npm package v1.2.1 (MIT, Pooya Golchian, https://riyal.js.org). Only its two font files and its licence are copied into `web/app/fonts/` and loaded with `next/font/local`, limited to `unicode-range: U+20C1`. No runtime dependency on `riyal` and none of its components. System fonts don't have this glyph yet; without the font it shows as an empty box.
   - Screen readers don't know U+20C1 yet. The sign is rendered only inside `<Sar>`, in an `aria-hidden` span, followed by a visually hidden word ("Saudi riyals" / «ريال سعودي»). Attribute strings (`aria-label`, `title`, `alt`) use `formatSarSpoken()`, which writes the word, never the sign.
   - "SAR" stays only where it is an identifier: field names in `Code` spans (`amount_sar`), receipts, and the Compliance View.
9. **No machine translation and no LLM.** Claude Code writes the Arabic as fixed tables, marks every new or changed Arabic string as a draft for review (existing convention), and lists them in the report. Nothing is generated at runtime.
10. **Missing Arabic falls back visibly.** If an `_ar` field is absent (an old fixture, a template the backend doesn't cover yet), the UI keeps today's behaviour: the English text in an LTR block with «القالب بالإنجليزية؛ القالب العربي قيد الإعداد». The final audit (Phase G) must find zero such blocks on the live data.
11. **Preview, not the live demo.** The new build goes to `gh-pages` under `/maal-sme-platform/preview/`. The root demo is replaced only after Faris merges this branch to `main`.

**The `_ar` fields added, by file.**

| File | Field(s) | Filled from |
|---|---|---|
| `lenses/credit/model.py` | `credit_explanation.public_tier[].text_ar`; `compliance_tier.units_ar`, `.phrases_ar` (same keys as `phrases`), `.feature_labels_ar` (the features in `contributions`); `credit_decision_detail.conditions_ar`; `text_ar` on the compliance-decline line | `lenses/credit/templates_ar.yaml`; Sharia text from `compliance/sharia_templates_ar.yaml` |
| `compliance/sharia.py` | `owner_prompts_ar`; `rules_triggered[].detail_ar`; `disclosures[].detail_ar`, `.prompt_ar`; new `compliance_explanation_ar()` | `compliance/sharia_templates_ar.yaml` |
| `pipeline/week8.py` | `governance.sharia_screen.compliance_explanation_ar`; `receipt.scope_ar` (`RECEIPT_SCOPE_AR`) | the two functions above; a fixed constant |
| `lenses/forecast/forecast.py` | `crunch_alert.drivers_ar` (same order and length as `drivers`); `method_ar` | `lenses/forecast/templates_ar.yaml` |
| `lenses/zakat/zakat.py` | `nisab_basis_ar`; `detail_ar` beside each `detail` (beyond the SOP's list: the Zakat card shows `detail`) | `lenses/zakat/templates_ar.yaml` |
| `lenses/anomaly/anomaly.py` | `method_ar` | `lenses/anomaly/templates_ar.yaml` |
| `web/scripts/export-scenarios.mjs` | `label_ar`, `story_ar` in `web/scenarios-data/index.json` | `scenarios/library_ar.yaml` (never read by `scenarios.run`) |

`lenses/arabic.py` is new and holds `ar_plural(n)` (the CLDR category, tested against CLDR for 0 to 120) and the
loader, shared by forecast and Zakat so that no lens imports another (§8). Every counted Arabic template (days, grams)
uses it.

**Template files (sha256 of the committed bytes, LF).** `lenses/credit/templates_ar.yaml` `f7ba217f…5729f`;
`compliance/sharia_templates_ar.yaml` `a72d0b57…18090`; `lenses/forecast/templates_ar.yaml` `1c687126…15fb2`;
`lenses/zakat/templates_ar.yaml` `a591b2b4…32b02`; `lenses/anomaly/templates_ar.yaml` `6937561f…bde11`;
`scenarios/library_ar.yaml` `20490922…f57184`. Full hashes in the report.

**Proof that English output and every number are unchanged (Phase B8).** The quick data was regenerated and the quick
store rebuilt (N = 300 serving businesses, 10,001 to 10,300). For 10001, 10004, 10037, 10040 and 10003, every API read
path (`/profile`, and the credit, forecast, anomaly and Zakat lenses) plus `GET /scenarios` was saved before and after.
With every key ending in `_ar` and the receipts' `output_sha256` and `code_commit` removed, all 26 responses are
identical. The same holds inside pytest: stripping the `_ar` keys from the 10001, 10004 and 10037 objects reproduces
their pre-change `output_sha256` exactly (`arabic fields change no english field`). `check_numbers` passed with no row
changed. **Hashes that must not move did not:** `rule_table_sha256` `e90efd67…` and `scenario_library_sha256`
`8f84b917…`, and the files `config.yaml`, `lenses/lens_config.yaml` and `lenses/credit/model_v1.json`. **Hashes that
moved, and why:** `output_sha256` of every object that gained an `_ar` key (each demo business's lens responses and every
scenario object), because new keys are hashed; the lens responses of 10003 (insufficient data) carry no `_ar` key and
kept theirs. `pipeline.verify` on 10001 passed before and after.

**Rules, how each is enforced, and its test.**

| # | Rule | Enforced by | Test |
|---|---|---|---|
| A1 | Every English template key has an Arabic template; every scenario has `label_ar` and `story_ar` | pytest over every template table, both directions | `test_every_english_template_has_an_arabic_template_*` (tests/test_arabic_templates.py) |
| A2 | Same placeholders as the English template, no digit the English lacks, no Latin word | pytest | `test_arabic_templates_keep_the_english_placeholders_and_numbers_*` |
| A3 | `_ar` output is deterministic and leaves every English field byte for byte unchanged | pytest on 10001, 10004, 10037, run twice, against the pre-change hashes; the B8 comparison | `test_arabic_fields_change_no_english_field` |
| A4 | An `/ar` page shows no Latin word outside the allowlist | Playwright crawl of 56 routes; the allowlist is named and explained token by token in the spec | `arabic pages show no untranslated text` (e2e/arabic.spec.ts) |
| A5 | Every `en.json` key exists in `ar.json` with the same placeholders; equal values only for named keys (`dashboard.title`) | vitest | `arabic catalogue matches english` (tests/arabic-catalogue.test.ts) |
| A6 | Every count uses a plural message | vitest over n = 0 to 120 for each of the 15 plural messages, both locales; a check that no plain string puts a count before a counted noun | `counts follow plural rules` |
| A7 | One term per concept | vitest: banned forms absent from `ar.json`, the three lib files and the six template files | `arabic terminology is consistent` |
| RS1 | Every visible amount starts with U+20C1 and a no-break space; no visible "SAR" or «ر.س» outside identifiers | vitest on `formatSar`; Playwright on 9 pages in both locales | `amounts show the riyal sign` |
| RS2 | U+20C1 appears only where the accessibility tree cannot read it; no attribute contains it | Playwright DOM walk | `riyal sign is hidden from screen readers and spoken as words` |
| RS3 | The font is self-hosted, pinned and renders the glyph | vitest (hashes, licence, unicode-range, no CDN, no fallback face); Playwright (`document.fonts.check`, glyph width 14.32 px at 16 px, not the fallback's) | `riyal font is self-hosted and renders` |

Existing rules touched: **U3** (amounts keep exactly 2 decimals; only the marker changed), **U4** (backend text is
rendered verbatim; in Arabic that is the backend's `_ar` field), **N3** (the digits switch never rewrites backend text:
the Arabic blocks carry `data-latin`, as the English ones were skipped by `lang="en"`; U+20C1 is not a digit and the
rewrite leaves it alone, tested).

**Terminology, final table.**

| Concept | Arabic | Never |
|---|---|---|
| serving population | مجموعة الخدمة (الخدمة as the population's name) | مجموعة العرض |
| research population | مجموعة البحث | |
| demo | النسخة التجريبية / تجريبي; the demo business: المنشأة التجريبية | العرض (for demo) |
| offer (credit) | عرض التمويل / العرض | |
| Display menu | المظهر | العرض |
| receipt | الإيصال | |
| hash | البصمة | |
| feature | المؤشر | |
| baseline | خط الأساس | |
| markup | هامش الربح | الفائدة |
| PD | احتمالية التعثر | PD inside Arabic text |
| MCC | رمز فئة التاجر | MCC inside Arabic text |
| credit lens | عدسة التمويل | |
| review queue | قائمة المراجعة | |
| log-odds | لوغاريتم نسبة الأرجحية | |
| Arabic-Indic digits | الأرقام الهندية (٠١٢٣) | أرقام عربية |
| Saudi riyal (spoken) | ريال سعودي | ر.س. |
| custom scenario (added) | سيناريو مخصص | |
| cross-validated AUC (added) | قيمة AUC بالتحقق المتقاطع | CV AUC inside Arabic text |
| inflows (added, scenario labels) | التدفقات الواردة | |

**Change to DECISIONS 41's "backend templates are not translated" paragraph.** The rule that the UI never translates
backend text stands. What changes is where the Arabic comes from: the backend now supplies it, as fixed tables beside
the English templates, reviewed by the same owners. The English-in-an-LTR-block fallback stays for any object without
the Arabic field.

**Items left out, with their stop code.** None of this SOP's items stopped. Out of scope by the SOP and untouched: the gold-price workflow (`.github/workflows/update-gold-price.yml`, which already commits `gold/latest.json` to `gh-pages`), the store concurrency fix (API owner), and any change to English template wording. Deviations, each in the report: `lenses/arabic.py` added (a shared plural helper, so no lens imports another); Zakat `detail_ar` added beyond the SOP's field list; RS2 also counts a `role="img"` ancestor as hidden (the forecast chart keeps its alt text, as a test requires); the before inventory was recorded on an `origin/main` worktree after the work began, not in Phase A; the static preview was captured from the quick store (N = 300), as the SOP says, and that capture was not committed, so `web/static-data/` on the branch is unchanged.

**Preview.** `gh-pages` commit `c5d9f37` replaces only `preview/` with the static build of this branch at `edb6515` (base path `/maal-sme-platform/preview`, 482 pages); its Pages deploy step failed once and an empty commit, `1056591`, redeployed it. https://at1808.github.io/maal-sme-platform/preview/ . The A4 crawl and RS1 to RS3 passed against the local copy of that build (93 of 93). The previous `preview/` held the phone-design preview (`d0d9f98`), which `main` already contains.

**Sign-off:** ☐ credit lens owner (credit Arabic templates, factor labels) ☐ compliance owner (Sharia Arabic templates, Arabic terminology) ☐ forecast and anomaly owner (drivers and method in Arabic) ☐ generator/scenario owner (library_ar.yaml) ☐ API owner (new response fields) ☐ team (riyal sign, preview)

## 58. A plain-language decision record for owners; the technical receipt kept for admin, public demo and Compliance View — PROPOSED (2026-11-11)

**Touches:** `web/` only, plus this entry and the READMEs. Done on `faris/receipt-plain` from `faris/arabic-riyal` at
`7dcf598` (entry 57), which is not merged into `main` yet, so this branch must be merged after it. Following
`SOP_plain_language_receipt.md` v1 (written 2026-11-10 from Faris's review: the receipt is built for an auditor but
shown to the business owner). Every rule from entries 42, 43, 45, 51 and 57 still applies, except U13 as amended below.

**Decisions taken for this work, word for word (SOP section 1a).**
1. **The UI only.** No change to the receipt object, `RECEIPT_SCOPE`, `scope_ar`, `pipeline/`, the API or any hash. The card is built from fields the responses already carry.
2. **Name.** The owner-facing card is called "How this result was reached" / «كيف وصلنا إلى هذه النتيجة». The technical panel keeps its content and is renamed "Technical record" / «السجل التقني». The word "receipt" stays in code, in DECISIONS and in the glossary entry for auditors, but no longer appears in owner-facing text.
3. **Who sees what.** The demo role comes from `?as=` (`lib/businesses.ts`, it proves nothing and gates nothing):

   | Role | Plain card | Technical record |
   |---|---|---|
   | `as=owner` | Yes | No |
   | `as=admin` | Yes | Yes, open by default |
   | no role (public demo) | Yes | Yes, closed by default, under the card |
   | Compliance View (`?view=compliance`) | No | Yes, open, as today |

   The technical record is never deleted from the page for admin, the public demo or the Compliance View, so the graduation committee and any reviewer can still see every hash.
4. **The card's four lines.** Each is built only from response fields; a line whose field is missing is left out, never filled with a guess:
   - **What we looked at.** "Your bank transactions up to {as_of}" / «معاملاتك البنكية حتى {as_of}». If `coverage_days_90d` is present, add "with activity on {n} of the last {window} days" only if `{window}` comes from a response field. It does not today, so this second part is left out (no hard-coded 90). See S5.
   - **How it was reached.** Per lens, from the catalogue (Phase B step 2). It says fixed rules and a fixed scoring method were used and that no AI wrote the result. It never claims "no person": a conditional Sharia case is checked by a person.
   - **Same data, same result.** "If your data is checked again, the result will be exactly the same." Shown only when the receipt has a `scope` (the lens routes). Not on `/profile`, which has no scope (U13).
   - **Questions about this result?** "Contact your bank and quote this reference: {ref}." No button, no mailto, no form: there is no backend to receive a request (out of scope).
5. **Reference number.** `M-{business_id}-{first 8 characters of output_sha256, upper case}`, for example `M-10001-7F3A9C2B`. Built by one helper, `referenceFor(receipt, business_id)` in `web/lib/reference.ts`. Shown in a `data-latin` span with a Copy button. It is a pointer to the full record, not a security token, and the card says nothing that suggests otherwise.
6. **State-specific wording.** The "How it was reached" line has its own words for: approved unconditional, approved conditional on Sharia review ("A Sharia reviewer will check your answers before the offer is final"), declined, Sharia hard flag, `partial_profile` and `insufficient_data` ("There was not enough data to reach a result"). Each comes from a map keyed by the same state helpers the plates use (`decisionWord`, `label()`), so R1 (different states never share a word) covers it.
7. **Register and terms.** Formal Arabic for the card (it states how a decision was reached, DECISIONS 57 rule 5). Terms from the DECISIONS 57 table. N1 (no digits) applies to the new tour and glossary text; the card itself may show digits because they come from the response.
8. **U13 amended, not loosened.** U13 says the lens receipt's scope is shown verbatim where present. It now reads: "verbatim in the technical record wherever the technical record is shown (admin, public demo, Compliance View); the owner role shows the plain card instead". Its tests keep checking the verbatim scope for those three, and gain an owner-role test.
9. **No new storage.** Nothing here adds a cookie, `localStorage` key, `sessionStorage` or IndexedDB use.

**How it is built.** `web/lib/record.ts` turns response fields into the card's lines (`recordLines`) and picks the
"how it was reached" words (`howKeys`) from `decisionState`, the plates' own helper, with `decline_origin =
"compliance"` for the Sharia hard flag. `components/DecisionRecord.tsx` renders the card (`PlainCard`) and the unchanged
`ReceiptPanel` by role; `components/RoleRecord.tsx` reads `?as=` and `?view=` in the browser, as `RoleHeading` does, so
the static snapshot switches too and nothing is stored. Used on the credit, Sharia, Zakat, forecast, review and profile
panels, the overview aside (the three short-hash rows are gone for every role) and the print sheet (plain lines for
all; the receipt's fields for admin and the public demo; the verbatim scope for admin only). Scenario compare keeps its
two technical records for every role and gets no card: a scenario is an illustration, not an owner's result. The admin
search also takes a reference: a serving business opens as admin with `?ref=`, `ReferenceNote` shows it beside the
heading, and a plate says when its characters no longer start the credit result's `output_sha256` ("from an earlier
result; the data or the method has changed since", never which). A research ID inside a reference is refused.

**Every claim on the card, and the code that makes it true.**

| Claim | Where it is true |
|---|---|
| Credit: "fixed rules and a fixed scoring method; no AI wrote this result" | `lenses/credit/model.py` `score` (a stored logistic model, `model_v1.json`) and `explain` (fixed `PHRASES` and labels) |
| Conditional: "a Sharia reviewer will check your answers" | `apply_sharia_gate`: `offer_status = conditional_on_sharia_review` with the owner prompts as `conditions` |
| Declined: "the reasons are shown with the decision" (the SOP draft said "listed above"; on the overview the card sits beside the verdict, so "above" was not true there) | the overview shows `decline_reason` in the verdict; the credit page and the sheet list `public_tier` |
| Sharia hard flag: "outside the fixed Sharia rules, so no financing was calculated" | `apply_sharia_gate`: hard flag → `risk_assessment_used_for_decision = false`, no amount |
| Sharia: "checked against a fixed list of Sharia rules" | `compliance/sharia.py` `screen` over `sharia_rules.yaml` |
| Zakat: "a fixed zakat method from your balance sheet" (the SOP draft said balances; Zakat reads the balance-sheet snapshot, not transactions) | `lenses/zakat/zakat.py` `compute_zakat` on `balances_monthly` |
| Forecast: "a fixed method from your past cash flow" | `lenses/forecast/forecast.py` with `naive90` from `lens_config` |
| Review: "fixed checks and a fixed statistical method" (the SOP draft said fixed checks only; the lens also fits an Isolation Forest, with a fixed seed) | `lenses/anomaly/anomaly.py`, `random_state` in `lens_config` |
| Profile: "measured by fixed formulas" | `profile_engine/features.py` |
| "Same data, same result" | the receipt's own scope (`pipeline/week8.py` `RECEIPT_SCOPE`), checked byte for byte by `pipeline.verify` and `eval.week8_check` |
| "Your bank transactions up to {date}" | the response's `as_of` (the business's `window_end`) |

**Rules, how each is enforced, and its test.**

| # | Rule | Enforced by | Test |
|---|---|---|---|
| PR1 | The owner role shows no hash, commit, field name, scope or command; the reference is the only identifier | `DecisionRecord` / `RoleRecord`, the sheet | `owner sees no technical record` (vitest, and Playwright on 24 pages: 10001 and 10037, six pages, both locales) |
| PR2 | Admin, the public demo and the Compliance View keep the full technical record, scope verbatim | the same components | `technical record stays for admin, public and compliance` (vitest and Playwright), the amended U13 tests |
| PR3 | Every card line comes from a response field; a missing field drops its line | `recordLines` | `plain card lines come from the response` |
| PR4 | One reference everywhere for one result, matching `output_sha256` | `referenceFor` is the only builder | `reference number matches the output hash` (vitest; Playwright on the overview, credit page, sheet and the admin's full hash) |
| PR5 | Each decision state has its own words | `howKeys` from `decisionState` | `every state explains how it was reached` |
| PR6 | Owner-facing text never says "receipt" / «إيصال» | the `record` catalogue group, the tour step | `owner text never says receipt`, `tour receipt step explains the plain card`, and the Playwright owner pages |

**U13, before and after.** Before: the lens receipt's scope is shown verbatim wherever a lens receipt is shown. After:
verbatim in the technical record wherever the technical record is shown (admin, public demo, Compliance View); the owner
role shows the plain card instead. Not a loosening: every place that showed the record still shows it, with the scope
verbatim; only the owner role, which the SOP takes as a person with no technical background, sees the card in its place.
Tests changed: `U13 the receipt panel is plain text with the scope verbatim` (visuals), `print sheet shows the required
labels` (vitest and e2e), and the N3 check in `digits-render` (the reference, not the short hashes); tests added for
the owner and admin roles.

**Out of scope.** A real "request a review" flow (there is no backend to receive one); recording that `pipeline.verify`
was run (`verified_at`), so the card says only that the same data gives the same result, never that it was checked;
any change to the receipt object, the scope text or `pipeline/`. In the static snapshot the admin search is absent (as
before), so the reference lookup runs on the live app only; the card and `?ref=` note work in both.

**Preview.** `gh-pages` commit `9e9b335` replaces only `preview/` with the static build of this branch at `57480f5` (base path `/maal-sme-platform/preview`, 482 pages): https://at1808.github.io/maal-sme-platform/preview/ . Owner, admin and public views, the reference number and the Arabic crawl passed against a local copy of that build (110 of 110), which also shows `?as=owner` switching the view in the static snapshot.

**Sign-off:** ☐ team (who sees what, card wording) ☐ credit lens owner (credit "how it was reached" lines) ☐ compliance owner (Sharia lines, Arabic wording)

## 59. Decision record wording (option C) and removal of the logo band — PROPOSED (2026-11-11)

**Touches:** `web/` only, plus this entry and the READMEs. Done on `faris/record-wording` from `faris/receipt-plain` at
`f176ce7` (entry 58), following `SOP_record_wording_and_logo_band.md` v1 (Faris's review of 2026-11-11: he chose option
C for the "how we decided" wording and asked for the drifting logo band to be removed). Merge order:
`faris/arabic-riyal`, then `faris/receipt-plain`, then this branch.

**Decisions taken for this work, word for word (SOP section 1a).**
1. **Option C wording.** Each "how we decided" line names what assessed the data (a scoring model trained on business transaction patterns, a fixed list of Sharia rules, or a fixed method), then says every business is assessed the same way.
2. **No "no AI" claim.** No owner-facing string says or suggests that no AI, no model or no machine learning was used. The credit score and the review flags come from trained models. The fact that no generated text is involved belongs in the technical record and DECISIONS, not on the owner card.
3. **Names.** Card title "About this result" / «عن هذه النتيجة». Line heading "How we decided" / «كيف قرّرنا». The technical record keeps its name.
4. **DECISIONS 58 is amended, not rewritten.** Its items 2 (the card name) and 4 ("How it was reached" bullet) are replaced by 1a.1 to 1a.3 here. Entry 58's text is not edited; the new entry says which items it replaces.
5. **The logo band is removed everywhere.** `LogoBand`, the `.weave` styles and the `weave` animation are deleted. The section mark (`SectionMark`, class `mk`), both logos and the tile SVGs stay unchanged.
6. **No new storage, no new dependency, nothing outside `web/`** except DECISIONS and the READMEs.

**What this replaces in entry 58.** Item 2 (the card was "How this result was reached") and the "How it was reached"
bullet of item 4 (its lines said "fixed rules and a fixed scoring method" and, for credit, "No AI wrote this result").
Entry 58's text stays as it was. The keys of the `record` catalogue group are unchanged, so `lib/record.ts`, `howKeys`
and the roles table are unchanged.

**Every changed string, before and after (all Arabic values drafts).**

| Key or file | Before | After |
|---|---|---|
| `record.title` (en) | How this result was reached | About this result |
| `record.how` (en) | How it was reached | How we decided |
| `record.howBy.credit_approved_unconditional` (en) | Calculated from your transactions by fixed rules and a fixed scoring method. No AI wrote this result. | A scoring model trained on business transaction patterns assessed your bank transactions. Every business goes through the same model and rules. |
| `record.howBy.credit_approved_conditional` (en) | Calculated from your transactions by fixed rules and a fixed scoring method. No AI wrote this result. A Sharia reviewer will check your answers before the offer is final. | A scoring model trained on business transaction patterns assessed your bank transactions. Every business goes through the same model and rules. A Sharia reviewer will check your answers before the offer is final. |
| `record.howBy.credit_declined` (en) | Calculated from your transactions by fixed rules and a fixed scoring method. The reasons are shown with the decision. | A scoring model trained on business transaction patterns assessed your bank transactions. Every business goes through the same model and rules. The reasons are shown with the decision. |
| `record.howBy.credit_sharia_hard_flag` (en) | Checked against a fixed list of Sharia rules. The registered activity is outside them, so no financing was calculated. | Your registered activity was checked against a fixed list of Sharia rules. It falls outside them, so no financing was calculated. |
| `record.howBy.sharia` (en) | Checked against a fixed list of Sharia rules. | Your registered activity and transactions were checked against a fixed list of Sharia rules. Every business is checked against the same list. |
| `record.howBy.zakat` (en) | Calculated by a fixed zakat method from your balance sheet. | Your zakat was calculated from your balance sheet by a fixed method. Every business is calculated the same way. |
| `record.howBy.forecast` (en) | Projected by a fixed method from your past cash flow. | A fixed forecasting method projected your cash flow from your past transactions. Every business goes through the same method. |
| `record.howBy.review` (en) | Flagged by fixed checks and a fixed statistical method on your transactions. A flag is a reason to look, not a finding. | Fixed checks and a model trained on your own past transactions looked for unusual activity. A flag is a reason to look, not a finding. |
| `record.howBy.profile` (en) | Measured from your transactions by fixed formulas. | Your figures were measured from your transactions by fixed formulas. Every business is measured the same way. |
| `record.title` (ar) | كيف وصلنا إلى هذه النتيجة | عن هذه النتيجة |
| `record.how` (ar) | كيف وصلنا إليها | كيف قرّرنا |
| `record.howBy.credit_approved_unconditional` (ar) | حُسبت من معاملاتك وفق قواعد ثابتة وطريقة تقييم ثابتة، ولم يكتب هذه النتيجة ذكاء اصطناعي. | قيّم نموذج تقييم مُدرَّب على أنماط معاملات المنشآت معاملاتك البنكية، وتمرّ كل المنشآت بالنموذج والقواعد نفسها. |
| `record.howBy.credit_approved_conditional` (ar) | حُسبت من معاملاتك وفق قواعد ثابتة وطريقة تقييم ثابتة، ولم يكتب هذه النتيجة ذكاء اصطناعي. وسيراجع مختص شرعي إجاباتك قبل اعتماد العرض. | قيّم نموذج تقييم مُدرَّب على أنماط معاملات المنشآت معاملاتك البنكية، وتمرّ كل المنشآت بالنموذج والقواعد نفسها. وسيراجع مختص شرعي إجاباتك قبل اعتماد العرض. |
| `record.howBy.credit_declined` (ar) | حُسبت من معاملاتك وفق قواعد ثابتة وطريقة تقييم ثابتة، والأسباب معروضة مع القرار. | قيّم نموذج تقييم مُدرَّب على أنماط معاملات المنشآت معاملاتك البنكية، وتمرّ كل المنشآت بالنموذج والقواعد نفسها. والأسباب معروضة مع القرار. |
| `record.howBy.credit_sharia_hard_flag` (ar) | فُحصت وفق قائمة ثابتة من الضوابط الشرعية، والنشاط المسجّل خارجها، فلم يُحسب أي تمويل. | فُحص نشاطك المسجّل وفق قائمة ثابتة من الضوابط الشرعية، ولأنه خارجها لم يُحسب أي تمويل. |
| `record.howBy.sharia` (ar) | فُحصت وفق قائمة ثابتة من الضوابط الشرعية. | فُحص نشاطك المسجّل ومعاملاتك وفق قائمة ثابتة من الضوابط الشرعية، وتُفحص كل المنشآت وفق القائمة نفسها. |
| `record.howBy.zakat` (ar) | حُسبت بطريقة ثابتة لحساب الزكاة من ميزانيتك. | حُسبت زكاتك من ميزانيتك بطريقة ثابتة، وتُحسب لكل المنشآت بالطريقة نفسها. |
| `record.howBy.forecast` (ar) | قُدّرت بطريقة ثابتة من تدفقاتك النقدية السابقة. | قدّرت طريقة تنبؤ ثابتة تدفقاتك النقدية من معاملاتك السابقة، وتمرّ كل المنشآت بالطريقة نفسها. |
| `record.howBy.review` (ar) | أُشير إليها بفحوص ثابتة وطريقة إحصائية ثابتة على معاملاتك، والإشارة سبب للمراجعة وليست حكمًا. | بحثت فحوص ثابتة ونموذج مُدرَّب على معاملاتك السابقة عن أي نشاط غير معتاد، والإشارة سبب للمراجعة وليست حكمًا. |
| `record.howBy.profile` (ar) | قيست من معاملاتك بمعادلات ثابتة. | قيست أرقامك من معاملاتك بمعادلات ثابتة، وتُقاس لكل المنشآت بالطريقة نفسها. |
| `lib/tour.ts` | en: { title: "How this result was reached", caption: "Every result says what data it used and how it was reached, and gives a reference number to quote if you have a question. Auditors can open the technical record." }, | en: { title: "About this result", caption: "Every result says what data it used and how we decided, and gives a reference number to quote if you have a question. Auditors can open the technical record." }, |
| `lib/tour.ts` | ar: { title: "كيف وصلنا إلى هذه النتيجة", caption: "تبيّن كل نتيجة البيانات التي اعتمدت عليها وكيف وصلنا إليها، وتعطيك رقمًا مرجعيًا تذكره إذا كان لديك استفسار. ويستطيع المدققون فتح السجل التقني.", draft: true }, | ar: { title: "عن هذه النتيجة", caption: "تبيّن كل نتيجة البيانات التي اعتمدت عليها وكيف قرّرنا، وتعطيك رقمًا مرجعيًا تذكره إذا كان لديك استفسار. ويستطيع المدققون فتح السجل التقني.", draft: true }, |
| `lib/howItWorks.ts` | what data it used, how it was reached and a [[reference|reference number]] | what data it used, how we decided and a [[reference|reference number]] |
| `lib/howItWorks.ts` | البيانات التي اعتمدت عليها وكيف وصلنا إليها، مع [[reference|رقم مرجعي]] | البيانات التي اعتمدت عليها وكيف قرّرنا، مع [[reference|رقم مرجعي]] |
| `lib/howItWorks.ts` | linkLabel: "See how a result was reached", | linkLabel: "See how we decide", |
| `lib/howItWorks.ts` | linkLabel: "اطّلع على كيفية الوصول إلى نتيجة", | linkLabel: "اطّلع على كيف نقرّر", |

**PR7, enforcement and test.** No owner-facing string claims that no AI or no model was used. Enforced by the `record`
catalogue group, the tour's `receipt` step and how-it-works' `receipts` section; test `owner text makes no no-ai claim`
(tests/record.test.ts) scans all three in both locales for "AI", "artificial", «ذكاء اصطناعي» and «الذكاء». It was shown to
fail on the entry 58 wording.

**Each "how we decided" line, and the code that makes it true.**

| Line | Where it is true |
|---|---|
| Credit: "a scoring model trained on business transaction patterns ... Every business goes through the same model and rules" | `lenses/credit/model.py` `score()` and `decide()` over `lenses/credit/model_v1.json`, a logistic model trained by `lenses/credit/train.py` on the research population's profile features; every serving business uses the same artifact and `lens_config.credit` rules. (The SOP's W1 called it XGBoost; it is logistic, per entry 21. The wording holds either way.) |
| Sharia hard flag: "checked against a fixed list of Sharia rules; outside them, so no financing was calculated" | `compliance/sharia.py` `screen()` over `sharia_rules.yaml`; `apply_sharia_gate`: hard flag, `decline_origin = compliance`, no amount |
| Sharia: "registered activity and transactions ... the same list" | `screen()` reads the declared MCC (or registered sector) and the business's own transactions |
| Zakat: "from your balance sheet by a fixed method" | `lenses/zakat/zakat.py` `compute_zakat()` on `balances_monthly` |
| Forecast: "a fixed forecasting method" | `lens_config.forecast.method = naive90` (`lenses/forecast/methods.py`), a trailing 90-day mean, not fitted on data, so "fixed" holds (S5 did not apply) |
| Review: "fixed checks and a model trained on your own past transactions" | `lenses/anomaly/anomaly.py`: hard rules and a per-business Isolation Forest fitted on that business's transactions (fixed seed); U8 holds (no fraud, no score) |
| Profile: "fixed formulas" | `profile_engine/features.py` |

**The logo band.** Removed from `components/SiteHeader.tsx` (under the header, every page), `app/[locale]/page.tsx`
(three times between landing sections), `app/[locale]/sign-in/page.tsx` (top of the brand panel) and
`components/brand/Logos.tsx` (the component). `app/globals.css` loses `.weave`, `@keyframes weave` and `.weave` in the
print rule; `.weave.ondark, .mk.ondark` becomes `.mk.ondark`; `--tile` stays (the section mark uses it). `app/phone.css`
loses its band rule. No spacing was added: each place the band sat already has a section boundary (the header's
hairline, section backgrounds and padding). Tile SVG sha256 unchanged: dark `7412a5ae...bd87`, light `237cc4de...faa1`.
This closes the looping-motion part of the item open since the redesign report for the band. Looping animations that
remain: `breathe` on the Sharia pending frame (`.frame`, ShariaPanel), `pulse` on the forecast chart's today point
(`.pulse-ring`), `travel` on the landing page's flow dots (`.dot`, Flow.tsx) and `float` on the landing hero card
(`.floaty`). All four stop under reduced motion.

**Tests changed, none loosened.** `tests/record.test.ts`: the expected titles; the "no line but the conditional one
claims a person" check now also covers `credit_sharia_hard_flag` and `sharia`; new PR7. `tests/brand.test.tsx`: "the
band and section mark are decorative" became "the section mark is decorative" (the band no longer exists; the section
mark's check is the same). `e2e/sheet.spec.ts`: `.weave` left its hidden-in-print list; the animation-count check
stays. New `e2e/band.spec.ts`: "no logo band on any page".

**Checks.** Baseline (receipt-plain f176ce7): vitest 337, Playwright 1,066 passed, 4 failed. Final: vitest 338, Playwright 1,074 passed, the same 4 failed (motion U7 nisab plate, tour en and ar, visual zakat en light 1280, all failing on the baseline too), 3 skipped, 31 not run. 34 of 36 visual baselines changed, each by the wording and the missing band only.

**Preview.** `gh-pages` commit `ea9a036` replaces only `preview/` with the static build of this branch at `ad89a89`: https://at1808.github.io/maal-sme-platform/preview/ . The band spec and the owner record tests passed against a local copy (32 of 32), and the built HTML has no "No AI" text and no band.

**Sign-off:** ☐ team (wording, logo band) ☐ credit lens owner (credit lines) ☐ compliance owner (Sharia lines, Arabic wording)

## 60. Web UI motion and visual polish: type scale, sticky header, elevation, page transitions, scroll reveals, hover system — PROPOSED (2026-11-11)

**Touches:** `web/` only, plus this entry and the READMEs. Done on `faris/ui-motion` from `faris/record-wording` at
`5c6d923` (entry 59), following `SOP_web_ui_motion_and_polish.md` v1. Merge order: `faris/arabic-riyal`, then
`faris/receipt-plain`, then `faris/record-wording`, then this branch.

**Decisions taken for this work, word for word (SOP section 1a).** The SOP asks Faris to confirm or change these
before the run. His instruction was to analyse and follow the SOP; that was taken as confirming all twelve unchanged.
None was changed.

1. **Motion never changes a value.** No count-up, no number tween, no bar that passes through a wrong value on its way to the right one in a way a reader could take as data. This is the design direction's rule, now enforced by a test (MO1).
2. **No new looping animation.** The logo band was removed as looping motion. Nothing in this SOP loops. The loops that exist at Phase A are listed and left as they are.
3. **CSS first, no animation library.** No `framer-motion`, GSAP, Lottie or similar. JavaScript is allowed for two things only: calling `document.startViewTransition` around a navigation or a theme change, and nothing else.
4. **No experimental framework flags.** Page transitions use the browser's View Transitions API directly. If the installed Next version can only do this through an `experimental` config flag, that is S5.
5. **R6 is unchanged.** Entrance delay stays at most 0.4 s and duration at most 0.6 s outside the landing page and sign-in. Scroll-linked reveals are tied to scroll position, not time, and they animate `transform` only, with at most 16 px of travel.
6. **Page transition timing.** The page crossfade lasts at most 0.25 s. A carried element (reading card title, nav underline) lasts at most 0.3 s.
7. **Type scale.** From 768 px up: 14 px (labels and captions), 16 px (body), 18 px (values in rows, card titles), 22 px (section headings). Below 768 px: 14, 16, 18, 20. The display sizes (44, 52, 76 px and the phone equivalents) are unchanged. No rendered text is under 14 px in either locale at any width.
8. **Sticky header from 768 px up only.** The phone header and bottom bar stay as they are.
9. **Raw codes (LG4).** The owner view shows words for `nisab_source_status` and `rule_table_status`. The raw codes stay in the technical record and the Compliance View. U6 and U7 are unchanged: the Sharia status is still visible and the nisab plate still shows for every unverified status.
10. **Profile record on the overview (LG5).** It moves inside the profile figures disclosure. The roles table of DECISIONS 58 is unchanged, and every lens page keeps its card.
11. **Fixed text.** Every new string exists in English and Arabic, every new Arabic string is marked draft, no rendered text uses the banned symbol characters, and no em dash.
12. **No new storage, nothing outside `web/`** except DECISIONS and the READMEs.

**Rules added.**

| # | Rule | Enforced by | Test name |
|---|---|---|---|
| MO1 | Motion never changes a displayed value | No number tween exists; amounts render once | `amount text never changes after first render` (e2e/polish.spec.ts: every `[data-sar]` amount and `[data-probability]` value on overview, credit, zakat and forecast for 10001, at first paint and after 2 s) and `no number tween in the code` (tests/motion-rules.test.ts) |
| MO2 | Scroll-linked motion never hides content | `.drift` animates `transform` only | `scroll reveals never hide content`, in both files: the CSS scan (keyframes driven by a non-auto `animation-timeline` are `drift`, `header-condense` and `header-brand`, and none touches opacity, visibility, clip-path or display) and the browser check (after 1 s, no element in `<main>` with a finite animation has opacity below 1, on the overview, how-it-works and the landing page) |
| MO3 | Every new animation and transition stops under reduced motion, page and theme transitions included | The global reduced-motion block, plus one for `::view-transition-*` | `reduced motion disables page and theme transitions`; `one reduced-motion block stops every animation and transition` |
| MO4 | Navigation works the same without the View Transitions API, and a transition never blocks input for more than 0.3 s | React only calls `document.startViewTransition` when the browser has it; the longest view-transition animation is 0.3 s | `navigation works without view transitions` (also run against the static preview), `page transition stays under the cap` |
| MO5 | No new looping animation | Allowlist of the four loops found in Phase A | `no new infinite animations` |
| MO6 | Text sizes come from the scale, and nothing is under 14 px | Size tokens in `globals.css`, Tailwind `text-label`, `text-body`, `text-value`, `text-heading` | `text sizes follow the scale` (overview, credit, zakat and review, both locales, 1280 and 390 px; also run against the static preview) |
| MO7 | The sticky header never covers the focused control or a tour target | `scroll-padding-top: var(--header-h)` from 768 px | `sticky header never covers the focused control`, `header stays in view after scrolling at 1280`, the tour tests |
| MO8 | Only interactive elements respond to hover | Every `:hover` rule sits inside `@media (hover: hover)` and none targets a plate, card or heading | `plates and static cards have no hover style` (browser) and `hover styles sit inside (hover: hover) and never on plates or static cards` (source) |

Other new tests: `demo role label stays on one line`, `phone header is unchanged`, `overview shows one record card
until the profile figures are opened`, `view transition names are unique on every page`, `segmented thumb sits under
the pressed option in both locales`, `credit view and URL never disagree after back`, `theme change works without view
transitions`, `every control shows the shared focus ring`, `raised surfaces differ from their ground in both themes`,
`print sheet has no background decoration`, `every keyframes block is used`, `no transition all in the stylesheet`.

**What was built.**

- **LG3, type scale.** Tokens `--fs-label` 14 px, `--fs-body` 16 px, `--fs-value` 18 px, `--fs-heading` 22 px (20 px
  under 768 px), with line heights 1.5, 1.6, 1.4 and 1.3, taller on `html[lang="ar"]` (label 1.6, body 1.75, value 1.5, heading 1.4). Every size from 11 to
  26 px in `globals.css`, `phone.css` and the components was mapped by role. Display sizes (44, 52, 76 px and the phone
  26, 34, 44, 48 px), the logo, the print sheet and the chart axis labels are unchanged. Measured on the 10001 overview as
  owner: before, Arabic at 1280 px used 14 sizes from 12 px up (23 elements at 13 px, 1 at 12 px); after, only 14, 16,
  18 and 22 px plus the display sizes. At 390 px, before 11 px × 5, 12 px × 1, 13 px × 16; after 14, 16, 18 px plus the
  phone display size. The print sheet for 10001 is 3 A4 pages before and after, in both locales.
- **LG1, header.** The demo role label is 14 px on one line. `white-space: nowrap` alone broke R8 (the header grew to
  127 px), and the full label broke it at 1440 px too, so the short catalogue form shows at every width ("Demo: business
  owner" / «تجريبي: مالك منشأة», "Demo: admin" / «تجريبي: مشرف», drafts) with the full form in `title` and in a
  screen-reader-only span. X5 is unchanged: the label names the role and no business.
- **LG2, sticky header.** From 768 px the header is `position: sticky; top: 0; z-index: 40`. Inside
  `@supports (animation-timeline: scroll())` it condenses over the first 96 px of scroll (row padding to 4 px, the brand
  to 80 %). No scroll listener. `scroll-padding-top` is the header's full height (72 px). Under 768 px the header is the
  phone header, unchanged (sticky, 71 px). Hidden in print, as before.
- **LG4, two codes in words.** See below.
- **LG5, one record card on the overview.** See below.
- **VS1, elevation.** `--elev-0` (page, `--bg`), `--elev-1` (cards, `--surface`, shadow `--elev-1-shadow`, which
  `--card-shadow` now points to), `--elev-2` (raised: the verdict, the glossary tip, the display and scenario panels).
  Dark theme: `--elev-2` is `#1c2230`, lighter than a card, and each raised shadow carries a 1 px `--rule` hairline. In
  light theme `--elev-2` is the card colour and differs by its deeper shadow. No hex colour in any `.tsx`.
- **VS2, verdict backdrop.** A radial gradient from `--accentSoft` to transparent behind the verdict, and a fainter one on
  each lens page's head card. It does not move. In print both get `background-image: none` and no shadow.
- **VS3, chart finish.** Forecast: the below-floor zone is a vertical gradient from `--badSoft` at the floor line to
  transparent; the today point is 14 px on screen at any width, the same as the review timeline's dots. Zakat bars
  already used `--r-bar`; the hatched liabilities bar keeps its pattern. No scale, axis, value, label rule or readout
  changed. At 360 px the larger labels pushed the hawl snapshot label past the track's start edge (B18); it now shifts
  back by its own share of the track, which keeps both edges inside at any width and the marker under the label.
- **MT1, page transitions.** See "Page transitions" below.
- **MT2, scroll reveals.** `.drift` moves an element up 16 px to its place as it enters the viewport
  (`animation-timeline: view()`, range `entry 0%` to `cover 25%`), inside `@supports`; off under reduced motion and in
  print. On the overview readouts, the profile card, the landing sections after the hero, the how-it-works sections after
  the first (where it replaces `.rise`, which played off screen) and the forecast table.
- **MT3, hover, press and focus.** One focus ring: `outline: 2px solid var(--focus)`, offset 2 px, `--focus` =
  `--accent` (contrast against every tier 9.65 to 10.66 in light, 7.16 to 8.70 in dark). Press: buttons and button-like
  links scale to 0.98 for 80 ms. Text links and the "Open" link on reading cards: the underline grows from the inline
  start over 150 ms. Bordered controls: border and background shift one tier over 150 ms. Every `:hover` rule (there
  were eight) now sits inside `@media (hover: hover)`. No element has an animated `transition: all` (11 actions had the
  computed default before, none animate now).
- **MT4, segmented thumb.** The credit Public/Compliance switch and the sign-in role switch: two equal halves and an
  `aria-hidden` thumb that slides 0.2 s on `inset-inline-start`, so it mirrors in Arabic. The buttons, `aria-pressed`
  and their fixed labels (R3) are unchanged; under reduced motion the thumb jumps.
- **MT5, theme crossfade.** `ThemeToggle` calls `document.startViewTransition` (0.2 s root crossfade) when the API exists
  and reduced motion is off; otherwise the theme switches at once. Storage is unchanged (`localStorage` only), and the
  no-flash script is untouched.
- **MT6, inventory.** The Motion table is in `web/README.md`. The unused `growy` keyframes were deleted.

**Page transitions (MT1).** The SOP's first choice was a `TransitionLink` wrapper, with the instruction to use a
documented, stable, non-experimental way instead if the installed Next has one. Next 16.4.5 documents React 19.3's
`<ViewTransition>` as working in the App Router with no configuration
(`node_modules/next/dist/docs/01-app/02-guides/view-transitions.md`), and `<Link transitionTypes>` and
`router.push(href, { transitionTypes })` since 16.2. So there is no `TransitionLink`: the page in
`app/[locale]/layout.tsx` sits in `<ViewTransition default={{ page: "auto", default: "none" }}>`, and only navigations
tagged with the `page` type (`PAGE_TRANSITION` in `lib/motion.ts`) animate: the header nav, the phone tab bar, the
overview's reading cards, the business switcher and search results. Play all, the scenario menu, `?view=`, the language
link and Back/Forward change at once, as the SOP asks. The root crossfade is 0.25 s; `site-header` and `tour-panel` hold
still; `nav-active` (the active nav link) and `nav-active-phone` (the tab bar's active item) slide to the new page's
item; `lens-<id>` carries each reading card's lens name to the matching lens page's heading, 0.3 s. Names are unique on
every page (tested). A first version wrapped every router update; it made Play all wait on the transition and left
animations running under reduced motion (player.spec), and was replaced by the type-scoped version before this entry.
Focus and the route announcement are as before.

**LG4: the two codes.**

| Code | Where it comes from | Words (en / ar, ar draft) |
|---|---|---|
| `nisab_source_status` = `world_bank_monthly_average_pending_sharia_advisor` | `lenses/lens_config.yaml` `zakat.nisab.source_status`, returned by `compute_zakat` in `lenses/zakat/zakat.py`; the price itself is the World Bank monthly average gold price × 3.75 SAR/USD ÷ 31.1034768 g for the calculation month, from `lenses/zakat/nisab_prices.py` (`build`, `price_for`), pending Sharia-advisor review (entries 48, 54) | "Nisab price is a World Bank monthly average, pending Sharia-advisor confirmation" / «سعر النصاب متوسط شهري من البنك الدولي، بانتظار تأكيد المستشار الشرعي» |
| `rule_table_status` = `proposed_unverified` | `compliance/sharia_rules.yaml` `source_status`, returned by `screen` in `compliance/sharia.py`; the file says the lists and thresholds are developer-proposed and must be confirmed by the Sharia advisor before being presented as a Sharia determination | "Rule list proposed, not yet verified" / «جدول ضوابط مقترح لم يُعتمد بعد» |

The nisab words are in the `zakat.nisabStatus` map and not in `zakat.nisabVerified`, so the plate still shows (R7, U7).
`rule_table_status` is a new `label()` group, rendered on the Sharia page and the decision sheet. Both raw codes stay in
the technical record and the Compliance View; an unknown value still falls back to the generic words with its code.
Tests: R5's `no raw codes outside receipts` covers both values and the Sharia panel; the sheet test checks the owner
sheet shows neither code; the print sheet test reads the new nisab words on the plate.

**LG5: one record card on the overview.** The profile's `DecisionRecord` moved inside the profile figures `<details>`,
so the overview shows one "About this result" card (the verdict aside's) until the figures are opened. Measured on the
10001 overview as owner at 1280 px: two cards in view before, one after. Nothing about who sees what changed: the same
`DecisionRecord` renders with the same role logic, it is only placed inside the disclosure; every lens page keeps its
card, and `data-tour="receipt"` stays on the verdict aside. Checked by PR1, PR2 and PR4 (unchanged and passing) and
`overview shows one record card until the profile figures are opened`. The receipts and Arabic digits tests now open the
profile figures before opening the record inside them.

**Unchanged, and how it was checked.**
- **R6** (entrance cap): `tests/motion.test.ts`, unedited, passes with the new styles. Scroll reveals are tied to scroll,
  not time.
- **R8** (header on one row at 1280 and 1440 px, both locales): the header specs pass; the header is 71 px at 1280 px.
- **U6** (Sharia status visible) and **U7** (nisab plate for every unverified status): their tests pass, extended to
  read the new words. The reduced-motion U7 zakat test in `motion.spec.ts` failed before this work and still does
  (baseline).
- **DECISIONS 58 roles table**: PR1 to PR7 pass; LG5 only moves where the profile card sits.

**Motion inventory.** 24 keyframes blocks before, 26 after; `growy` deleted as unused, `drift`, `header-condense` and
`header-brand` added. The four loops found in Phase A remain, unchanged: `breathe` (the warning frame, 4 s), `pulse`
(the live dot, 1.8 s), `travel` (the landing pipeline dot, 2.4 s) and `float` (the landing illustration, 6 s). Nothing
new loops. Every row of the table in `web/README.md` stops under reduced motion.

**Checks.** `tsc` and ESLint clean; vitest 345 passed (338 before, plus the 7 source rules); Playwright, full suite on
the quick backend: 1087 passed, 7 failed, 3 skipped. Five of those failures were from this work, fixed and rerun green:
Play all twice (the first MT1 version), the print sheet test (new nisab words), Arabic digits (LG5), and the overview
snapshot (the API's 60-a-minute limit for 10001, passing on rerun). The two left fail on the base too: the
reduced-motion U7 zakat test and the English tour walk. Two base failures now pass: the Arabic tour walk and the zakat
English light snapshot. pytest: 214 passed, 8 failed, equal to the Phase A baseline. All 36 visual baselines were
looked at before and after and updated in their own commit. The static preview passes `navigation works without view
transitions`, `scroll reveals never hide content` and `text sizes follow the scale`.

**Preview.** `gh-pages` commit `8fa0d5c` replaces only `preview/` with the static build of `55c88d08` (32 businesses of 300
serving, 482 pages): https://at1808.github.io/maal-sme-platform/preview/ .

**Deviations from the SOP.**
1. No `TransitionLink`: React's `ViewTransition` with transition types, as the SOP allows (above).
2. The short role label shows at every width, not only under 1440 px: the full label broke R8 at 1440 px too.
3. The segments of the two segmented controls are equal halves, so the thumb can be placed by CSS alone.
4. On how-it-works, `.drift` replaces `.rise` on the sections after the first.
5. In light theme the raised tier differs from a card by its shadow, not its colour (the dark theme differs by both).
6. Reading cards have no chevron on desktop, so there is none to nudge; the "Open" link's underline grows instead.
7. Items were committed in groups, not one commit per item: `globals.css` carries every item's rules.
8. The manual pass in a visible browser (SOP Phase E.3) was done by automated checks and screenshots; nobody has yet
   watched the transitions, the tour and an OS-level reduced-motion walk by eye.

**Items left out.** None. No stop condition was met.

Sign-off: ☐ team (type scale, header, motion) ☐ compliance owner (nisab status and rule list wording, Arabic copy) ☐ credit lens owner (credit page layout)

## 61. Motion close-out: Arabic for synthetic data is «مصطنعة» (MO9), page transition check, carried test failures traced — PROPOSED (2026-11-11)

**Touches:** `web/` only, plus this entry. Done on `faris/ui-motion` after entry 60, following Part 1 of
`SOP_close_out_merge_and_owner_insights.md`. This entry completes entry 60; entry 60's text is not edited.

**Decision taken for this work, word for word (SOP section 1a, decision 1; Faris, 2026-11-11).**

1. **«مصطنعة» (Faris).** Decision 1a.13 of the motion SOP v2 applies in full. It is copied in Phase B.

The motion SOP v2 itself was not available to the run (the run of entry 60 followed v1). What Phase B of this SOP
copies from it, word for word, is the replacement table:

| Before | After |
|---|---|
| بيانات اصطناعية | بيانات مصطنعة |
| مصدر البيانات: اصطناعية | مصدر البيانات: مصطنعة |
| اصطناعي (masculine noun) | مصطنع |
| الاصطناعية (definite, data) | المصطنعة |

**What this adds to entry 57.** Entry 57 fixed one Arabic term per concept (rule A7) but its text has no row for
"synthetic", and the A7 test lists no form for it. This entry adds that row: synthetic (of data) is «مصطنعة». The one
exception is artificial intelligence, which stays «ذكاء اصطناعي» / «الذكاء الاصطناعي».

**New rule.**

| # | Rule | Enforced by | Test name |
|---|---|---|---|
| MO9 | Arabic never calls the data «اصطناعية» | The catalogue and the fixed-text files | `arabic synthetic is not اصطناعية` (tests/arabic-synthetic.test.ts: scans `messages/ar.json`, `lib/tour.ts`, `lib/glossary.ts`, `lib/howItWorks.ts`; fails on any «اصطناعي» outside the two AI phrases) and `arabic pages say مصطنعة for the data source` (e2e/polish.spec.ts: footer on the landing page, sign-in, the 10001 overview and credit page; the header line on the two business pages; no «اصطناعي» anywhere in the page text) |

**Every string changed (all Arabic values remain drafts).** Every match was the feminine form, so each change is
«اصطناعية» to «مصطنعة», or «الاصطناعية» to «المصطنعة». Each sentence was read in full afterwards; none needed
rewording. No draft mark was removed: every Arabic string is a draft for the compliance owner for other reasons.

| Key or file | Before | After |
|---|---|---|
| `footer.scope` | بيانات اصطناعية فقط. المجموعة: الخدمة. لا تحتفظ ه … | بيانات مصطنعة فقط. المجموعة: الخدمة. لا تحتفظ هذه النسخة ا … |
| `enums.data_source.synthetic` | اصطناعية | مصطنعة |
| `landing.lead` | مآل يقرأ التدفق النقدي للمنشأة الصغيرة من خلال أر … | … د يعيد تشغيله. وهذه النسخة التجريبية تشتغل على بيانات مصطنعة. |
| `landing.illustrative` | توضيحي، بيانات اصطناعية | توضيحي، بيانات مصطنعة |
| `landing.tryIntro` | خمس منشآت اصطناعية، وحدة لكل حالة تعيدها الواجهة  … | خمس منشآت مصطنعة، وحدة لكل حالة تعيدها الواجهة البرمجية. وكل  … |
| `landing.faq.0.a` | لا. مآل يعرض مخرجات عدسة تمويل تجريبية على بيانات … | لا. مآل يعرض مخرجات عدسة تمويل تجريبية على بيانات مصطنعة. وهو ليس عرضًا من أي بنك، وهامش الربح ليس مع … |
| `landing.faq.2.a` | لا. كل منشأة في النسخة التجريبية اصطناعية. ويتطلب … | لا. كل منشأة في النسخة التجريبية مصطنعة. ويتطلب أي تشغيل فعلي إشعارًا بموجب نظام حما … |
| `landing.project` | مآل، مشروع تخرج جامعي. نسخة تجريبية على بيانات اصطناعية فقط. | مآل، مشروع تخرج جامعي. نسخة تجريبية على بيانات مصطنعة فقط. |
| `signIn.synthetic` | هذه النسخة التجريبية تشتغل على بيانات اصطناعية. | هذه النسخة التجريبية تشتغل على بيانات مصطنعة. |
| `admin.eyebrow` | مجموعة الخدمة، بيانات اصطناعية | مجموعة الخدمة، بيانات مصطنعة |
| `admin.note` | خمس منشآت مختارة لتعرض كل حالة تعيدها الواجهة الب … | … يدها الواجهة البرمجية (مجموعة الخدمة، N = {n}، بيانات مصطنعة). والقائمة الكاملة تحتاج GET /businesses، وه … |
| `lib/glossary.ts` line 18 | تقدير نموذج مخاطر التمويل لاحتمال تعثر المنشأة في … | … مال تعثر المنشأة في السداد. وهو مخرج نموذج على بيانات مصطنعة، وليس معدلًا مقيسًا. |
| `lib/glossary.ts` line 30 | قيمة AUC لمؤشر المخاطر المخفي لدى المولّد على هذه … | … C لمؤشر المخاطر المخفي لدى المولّد على هذه البيانات المصطنعة، وهي أقصى ما يبلغه أي نموذج هنا. تبيّن مقدار … |
| `lib/glossary.ts` line 162 | بيانات اصطناعية | بيانات مصطنعة |
| `lib/howItWorks.ts` line 45 | كل منشأة هنا [[synthetic-data\|بيانات اصطناعية]]  … | كل منشأة هنا [[synthetic-data\|بيانات مصطنعة]] ينتجها مولّد المشروع من إعدادات ثابتة. لا  … |
| `lib/howItWorks.ts` line 225 | كل هذا يعمل على بيانات اصطناعية، فلا يصف أي رقم هنا سوقًا حقيقية. | كل هذا يعمل على بيانات مصطنعة، فلا يصف أي رقم هنا سوقًا حقيقية. |

Long sentences are shown around the changed word; nothing else in them changed.

**Matches left alone.** `tests/record.test.ts` line 93, a pattern that looks for «ذكاء اصطناعي» (AI). Three lines of
this file inside entry 59, which quote the old "no AI" wording. Nothing fitted neither list.

**Backend text.** No Python, YAML or JSON file outside `web/` contains the word, so there is no backend text left for
an owner to change.

**Tests that expected the old word.** `tests/visuals.test.tsx` (the footer scope) and `e2e/pages.spec.ts` (the footer
constant) now expect «بيانات مصطنعة فقط». 18 Arabic visual baselines were rewritten: same sizes, and the only pixels
that differ are on the data source line and the footer line (five text lines on the landing page).

**CK1, page transitions use no experimental flag: pass.** `web/next.config.*` has no `experimental` key and no
`viewTransition` setting; no file under `web/app`, `web/components` or `web/lib` imports an `unstable_` name. The one
import is `import { Suspense, ViewTransition, type ReactNode } from "react";` in `web/app/[locale]/layout.tsx`. The
installed Next's own guide, `node_modules/next/dist/docs/01-app/02-guides/view-transitions.md`, says: "View transitions
work in the App Router with no configuration. React 19.3 includes the `<ViewTransition>` component and
`addTransitionType` API used in this guide."

**CK2, `tests/motion.test.ts` (R6) identical to the base: pass.** `git diff 5c6d923 HEAD -- web/tests/motion.test.ts`
is empty.

**The carried Playwright failures.**

- **`reduced motion: U7 zakat shows the nisab plate, the bars and the nisab marker`.** Failed every time. It expected
  the plate text "Nisab price is a commercial quote, pending independent verification". Since entry 54 the API returns
  `world_bank_monthly_average_pending_sharia_advisor`, so the app, correctly, shows that status's plate. The test was
  stale from the moment entry 54 reached the UI branch. The app was right; the test is fixed. It now requires the plate
  element itself (`main .plate`) to be visible with exactly the catalogue's words for the status the API returns, and
  that the status is not in `nisabVerified`. That is stricter than before, which only looked for the text anywhere on
  the page. Passed 3 of 3 headed.
- **`tour walks all steps for 10001`, English and Arabic.** Fails only under the API's limit of 60 requests a minute
  per business. Alone, the English walk passed 3 of 3; back to back, the Arabic walk failed 2 of 5, each time with the
  page showing "HTTP 429" where the verdict should be, and a new 429 in the API log. In the full run of entry 60 the
  English walk failed and the Arabic one passed; in this entry's first full run it was the reverse. So the Arabic walk
  was never "fixed as a side effect": it was lucky. The app's page is right and the test is right; the web server
  simply asks the API for business 10001 too often. The fix is the shared request layer (FX3) of the next entry, and
  both walks are rerun there.
- **`visual: zakat en light 1280`.** Passed 5 of 5 alone, and failed in the last full run with a 900 px error page
  (429) in place of the 1909 px page. Same cause, same fix. Because the visual file runs in order and stops at the
  first failure, 31 later snapshot tests did not run in that full run; all 36 pass when the file runs alone.

**The three skipped tests.** `records the Latin words on every Arabic page` is a recording tool that runs only when
`ARABIC_RECORD` names a file; it should stay skipped in a normal run. `phone scenario select scrolls to the diff` is
skipped on the tablet-768 and laptop-1280 projects because the select exists only on phones; it runs on the two phone
projects. Both skips are right.

**Checks at the end of this entry's work.** `tsc` and ESLint clean; build compiles; vitest 347 passed (345 before, plus
the two MO9 tests); pytest 214 passed, 8 failed, 2 skipped, equal to the baseline. Playwright, full suite on the quick
backend: before any change, 1126 passed, 2 failed (U7 zakat, Arabic tour), 3 skipped; at the end, 1095 passed, 3 failed
(both tour walks and the zakat snapshot, all three on a 429), 3 skipped, 31 did not run. The suite does not yet exit 0;
every remaining failure has the rate limit as its root cause and is carried to FX3.

**Sign-off:** ☐ team (the word for synthetic) ☐ compliance owner (Arabic copy)

## 62. Owner insights: registration number entry, what to do next, change over time; shared request layer; peer comparison stopped — PROPOSED (2026-11-11)

**Touches:** `web/`, plus one read-only route and its test in `api/` and `tests/` (decision 11 below), this entry and
the READMEs. Done on `faris/owner-insights`, following Part 3 of `SOP_close_out_merge_and_owner_insights.md`. The SOP
starts this branch from `origin/main` after the four UI branches are merged. They were not merged (stop code S10: the
`gh` tool is not installed, and the SOP forbids merging any other way), so the branch starts from `faris/ui-motion` at
`65d720e` (entry 61). Merge order: `faris/arabic-riyal`, `faris/receipt-plain`, `faris/record-wording`,
`faris/ui-motion`, then this branch.

**Decisions taken for this work, word for word (SOP section 1a, decisions 5 to 13).** Decision 6 is Faris's
(2026-11-11). The rest were proposed for Faris to confirm or change before the run; his instruction was to analyse and
follow the SOP, which was taken as confirming them unchanged. None was changed by Faris. Decision 9 could not be
carried out: see "Peer comparison stopped" below.

5. **Rate limit.** The fix is on the web server only: one shared request layer that removes duplicate calls and caches API answers in memory for a short time. No API change, no raised limit, no bypass of the request queue, no browser storage. An in-memory cache in the server process is not "storage" in the sense of the earlier decisions; say so in the entry.
6. **Demo number (Faris).** The entry field shows the hint "Demo commercial registration number: 10001".
7. **What the entry field validates.** A real Saudi commercial registration number is the 10-digit unified number that starts with 7. This demo holds only synthetic businesses numbered 10001 to 10300. So the field accepts a demo number, and tells the truth about a real one (CR1). The UI never claims a demo number is a real registration.
8. **Guidance is rule-based and fixed.** Every "what to do next" line comes from a written rule over values the API already returns, picks a fixed catalogue sentence, and names the value that triggered it. No generated text, no promise of an outcome, no financing or religious ruling. At most three lines per page.
9. **Comparisons carry their population.** Every comparison names the group and its N (for example "42 synthetic businesses in the same sector"). The group must have at least 20 businesses; below that, the comparison falls back to all serving businesses, and says so. The population is synthetic and the page says so (U11).
10. **No invented history.** Change over time shows only periods the data supports. If the backend can't give a value for an earlier period, that value is not shown; nothing is interpolated or estimated.
11. **Backend scope.** IN2 and IN3 may need new read-only API routes. Faris owns `profile_engine/` and is acting API owner, so changes in `api/` and `profile_engine/` are allowed for those two items only, read-only routes only, each with a test. Nothing in `lenses/`, `compliance/` or `pipeline/` is edited (S2).
12. **Fixed text.** Every new string exists in English and Arabic, every new Arabic string is marked draft, no em dash, none of the banned symbol characters.
13. **Motion rules hold.** New parts follow MO1 to MO9: no count-up, no new loop, reveals never hide content, everything stops under reduced motion.

**On decision 5: the in-memory cache is not storage.** The earlier decisions (42, 51, 60) forbid browser storage and
cookies: nothing about a visitor is kept on their device. The request layer keeps API answers in the memory of the web
server process, for 30 seconds (business data) or 5 minutes (reference data). Nothing is written to disk, nothing is
set in the browser, and what is kept is the API's own answer for a business, not anything a visitor typed.

**Rules added.**

| # | Rule | Enforced by | Test name |
|---|---|---|---|
| RL1 | One page view never sends the same API request twice, and the overview stays well under the limit | `lib/request-layer.ts`, used by every read in `lib/api.ts` | `overview makes each API call once`, `ten overview loads in a minute stay under the limit` (tests/request-layer.test.ts, against a recording stub of fetch) |
| RL2 | A cached answer is never shown for a different business, role or locale | The key is locale, role and route (the route names the business) | `cache never crosses business, role or locale` |
| CR-V1 | The entry field rejects bad input before any API call, with a message that says what is wrong | `lib/registrationNumber.ts`, one validator | `registration number validation`, `no API call is made for input that fails a format step` (tests/registration.test.tsx); `entry field error is announced and tied to the field` (also e2e/registration.spec.ts, which records every request and finds none) |
| CR-V2 | The UI never presents a demo number as a real registration | Fixed label and hint | `entry field says the number is a demo number` (vitest and Playwright, both locales) |
| GD1 | Every guidance line comes from a rule in the rule table and names its trigger value | `lib/guidance.ts` | `every guidance line maps to a rule and a value`, `each line on the page shows its rule's reason and the value that triggered it` |
| GD2 | Guidance never promises an outcome or gives a ruling | Banned-phrase lists in both languages | `guidance has no promise or ruling wording` |
| TR1 | Change over time shows only real periods; a missing period is absent, not estimated | `api/insights.py` and `components/Trends.tsx` | `trend shows no value the API did not return` (vitest); `test_history_points_are_real_periods_only`, `test_history_of_a_past_date_ignores_later_rows` (pytest) |

CP1 (comparisons show their group and N) has no test and no code: the comparison was not built.

Other new tests: `a kept answer is the same answer, receipt included`, `an error and a 429 are never kept`, `a 429
waits for the stated time and retries once, never in a loop`, `the health line is never kept`, `demo hint fills the
field`, `unknown business in the URL shows the hint`, `admin finder reads a typed number as a registration number`,
`at most three next steps`, `next steps amounts match the lens page`, `no next steps for roles that should not see
them`, `the cash rules never contradict each other`, `latest trend value equals the current value`, `trend has a table
equivalent`, `short history shows the sentence`, `the trend draws nothing through values and compares with no other
business`, and eight pytest tests for the history route.

### FX3: the shared request layer

**Measured before** (10001 as owner, live quick API, upstream calls counted in the API's log): the overview made 5
calls, one per route, none repeated inside the page; the credit, zakat and forecast pages made 1 each. Nothing was
kept between page views, so ten overview loads made 50 calls and the twelfth page view of one business inside a
minute got HTTP 429. That, and not a fault in any page, was why the tour walks and one snapshot failed in full runs.

**The layer.** Every server-side read goes through `lib/request-layer.ts`, then the existing queue (one API request at
a time, entry 41, unchanged):
- a read already in flight for the same key is shared, not repeated;
- a good answer is kept in memory: 30 s for business data (profile, lenses, history), 5 min for reference data (the
  business list, the scenario catalogue); the health line is never kept. The lifetimes are in `lib/cache-lifetimes.ts`;
- the key is locale, role and route;
- an error and a 429 are never kept;
- on a 429 the layer waits for the API's `Retry-After` (1 s if none, 5 s at most) and tries once more; a second 429
  shows the page's existing error state. It never loops;
- at most 500 answers are kept; the oldest goes first.

A kept answer is the same object the API returned, so receipts and reference numbers still match the output hash
(PR4 passes). The key stays on the server (`lib/api.ts` is still `server-only`; the key-leak guard passes). The online
snapshot reads files and skips the layer.

**Measured after:** the overview makes 5 calls plus 1 for the history of IN3; the credit, zakat and forecast pages
opened after it make 0; ten more overview loads make 0. The tour walks passed 5 of 5 back to back, where the Arabic
walk had failed 2 of 5.

### CR1, CR2: the commercial registration number field

**Where a business is entered.** Sign-in as owner (`SignInForm`): a field labelled "Commercial registration number"
with the hint "10 digits", which was never read; sign-in always opened 10001. The admin finder (`BusinessPicker`): a
name or a full business ID. The admin list filter (`BusinessSearch`): the first digits of an ID, and a sector. The
header's search dialog (`CommandPalette`) and business switcher (`BusinessSwitcher`): names picked from a list.

**What changed.** The sign-in field is now read: a valid demo number opens that business as the owner. The validator
is also used for typed digits in the admin finder. The list filter, the search dialog and the switcher are a prefix
filter and two name pickers, where "10 digits starting with 7" cannot apply; they are unchanged.

**This amends entry 42.** Entry 42 said the registration number is not read at all, and the sign-in notice said
"nothing you type is saved or sent". The number is now checked in the browser and chooses which demo business opens;
it becomes part of that page's address and goes nowhere else. The notice now reads: "Demo sign-in. No accounts exist.
The password is checked in this browser only. The number you enter only chooses which demo business opens, and nothing
else you type is saved or sent." The form still sends no request, sets no cookie and stores nothing (tested).

**The validator, in order** (`lib/registrationNumber.ts`; spaces and dashes are dropped and Arabic-Indic and Persian
digits are read as digits first):

| Input | Message (English) | Message (Arabic, draft) |
|---|---|---|
| empty | Enter a commercial registration number | أدخل رقم السجل التجاري |
| not all digits | Use digits only | استخدم الأرقام فقط |
| 5 digits, a demo business | accepted | |
| 5 digits, no such demo business | No demo business has this number. Demo numbers run from 10001 to 10300 | لا توجد منشأة تجريبية بهذا الرقم. الأرقام التجريبية من 10001 إلى 10300 |
| 10 digits starting with 7 | This looks like a real commercial registration number. This demo holds synthetic businesses only. Try 10001 | يبدو أن هذا رقم سجل تجاري حقيقي. هذه النسخة التجريبية تضم منشآت مصطنعة فقط. جرّب 10001 |
| 10 digits not starting with 7 | A commercial registration number is 10 digits and starts with 7 | رقم السجل التجاري مكوّن من 10 أرقام ويبدأ بالرقم 7 |
| any other length | A commercial registration number is 10 digits and starts with 7. Demo commercial registration number: 10001 | رقم السجل التجاري مكوّن من 10 أرقام ويبدأ بالرقم 7. رقم سجل تجاري تجريبي: 10001 |
| 5 digits not in the online preview | This preview holds only some demo businesses, and this number is not one of them. Try 10001 | هذه المعاينة تضم بعض المنشآت التجريبية فقط، وهذا الرقم ليس منها. جرّب 10001 |

The range in "from 10001 to 10300" is asked of the API on the server (`GET /businesses`, first and last row, kept 5
minutes); the config range is only the fallback if the API does not answer. No call is made from the browser, and none
at all for input that fails a format step.

**Label and hint.** Label "Commercial registration number" / «رقم السجل التجاري». Hint, always visible under it: "Demo
commercial registration number: 10001" / «رقم سجل تجاري تجريبي: 10001» (draft). The number is a button named "Use the
demo number 10001" that fills the field. The number follows the digits switch.

**Behaviour.** The format is checked when the field is left and when the form is sent, not on every key press. An
empty field is refused only on sending, so tabbing through raises no error. The message sits under the field, is tied
to it with `aria-describedby`, sets `aria-invalid`, has `role="alert"`, and focus returns to the field.
`inputmode="numeric"`, `type="text"`.

**A bad number in the address.** `/business/99999`, an in-range number the store does not hold, and `/business/abc`
show the existing not-found state with the demo hint and a link to 10001. The last one used to throw on the server
(the name helper divided by a non-number); it no longer does. A number outside the demo's range now gets no invented
business name: the heading is the number as typed.

**Left as they are, for Faris:** the admin finder is still labelled "Find a business by name or ID", the admin list
filter still says "business ID", and the business pages' addresses still carry the number as `/business/<id>`.

### IN1: what to do next

`lib/guidance.ts` holds the rule table. Each rule reads fields the API already returns, picks one fixed catalogue
sentence, and carries the field and value that fired it. At most three lines show, lowest priority number first: under
the verdict on the overview, and each lens's own lines at the end of its page. Each line has a link to the page that
explains it and a "Why am I seeing this?" disclosure with the rule in plain words and the trigger value.

| Priority | Rule | Lens | Condition | Sentence (English; the Arabic is a draft in the catalogue) |
|---|---|---|---|---|
| 1 | G-cash-floor | forecast | `forecast.crunch_alert.days_to_projected_negative_balance` is a number | Your balance is forecast to fall below your cash floor around {date}. Plan for about {amount} more by then |
| 2 | G-sharia-flag | sharia | `sharia_screen.rules_triggered` has at least one rule | Items that need a Sharia review: {count}. Open the Sharia screen to see them |
| 3 | G-cash-watch | forecast | `forecast.crunch_alert.level` is watch or crunch, and no negative balance is projected | Your crunch alert is at {level}: the 30-day liquidity hazard is {pct}. See the forecast for what drives it |
| 4 | G-credit-top | credit | `credit_explanation.public_tier` has a line whose direction is against; the first one | The factor weighing most on your credit result: {factor} |
| 5 | G-zakat-due | zakat | zakat computed, liability above 0, and `zakat.hawl_completion_date` within 60 days of `as_of`, before or after | Your zakat year ends on {date}. The estimate so far is {amount} (after the date: Your zakat year ended on {date}. The estimate is {amount}) |
| 6 | G-sharia-question | sharia | `sharia_screen.disclosures` has at least one question | Questions for you on the Sharia screen: {count}. They are shown for information |
| 7 | G-review | review | `anomaly.flags` has at least one transaction | Transactions listed for you to review: {count}. A full list is normal: it is a queue for a person, not an alarm |
| 8 | G-zakat-pending | zakat | zakat computed and `zakat.nisab_source_status` not in the catalogue's verified list | The zakat estimate uses a nisab price that is not yet confirmed. Treat it as an estimate |
| 9 | G-cash-ok | forecast | `forecast.crunch_alert.level` is none and every projected minimum balance is at or above 0 | Your forecast stays above your cash floor through day {days} of the forecast |
| | G-nothing | | no rule fired, on a business where at least one lens ran | Nothing needs your attention right now |

Changes from the SOP's draft table, each because of what the API returns:
- **G-cash-watch is new.** 10001's forecast stays above the floor while its crunch alert is at Watch. Without this
  rule the owner would have been told only that the forecast stays above the floor.
- **G-sharia-question is new.** The Sharia screen lists questions for the owner (disclosures) that are not rules for
  review; they get their own, lower line.
- **G-credit-top quotes the backend's own line** verbatim (U4) instead of a factor label, because the API gives no
  English label for a factor.
- **G-review's wording** follows the review page's own framing (a queue, not an alarm); the SOP's "unusual
  transactions are waiting" would have overstated a list that is always filled to ten.
- **Counts are written as "thing: {count}"**, so no sentence needs plural forms in either language (rule A6).
- **G-nothing is silent when no lens ran** (a business refused as insufficient data): "nothing needs your attention"
  would not be true of a business nothing was computed for.

**Figures.** Every amount and date is the API's value through the app's own formatters. One figure is worked out:
G-cash-floor's date is `as_of` plus the returned number of days, and its sentence says "around". Its amount is the
lowest projected balance the API returned, and the sentence says "about".

**Who sees it.** The owner only. The DECISIONS 58 roles table does not cover a new owner-only block, so the admin, the
public demo and the Compliance View see none; this is for Faris to confirm. The role is read in the browser, as
`RoleRecord` does.

**Print.** The block is hidden in print and is not on the decision sheet, so the sheet's page count for 10001 is
unchanged.

**For 10001 the overview shows:** G-cash-watch, G-credit-top, G-zakat-due (ended 21 July 2026, estimate 5,963.26).

### IN3: change over time

**Route.** `GET /insights/history?business_id=` (`api/insights.py`, Faris as acting API owner). For four profile
features it returns the value as of the business's own as-of date and as of earlier dates 30 days apart. Each value is
the profile engine's own, through `pipeline.data.run_profiles`, with only the as-of date moved: the four features are
computed from daily aggregates inside the trailing 90-day window, so nothing else needs to change. A date is included
only if the whole 90-day window before it lies inside the business's data, so every point is the same measure. Nothing
is interpolated. The newest point equals `/profile` today (tested for 10001 and one business per other sector). The
route is keyed, rate-limited per business, explicit on `insufficient_data`, and carries the same receipt as `/profile`.
Nothing in `lenses/`, `compliance/`, `pipeline/` or `profile_engine/` was edited.

**The four figures:** `avg_monthly_inflow`, `inflow_outflow_ratio`, `avg_daily_balance`, `cash_flow_volatility`. They
are profile figures the owner already sees, and they depend on daily data alone. The Arabic labels are the backend's
own factor labels, except volatility: the backend calls it «استقرار التدفق النقدي» (stability), which would read
backwards beside "up" and "down", so the block says «تقلب التدفق النقدي» (draft).

**What the data supports.** 10001 has 180 days of data (1 February to 30 July 2026), which gives four dated values.
Of the first 45 serving businesses: 34 have four, 3 have three, 2 have one or two, 4 have none, and 2 are refused as
insufficient data. The shortest history among the 300 is 30 days.

**Display.** Inside the profile figures on the overview: the current value; a direction word and the API's two values
("Up since 30 June 2026: 231,437.86 then, 232,275.55 now"), with no difference worked out; a small line of the dated
values; and the same values as a table. Fewer than three dates shows "Not enough history yet to show a trend". A date
with no value has no mark and the line does not join across it. The line is drawn at once. Marks are 44 px targets
with the 14 px dot and the shared focus ring, and show a readout on hover, focus and tap. Time runs left to right in
Arabic.

**Credit and zakat results over time are not shown.** Recomputing a lens result for a past date needs the lens's own
code run on past inputs, and several of its inputs (counterparty windows, obligations, the balance-sheet snapshot)
are stored only as of today. The web app never rebuilds a lens result (decision 10).

### IN2: peer comparison stopped (S6)

The comparison with similar businesses was not built for the owner. Schema §36.4 is titled "Rejected: Synthetic-
Population Peer Benchmarking": it rejects a "how do you compare to peers" feature because it presents a comparison
against synthetic businesses to the person least able to detect the substitution. Rule U9 (entry 41) is "No peer
benchmarking (§36.4)", with a test. Decision 9 above adds labelling but does not say it overrides §36.4 or U9, and the
SOP's stop code S6 says that where the SOP conflicts with the schema or DECISIONS beyond section 1a, the repo is
followed and the conflict reported.

What the data would support, for the record: sector groups among the 300 serving businesses whose profile ran are
retail trade 143, construction 98, food and beverage 36 and professional services 5, so the last would need the
all-businesses fallback. A read-only route and its tests were written and then taken out before anything was pushed;
they are kept outside the repo as a patch. The same schema section points to the self-comparison of §36.2 as the
version that keeps the useful part, and that is IN3.

Options for the team: keep the rejection (nothing to do); or amend §36.4 and U9 by a team decision, after which the
route and a comparison block can be added.

### Checks

At the head of the branch, on the quick backend (N = 300 serving businesses):

- `tsc` and ESLint clean; the build compiles.
- vitest: 380 passed (347 at the end of entry 61).
- Playwright, full suite, all projects: 1159 passed, 0 failed, 3 skipped (the three explained in entry 61). The run
  before the last fixes had 1156 passed and 3 failed, all three the admin finder's refusal tests, which expected the
  old message for typed numbers; they now name the message each input gets and also check that no request is sent.
  Both tour walks and all 36 visual snapshots pass inside the full run, which they did not before the request layer.
- The API log for the full run holds 13 rate-limit refusals, all for business 10011, which one test exhausts on
  purpose to check the "request limit" state; there is no other 429.
- That log also showed a fault in the first version of the request layer: the one retry after a 429 never reached the
  API, because Next remembers identical requests within one page render. Each request now carries an abort signal,
  the documented way to opt out, and the log shows the retry (two refusals per route in that test, not one).
- Visual snapshots: none changed. The new blocks are owner-only or inside closed sections, so the public pages the
  snapshots cover are the same.
- The decision sheet for 10001 prints on 3 pages, as before. Ten quick overview loads show no error state.
- pytest, on the current store (`MAAL_STORE=data/serving_quick.duckdb`): 229 passed, 1 failed, 2 skipped; before this
  entry 221 passed, 1 failed (a test that expects 1,000 businesses, where the quick store holds 300). The difference is
  the 8 new history tests. On the default `data/serving.duckdb`: 215 passed, 12 failed, 3 errors, 2 skipped, against
  214 passed and 8 failed before. That store is stale (built before entry 30: "business(es) have thinned rows but no
  counterparty_windows rows"), which is the cause of the 8 old failures and of the 7 new tests that need the store.
  It needs rebuilding with `python -m api.store`; this entry does not touch it.

**Deviations from the SOP.** The branch starts from `faris/ui-motion`, not `main` (S10). IN2 is not built (S6). CR1 and
CR2 are one commit, because the validation and the hint are one component. The validator is used by the sign-in field
and the admin finder's number path, not by the three name pickers and the prefix filter. An empty registration field
is refused on sending, not on leaving it. Lens-page guidance sits at the end of the page, after the record card. The
manual pass in a visible browser was done by automated checks and screenshots; nobody has yet walked it by eye.

**Sign-off:** ☐ team (entry field, guidance, trend) ☐ compliance owner (guidance wording on zakat and Sharia, Arabic copy) ☐ credit lens owner (credit guidance line) ☐ API owner (new read-only route, request layer)
