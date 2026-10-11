# Compliance — Sharia screening v1 BUILT · Compliance View data ready · PDPL note

**v1 (2026-10-11, DECISIONS entry 26).** `sharia.py` computes feature 24 from a versioned rule
table, `sharia_rules.yaml` — rules as data, so a Sharia advisor can change them without touching
code. 100% deterministic; every output carries the rule table's sha256.

- **Activity screen** on the declared MCC; with no MCC (coverage-limited by design, §12.3) it falls
  back to the registered sector and says so (`evidence_basis`).
- **Income screen:** inflows from financial institutions ≥ 5% of inflow value → soft flag.
- **Disclosure:** existing financing of unknown type → the owner is asked, status unchanged.
- **Precedence:** hard → `hard_flag`; else soft → `soft_flag_review` with fixed owner prompts (§10);
  else `compliant`.
- **Effect on credit (§27):** hard flag → compliance decline (`decline_origin: compliance`, template
  explanation only, recourse unreachable); soft flag → approval becomes `conditional_on_sharia_review`.

**Population result** ([`../eval/out/sharia_screen.md`](../eval/out/sharia_screen.md)): research 85.1%
compliant, 14.9% soft flag (all retail — MCC 5999 or no MCC), 0% hard flag. The generator assigns only
permissible MCCs, so the hard-flag path is proven by `tests/test_sharia.py` on crafted inputs.

**The rule table is PROPOSED, not certified.** Before anything is presented as a Sharia determination
the compliance owner must archive and cite the screening standard (AAOIFI Shari'ah Standard No. 21 is
the usual reference) and ISO 18245, and the Sharia advisor must confirm every list and threshold.

**Compliance View (§10):** the data is in every decision — `governance.sharia_screen` (rule trace,
prompts, disclosures, hashes) and `credit_explanation.compliance_tier` (raw log-odds SHAP + the fixed
§13 table). All of it is template or computed — no generated text. The toggle itself is UI work (Week 10).

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
