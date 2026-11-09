# Stretch-goal readiness — what stands between the team and recourse

Prepared 2026-11-10. A check, not a plan: nothing here starts a stretch goal. Sources: schema §26–§28
and §36.5, SOP §6, `DECISIONS.md`, `lenses/credit/model.py`, `eval/out/demo_exposure.md`.

## The order the documents give

| Position | Schema §28 (v2.7) | Schema §36.5 (v2.8 proposal) and SOP §6 |
|---|---|---|
| Build 1 | Counterfactual recourse | Counterfactual recourse |
| Build 2 | Survivability stress-testing (§34) | Survivability stress-testing |
| Build 3 | ESG scoring and markup adjustment | ESG scoring and markup adjustment |
| Build 4 | NLP sector classification | Generative financial health report (§36.2) |
| Build 5 | — | Monsha'at & Kafalah navigator (§36.3) |
| Build 6 | — | NLP sector classification |
| Cut first → last | NLP, ESG, stress, recourse | Navigator, generative report, NLP, ESG, stress, recourse |

Recourse is built first and cut last in every version. §28's stress-test insertion (v2.7) and §36.5's
order (v2.8) both say they take effect only when the team records the decision, and no DECISIONS
entry records it. That affects items 2–6, not recourse.

## Blockers still open before recourse can start

| # | Blocker | Why it blocks recourse | Owner | Entry |
|---|---|---|---|---|
| 1 | Sharia rule table unconfirmed | Recourse runs only when `sharia_screen_status == "compliant"` (§27 constraint 4); what "compliant" means is `proposed_unverified` | Compliance owner + Sharia advisor | 26 |
| 2 | Feature 24 carries a value and a null for refused businesses | Recourse branches on feature 24 | Compliance owner (profile engine owner signed) | 31, 32 |
| 3 | The model is not frozen yet | §27 searches "the already-trained model"; option C of 47 or implementing 34 (features 41, 42) would replace it | Credit lens owner; team | 47, 34 |
| 4 | The public explanation is a sector effect | Recourse text sits beside a first reason that is about the sector for 834 of 943 | Credit lens owner; team | 47 |
| 5 | Which declines recourse covers | §27 covers risk-model declines only; most declines are affordability (below). Covering affordability would be a schema change | Credit lens owner; team | none yet |
| 6 | Schema §27 says "XGBoost model" | The shipped model is logistic; the wording must match before the module cites it | Credit owner, forecast owner, team | 49 |

Already satisfied: the Week 8 gate has passed; feature 24 exists (entry 26), which the handover note
calls the unblock; the whitelist features 5, 8, 22 and 13 (§27) are all classified in §26, and 5 and
22 are now computed from full-stream totals (entry 30).

## Facts already measured for recourse

From `eval/out/demo_exposure.md` (serving, 943 scored or partial_profile, shipped code path):

| Decline reason | Businesses | Reachable by §27 recourse as specified |
|---|---|---|
| `affordability_no_installment_capacity` | 223 | No (`decline_origin: affordability`) |
| `affordability_below_minimum_amount` | 20 | No |
| `risk_model` | 38 | Yes, if also Sharia-compliant |
| **All declines** | **281** | **38 at most** |

Two further facts from the code, not measured as counts:
- `decide` checks the risk model first (`lenses/credit/model.py:208`) and affordability after it
  (lines 213–217). A counterfactual that moves PD below 0.10 can still end in an affordability
  decline, so "this decision would approve" (§27's example) is not guaranteed by a PD flip alone.
- How many of the 38 risk-model declines are Sharia-compliant has not been counted.

Not started, by instruction: no recourse, stress, ESG, report, navigator or NLP code exists on this
branch.
