# Behavioral Profile Engine — Feature Schema

**Version:** v2.9 (see change log at bottom) &nbsp;|&nbsp; **Status:** Living technical reference — locked sections require team sign-off to change.

**Purpose:** This is the single contract every lens (Credit, Cash-Flow, Anomaly, Compliance) reads
from. Lock this schema before writing any model code. Changing it later means re-touching every
lens, so get disagreements out now, not in Week 6.

**Convention:** all features are computed per business, over a rolling trailing window (default:
90 days, noted where different). `type` is the runtime data type. `lens` shows which module(s)
consume the feature.

---

## 1. Income / Revenue Features

| # | Feature | Type | Definition | Used by |
|---|---------|------|------------|---------|
| 1 | `avg_monthly_inflow` | float (SAR) | Mean total incoming transaction value per calendar month | Credit, Cash |
| 2 | `inflow_count_per_month` | int | Average number of incoming transactions per month | Credit, Anomaly |
| 3 | `inflow_regularity_score` | float [0–1] | 1 − (coefficient of variation of inflow timing intervals); higher = more predictable income | Credit, Cash |
| 4 | `revenue_growth_rate_90d` | float (%) | % change in average monthly inflow, current 90d vs prior 90d | Credit, Cash |
| 5 | `largest_single_source_ratio` | float [0–1] | Share of total inflow value from the single largest counterparty | Credit, Anomaly |

## 2. Expense Features

| # | Feature | Type | Definition | Used by |
|---|---------|------|------------|---------|
| 6 | `avg_monthly_outflow` | float (SAR) | Mean total outgoing transaction value per calendar month | Credit, Cash |
| 7 | `outflow_count_per_month` | int | Average number of outgoing transactions per month | Anomaly |
| 8 | `recurring_expense_ratio` | float [0–1] | Share of outflow value classified as recurring/fixed (rent, payroll, subscriptions) vs. variable | Credit, Cash |
| 9 | `expense_growth_rate_90d` | float (%) | % change in average monthly outflow, current 90d vs prior 90d | Cash |
| 10 | `top_expense_category_share` | float [0–1] | Share of outflow going to the single largest expense category | Credit |

## 3. Volatility / Risk Features

| # | Feature | Type | Definition | Used by |
|---|---------|------|------------|---------|
| 11 | `cash_flow_volatility` | float | Standard deviation of daily net cash flow (inflow − outflow) | Credit, Cash, Anomaly |
| 12 | `inflow_outflow_ratio` | float | avg_monthly_inflow / avg_monthly_outflow. Denominator floored per Section 16's epsilon convention (same floor as #4/#9) — a dormant-expense business must not be allowed to explode this ratio. | Credit, Cash |
| 13 | `days_negative_balance_90d` | int | Count of days where end-of-day balance < 0 | Credit, Cash |
| 14 | `overdraft_events_90d` | int | Count of distinct overdraft occurrences | Credit |
| 15 | `volatility_index` | float [0–100] | Composite score combining #11–#14, normalized | Credit |

## 4. Liquidity Features

| # | Feature | Type | Definition | Used by |
|---|---------|------|------------|---------|
| 16 | `avg_daily_balance` | float (SAR) | Mean end-of-day account balance over window | Credit, Cash |
| 17 | `min_daily_balance_90d` | float (SAR) | Lowest end-of-day balance in window | Cash |
| 18 | `current_runway_days` | float | `balance_today ÷ max(burn_rate_30d, epsilon)`, where `burn_rate_30d` is the trailing 30-day mean daily net outflow (only when burning cash — see corrected definition and worked rationale in Section 16). **Corrected in v2.7:** the prior definition used the 90-day *average* balance, which systematically overstates runway for any business that is actively burning down its balance, since the 90-day mean sits above today's balance by construction. | Cash |
| 18b | `runway_days_avg_balance` | float | The original average-balance formulation (`avg_daily_balance ÷ burn_rate_30d`), retained as a separate, clearly-labeled feature for context — never used alone to drive an alert. | Cash (context only) |
| 19 | `liquidity_trend_slope` | float | Linear regression slope of daily balance over trailing 30 days | Cash |

## 5. Counterparty / Concentration Features

| # | Feature | Type | Definition | Used by |
|---|---------|------|------------|---------|
| 20 | `unique_counterparties_count` | int | Distinct payer/payee entities in window | Anomaly |
| 21 | `counterparty_concentration_index` | float [0–1] | Herfindahl-style concentration index over counterparty transaction value | Credit, Anomaly |
| 22 | `new_counterparty_ratio_30d` | float [0–1] | Share of transaction value involving counterparties not seen before, last 30 days | Anomaly |

## 6. Compliance & Sustainability Features

| # | Feature | Type | Definition | Used by |
|---|---------|------|------------|---------|
| 23 | `declared_mcc_code` | categorical | Business's registered Merchant Category Code(s) | Compliance |
| 24 | `sharia_screen_status` | enum: `compliant` / `hard_flag` / `soft_flag_review` | Output of MCC + counterparty rule screening | Compliance, Credit |
| 25 | `esg_proxy_score` | float [0–100] | Composite of environmental/governance/social proxy signals | Credit (markup adjustment) |
| 26 | `governance_transparency_score` | float [0–1] | Derived from transaction regularity + traceability (reuses #3, #11) | Compliance, ESG |

---

## 7. Balance-Sheet Snapshot (Monthly) — Required Separately for Zakat

**Important correction:** Zakat on business assets is calculated from zakatable assets minus
short-term liabilities (commonly approximated via the Net Working Capital method), **not** from
cash-flow/transaction volume. Features 1–26 above are insufficient on their own to compute Zakat
correctly. This is a distinct, smaller profile, generated and read separately.

| # | Feature | Type | Definition | Used by |
|---|---------|------|------------|---------|
| 27 | `cash_and_equivalents_eom` | float (SAR) | End-of-month cash + bank balances | Zakat |
| 28 | `inventory_value_eom` | float (SAR) | End-of-month inventory value at zakatable valuation | Zakat |
| 29 | `accounts_receivable_eom` | float (SAR) | End-of-month amounts owed to the business (collectible) | Zakat |
| 30 | `accounts_payable_eom` | float (SAR) | End-of-month amounts owed by the business, short-term | Zakat |
| 31 | `short_term_liabilities_eom` | float (SAR) | Other short-term debt/liabilities due within the Zakat year | Zakat |

**Data implication:** the synthetic data generator must output three distinct tables, not one:
1. `transactions.csv` — raw daily inflows/outflows.
2. `daily_aggregates.csv` — pre-aggregated daily summaries (max ~90 rows per business); this is
   what `GET /profile/{business_id}` actually reads at runtime, to keep the &lt; 2s API target
   achievable (see Section 12).
3. `balances_monthly.csv` — end-of-month cash, inventory, receivables, payables, short-term
   liabilities (feeds features 27–31, Zakat only).

**Demo framing:** state this limitation openly — *"Zakat requires balance-sheet data, not just
cash-flow. We generate this synthetically in parallel; a real integration would pull it from an
accounting system (e.g., QuickBooks) rather than a bank feed alone."* This is an accuracy detail a
Saudi-based reviewer is likely to check specifically — do not present Zakat as "near-zero extra
effort" derived from the same transaction stream as everything else.

---

## 8. API Read-Paths (Architecture Reference)

Three lenses run independently and simultaneously off one shared profile — no lens is gated on
another's output. Versioned, explicit read-paths:

| Route | Reads | Returns |
|---|---|---|
| `GET /profile/{business_id}` | Raw transaction data (via `daily_aggregates.csv`, Section 12) | The transaction-derived feature vector — features 1–26, 32–33, 36, 40–59 (Sections 30–34) — "the chart." **Corrected in v2.7:** this route does **not** return the balance-sheet features (27–31, 34–35), which live in a separate profile read only by `/lenses/zakat` (see Section 7). The prior "features 1–36" range implied a single unified vector, which contradicted Section 7's explicit statement that the balance-sheet snapshot is generated and read separately, and contradicted Section 26's controllability table, which tags 27–31/34–35 `fixed` on the assumption the recourse generator can see them via this route. State the exact feature-ID membership list in code, not as a range, so this can't drift again. |
| `GET /lenses/credit` | Profile | Decision + terms + SHAP-based plain-language explanation |
| `GET /lenses/forecast` | Profile | 30/60/90-day projection + crunch alert |
| `GET /lenses/anomaly` | Profile | Flagged transactions with `flag_reason` (never `fraud_reason`) — raw anomaly scores are never returned by the API; see Section 29 |
| `GET /lenses/zakat` | Balance-sheet snapshot (separate from the above) | Annual Zakat liability |

**Why this matters for review:** adding a future lens means registering a new route against the
existing schema — the profile engine itself never changes. This is the concrete proof of the
"single engine, multiple lenses" reuse claim, not just a diagram.

---

## 9. Week 8 "Demoable" Definition (Charter Language)

Put this verbatim in the team charter so "done" isn't a debate under deadline pressure:

> **Demoable (Week 8 gate) =** a CLI script or notebook that ingests `transactions.csv`,
> `daily_aggregates.csv`, and `balances_monthly.csv`, passes them through the shared profile
> engine, and outputs one JSON object containing: credit decision (`base_markup_pct` always
> present, `adjusted_markup_pct` null unless ESG is built — see Section 11), cash-flow forecast +
> crunch alert, anomaly flags, and Zakat liability, for a single business. **No UI required to
> pass this gate.**

No stretch-goal (ESG scoring, NLP classification, dashboard polish) code is written before this
gate is met. If not met by Week 8, stretch goals are cancelled and Weeks 9–12 go to polish and
documentation of the core only.

---

## 10. Evaluation & Explanation Notes

- **Cash-flow lens:** report MAPE against a naive (trailing-30-day-average) baseline, plus a
  "holdout shock" test — inject a deliberate synthetic macro-event (e.g., a 30% revenue drop) and
  report detection lead time vs. the naive baseline's lead time. A comparison chart (model vs.
  baseline vs. actual) is the strongest single visual in the whole project.
- **Credit lens explanation:** two tiers, not one. Public tier = plain-language template (see main
  proposal). Compliance/debug tier = raw SHAP values + the exact lookup-table mapping used to
  generate the plain-language text, toggleable live in the demo ("Compliance View"). This is the
  concrete proof that the system is not a black box.
- **Sharia soft-flags:** ambiguous MCC codes should prompt the business owner directly (e.g., "We
  detected a general trading code — does more than 50% of your revenue come from [category]?")
  rather than silently routing to a static manual-review queue. This demonstrates the system
  handles real-world data ambiguity, not just clean-case rules.

---

## 11. Credit Lens Output Contract — Base vs. ESG-Adjusted (Decoupling Fix)

**Correction applied:** the Credit Lens must not depend on the ESG module, since ESG scoring is a
Week-8-gated stretch goal. The credit decision is a two-step process, and the JSON contract makes
the dependency explicit rather than implicit:

```json
{
  "decision": "approved",
  "amount_sar": 45000,
  "base_markup_pct": 6.0,
  "adjusted_markup_pct": null,
  "markup_fixed_at_inception": true,
  "late_penalty_policy": "charity_directed",
  "repayment_months": 12,
  "recourse": null,
  "stress": null
}
```

**`stress` (added v2.7):** nullable, same fail-soft pattern as `adjusted_markup_pct` and
`recourse` — null unless the Section 34 stress module is built. When present, it is an array of
scenario results re-scored against the finished, frozen model. **There is, and must never be, a
`stressed_markup_pct` field or any field that varies `base_markup_pct`/`adjusted_markup_pct` based
on stress output** — see the Sharia constraints in Section 34. This absence is asserted here
explicitly, not left implicit, per the same "encode the guarantee in structure" logic already
applied to the fields that *do* exist.

**GenAI shell outputs (Section 36, added v2.8) are never added to this contract.** The generative
financial health report and the navigator response are produced by a separate read-only service
*after* this JSON is final and receipt-hashed — they are not fields of this object, precisely so
the reproducibility receipt's byte-identical guarantee never has to cover non-deterministic content.

- `base_markup_pct` is **always present** — computed by the Base Murabaha Lens (committed core),
  a flat/risk-tiered rate independent of ESG.
- `adjusted_markup_pct` is **null unless the ESG module is built**. If built, it is
  `base_markup_pct` minus a basis-point discount derived from `esg_proxy_score` (feature 25).
- `markup_fixed_at_inception` is **always `true`** — the rate is set once at contract signing and
  never repriced or floated during the repayment term, whether or not ESG adjustment applies.
  Risk-tiering different businesses at different fixed rates is fine; changing one business's rate
  mid-contract is not.
- `late_penalty_policy` is **always `"charity_directed"`** — any late-payment penalty collected is
  directed to charity, never retained as income, per Section 17.
- `recourse` is **null unless the counterfactual recourse module is built** (Section 27) — same
  fail-soft pattern as `adjusted_markup_pct`. When present, it is only populated on a decline
  originating from the risk model with `sharia_screen_status == "compliant"`; never on a
  compliance-driven decline.
- This proves the core stands alone: cancelling either stretch goal at Week 8 does not break the
  Credit Lens — the corresponding field simply stays null and the UI shows the base output.

---

## 12. Synthetic Data Generator — Configuration, Not Randomization

Random number generation alone makes backtesting non-reproducible and anomaly precision-at-k
meaningless. The generator must be driven by an explicit, versioned config, e.g.:

```yaml
business_profile: sme_retail_moderate
volatility_level: moderate
start_date: "2026-02-01"
window_days: 180
inject_cash_crunch:
  week: 6
  severity_pct: 30
inject_anomalies:
  - type: large_transfer
    week: 9
  - type: odd_hours_transaction
    week: 11
seed: 42
```

`start_date` is required, not cosmetic: it is what lets the 180-day window be placed deliberately
over a Hijri Ramadan/Eid period for the Section 16 seasonality test (feature 36, `ramadan_adjusted`)
rather than depending on whatever date the generator happens to be run. Generate at least one
business config with `start_date` placed to overlap Ramadan and one that doesn't, so the
false-positive comparison in Section 16 is reproducible on demand, not incidental to timing.

Show this file in the demo — it is the difference between "we tuned parameters until the demo
looked good" and "this is a controlled, repeatable scientific instrument." Every backtest and
holdout-shock result reported in the final write-up must cite the config used to generate it.

**Held-out anomaly requirement:** precision-at-K measured only against anomaly types the generator
itself injects is partially circular — it only proves the detector finds what it was told to hide.
At least one anomaly type must be defined **only in the evaluation harness**, never in
`config.yaml`, so it is genuinely unseen by anything that touched the generator. Report
precision-at-K separately for injected vs. held-out anomaly types.

**Third output table required:** `daily_aggregates.csv` — pre-aggregated daily summaries (max ~90
rows per business) alongside `transactions.csv` and `balances_monthly.csv`. The feature engine
(`GET /profile/{business_id}`) reads from this pre-aggregated table, not raw transactions, so the
36-feature computation stays in milliseconds rather than seconds — this is what makes the &lt; 2s
API response target in the main proposal actually achievable, not just aspirational. State this
explicitly in the demo: *"We pre-aggregate transaction data daily to separate analytical compute
from real-time serving."*

---

## 13. Explainability &amp; Validation — Must Be Rule-Based, Not Eyeballed

**SHAP-to-plain-language threshold table (hard-coded, documented, auditable):**

SHAP values here are in **log-odds units** (native XGBoost output scale) — state this explicitly
in the compliance-tier payload so the units are never ambiguous. The table must also be
**direction-aware**: "strongly influenced" reads very differently to an applicant depending on
whether it pushed the decision up or down, so direction and magnitude are reported separately.

| `abs(SHAP)`, log-odds | Magnitude term | Direction | Applicant-facing phrasing |
|---|---|---|---|
| &gt; 0.3 | "strongly" | positive | "...strongly supported this decision" |
| &gt; 0.3 | "strongly" | negative | "...was the main factor working against approval" |
| 0.1 – 0.3 | "moderately" | positive | "...moderately supported this decision" |
| 0.1 – 0.3 | "moderately" | negative | "...moderately weighed against approval" |
| &lt; 0.1 | "marginally" | either | "...had only a small effect either way" |

The exact thresholds can be tuned, but they must be a fixed, documented table — never an
ad-hoc judgment call per decision. This is what allows a Sharia board to audit the translation
logic rather than trust it blindly.

**Time-series validation (no look-ahead bias):** the generator's default `window_days: 180`
(Section 12) gives roughly six months of history per business, so the CV scheme must be scaled to
that, not to a full year. All model validation uses expanding-window cross-validation matched to
this window: train on months 1–3, validate on month 4; train on months 1–4, validate on month 5;
train on months 1–5, validate on month 6. **Random shuffling of time-series data for train/test
splits is not permitted anywhere in this project.** If a longer history becomes available (e.g.,
via real SAMA sandbox data, or a longer synthetic window is generated specifically for the Zakat
hawl requirement — see Section 17), extend the expanding-window scheme proportionally; do not mix
a 6-month CV scheme with a 12-month generated history without re-deriving the split points.

**Entity-level split, in addition to the temporal split (added v2.7):** expanding-window CV alone
only guarantees no *future* data leaks into the past for a given business. It does not stop the
same business appearing in both a training fold and the validation fold. Because Section 14's
default labels are driven by *per-business* latent variables that persist across the entire
window, a model can partially memorize business-level effects rather than learning generalizable
risk signal, inflating validation AUC. The CV scheme is therefore two-dimensional: split
**temporally** (as above) **and** by **business ID**, so that no business ever appears in both the
training and validation portion of any fold. State both splits explicitly in the methodology
write-up — "expanding-window CV" on its own reads as if leakage is fully handled, and it is not
until the entity-level split is named alongside it.

---

## 14. Credit Label Generation — Fixing Circularity (Critical)

**The problem:** if the synthetic generator produces "default" labels as a direct function of the
same observable features the model consumes (e.g., a rule like "default if volatility high"),
XGBoost will simply recover that rule. The resulting AUC ≥ 0.85 would be circular — it proves
nothing about real predictive power, and "where do your labels come from?" is the question that
ends a defense if the honest answer is "a rule using the same features we scored on."

**The fix:** default events are generated from **latent variables the model never sees**, plus
noise:

- `latent_management_quality` — hidden per-business parameter, not exposed as a feature.
- `latent_market_shock_sensitivity` — hidden per-business parameter, not exposed as a feature.
- Observable features (1–36) are generated as **noisy, partial reflections** of these latent
  variables — the same relationship real transaction data has to real underlying business health
  (visible behavior correlates with, but does not fully determine, creditworthiness).
- Default events are sampled as a function of the latent variables + independent noise, **not**
  directly from the observable feature set.

**Reporting requirement:** report ROC-AUC **as a function of label-noise level** (e.g., AUC at
noise σ = 0.1, 0.2, 0.3), not a single headline number. This preempts "did you just tune the noise
until you hit 0.85?" — the honest answer becomes "here is how performance degrades as the labels
get noisier, which is itself the finding."

**Sector-conditional latents (added v2.7 — makes the Section 25 fairness audit non-trivial):** if
`latent_management_quality` and `latent_market_shock_sensitivity` are drawn i.i.d. across sectors,
then sector carries **no true default signal** in the synthetic world, XGBoost has nothing to
learn from the sector code even if it tried, and the Section 25 fairness audit ("the model doesn't
shortcut to sector") would pass *trivially* — it could not have failed, so passing it proves
nothing. The generator must instead draw `latent_market_shock_sensitivity ~ Beta(α_s, β_s)` with
sector-specific parameters, so that, e.g., construction genuinely carries a higher unconditional
default rate than professional services in the ground truth. The Section 25 audit is only
meaningful once a real shortcut is available to the model and demonstrably not taken. Report the
ground-truth per-sector default differential in the final write-up alongside the audit result, so
the panel can see the shortcut existed and the model was shown not to have taken it — this is
stronger evidence than an audit with no shortcut to find.

**Correlation-strength parameter (closes the side door):** if observable features perfectly
reflect the latent variables, circularity sneaks back in even with latents in the design —
"noisy reflection" only breaks the shortcut if the noise is real. `config.yaml` must state an
explicit `latent_to_observable_correlation` parameter (e.g., 0.6), and AUC should additionally be
reported as a function of this parameter alongside label-noise level, so the team can show the
model's performance is not an artifact of an accidentally-too-clean generator.

---

## 15. Data Sufficiency &amp; Thin-File Handling

The most common real-world SME case is **thin file** — 30 days of history, gaps, a single account.
Without an explicit rule, every lens silently computes garbage on new businesses instead of
declining to score them.

| # | Feature | Type | Definition | Used by |
|---|---------|------|------------|---------|
| 32 | `coverage_days_90d` | int | Number of days with at least one transaction, out of the trailing 90 | All lenses |
| 33 | `data_gap_ratio` | float [0–1] | Share of **expected business-operating days** (trailing 90 days minus Fridays/Saturdays and declared public holidays — the weekly Saudi weekend, not calendar days) with zero transaction data. **Clarified in v2.7:** this is deliberately not `1 − coverage_days_90d/90`. Using raw calendar days for both #32 and #33 makes them near-duplicates, since most SMEs have no transaction activity on non-operating days regardless of health. Excluding non-operating days from #33's denominator makes it a genuinely different signal from #32: a business with gaps *on days it should have been operating* is a materially different risk case than one that's simply closed on weekends. | All lenses |

**Hard eligibility rule (applies before any lens runs):** if `coverage_days_90d < 60`, the profile
engine returns `status: "insufficient_data"` for that business — **not** a low score, not a
default-flagged score, an explicit refusal to score. This must show up in the Week 8 CLI/JSON
output as a distinct state, not silently as `null`.

**Partial-history state (added v2.7 — closes a gap the 60-day gate misses):** features 4 and 9
(`revenue_growth_rate_90d`, `expense_growth_rate_90d`) compare the current 90-day window against
the *prior* 90 days — they require roughly 180 days of history, not 60. A business with, say, 75
days of coverage passes the `insufficient_data` gate but has no prior window to compare against,
and the Section 16 epsilon floor would return `null` for the wrong reason ("prior inflow ≈ 0")
when the real reason is "no prior period exists." Every feature definition in Sections 1–2 that
depends on a prior comparison window must now carry an explicit `min_history_days` attribute
(180 for #4 and #9). If `coverage_days_90d ≥ 60` but total available history `< min_history_days`
for a given feature, the profile engine returns `status: "partial_profile"` for that business (a
distinct, non-blocking state — the business is still scored) and that specific feature returns
`null` with `reason: "insufficient_history"`, distinguishable from `reason: "near_zero_denominator"`
in the Section 16 epsilon case. This lets the credit lens's SHAP explanation state "this factor was
not available" rather than silently treating an absent signal the same as a genuinely near-zero one.

---

## 16. Edge Cases &amp; Null Conventions (Feature Definitions)

- **`current_runway_days` (#18):** undefined/not applicable when the business is not net-burning
  cash (net daily cash flow ≥ 0). Convention: return `null`, render in UI as "not applicable —
  business is cash-flow positive," never `0` or `Infinity`.
- **Growth rate features (#4, #9):** near-zero denominators (e.g., prior-period inflow ≈ 0) make
  a percentage growth rate explode or divide-by-zero. Convention: apply an epsilon floor on the
  denominator (e.g., minimum SAR 500) and cap reported growth at ±300%; below the epsilon, return
  `null` rather than a real number. Without this, one outlier month poisons the credit lens.
- **Saudi calendar seasonality:** a fixed 90-day trailing window that happens to straddle
  Ramadan/Eid will make retail revenue look anomalous or falsely "crashing," depending on
  business segment — exactly the kind of business your demo audience is likely to know well.
  Explicitly run the Section 10 holdout-shock backtest across a window that includes Ramadan, not
  only a neutral period, and report anomaly false-positive rate with and without the seasonal
  adjustment below.

| # | Feature | Type | Definition | Used by |
|---|---------|------|------------|---------|
| 36 | `ramadan_adjusted` | bool | True if any part of the trailing 90-day window overlaps the Hijri Ramadan/Eid period (computed from the Hijri calendar, not assumed fixed-Gregorian) | Anomaly, Forecast |

**Known limitation:** `ramadan_adjusted` is a coarse gate ("don't trust raw comparisons this
window"), not a magnitude adjustment — it does not tell a lens how much of the window overlaps or
which days. That is sufficient for the anomaly false-positive-rate demonstration in Section 16.
It is **not** sufficient for the forecast lens to make a quantitative seasonal correction; that
would need an overlap fraction or a per-day calendar table, which is out of scope for this term.
State this limitation explicitly in the final report so the seasonality feature isn't
over-claimed as more than a gate.

---

## 17. Murabaha Mechanics &amp; Zakat Corrections (Sharia-Advisor-Facing)

**Fixed markup at inception:** now encoded directly in the credit output contract as
`markup_fixed_at_inception: true` (Section 11) — the rate is set once at signing and never
repriced during the repayment term. Risk-tiered pricing (different rates for different risk
profiles) is fine; a rate that changes after the contract is signed is not.

**Late payments:** conventional late fees are riba. Now encoded directly in the credit output
contract as `late_penalty_policy: "charity_directed"` (Section 11) — any late-payment penalty
collected is directed to charity, never retained as income. This single field is a strong,
concrete signal that the team understands the underlying Sharia principle rather than just
labeling the product "Sharia-compliant."

**Zakat — nisab and hawl were missing:** the Net Working Capital method is a valid approximation,
but Zakat only applies above the nisab threshold and after a full lunar year (hawl) of ownership.
Add:

| # | Feature | Type | Definition | Used by |
|---|---------|------|------------|---------|
| 34 | `nisab_threshold_met` | bool | Whether zakatable net assets exceed the current nisab value | Zakat |
| 35 | `hawl_completion_date` | date | Date the business completes one full lunar (Hijri) year of asset ownership at/above nisab | Zakat |

If `nisab_threshold_met` is false, or the hawl period is incomplete, the Zakat lens must return
`liability_sar: 0` with an explicit reason (`"below_nisab"` / `"hawl_incomplete"`) — not a computed
figure that silently assumes both conditions are satisfied.

**Demo data note — this will always show `hawl_incomplete` unless seeded deliberately.** The
default generator window (`window_days: 180`, Section 12) is under a lunar year, so
`hawl_completion_date` can never be reached from generated transaction history alone, and every
demo business will return a zero Zakat liability. That is a technically correct state and worth
showing once — but decide deliberately whether that is the whole story you want to tell. To also
demo a non-zero Zakat liability, add an explicit opening state to `config.yaml`:

```yaml
zakat_seed:
  hawl_start_date: "2025-08-01"
  opening_net_assets_sar: 120000
```

This seeds a business that already held qualifying assets above nisab before the visible
transaction window begins, so `hawl_completion_date` can fall within the demo period. Generate at
least one demo business with this seed (non-zero liability) and at least one without it (correctly
returns `hawl_incomplete`) — showing both proves the rule is real, not hardcoded to always pass or
always fail.

---

## 18. Consent &amp; PDPL Note

The proposal claims alignment with SAMA Open Banking, which is itself a consent-based framework —
but no document currently mentions consent management or Saudi PDPL (Personal Data Protection
Law) explicitly. For a synthetic-data demo, this is one paragraph, not a build item: state that any
real deployment would require explicit, revocable user consent for each data category accessed
(per SAMA Open Banking consent standards) and PDPL-compliant handling/retention of any personal or
financial data. Its absence currently undercuts the "enterprise-grade" framing in the proposal.

---

## 19. Week-by-Week Plan (12 Weeks, Week 8 Gate Marked)

Referenced in the briefing document but not previously written down anywhere — this is the
authoritative version.

| Week | Milestone |
|---|---|
| 1 | Lock the current version of this document at time of signing as the Week 1 baseline. Stand up synthetic data generator skeleton + `config.yaml`, including the two-stage-plus-age-tier sampling (Section 20), disjoint train/serving population seeds (Section 23), and the sector-relative reference-stats pipeline (Section 35) — these are Week-1-or-never decisions since they touch the feature contract every lens reads. Apply for SAMA sandbox access (parallel track, non-blocking). Begin SME owner outreach for qualitative validation (Demo & Credibility plan, item 5: 8-10 candidates, parallel channels — start now, yield is low). |
| 2 | **Generator-only for its owner.** Everyone else builds profile-engine scaffolding against a small, hand-made sample dataset (not the real generator output) so they are not idle but also not coupled to the generator's quality yet. Generator owner works toward all three tables (`transactions.csv`, `daily_aggregates.csv`, `balances_monthly.csv`) with sector-consistent balance sheets (Section 24), latent-variable-driven labels (Section 14), and seasonality-calibrated curves (Section 22). |
| 3 | **Generator Accepted gate (end of week, pass/fail — see below).** If passed, the rest of the team switches from the hand-made sample to real generator output for the behavioral profile engine (features 1–26 from `daily_aggregates.csv`). If failed, the generator owner gets first call on any available team time in Week 4 to fix it before anything downstream proceeds. |
| 4 | Data-sufficiency rule (Section 15) + edge-case null conventions (Section 16) implemented. |
| 5 | Base Murabaha credit lens (flat/risk-tiered markup, no ESG) trained with expanding-window CV; forecast lens (naive baseline + model) running. **This week is only achievable if the Week 3 gate passed on schedule — both lenses depend directly on generator output quality, not just its existence.** |
| 6 | Anomaly lens (Isolation Forest) running; held-out anomaly type added to eval harness (Section 12 fix). Ramadan-window holdout-shock test run. |
| 7 | SHAP integration + threshold table (Section 13); Zakat lens (nisab/hawl-aware) running off `balances_monthly.csv`. **Serving-path latency smoke test run here, not deferred to Week 10** — see below. |
| **8** | **Hard gate:** CLI/notebook demoable per Section 9 definition, including `insufficient_data` state, base/adjusted markup contract, and the credit, forecast, and anomaly lens outputs plus Zakat liability, all in one JSON. **Go/no-go for stretch goals decided here.** |
| 9 | If gate passed: begin stretch goals in build order (Section 28) — counterfactual recourse first, then the survivability stress-testing module (Section 34), then ESG — and/or start the Next.js UI shell (separate milestone, not blocking the core). If gate missed: stretch goals cancelled, full focus shifts to polish. |
| 10 | UI wired to the five API read-paths (Section 8); Compliance View toggle (Section 10) implemented. |
| 11 | Full-system integration test; holdout-shock and label-noise-vs-AUC results finalized for the report. |
| 12 | Documentation, defense rehearsal, buffer. |

**Generator Accepted gate — pass/fail criteria (end of Week 3):** all three of the following must
hold, checked against a small manually-inspected sample, not just "the script runs without
erroring":
1. Balance sheets are sector-consistent (Section 24) — e.g., a construction-sector business in the
   sample actually shows long-dated receivables and low inventory, not generic random values.
   **Machine-checkable per v2.7 (Section 30):** construction-sector businesses must show
   `implied_dso_days` in `[60, 120]`; professional/digital-services businesses must show
   `implied_dio_days < 5`. Run this as an assertion in the eval harness, not only a visual check.
2. Labels are demonstrably not a direct function of the observable features they're paired with
   (Section 14) — spot-check that two businesses with near-identical observable profiles can carry
   different default labels, proving the latent-variable path is actually wired in, not bypassed.
3. Simulated POS/inflow curves qualitatively track the expected Ramadan/Eid pattern (Section 22) —
   a visual plot check is sufficient at this stage; the full empirical alignment work continues
   after this gate.

If any of the three fails at end of Week 3, treat it as a real schedule event, not a rounding
error — Week 5's credit and forecast lenses are not achievable on a generator that hasn't cleared
this gate, per the note in the Week 5 row above.

**Serving-path latency smoke test (Week 7, not Week 10):** run the full serving path — profile
computation, XGBoost inference, and SHAP explanation generation — end-to-end at N = 1,000 (Section
23's serving scale) and check against both named metrics: API response &lt; 2s and SHAP
explanation generation &lt; 1s. Training being fast on a laptop CPU says nothing about serving
latency under the pre-aggregation design (Section 12) actually holding up — test this with enough
runway left (Week 7, one week before the gate) to fix it if it doesn't, rather than discovering it
during Week 10's UI-wiring work when there's no slack left to address it.

**Note on the UI:** the proposal's "fully integrated web platform" (Next.js) is a **post-Week-8
milestone with its own gate (Week 10)**, not a Week 8 requirement — the Week 8 gate is CLI/JSON
only, by design (Section 9). Present these as two separate, clearly labeled milestones rather than
one continuous promise, so the UI timeline can slip without threatening the core grade.

---

## 20. Two-Stage Conditional Sampling (Sector → Size)

Sampling sector and enterprise-size tier independently distorts real economic structure — it
would produce nonsense edge cases like large numbers of medium-sized single cafés or micro-scale
civil engineering contractors. The generator instead samples in two sequential, dependent stages:

- **Stage 1 (sector):** each business is assigned an industry sector drawn from national SME
  sector distributions (e.g., Wholesale/Retail, Construction, F&amp;B, Logistics).
- **Stage 2 (size, conditional on sector):** the size tier (Micro/Small/Medium) is then sampled
  from a probability distribution specific to that sector — so F&amp;B skews overwhelmingly micro,
  while construction and manufacturing carry a realistically higher share of small/medium
  enterprises.

`config.yaml` must express this as a joint distribution, not two independent fields:

```yaml
sector_size_distribution:
  retail_trade:      { weight: 0.28, size_tiers: { micro: 0.85, small: 0.13, medium: 0.02 } }
  construction:       { weight: 0.15, size_tiers: { micro: 0.45, small: 0.40, medium: 0.15 } }
  food_beverage:      { weight: 0.12, size_tiers: { micro: 0.90, small: 0.09, medium: 0.01 } }
  logistics:          { weight: 0.05, size_tiers: { micro: 0.55, small: 0.35, medium: 0.10 } }
  # (excerpt — remaining sectors omitted; full config's weights must sum to 1.0)
```

**Stage 3 (age tier, conditional on sector × size) — added v2.7:** the two-stage design has no
notion of business vintage, and `coverage_days_90d` (feature 32) currently conflates "genuinely
young business" with "sparse reporting for an unrelated reason," even though Section 26 tags it
`fixed`. Add an `age_tier` (e.g., `<1yr`, `1–3yr`, `3–7yr`, `7yr+`) sampled from a distribution
conditional on the already-sampled sector and size (young businesses skew micro and skew toward
F&amp;B/retail; a medium-tier construction firm being under two years old is rare). `coverage_days_90d`
and the thin-file population (Section 15) then become a **consequence** of the sampled age tier
rather than an independently random parameter, which makes the thin-file demonstration realistic
rather than an arbitrary carve-out. A fourth stage (geography, since GASTAT shows Riyadh dominance
and it affects counterparty concentration and seasonal amplitude) was considered and deliberately
cut for this term's timeline — note it in the final report the same way ESG/NLP/security scope
cuts are already named, rather than leaving it silently unaddressed.

## 21. Emergent, Non-Circular Macro Validation

To prove the dataset is scientifically grounded rather than circularly engineered to pass its own
tests, every validation metric must fall into exactly one of two categories, and the two must
never be conflated:

- **Calibration inputs** (what the generator is explicitly told): sector weights, conditional size
  ratios, latent management-quality distributions (Section 14), `latent_to_observable_correlation`.
- **Emergent validation targets** (what the generator is never told, and must reproduce anyway):
  published macroeconomic figures the simulation is not instructed to hit.
  - **Aggregate revenue by tier:** the generator calibrates business *counts* per tier, but the
    *revenue share* per tier (e.g., medium enterprises contributing a disproportionate share of
    national SME revenue despite being a small share of business count) must emerge from simulated
    daily cash flows, not be hardcoded — then compared against GASTAT's published SME revenue
    breakdown.
  - **Macro default/NPL rate:** the overall proportion of businesses that default is not set
    directly; it emerges from latent risk shocks interacting with simulated cash flows (Section
    14), and the resulting aggregate rate is then compared against published central-bank
    non-performing-loan figures as a sanity check, never tuned backward to match them.

If an emergent target is wildly off, that is a finding to report, not an invitation to hardcode the
target directly — doing so would silently turn an emergent validation into a second calibration
input wearing a validation label.

**Pre-registered tolerance bands (added v2.7 — closes a post-hoc-judgment gap):** "wildly off" is
currently a judgment made *after* seeing the result, which is exactly the kind of unfalsifiable
framing this section otherwise guards against. Every emergent target must instead carry a
tolerance band **committed in `config.yaml` before the validation run**:

```yaml
emergent_validation_targets:
  - metric: revenue_share_medium_tier
    source: "GASTAT SME Establishments Statistics 2022"
    published_value: 0.41
    tolerance_rel: 0.15
    status_on_fail: report_as_finding   # never: retune
```

A result outside its pre-registered band is reported as a finding, exactly as this section already
requires — the only change is that the band itself is committed to version control before the run,
so "did you tune until it matched?" has a documented, dated answer.

**Distributional comparison, not just point comparison (added v2.7):** where the published source
gives a distribution rather than a single figure (sector mix, size-tier shares), report a
distributional distance against the pre-registered tolerance, not an eyeballed bar chart:
Kolmogorov–Smirnov statistic `D = sup_x |F_sim(x) − F_pub(x)|` for categorical/tier distributions,
or Wasserstein-1 distance for continuous ones (e.g., revenue distribution), since it penalizes the
*magnitude* of the mismatch rather than only whether the CDFs cross.

**Held-out anchor year (added v2.7):** calibrate seasonality and macro targets against all but the
most recent full year of published data, then report the fit against that held-out year. This
converts the emergent-validation claim from "we compared against published figures" (which could
still be circular if the same year informed both calibration and comparison) into an actual
out-of-sample test, mirroring the held-out anomaly-type discipline already required in Section 12.

**Survivorship bias in the calibration source (added v2.7 — must be stated, not silently accepted):**
Monsha'at/GASTAT sector and size weights describe **currently registered, active** SMEs — a
survivor population. Businesses that already failed are not represented in it. The generator then
produces *forward* defaults from latent shocks (Section 14) applied to that survivor population,
and the resulting aggregate default rate is compared against published NPL figures drawn from a
**bank-lending population**, which carries its own selection (banks already screened these
borrowers before lending). Neither comparison is invalid on its own, but the mismatch between the
three populations (registered stock → simulated-forward defaults → lending-population NPLs) is
real and must be stated explicitly in the final report, in the same register as the existing
GASTAT-publication-lag note: the claim is directional and order-of-magnitude, not a like-for-like
match between identical populations.

**Source discipline for every emergent target:**

- **Archive on download, not on demand.** The day any government/central-bank source is pulled for
  a calibration or validation target, save a local copy (PDF/XLSX as published) alongside the
  citation. Government portals reorganize; a link that resolves in Week 2 may 404 by Week 12, and
  a validation claim with a dead source link is functionally unverifiable at defense time.
- **Pin the exact edition, never "latest."** Cite as "GASTAT SME Establishments Statistics 2022,"
  "SAMA Financial Stability Report 2024," "mada POS weekly bulletin, [specific week]" — a specific,
  dated publication, not a rolling reference that silently changes meaning if re-checked later.
  This entire validation methodology depends on comparing against a fixed, named snapshot.
- **Known lag — state it, don't paper over it.** GASTAT's SME statistics publish annually with a
  delay; the 2022 edition is the most recent full release at time of writing. Calibration targets
  will therefore be 2–3 years old by demo time. This is acceptable and should be stated explicitly
  in the final report: the claim is that the synthetic population matches **the most recent
  published census of the economy**, not the economy as of the demo date. Do not imply real-time
  accuracy the data cannot support.
- **SME-specific NPL data may not exist as a clean published series.** SAMA publishes sector-level
  and banking-system-level NPL figures; a dedicated SME breakdown is patchier and may not appear in
  the Financial Stability Report at all. Before committing to "SME NPL rate" as a named validation
  target in this schema, Week 1 must check: (1) whether the FSR contains an SME-specific figure for
  the target year, and (2) if not, whether sector-level NPLs plus Kafalah program guarantee/default
  reporting can serve as a defensible fallback proxy. If neither is available with a pinned,
  citable source, drop the NPL emergent target rather than asserting a number that can't be traced
  to a specific publication.

## 22. Empirical Seasonality &amp; Payment Trajectory Alignment

Rather than estimating spending fluctuations and ticket sizes by intuition, transaction generation
is benchmarked against real central-bank payment statistics:

- **POS volume curves:** the amplitude, inflection points, and post-holiday drop-offs of simulated
  daily retail inflows are aligned with published monthly card-payment (mada) trends across the
  Hijri calendar, specifically the Sha'ban → Ramadan → Eid cycle — this is what makes the
  `ramadan_adjusted` feature (36) and its holdout-shock test (Section 16) empirically grounded
  rather than a plausible-sounding guess.
- **Ticket size bounds:** average transaction amounts and daily transaction frequency per sector
  are validated against national card-transaction totals divided by overall volume, so simulated
  ticket values reflect real point-of-sale behavior rather than an arbitrary distribution.

**Hijri/Gregorian re-indexing (added v2.7 — a real gap in the prior calibration method):** mada
bulletins publish on the **Gregorian** calendar; the `ramadan_adjusted` feature (36) and the
seasonal effect it gates are **Hijri**, drifting roughly 11 days earlier each Gregorian year.
Comparing simulated Hijri-indexed seasonality directly against Gregorian monthly aggregates without
re-indexing smears the Ramadan peak across two calendar months and understates its true amplitude.
Correct method: let `w_{m,h}` be the fraction of Gregorian month `m` that overlaps Hijri month `h`
(exactly computable from any Hijri conversion library). If `P_m` is the published POS value for
month `m`, `T_m` a smooth Gregorian baseline trend (fit first, e.g. via LOESS), and `β_h` the
unknown per-Hijri-month seasonal multiplier:

```
P_m ≈ ( Σ_h w_{m,h} · β_h ) · T_m
```

Stacking 36+ months of published data and solving for `β` by non-negative least squares
(constrained to `mean(β) = 1`) is identifiable precisely because Ramadan falls in different
Gregorian months across different years. The resulting `β_Ramadan`, `β_Eid` multipliers are
empirically estimated from real published data, rather than a plausible-sounding guess, and are
what the generator's Ramadan amplitude should be calibrated against.

## 23. Dual-Scale Population Strategy (Solving Cell Sparsity)

A 1,000-business demo population makes rare segments statistically unreliable — the ~2% Medium
tier would produce only ~20 entities and potentially a single default event, which is not enough
to validate per-tier credit discrimination. The generator runs at two explicit scales:

- **Research &amp; benchmarking scale (N = 10,000):** model training, expanding-window
  cross-validation (Section 13), and ROC-AUC-vs-noise sensitivity testing (Section 14) run here —
  enough medium-tier businesses and default events for statistically meaningful per-tier results.
- **Serving &amp; demonstration scale (N = 1,000):** a representative slice indexed into the demo
  database, sized specifically to keep live UI queries and multi-lens API calls within the &lt; 2s
  response target (Section 12).

Report which scale every number in the final write-up came from — an AUC computed at N=10,000 and
a demo response time measured at N=1,000 are both legitimate, but only if labeled.

**Demo population must be disjoint from training, not a subset (added v2.7 — closes a real risk):**
the prior wording ("a representative slice indexed into the demo database") did not state whether
the N=1,000 serving population is drawn *from* the N=10,000 research population or generated
independently. If it is a subset, every business scored live at the defense was in the model's
training data, and a judge asking "was this business in your training set?" gets an uncomfortable
answer. Fix: generate the serving population with a **separate seed and a disjoint business-ID
range**, both named explicitly in `config.yaml` as two distinct populations, with disjointness
asserted by the eval harness (not just assumed). The live demo is then genuinely out-of-sample, and
this can be stated proactively rather than defensively.

**Minimum-cell rule for evaluation (added v2.7):** the sector × size joint distribution in Section
20 produces cells far sparser than the marginal counts suggest — e.g., food/beverage-medium at
weight 0.12 × 0.01 = 0.12% of N=10,000 is ~12 businesses, and at a single-digit-percent default
rate that cell can expect well under one default event. This directly undermines the Section 25
within-sector fairness audit, which needs *defaults within sector* to say anything. Rule: do not
report a per-cell metric (per-sector AUC, per-sector-tier fairness attribution) unless the cell has
≥ 30 businesses **and** ≥ 10 default events; cells below that threshold report as
`insufficient_sample`, the same discipline Section 15 already applies to individual business
scoring, now applied to evaluation. Where a fairness or per-tier claim needs a thin cell filled,
generate a **supplementary stratified population** (e.g., N=2,000, oversampling thin cells) used
only for that audit, with importance weights available to recover unbiased aggregate estimates if
needed — reported and labeled as its own population, per the scale-labeling rule above.

## 24. Sector-Consistent Balance Sheet Synthesis

Transactions and balance-sheet snapshots (Section 7) must tell one coherent operational story per
business, not two independently randomized datasets that happen to share a business ID. Balance
sheet generation inherits sector archetypes:

- **Retail &amp; trading:** high inventory ratios, modest receivables, short collection delays.
- **Contracting &amp; construction:** low physical inventory, high working-capital liabilities, and
  long-dated receivables (60–120 days), reflecting real milestone-billing practice.
- **Professional &amp; digital services:** near-zero inventory, short-term liabilities concentrated
  almost entirely in monthly payroll.

Without this, the Zakat lens (features 27–31, 34–35) or the liquidity/runway features (16–19) could
be computed on a balance sheet that contradicts the business's own simulated cash flows — e.g., a
construction firm with zero receivables despite long milestone-billing cycles in its transaction
history.

## 25. Within-Sector Algorithmic Bias Audit

Sectors like construction naturally carry higher cash-flow volatility and longer payment cycles
than, say, professional services. Without an explicit check, the credit model could learn to
penalize a sector code wholesale rather than genuinely assessing individual business risk within
that sector — which would be a fairness problem and, for a Sharia-compliant product, a real
compliance problem (penalizing an entire lawful sector rather than individual risk).

**Audit method:** using the SHAP infrastructure already required for explainability (Section 13),
compute feature attributions **within each sector separately**, not only in aggregate. The audit
passes if, within construction specifically, the top attributed features are liquidity-trend and
working-capital-resilience features (16–19, 11–15) — not the sector code itself or features that
function as a proxy for it. This is the concrete evidence for a specific, checkable claim: *the
model rewards disciplined operators within a volatile sector, rather than penalizing the sector as
a whole.*

---

## 26. Feature Controllability Classification

Every feature (1–36) is tagged with whether a business can act on it, for use by the recourse
generator (Section 27) and for general transparency about what a signal actually means. Recorded
here as one consolidated reference table rather than as a column retrofitted into each of the eight
feature tables above — same information, lower risk of an inconsistent edit landing in only one
place.

| Tag | Meaning | Example features |
|---|---|---|
| `controllable` | A business can directly change this through its own decisions | `largest_single_source_ratio` (5), `recurring_expense_ratio` (8), `new_counterparty_ratio_30d` (22) |
| `influenceable` | Changes gradually, through sustained behavior, not a single decision | `inflow_regularity_score` (3), `cash_flow_volatility` (11), `counterparty_concentration_index` (21), `days_negative_balance_90d` (13) |
| `fixed` | Not actionable by the business at all, on any timescale relevant to a financing decision | `coverage_days_90d` (32), `account age` (implicit in window features), macro/seasonal features (`ramadan_adjusted`, 36), balance-sheet timing features (27–31, 34–35), all Section 34 stress-scenario outputs (52–54 and any `stress` array contents — macro conditions are not actionable by the business, see Section 34 constraint 3), `sector_relative_*` z-scores (55–59, since they are sector *reference statistics*, not something a business can move on its own) |

**v2.7 additions not yet classified above, added explicitly so the table stays the single source
of truth:** `cash_conversion_cycle_days` and its components (37–40) — `controllable`, since a
business can change receivables/payables terms; `financing_outflow_ratio` (41) — `influenceable`;
`installment_capacity_sar` (42) — derived, inherits the controllability of its inputs;
`inflow_break_recency_days` (43), `net_flow_autocorr_lag7` (44) — `influenceable`;
`counterparty_persistence_ratio` (45) — `influenceable`; `circular_counterparty_count` (46) —
`influenceable`; `downside_semideviation_90d` / `upside_semideviation_90d` / `flow_asymmetry_ratio`
(47–49) — `influenceable`; `revenue_shock_absorption_pct` (50), `fixed_obligation_coverage_months`
(51) — `influenceable`, derived from controllable/influenceable inputs.

**Rule:** the recourse generator (Section 27) may only construct counterfactuals from features
tagged `controllable`, optionally `influenceable` — never `fixed`. This filtering happens at the
feature-definition level, not inside the recourse code, so it can't be silently bypassed by a
future addition that forgets to check.

---

## 27. Counterfactual Recourse (Post-Gate Stretch Goal)

**What it is:** for a declined credit decision, in addition to the SHAP-based explanation
(Section 10, 13), show one or two counterfactuals — the minimal change to a `controllable` feature
that would flip the decision. E.g., "if your largest client were 30% of revenue instead of 55%,
this decision would approve." This is a genuinely novel addition at this level: explanation says
*why*, recourse says *what to do about it* — an active responsible-AI research area, not a solved
problem, so the design below deliberately narrows scope rather than attempting the general case.

**Design constraints (each resolves a specific risk):**

1. **Perturbation whitelist, not the general problem.** Counterfactuals are only generated from a
   fixed whitelist of near-independent features: `largest_single_source_ratio` (5),
   `recurring_expense_ratio` (8), `new_counterparty_ratio_30d` (22), `days_negative_balance_90d`
   (13). The general recourse-under-correlated-features problem is unsolved research; this project
   does not attempt to solve it, only to bound it to a checkable case.
2. **Sector-plausibility check.** A counterfactual is only surfaced if the perturbed profile still
   falls within the observed range for that business's sector archetype (Section 24 — reusing the
   same sector-conditioned distributions the generator itself uses). The claim is explicitly bounded:
   *"this counterfactual describes a business that could plausibly exist in your sector,"* not a
   guarantee of real-world achievability.
3. **Controllability filter.** Only `controllable` features (Section 26) are eligible — never
   `fixed`, and `influenceable` only with a caveat in the wording that the change happens over time,
   not instantly.
4. **Structural Sharia separation, not wording care.** Recourse is generated **only when**
   `sharia_screen_status == "compliant"` **and** the decline originated from the risk model, not
   the compliance gate. If `sharia_screen_status` is `hard_flag` or `soft_flag_review`, the output
   is a compliance explanation only — the recourse code path is not reachable from that branch at
   all. This is enforced by branching on the same enum used everywhere else in this document
   (Section 6, feature 24), not by careful phrasing in a template, so it can't drift under later
   editing.

**Output contract:** `recourse` is added to the Section 11 JSON as a nullable field, following the
same pattern as `adjusted_markup_pct` — always present as a key, `null` unless the module is built:

```json
"recourse": null
```

or, if built:

```json
"recourse": [
  {"feature": "largest_single_source_ratio", "current": 0.55, "suggested": 0.30,
   "plain_language": "If your largest client made up 30% of revenue instead of 55%, this decision would approve."}
]
```

**Cost:** the minimal version (single-feature counterfactuals from the whitelist, binary-searching
the decision boundary on the already-trained XGBoost model from Section 11) is roughly 2–3 days of
work once the Week 8 gate has passed — it is a read-only layer over a finished, frozen model, so it
cannot destabilize the credit lens itself. See Section 28 for where this sits in the stretch-goal
build/cut order.

**Known limitations (record in the final report regardless of whether this ships):** single-feature
perturbation does not model feature interdependency; the sector-plausibility check is a bound, not
a proof of achievability; and the whitelist is deliberately narrow rather than comprehensive. Naming
these explicitly, with the mitigations above, is itself part of the contribution — it demonstrates
the hardest objections were anticipated, not missed.

---

## 28. Stretch-Goal Policy (Build Order vs. Cut Order — Explicit Direction)

A single "priority order" is ambiguous under pressure — it doesn't say whether the highest-priority
item goes first when building or survives longest when cutting. This project uses two named,
opposite-direction orders so neither is ever unclear:

> **Build order (attempted in this sequence after the Week 8 gate):** (1) counterfactual recourse,
> (2) survivability stress-testing module (Section 34), (3) ESG scoring &amp; markup adjustment,
> (4) NLP sector classification.
>
> **Cut order (abandoned in this sequence if time runs short):** (1) NLP sector classification cut
> first, (2) ESG scoring cut second, (3) survivability stress-testing cut third, (4) counterfactual
> recourse cut last.
>
> No item may be re-prioritized without a team decision recorded in this change log.

**v2.7 proposal, pending team sign-off:** the stress-testing module (Section 34) is inserted at
build-order position 2 because it shares recourse's fail-soft, read-only-over-a-frozen-model safety
property at comparable effort (~2–3 days), and because a stress-tested approval is a stronger
defense claim than a partially-built ESG discount. This is recorded here as a proposed change per
this section's own policy — it takes effect once the team records the decision, not automatically
on this document's edit.

**Why cost-ascending build order is safe here specifically:** recourse, the stress module, and ESG
all **fail soft by design** — a cancelled ESG module leaves `adjusted_markup_pct` null and the UI
shows the base rate (Section 11); a cancelled recourse module simply omits the `recourse` field's
contents; a cancelled stress module leaves `stress` null. None leaves the system in a broken or
half-built state. This ordering logic does not generalize automatically to a future stretch goal
that fails hard (leaves partial state) — re-derive the argument per item, don't assume "cheapest
first" is always safe.

**Why recourse goes first despite being decided on later:** it is the cheapest stretch item by an
order of magnitude (2–3 days vs. ESG's multi-week scope) and touches only a finished, frozen model
post-gate — it cannot destabilize core work the way it could pre-gate, which is why an earlier,
reasonable-sounding argument for cutting it first ("it touches the most complex component") no
longer applies once Week 8 has passed.

**Acknowledged counterweight:** the ESG module is visible in the proposal abstract as a named
planned enhancement, so its absence is more likely to be asked about than recourse's, which is
promised nowhere. This is an argument for ESG's visibility, not its build priority — a working
recourse feature plus "ESG is in progress" outperforms a rushed ESG plus no recourse at all. Done
beats promised.

---

## 29. Security Considerations (Threat Model &amp; Data Handling)

Scoped for what a 3-month academic project can actually deliver and defend — this is not an
enterprise security audit, but it must be more than the one-paragraph PDPL note in Section 18. The
goal is to show the threat surface was thought through deliberately, with named mitigations, not
to claim production-grade hardening.

**Credential and token handling (if SAMA sandbox access is used):** any Open Banking access token
or credential is treated as a secret at the same level as a database password — never committed to
the repository, never logged, never placed in a URL query string (per the general privacy rule
this project already follows). Stored in environment variables or a local secrets file excluded
from version control. If sandbox access is not obtained in time (Track B, the synthetic-data
default defined in the Project Scope, Data &amp; Resource Briefing, Section 3.2), this entire
subsection is moot for the demo but stays documented for completeness and for the "what a real
deployment would require" framing already used for PDPL (Section 18).

**API authentication for the five read-paths (Section 8):** even for a demo, the five routes
(`/profile`, `/lenses/credit`, `/lenses/forecast`, `/lenses/anomaly`, `/lenses/zakat`) should
sit behind a minimal authentication check — a single shared API key for the demo environment is
sufficient scope for this project; a real deployment would need per-business-owner authentication
and authorization (a business can only ever query its own profile). State this distinction
explicitly rather than silently building an open API and calling it done.

**Threat: adversarial probing of the anomaly lens.** An unsupervised anomaly detector's decision
boundary can, in principle, be probed by repeated queries to learn what does and doesn't trigger a
flag — the same general concern as adversarial evasion against any classifier. Full adversarial
robustness is out of scope for this project, but two cheap mitigations are in scope and worth
implementing: (1) never expose raw anomaly scores or thresholds through the API, only the final
flag and `flag_reason` (Section 8) — score values are strictly more informative to an attacker
than a binary/categorical outcome; (2) rate-limit queries per business ID on the demo API, which
also happens to be good practice independent of the security argument.

**Synthetic-vs-real data boundary.** Since Track B (synthetic data) is the default and Track A
(real SAMA sandbox data) is opportunistic — both defined in the Project Scope, Data &amp; Resource
Briefing, Section 3 — every stored record must be unambiguously tagged with its source
(`data_source: "synthetic"` / `"sandbox"`), enforced at the point of generation or ingestion, not
inferred later. This prevents two failure modes: presenting a synthetic result as if it were
validated on real data (a scientific-integrity issue, not just a security one — see the same
Briefing section's evaluation-honesty commitment), and, if real sandbox data is ever used,
applying synthetic-data-appropriate handling (casual storage, easy sharing across the team)
to what would actually be regulated personal financial data.

**What is explicitly out of scope, stated rather than left implicit:** penetration testing,
encryption-at-rest for the demo database, formal adversarial robustness evaluation of any model,
and production-grade key management (e.g., a secrets manager rather than environment variables).
Naming these as deliberate scope cuts — the same discipline already applied to ESG, NLP, and
recourse — is a stronger answer to a security-focused question than either pretending they're
covered or being caught not having considered them.

---

## 30. Working-Capital Cycle Features (Added v2.7)

**Why:** Section 24 asserts sector-consistent balance sheets (e.g., construction shows 60–120 day
receivables) and Section 19's Week 3 gate checks this "by manual inspection" — but until now there
was no feature that made the check machine-verifiable. These four features are computed entirely
from existing data (features 1, 6, 28, 29, 30) — no new tables, no new generator work.

| # | Feature | Type | Definition | Used by |
|---|---------|------|------------|---------|
| 37 | `implied_dso_days` | float | `(accounts_receivable_eom / max(avg_monthly_inflow, 500)) × 30` — implied Days Sales Outstanding | Credit |
| 38 | `implied_dio_days` | float | `(inventory_value_eom / max(avg_monthly_outflow, 500)) × 30` — implied Days Inventory Outstanding | Credit |
| 39 | `implied_dpo_days` | float | `(accounts_payable_eom / max(avg_monthly_outflow, 500)) × 30` — implied Days Payable Outstanding | Credit |
| 40 | `cash_conversion_cycle_days` | float | `implied_dso_days + implied_dio_days − implied_dpo_days` | Credit |

**Gate upgrade:** the Section 19 Week 3 "Generator Accepted" pass/fail criterion #1
(sector-consistent balance sheets) now has a checkable assertion instead of only a visual
inspection: construction-sector businesses in the sample must show `implied_dso_days` in
`[60, 120]`; professional/digital-services businesses must show `implied_dio_days < 5`. This
converts a human judgment call into a test that runs in the eval harness.

## 31. Existing-Obligation & Affordability Features (Added v2.7)

**Why:** the schema previously had no feature representing a business's existing financial
obligations. Underwriting a new Murabaha facility without checking installment affordability
against current obligations is a conventional credit-underwriting gap, and it is one a
finance-literate reviewer will look for by default.

| # | Feature | Type | Definition | Used by |
|---|---------|------|------------|---------|
| 41 | `financing_outflow_ratio` | float [0–1] | Share of recurring outflow value going to counterparties with a financial-institution MCC, as a proxy for existing debt service | Credit |
| 42 | `installment_capacity_sar` | float (SAR) | `max(0, avg_monthly_inflow − avg_monthly_outflow) × (1 − k × flow_asymmetry_ratio)`, `k = 0.15` (fixed, documented), haircut capped at 0.5 — a business with downside-heavy cash flow (feature 45) gets a more conservative capacity estimate | Credit |

**Underwriting rule (fixed, at inception only — see Sharia note below):**
`required: monthly_installment ≤ α × installment_capacity_sar`, `α = 0.40` (fixed, documented
constant, tunable only via team sign-off same as any other threshold in this document). This is an
affordability check performed once at signing, the same class of gate as the existing sector
screen — it does not reprice anything after contract signature.

## 32. Temporal Structure Features (Added v2.7)

**Why:** every existing feature reduces the trailing window to a scalar (mean, standard deviation,
a single growth percentage). Two businesses with identical `revenue_growth_rate_90d` can have very
different risk profiles depending on *when* within the window the change happened and whether the
business has any exploitable rhythm at all.

| # | Feature | Type | Definition | Used by |
|---|---------|------|------------|---------|
| 43 | `inflow_break_recency_days` | int (nullable) | Days since the most recent detected structural break in standardized daily inflow, via CUSUM: `S_t = max(0, S_{t-1} + x̃_t − k)`, break flagged at first `t` where `|S_t| > h`, with fixed documented constants `k = 0.5`, `h = 5.0` on `x̃_t` standardized against the prior-90-day mean/SD. `null` if no break detected in-window. | Credit, Cash |
| 44 | `net_flow_autocorr_lag7` | float [−1, 1] | Pearson autocorrelation of the daily net-flow series at lag 7 — captures weekly operating rhythm (or its absence) | Anomaly, Cash |

A recent break (low `inflow_break_recency_days`) is a materially different risk signal than the
same aggregate growth rate spread evenly across 90 days, and a business with a genuine weekly
rhythm (`net_flow_autocorr_lag7` far from 0) gives the anomaly lens a real baseline to deviate from,
rather than a flat mean.

## 33. Relational Persistence Features (Added v2.7)

**Why:** features 20–22 measure concentration but not *persistence* — a business with five stable
long-term clients and one that acquired five new clients last quarter can show identical
concentration values today, at very different underlying risk.

| # | Feature | Type | Definition | Used by |
|---|---------|------|------------|---------|
| 45 | `counterparty_persistence_ratio` | float [0–1] | Value-weighted share of current-90-day inflow coming from counterparties also present in the *prior* 90-day window: `Σ_{c ∈ Cₙₒw ∩ Cₚᵣᵢₒᵣ} inflow_now(c) / Σ_{c ∈ Cₙₒw} inflow_now(c)` | Credit |
| 46 | `circular_counterparty_count` | int | Count of distinct entities appearing as both payer and payee above a fixed documented value threshold within the window — a round-tripping signal not currently covered by any existing anomaly feature | Anomaly |

Concentration in *retained* counterparties (#45 near 1) is materially safer than the same
concentration figure driven by newly acquired ones — the existing features cannot make this
distinction, and #46 broadens the anomaly lens's signal set beyond magnitude/timing outliers,
which helps satisfy Section 12's held-out-anomaly-type requirement with a genuinely different
detection mechanism.

## 34. Survivability & Stress Features (Added v2.7 — see Sharia constraints below)

**Why:** the forecast lens produces a point projection and a binary crunch alert; the credit lens
produces a point-in-time PD. Neither answers "how much shock can this business absorb before it
breaks?" — the question a risk committee actually asks, and the one the proposal's own problem
statement (rigid credit models ignoring resilience) implicitly promises to address.

| # | Feature | Type | Definition | Used by |
|---|---------|------|------------|---------|
| 47 | `downside_semideviation_90d` | float | `sqrt( (1/(D−1)) · Σ_t [min(n_t, 0)]² )` over daily net flow `n_t` | Credit |
| 48 | `upside_semideviation_90d` | float | `sqrt( (1/(D−1)) · Σ_t [max(n_t, 0)]² )` over daily net flow `n_t` | Credit |
| 49 | `flow_asymmetry_ratio` | float | `downside_semideviation_90d / max(upside_semideviation_90d, epsilon)` — ≈1 is symmetric volatility; >1 means volatility is concentrated on the loss side | Credit, feeds #42 |
| 50 | `revenue_shock_absorption_pct` | float [0–1] | Largest uniform revenue shock θ the business survives for 90 days without breaching zero balance. Fixed costs held constant, variable costs scale with revenue: `I'_t=(1−θ)I_t`, `V'_t=(1−θ)V_t`, `F'_t=F_t`, `B_t(θ)=B₀+Σ_{s≤t}(I'_s−F_s−V'_s)`. `θ* = max{θ ∈ [0,1] : min_t B_t(θ) ≥ 0}`, found by bisection (monotone in θ, ~20 iterations). `0` if already breaching at θ=0. | Credit, Cash |
| 51 | `fixed_obligation_coverage_months` | float | `avg_daily_balance / max(recurring_expense_ratio × avg_monthly_outflow, 500)`, capped at 24, `null` below the floor | Cash |
| 52 | `liquidity_hazard_30d` | float [0–1] | `P(min_{t≤30} B_t < 0)`, Monte Carlo over block-bootstrapped residuals of the forecast model (preserves weekly autocorrelation), seed from `config.yaml` | Cash |
| 53 | `liquidity_hazard_60d` | float [0–1] | As above, `h = 60` | Cash |
| 54 | `liquidity_hazard_90d` | float [0–1] | As above, `h = 90` | Cash |

**Why 52–54 are profile features, not forecast-lens outputs:** feeding a forecast-lens output into
the credit lens would break Section 8's guarantee that no lens is gated on another's output, which
is the concrete evidence for the "single engine, multiple lenses" reuse claim. Computing the hazard
curve **in the shared profile engine** and letting both the forecast and credit lenses *read* it
from the same profile preserves that architectural guarantee exactly as designed. Evaluate with a
Brier score and reliability diagram against realized breaches in the held-out window — this is a
stronger evaluation artifact than MAPE alone, on the existing model, at effectively no new
modeling cost.

**Frozen-model stress scenarios (post-gate, nullable — same fail-soft pattern as Section 27):**
scenarios live in `config.yaml`, never free-text, and are applied as a deterministic map over an
already-trained, frozen model — a read-only re-scoring layer, exactly as safe as recourse (Section
27) is post-gate, and for the same reason (it cannot destabilize a finished model).

```yaml
stress_scenarios:
  - id: revenue_contraction_moderate
    inflow_multiplier: 0.80
    duration_days: 90
  - id: collection_delay_45d
    receivable_lag_add_days: 45
  - id: concentration_loss
    remove_largest_counterparty: true
```

Output contract addition (Section 11), following the existing nullable-field pattern:

```json
"stress": [
  {"scenario_id": "revenue_contraction_moderate",
   "stressed_pd": 0.19,
   "stressed_runway_days": 41,
   "decision_flips": false}
]
```

**Sharia constraints — enforced by structure, not by wording (per the Design Principle below):**

1. Stress results may influence `decision` and `amount_sar` **at inception only** — that is
   ordinary underwriting.
2. **Prohibited, explicitly and permanently:** no `stressed_markup_pct` field, and no mechanism
   that varies `base_markup_pct` or `adjusted_markup_pct` based on stress-scenario output, ever.
   `markup_fixed_at_inception: true` (Section 11) means the rate is set once at signing. A
   stress-linked rate is a floating rate wearing a risk-management label. This negative assertion
   is recorded here specifically because a team member without Islamic-finance background is the
   most likely person to propose "dynamic risk-based pricing" as an obviously-good idea in Week 10
   without realizing it breaks the core Sharia claim.
3. Stress scenarios are `fixed` features under Section 26 (macro conditions are not actionable by
   the business). The stress code path **must not feed the recourse generator** (Section 27) — "if
   the macro shock were smaller you'd be approved" is not actionable recourse and is a direct
   Section 26 violation. Enforce this as a separate code branch, the same way Section 27 already
   branches on `sharia_screen_status`, not as a comment warning against it.

**Build-order note:** this module is proposed at stretch-goal build-order position 2 (after
recourse, before ESG) in Section 28, since it shares recourse's fail-soft, read-only-over-a-frozen-
model safety property at comparable effort (~2–3 days). Per Section 28's own policy, this
re-prioritization requires a recorded team decision — flagged here as a v2.7 proposal pending that
sign-off, not a unilateral change to the committed build order.

---

## 35. Sector-Relative Normalization Layer (Added v2.7)

**Why:** all features above are absolute. A volatility of 0.4 means something different in
construction than in professional services, and asking XGBoost to learn that interaction from
sparse per-sector cells (Section 23) is exactly how a model ends up shortcutting to the sector code
itself — the failure mode Section 25's audit exists to catch. Normalizing a fixed subset of
features against sector-specific reference statistics makes "assesses risk within sector, not
sector membership" a property of the model's *inputs*, not just a hoped-for finding from the SHAP
audit — the same "encode the guarantee in structure" pattern this document already applies
elsewhere.

| # | Feature | Type | Definition | Used by |
|---|---------|------|------------|---------|
| 55 | `sector_relative_regularity_z` | float | `(feature_3 − μ_{sector,3}) / max(σ_{sector,3}, ε)` | Credit |
| 56 | `sector_relative_volatility_z` | float | Same transform applied to feature 11 (`cash_flow_volatility`) | Credit |
| 57 | `sector_relative_days_negative_z` | float | Same transform applied to feature 13 (`days_negative_balance_90d`) | Credit |
| 58 | `sector_relative_balance_z` | float | Same transform applied to feature 16 (`avg_daily_balance`) | Credit |
| 59 | `sector_relative_concentration_z` | float | Same transform applied to feature 21 (`counterparty_concentration_index`) | Credit, Anomaly |

**Critical implementation constraint:** `μ_{sector,f}` and `σ_{sector,f}` must come from a
**pinned reference table**, computed once on the N=10,000 research population, serialized as
`sector_reference_stats_v1.json`, version-hashed, and **never recomputed at serving time**.
Recomputing at serving would make a business's score depend on which other businesses happen to be
in the current demo slice, breaking both determinism and the reproducibility receipt (Demo &
Credibility plan, item 2). Include this file's hash in the receipt alongside the config and model
hashes.

**Timing constraint:** this touches the feature contract every lens reads — it is a Week 1 decision
or it does not happen this term. Do not retrofit it after Week 8.

---

## 36. GenAI & RAG Layer — Read-Only Shell (Added v2.8)

**Why this section exists:** an external review evaluated adding LLM/RAG capabilities to broaden the
project's AI/DS scope. The core finding: generative AI is safe in this system only where it can be
mechanically verified or where it has no path back into a decision. This section defines that
boundary structurally — per the Design Principle below, as a service separation someone has to
deliberately break, not a convention someone can silently drift away from.

### 36.1 The Deterministic Core / Read-Only GenAI Shell Boundary

The **deterministic core** comprises: the profile engine (all 59 features), the credit lens, the
forecast lens, the anomaly lens, the Sharia screening module, the Zakat module, the recourse
generator (§27), and the stress layer (§34). Every field in the §11 output contract and every value
returned by the five API read-paths (§8) originates here. It contains no LLM call, on any path,
ever.

The **GenAI shell** may only read the finished, receipt-hashed JSON artifact (Demo & Credibility
plan, item 2) and a versioned document corpus. It may only emit natural-language text to a human.
It has no write path back into the core, no route into the §11 contract, and no ability to alter
any field already computed.

**Enforced structurally:** the GenAI shell is a separate service that receives the output JSON as
input and returns a string. It holds no reference to the model object, the profile engine, or the
database. Breaking the boundary requires changing a service interface someone owns — it cannot
happen through a careless edit inside an existing module.

**Why the core cannot absorb an LLM, in specific terms:**
- **Reproducibility receipt (Demo & Credibility plan, item 2):** commercial LLM APIs cannot
  guarantee byte-identical output even at temperature 0 (floating-point non-associativity in
  batched inference, routing effects, silent model updates behind a stable endpoint). Any LLM
  output inside the receipted JSON makes the receipt false.
- **§14 label-circularity defense:** an LLM's training corpus and learned associations cannot be
  characterized the way the latent-variable label generation can. An LLM in the decision path means
  none of §14's AUC/noise/correlation reporting can be attributed to a characterized model.
- **§25 fairness audit:** there is no SHAP-equivalent decomposition of an LLM's contribution.
  Pretrained models carry documented demographic/regional biases from their training corpus, which
  for a Sharia-compliant product is a compliance failure, not a footnote.
- **§13 explainability table:** an LLM choosing magnitude or direction language makes the
  hard-coded, auditable threshold table meaningless, since there is no longer a fixed table
  governing what gets said.
- **Zakat and `sharia_screen_status`:** these are a computed religious-obligation amount and a
  compliance-gating enum, respectively (§17, §6 feature 24). Both remain 100% deterministic,
  permanently — this is treated as an ethical requirement, not a design preference.
- **§29 anomaly-score protection:** an LLM explaining an anomaly flag must operate only on the
  categorical `flag_reason` values the API already exposes (§8), never on raw scores — natural-
  language explanation is otherwise a soft channel for leaking the detection threshold the API
  deliberately withholds.

**Corollary — the receipt's scope must be stated on the receipt itself:** *"This receipt guarantees
byte-identical reproduction of the decision. Any generated advisory text is not covered by this
receipt and cannot affect the decision — see Section 36."*

**Corollary — generated content is tagged at the source (extends §29):** any stored generated text
carries `content_source: "generated"`, the same discipline §29 already applies to
`data_source: "synthetic"/"sandbox"`, so generated text can never later be mistaken for a
deterministic field.

### 36.2 Approved Feature 1 — Generative Financial Health Report (Public-Tier Explanation)

**What it is:** an LLM stitches the already-computed SHAP magnitude/direction/feature triples
(§13) and, where built, the recourse parameters (§27) into a fluent public-tier paragraph, replacing
concatenated template sentences with readable prose. All semantic content — which features, what
direction, what magnitude, what counterfactual values — is fully determined before generation. The
LLM's only job is fluent phrasing of already-fixed facts.

**Self-comparison extension (folds in a proposed peer-benchmarking idea, narrowed to be honest):**
the same report may compare the business against **its own trailing history** using the temporal
(§32) and working-capital-cycle (§30) features already computed — e.g., "your recurring expense
ratio has risen from 0.42 to 0.51 over the last two quarters." This requires no reference
population and makes no claim beyond the business's own data.

**Explicitly rejected — synthetic-population peer benchmarking:** a version of this idea proposed
comparing a business's §35 sector-relative z-scores against "peer averages," where the underlying
reference statistics come from the **N=10,000 synthetic research population** (§35). Presenting a
synthetic-generator artifact as a market fact to a business owner silently converts a calibration
input into an apparent empirical finding — exactly the failure §21 exists to prevent, now occurring
at the presentation layer instead of the validation layer. This is not implemented. If a genuine
GASTAT-published sector aggregate exists at the needed granularity, it may be cited directly, with
edition and date, per §21's source discipline — never the synthetic reference table.

**Mandatory post-generation verifier (code, not a system prompt — a prompt is not a guarantee that
survives an edit; see the Design Principle below):**

```
verify(generated_text, source_json) → pass | reject

1. Numeric check: every numeral in generated_text must appear in source_json
   (normalized for formatting). Any orphan number → REJECT.
2. Feature-mention check: every named feature must be present in this decision's
   SHAP payload. A feature not in the payload → REJECT.
3. Direction check: the polarity of generated phrasing for each mentioned feature
   must match the sign of that feature's SHAP value. Mismatch → REJECT.
4. Prohibited-content check: no approval/decline language beyond the `decision`
   field, no rate/markup figure not already in the JSON, no forward-looking
   promise of approval (e.g. "would align with approval criteria" is rejected;
   "this factor would no longer weigh against the application" is the bounded,
   accurate phrasing per §27's plausibility-bound language).

On REJECT: retry generation once, then fall back to the static §13 template.
The static path is always correct and always available — this is what makes
the feature fail soft.
```

**Language scope:** English, generated and verifier-gated. Arabic stays on the existing
template-translation path (Demo & Credibility plan, item 3) — fluent-reviewed and locked, not
generated at runtime. Financial Arabic register and exact Islamic-finance terminology (مرابحة،
زكاة، نصاب، حول) are higher-risk to get wrong from an unverified generation path than the value
added justifies. If a generated Arabic version is wanted, generate it once offline, have it
fluent-reviewed, and ship the approved text as a template — fluency without runtime variance.

**Compliance-tier note:** the compliance/debug tier (§10) is untouched — raw SHAP values and the
exact §13 lookup-table mapping, no LLM anywhere near it. The Compliance View toggle remains the
proof of non-black-box behavior; if it ever displayed generated text, the explainability claim
would fail on the spot.

**Effort:** ~2–3 days including the verifier. **Build order:** position 4 (§36.5).

### 36.3 Approved Feature 2 — Monsha'at & Kafalah Navigator (RAG)

**What it is:** a retrieval-augmented assistant that, on a decline, surfaces published government
financing-program criteria (Kafalah, Monsha'at guidance) relevant to the business's sector and size
tier — turning a dead-end rejection into a pointer toward a program the applicant may not know
exists.

**The critical constraint — no eligibility determination.** The platform's profile vector
(sector, size tier, `coverage_days_90d`, etc.) is not sufficient information to determine real
program eligibility, which depends on registration status, ownership structure, prior guarantee
history, and program-cycle-specific conditions the platform does not have. The navigator's output
schema **has no `eligible` boolean or equivalent field** — the same fail-closed pattern already
used to keep a stress-linked markup field out of §11's contract (§34). It may only emit: (a)
retrieved program criteria, verbatim-cited to source and edition, and (b) a pointer to verify
directly with the program. It must never assert that a specific business qualifies.

```json
"navigator_response": {
  "declined_reason_category": "risk_model",
  "retrieved_programs": [
    {"program": "Kafalah SME Guarantee", "source": "Kafalah Program Guidelines, [pinned edition]",
     "relevant_criteria": "...", "verify_at": "[official program URL]"}
  ],
  "disclaimer": "This reflects published program criteria as of the cited edition, not an eligibility determination. Verify directly with the program."
}
```

**Corpus discipline (extends §21 to this document set):** every indexed document is archived on
download (not on demand) with access date, per §21's existing rule for macro-validation sources.
Every citation states the exact pinned edition, never "latest," since Kafalah/Monsha'at program
terms are revised periodically and a stale figure served confidently is worse than no answer.
Monsha'at and Kafalah materials are substantially Arabic and often scanned; if English-only
coverage is what the team can reliably extract and verify in the available time, scope the corpus
to that and state the limitation, rather than serving lower-confidence extractions from OCR'd
Arabic scans.

**Retrieval-failure handling:** a fixed similarity threshold gates every retrieval. Below it, the
navigator states plainly that no matching published program was found in its corpus — it does not
guess. A confidently wrong answer about a government program is a worse outcome than an honest "not
found."

**Latency — a separate, explicitly stated budget, not counted against the core:** the five
read-paths in §8 keep the existing &lt;2s target; this route is a sixth, separate, non-real-time
route. Embedding + retrieval is 50–200ms; generation with streaming is 1–3s to first token and
3–8s to full completion. State a distinct budget for this route (e.g., first token &lt;2s, full
response &lt;10s) and stream output — do not let this route's latency appear on the same slide as
the core API target, and do not let the core target's number quietly absorb this route's cost.

**Rate limiting:** per §29's existing anomaly-lens rate-limiting logic, this route also needs
per-business rate limiting, since each call carries real external API cost and accepts open text
input.

**Effort:** ~5–7 days including corpus archival and extraction — the highest-effort GenAI item,
driven by corpus work rather than model work. **Build order:** position 5, cut first (§36.5).

### 36.4 Rejected — Synthetic-Population Peer Benchmarking

Recorded here rather than silently dropped, per this document's own standard of naming deliberate
scope cuts (§29 already does this for security scope). A proposed "how do you compare to peers"
feature would have benchmarked a business's §35 sector-relative z-scores — computed against the
**synthetic** N=10,000 research population — and presented the comparison as a market fact ("your
expense ratio is 15% higher than the average F&amp;B business in Riyadh"). Two independent problems:
(1) it silently converts a §21 calibration input into an apparent empirical finding, presented to
the person least able to detect the substitution; (2) it implies a geographic breakdown ("in
Riyadh") the schema does not model — §20 has no geography sampling stage, deliberately cut for this
term. The self-comparison version in §36.2 delivers the genuinely useful part of this idea (CFO-
style insight into the business's own trend) without either problem.

### 36.5 Updated Stretch-Goal Build Order (Supersedes the §28 order pending team sign-off)

> **Build order:** (1) counterfactual recourse, (2) survivability stress-testing (§34), (3) ESG
> scoring &amp; markup adjustment, (4) generative financial health report + self-comparison (§36.2),
> (5) Monsha'at &amp; Kafalah navigator (§36.3), (6) NLP sector classification.
>
> **Cut order:** (1) navigator cut first, (2) generative report cut second, (3) NLP cut third,
> (4) ESG cut fourth, (5) stress-testing cut fifth, (6) counterfactual recourse cut last.

**Why the two GenAI items go last despite the report being cheap:** every other stretch item is
self-contained team effort. Both GenAI items introduce a dependency this project has not had
before — an external LLM API available and responsive on defense day. A live demo dependent on a
third-party API that could rate-limit or degrade mid-presentation is a new category of risk, and
per §28's own "done beats promised" logic, it is ranked behind every item that carries no such
dependency. The navigator carries the additional external-corpus dependency (variable-duration,
like the SME interview outreach in the Demo &amp; Credibility plan) and is therefore cut before the
report.

**Hard prerequisites before either GenAI item is attempted:**
1. The §36.2 verifier exists and is tested before any generated text is shown to anyone.
2. Both are demonstrated with the LLM API unavailable — the navigator route disabled cleanly, the
   report falling back to the static §13 template — rehearsed as part of the Demo &amp; Credibility
   plan's Item 1 hostile-demo rehearsal, not as an afterthought.

**Per §28's own policy**, this build-order change requires a recorded team decision — recorded here
as a v2.8 proposal pending that sign-off, not a unilateral change to the committed order.

---

## 37. Development Tooling, Data Validation & AI-Coding Guardrails (Added v2.9)

**Why this section exists:** Sections 1–36 define what the system must guarantee. This section
defines the tooling that keeps day-to-day implementation honest to those guarantees, added after
an internal tooling review. Nothing here changes the feature contract, any lens, or any output
field — it is process and enforcement tooling layered on top of a schema that does not change.

### 37.1 Data Validation — Pandera

Every one of the three generator output tables (`transactions.csv`, `daily_aggregates.csv`,
`balances_monthly.csv` — Section 7) is validated against a Pandera schema derived directly from
this document's feature and type definitions, before the data is allowed to reach the feature
engine. This is the concrete enforcement mechanism behind the Data Engine's "100% schema
validation rate" target named in the main proposal's deliverables table — previously a target
without a named mechanism, which is exactly the kind of gap this document's own Design Principle
(below) warns against leaving implicit.

### 37.2 Local Analytics — DuckDB, Single-Threaded

DuckDB provides an embedded, zero-infrastructure query engine for the Section 21
distributional-comparison work (Kolmogorov–Smirnov / Wasserstein checks against published macro
figures) across both the N=10,000 and N=1,000 populations (Section 23), without standing up a
separate analytics server.

**Determinism constraint (critical):** DuckDB's default execution is multi-threaded, and
multi-threaded floating-point aggregation is not guaranteed to be order-stable — the same query can
return a bit-for-bit-different aggregate across runs. Any DuckDB query whose result feeds a
receipted output (Demo &amp; Credibility plan, item 2's byte-identical reproducibility receipt) must
pin single-threaded execution immediately after connecting:

```python
import duckdb
con = duckdb.connect(database=':memory:')
con.execute("SET threads TO 1")  # required for any receipted value
```

This is the same class of guarantee as Section 35's "never recomputed at serving time" rule for the
sector-reference-statistics file — a correctness property enforced at the tooling level, not
assumed to hold by default.

### 37.3 Code Quality — Ruff

A single linter/formatter (`ruff`), initialized with a default `ruff.toml` at the project root, runs
across the codebase so five contributors do not drift into five different style conventions. No
custom rule configuration is required at this stage — Ruff's default rule set is sufficient.

```bash
pip install pandera duckdb ruff
touch ruff.toml
```

### 37.4 AI-Assisted Development — Context7

Where an AI coding assistant helps implement a lens (Section 28's build-order items, or day-to-day
core development), the team enables a documentation-retrieval skill (Context7) that fetches
current, version-pinned library documentation at generation time. This mitigates a specific,
concrete risk: an assistant confidently generating a plausible-looking XGBoost, SHAP, or Prophet API
call that does not exist in the pinned library version — an error that is easy to miss in review
because it reads as syntactically correct code.

### 37.5 Project-Level Architectural Guardrail Skill

Per this document's own Design Principle (below), the team defines a project-level coding-assistant
skill that checks any AI-assisted contribution against this schema's non-negotiables before it is
accepted, rather than relying on a human reviewer to catch a violation after the fact:

- No `stressed_markup_pct` field, and no mechanism that varies `base_markup_pct` /
  `adjusted_markup_pct` from stress output (Section 34, constraint 2).
- No floating or dynamically-repriced markup of any kind — `markup_fixed_at_inception: true` is
  permanent (Section 11, Section 17).
- Exactly three analytical lenses (Credit, Forecast, Anomaly) plus two embedded governance modules
  (Sharia screening, Zakat) — no additional lens without a corresponding update to this document
  (see the Framing Note, below).
- No generated text inside the Compliance View (Section 10, Section 36.2) — the Compliance View is
  the proof of non-black-box behavior and must remain 100% deterministic.

This skill is a development-time check, not a runtime enforcement mechanism — it supplements,
and does not replace, the structural enforcements already specified in Sections 11, 34, and 36
(nullable fields, separate service boundaries, verifier gates).

**Sourcing note:** any coding-assistant skill or plugin used by the team is obtained through the
assistant's own built-in plugin marketplace, never an external, unfamiliar download link. An
unverified third-party skill package is exactly the kind of unvetted dependency Section 29's
security discipline already warns against for credentials and API access — the same caution
applies to executable developer tooling.

---

## Design Principle: Encode Guarantees in Structure, Not in Prose

Stated explicitly because it is a recurring pattern worth applying to every future decision, not
just the cases where it already appears:

> **Can this guarantee be edited away silently, or would breaking it require changing code that
> someone has to own?** If the answer is "edited away silently," restructure until it isn't.

This project already follows the pattern in four places, named here so the pattern is visible as
a pattern rather than unrelated decisions:

- `insufficient_data` (Section 15) is a distinct output **state**, not a `null` score that could be
  silently misread as a real, low score.
- `late_penalty_policy` (Section 11, 17) is a fixed **enum value** (`"charity_directed"`) baked into
  the output contract, not a policy described in a document that the code doesn't actually enforce.
- `sharia_screen_status` (Section 6, feature 24) is a **3-valued enum** branched on directly in code
  (Section 27), not a boolean with a comment explaining the ambiguous case.
- The GenAI/RAG **read-only shell boundary** (Section 36) is a separate service with no reference to
  the model, profile engine, or database, not a system-prompt instruction telling an LLM to behave —
  the latter can be silently edited away in Week 11; the former cannot.

Apply the same test before adding any new rule to this document going forward: if the rule can only
be found in a paragraph, it isn't done yet.

---

## Notes for the team meeting

- **Features 15, 25, 26 are composite/derived** — agree on the exact weighting formula together,
  since these are the ones most likely to get quietly changed by one person mid-project without
  the rest of the team noticing.
- **`sharia_screen_status` is 3-valued, not boolean** — per the compliance discussion, ambiguous
  sector codes route to manual review rather than auto-decline.
- Anything not in this table does not exist as far as any lens is concerned. If a lens needs a new
  signal later, it comes back to this document and gets added with the same rigor — not
  implemented as a private variable inside one person's module.
- Suggested Week 1 exit criteria: every team member can independently explain, in one sentence
  each, what all 36 features mean and why they matter to at least one lens.

---

## Framing Note: "Three Lenses" vs. Five API Routes

The product story stays **"one engine, three analytical lenses"** (Credit, Forecast, Anomaly) for
pitches and plain-language explanation — this is what a non-technical audience should hear.
Architecturally, there are five routes (Section 8) because **Zakat and Sharia/ESG screening are
embedded governance modules, not analytical lenses** — they don't predict or forecast anything,
they apply deterministic rules and calculations to the same shared profile. Keep this distinction
consistent across all documents: three lenses + two embedded governance/compliance modules, all
reading one profile engine.

---

## Change Log

- **v1.0** — Initial 26-feature draft (Week 1).
- **v1.1** — Added balance-sheet snapshot (Zakat, features 27–31), API read-paths, Week 8 gate
  definition, evaluation notes.
- **v1.2** — Added credit label generation methodology (Section 14, fixes AUC circularity),
  data-sufficiency rule (Section 15, features 32–33), edge-case null conventions, Ramadan
  seasonality handling, Murabaha fixed-markup and charity-directed late-penalty policy, nisab/hawl
  Zakat features (34–35), consent/PDPL note, full week-by-week plan, and this framing note. SHAP
  threshold table updated to log-odds units with direction-aware language (Section 13).
- **v1.3** — Consistency sweep: feature count corrected to 36 throughout (added feature 36,
  `ramadan_adjusted`, which v1.2 had described in prose without a table row). Expanding-window CV
  scheme rescaled to match the generator's 180-day default window (months 1–3/4/5/6, not
  1–6/7/8). Added explicit hawl-seeding guidance (`zakat_seed` in `config.yaml`) so the demo can
  show both a zero and a non-zero Zakat outcome deliberately, rather than defaulting to
  `hawl_incomplete` for every business. Added `latent_to_observable_correlation` as a required,
  explicit generator parameter (Section 14) to prevent circularity re-entering through an
  accidentally too-clean generator. Minor wording fix to the Week 1 milestone.
- **v1.4** — Closed a dangling cross-reference: `markup_fixed_at_inception` and
  `late_penalty_policy` now appear directly in the Section 11 JSON contract itself (previously
  only required in prose, pointing from Section 17 to a Section 11 that never received the
  fields — exactly the "private variable" failure mode this document warns against). Added
  `start_date` to the generator config so the Ramadan seasonality test (feature 36) is
  config-driven and reproducible on demand, not incidental to run timing. Fixed the Week 1
  milestone to lock the actual current version rather than an obsolete v1.0. Added a
  known-limitation note clarifying `ramadan_adjusted` is a coarse gate, not a magnitude
  adjustment. Proposal PDF Section 4 header softened from "will deliver" to "targets delivery
  of," matching the Week 8/Week 10 gating already reflected in its own metrics table.
- **v1.5** — Fixed the same self-reference bug one level up: the Week 1 milestone pointed to a
  hardcoded version number that was already stale by the time of this edit. Reworded to "lock the
  current version of this document at time of signing" so the instruction can't go stale again
  regardless of how many further revisions this document goes through.
- **v1.6** — Major generator methodology upgrade (Sections 20–25): two-stage conditional sampling
  (sector → size, replacing independent sampling that produced unrealistic combinations); explicit
  separation of calibration inputs vs. emergent, non-circular macro validation targets (aggregate
  revenue by tier, macro default/NPL rate compared against published figures rather than tuned to
  match them); empirical seasonality calibration against published mada POS payment statistics
  (grounds the `ramadan_adjusted` feature and its holdout test in real data); a dual-scale
  population strategy (N=10,000 for research/training, N=1,000 for demo serving) to solve rare-tier
  statistical sparsity; sector-consistent balance sheet archetypes so transactions and balance
  sheets tell one coherent story per business; and a within-sector SHAP fairness audit to verify
  the credit model penalizes individual risk, not sector membership.
- **v1.7** — Added source-discipline requirements to Section 21: archive every government/central-
  bank source locally on download (not on demand) with URL and access date, since public portals
  reorganize and links rot; pin exact publication editions in every citation, never "latest";
  explicitly stated the 2–3 year GASTAT publication lag and reframed the validation claim as
  matching the most recent published census, not real-time economic conditions; flagged that a
  dedicated SME-specific NPL series may not exist in SAMA's Financial Stability Report, with
  sector-level NPLs plus Kafalah program reporting as the fallback to check in Week 1 before
  committing to that target.
- **v1.8** — Added Section 26 (feature controllability classification: controllable /
  influenceable / fixed, consolidated as one reference table rather than retrofitted into all
  eight existing feature tables), Section 27 (counterfactual recourse as a post-gate stretch
  goal — whitelisted, sector-plausibility-checked, structurally gated off the Sharia screen so it
  can never fire on a compliance decline, `recourse: null` added to the Section 11 output
  contract), and Section 28 (stretch-goal policy with explicit, opposite-direction build order —
  recourse → ESG → NLP — and cut order — NLP → ESG → recourse — resolving the ambiguity in a prior
  single "priority order"). Named the "encode guarantees in structure, not in prose" design
  principle explicitly, pointing to three places this document already followed it before the
  pattern was named. Updated the Week 9 plan milestone to reflect the corrected build order.
- **v1.9** — Fixed a "four lens" reference inside the Section 19 Week 8 plan-table row, which
  contradicted this document's own Framing Note (three lenses + two embedded governance modules).
  Found during a cross-document consistency sweep prompted by the same issue in the companion
  Demo & Credibility Enhancements execution plan — the schema is the authoritative source other
  documents check against, so an inconsistency here was the more important of the two to catch.
- **v2.0** — Marked the Section 20 config example as an excerpt (weights shown sum to 0.60, not
  1.0, since remaining sectors are omitted) so it can't be copy-pasted as a complete config by
  mistake. Companion documents updated to match: briefing scope table now lists all three stretch
  goals including recourse (previously only ESG and NLP were listed, contradicting Section 28);
  proposal's GASTAT sentence reworded ("employee compensation, which reached SAR 164.2 billion")
  so the figure can no longer be misread as total SME revenue on a skim.
- **v2.1** — Restructured Section 19's Week 2-3 plan: the generator's owner works generator-only
  while the rest of the team scaffolds the profile engine against a hand-made sample dataset
  rather than sitting idle or coupling early to unvalidated generator output. Added an explicit
  end-of-Week-3 "Generator Accepted" gate with three named pass/fail criteria (sector-consistent
  balance sheets, latent-variable-driven labels distinguishable from observable-feature shortcuts,
  qualitatively correct seasonal curves), since the generator is the one component whose failure
  cannot be de-scoped and previously had no explicit checkpoint of its own. Flagged Week 5's credit
  and forecast lenses as silently dependent on the Week 3 gate passing on schedule. Moved the
  serving-path latency smoke test (API &lt; 2s, SHAP generation &lt; 1s) to Week 7, one week before
  the Week 8 gate, instead of leaving it implicit until Week 10's UI work. Companion enhancements
  document's SME outreach guidance widened from a 2-3-candidate list to 8-10, moved to start Week
  1-2, after noting that personal-network outreach commonly yields close to zero responses at the
  smaller size.
- **v2.2** — Fixed a dangling cross-reference introduced in v2.1: the Week 1 plan row pointed to
  "Section 5" for SME outreach guidance, which is this document's Counterparty/Concentration
  Features table, not the qualitative-validation content — that guidance lives only in the Demo &
  Credibility plan (item 5). Reworded to point outward to the correct document explicitly, same
  pattern Section 27 already uses in reverse (scoping recourse by pointing back into this schema
  rather than duplicating content across documents).
- **v2.3** — Added Section 29 (Security Considerations), scoped to what a 3-month academic project
  can realistically defend: credential/token handling if SAMA sandbox access is used, minimal API
  authentication for the five read-paths, two cheap mitigations against anomaly-lens threshold
  probing (never expose raw scores, only `flag_reason`; rate-limit by business ID), an enforced
  `data_source` tag distinguishing synthetic from real records, and an explicit list of what is out
  of scope (penetration testing, encryption-at-rest, adversarial robustness evaluation, production
  key management) — named directly rather than left for a reviewer to discover unaddressed.
- **v2.4** — Fixed an internal contradiction introduced in v2.3: Section 29 said "four read-paths"
  / "four routes" while listing all five endpoints, contradicting the Framing Note's own "five
  routes" language two sections later in the same document. Also refreshed the companion Demo &
  Credibility plan's schema-version citation, which had gone stale across three schema revisions
  (last pointed at v2.1).
- **v2.5** — A second pass on the v2.3 "four" bug missed by v2.4: the Section 19 Week 10 plan row
  still said "four API read-paths"; corrected to five. Fixed a real contradiction between Section
  8's route table (which listed the anomaly endpoint as returning raw scores) and Section 29's
  security rule (which prohibits exposing them) — per this document's own design principle, the
  security rule wins, so Section 8's Returns column was edited to match. Fixed two dangling
  cross-references in Section 29 that pointed to "Section 3" and "Section 3.2" within this
  document — the Track A/B synthetic-vs-real data distinction actually lives in the companion
  Project Scope, Data &amp; Resource Briefing, not here — now named explicitly, matching the
  pattern Section 27 already uses for cross-document references. Also fixed a rendering bug in the
  proposal PDF where a nonstandard `&amp;ge;` entity (not supported by the PDF library's markup
  parser, and the Unicode &ge; glyph is outside the base font's encoding) rendered as a mangled
  character; replaced with plain ASCII `&gt;=` throughout, which cannot suffer the same failure.
- **v2.6** — The companion Demo &amp; Credibility plan's header cited a hardcoded schema version
  number (v2.4) that went stale one revision later, at v2.5 — the same self-reference bug class
  already fixed once at the document level in v1.5 (the Week 1 milestone's hardcoded version),
  now reintroduced one level up at the cross-document level. Fixed durably rather than patched
  again: the companion document's header now reads "current version" instead of citing a number,
  so this specific citation cannot go stale on any future schema revision, including this one.
- **v2.7** — External architecture audit incorporated. **Defect fixes:** §8's `/profile` route
  corrected from an ambiguous "features 1–36" to the actual transaction-derived subset, resolving a
  contradiction with §7 and §26; `current_runway_days` (18) corrected from an average-balance
  formula (which overstates runway for exactly the businesses burning cash) to a today's-balance
  formula, with the old formulation retained separately as `runway_days_avg_balance` (18b);
  `inflow_outflow_ratio` (12) given the same epsilon floor already applied to features 4/9;
  `data_gap_ratio` (33) redefined against business-operating days instead of calendar days to stop
  it duplicating `coverage_days_90d` (32); added a `partial_profile` state and per-feature
  `min_history_days` for growth features that need ~180 days of history despite the 60-day
  eligibility gate; added sector-conditional latent generation (§14) so the §25 fairness audit can
  actually fail rather than passing trivially; added an entity-level train/validation split
  alongside the existing temporal expanding-window CV (§13) to close a business-level memorization
  leak. **New features (37–59, Sections 30–35):** working-capital cycle (implied DSO/DIO/DPO, cash
  conversion cycle — also makes the Week 3 gate's balance-sheet-consistency criterion
  machine-checkable); existing-obligation and installment-affordability features feeding a fixed,
  documented underwriting rule; temporal structure features (CUSUM structural-break recency, lag-7
  autocorrelation); relational persistence and round-trip features; a survivability/stress feature
  set (downside/upside semideviation, shock-absorption percentage, fixed-obligation coverage
  months, and a liquidity hazard curve computed in the shared profile engine — deliberately not in
  the forecast lens, to preserve the no-lens-gates-another-lens architecture guarantee in §8); and a
  sector-relative z-score normalization layer for a fixed feature subset, backed by a pinned,
  version-hashed reference-statistics file computed once on the N=10,000 population, never
  recomputed at serving time. **New post-gate stretch module:** a frozen-model survivability
  stress-testing layer (§34), proposed at build-order position 2 in §28 (pending team sign-off per
  §28's own re-prioritization policy) — nullable `stress` field added to the §11 contract, with an
  explicit, permanent prohibition recorded against any stress-linked markup field, since a
  risk-based dynamic-pricing instinct would otherwise silently break `markup_fixed_at_inception`.
  **Sampling/evaluation fixes (§20, §21, §23):** added a third sampling stage (age tier, conditional
  on sector × size) so thin-file incidence is a consequence of vintage rather than an independent
  random draw; generated the N=1,000 serving/demo population from a disjoint seed and ID range from
  the N=10,000 research population, rather than as a subset, so the live defense demo is genuinely
  out-of-sample; added a minimum-cell rule (≥30 businesses, ≥10 defaults) for any per-cell metric,
  with an optional stratified supplementary population for thin-cell fairness audits; pre-registered
  tolerance bands for every emergent validation target, committed to `config.yaml` before each
  validation run; added Kolmogorov–Smirnov/Wasserstein distributional comparisons alongside point
  comparisons; added a held-out-year discipline for macro/seasonal calibration; added an explicit
  Hijri/Gregorian re-indexing method (non-negative least squares over overlap weights) so the
  Ramadan seasonality calibration against Gregorian-indexed mada bulletins is methodologically
  sound rather than a smeared approximation; and named the survivorship-bias mismatch between the
  registered-SME calibration population, the simulated-forward default population, and the
  bank-lending NPL comparison population explicitly, rather than leaving it implicit.
- **v2.8** — Added Section 36 (GenAI &amp; RAG Layer), following an external evaluation of where
  generative AI and retrieval-augmented generation can safely enter this system. Defined the
  Deterministic Core / Read-Only GenAI Shell boundary as a structural service separation — the
  shell reads the finished, receipt-hashed JSON and a document corpus, emits text only, and has no
  write path into the §11 contract or any lens — with the specific reasons the core cannot absorb
  an LLM enumerated against §8, §13, §14, §17, §25, and §29. Approved two GenAI/RAG features:
  (1) a generative financial health report that stitches already-computed SHAP/recourse facts into
  fluent public-tier prose, gated by a mandatory four-check post-generation verifier (numeric
  grounding, feature grounding, SHAP-direction polarity, prohibited forward-looking approval
  language), falling back to the existing static §13 template on any verifier rejection — including
  a self-comparison extension using the business's own trailing history (§30, §32 features), no
  reference population required; and (2) a Monsha'at &amp; Kafalah RAG navigator that surfaces
  published financing-program criteria on a decline, with an explicit, permanent absence of any
  `eligible` field in its output schema, since the platform's profile vector cannot determine real
  program eligibility — corpus discipline extends §21's archive-on-download and pinned-edition
  rules to program documents, and its latency is scoped as a separate, non-real-time budget rather
  than counted against the §8/§23 &lt;2s core API target. Explicitly rejected and recorded (rather
  than silently dropped) a third proposed feature — synthetic-population peer benchmarking — because
  it would present the N=10,000 research population's own calibration statistics (§35) to a business
  owner as an empirical market fact, the same failure §21 exists to prevent, now at the presentation
  layer; its useful component survives as the self-comparison extension above. Updated the
  stretch-goal build order (§36.5, proposed pending team sign-off per §28's policy) to insert both
  GenAI items after ESG and before NLP, ranked behind every non-GenAI stretch item specifically
  because they introduce a live external-API dependency §28's other items don't carry — with the
  navigator, which additionally depends on an external document corpus, cut before the report.
  Added a fourth example to the "encode guarantees in structure" design principle (the GenAI shell's
  service-level separation, contrasted explicitly with a system-prompt instruction, which can be
  edited away silently and therefore does not qualify as a guarantee).
- **v2.9** — Added Section 37 (Development Tooling, Data Validation & AI-Coding Guardrails),
  following an internal tooling review. This section adds no new feature, lens, or output-contract
  field — it specifies the enforcement tooling around the schema that already exists. Pandera is
  adopted to validate the three generator output tables against this document's feature and type
  definitions before data reaches the feature engine, giving the Data Engine's existing "100%
  schema validation rate" target (main proposal deliverables table) a named mechanism it previously
  lacked. DuckDB is adopted for the Section 21 distributional-comparison queries (KS/Wasserstein)
  across the N=10,000 and N=1,000 populations, with an explicit, mandatory single-threaded
  execution constraint (`SET threads TO 1`) for any query feeding a receipted value, since
  DuckDB's default multi-threaded execution is not guaranteed to be floating-point order-stable and
  would otherwise silently break the reproducibility receipt's byte-identical guarantee (Demo &amp;
  Credibility plan, item 2) — the same class of risk Section 35 already guards against for the
  sector-reference-statistics file. Ruff is adopted as a single project-wide linter/formatter.
  Context7 is adopted as an AI-coding-assistant documentation-retrieval skill to reduce the risk of
  a generated call against a library API that does not exist in the pinned version. A project-level
  architectural guardrail skill is specified, checking AI-assisted code contributions against this
  schema's existing non-negotiables (no `stressed_markup_pct` field, no floating or
  dynamically-repriced markup, exactly three analytical lenses, no generated text in the Compliance
  View) as a development-time check that supplements, and does not replace, the structural
  enforcements already specified in Sections 11, 34, and 36 — framed explicitly as an application
  of this document's own "encode guarantees in structure, not in prose" Design Principle. A sourcing
  note was added recommending any coding-assistant skill be obtained only through the assistant's
  built-in plugin marketplace, extending Section 29's existing credential/dependency caution to
  executable developer tooling.
