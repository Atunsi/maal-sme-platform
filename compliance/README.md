# Compliance — Sharia screening, PDPL — NOT BUILT

**Owner:** compliance owner · **Schema:** §6, §10, §18, §27, §29 · **Due:** Week 7

## Sharia screening (feature 24)

`sharia_screen_status`: `compliant` / `hard_flag` / `soft_flag_review`, from MCC
+ counterparty rule screening. **100% deterministic — no LLM, ever** (§36.1,
SOP §2). `businesses.csv` carries `declared_mcc_code` (feature 23) per business.

**Soft flags prompt the owner, not a silent queue** (§10): an ambiguous MCC
should ask — *"We detected a general trading code — does more than 50% of your
revenue come from [category]?"* — rather than routing quietly to manual review.
That demonstrates handling real-world data ambiguity instead of clean-case rules.

**Structural separation from recourse** (§27 constraint 4): recourse is
generated **only when** `sharia_screen_status == "compliant"` **and** the
decline came from the risk model. On `hard_flag` / `soft_flag_review` the
recourse code path must not be reachable at all — enforced by branching on this
enum, not by careful template wording.

## Compliance View (§10)

The toggle that displays raw SHAP values plus the exact §13 lookup-table
mapping. **No generated text here, ever** — it is the proof the system is not a
black box, and generated text in it kills the claim on the spot (SOP §2).

## PDPL & consent (§18)

One paragraph, not a build item: any real deployment requires explicit,
revocable consent per data category (per SAMA Open Banking consent standards)
and PDPL-compliant handling/retention. Its absence undercuts the
"enterprise-grade" framing.

## Named scope cuts — deliberate, stated, not missed (§29, SOP §10)

Penetration testing, encryption-at-rest for the demo database, formal
adversarial robustness evaluation, production-grade key management.
