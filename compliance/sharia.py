"""Sharia screening — feature 24 `sharia_screen_status` (schema §6, §10, §27; SOP §2).

    status ∈ {compliant, hard_flag, soft_flag_review}

Deterministic rule evaluation over (a) the declared MCC, falling back to the registered
sector when there is none, and (b) the business's own transactions. The rules are data
(compliance/sharia_rules.yaml, versioned and hashed into every output), not code.
Precedence: any hard rule → hard_flag; else any soft rule → soft_flag_review; else
compliant. No model, no score, no LLM — permanently.

What each status does downstream (pipeline/week8.py, lenses/credit):
  hard_flag         credit is declined as a COMPLIANCE decline (decline_reason
                    "sharia_hard_flag"); the explanation is the compliance template only;
                    recourse can never be offered on it (§27 constraint 4).
  soft_flag_review  the risk decision stands but the offer is conditional until the owner
                    answers the fixed prompts (§10) — a prompt, not a silent review queue.
  compliant         no effect.

Disclosures (e.g. existing financing of unknown type) are asked of the owner but never
change the status.
"""

from __future__ import annotations

import hashlib
from functools import lru_cache
from pathlib import Path

import pandas as pd
import yaml

RULES_PATH = Path(__file__).with_name("sharia_rules.yaml")
STATUSES = ("compliant", "soft_flag_review", "hard_flag")


@lru_cache(maxsize=2)
def load_rules(path: str = str(RULES_PATH)) -> tuple[dict, str]:
    raw = Path(path).read_bytes()
    return yaml.safe_load(raw), hashlib.sha256(raw).hexdigest()


def _mcc(v) -> int | None:
    if v is None or (isinstance(v, float) and pd.isna(v)) or v is pd.NA:
        return None
    try:
        return int(v)
    except (TypeError, ValueError):
        return None


def screen(sector: str, declared_mcc, tx: pd.DataFrame | None, rules: dict | None = None, rules_sha: str | None = None) -> dict:
    """Screen one business. `tx` is its own transactions (may be None or empty)."""
    if rules is None:
        rules, rules_sha = load_rules()
    act, inc = rules["activity"], rules["income"]
    hits, prompts, disclosures = [], [], []
    mcc = _mcc(declared_mcc)

    # (a) activity screen
    if mcc is not None:
        basis = "declared_mcc"
        if mcc in act["hard_flag_mcc"]:
            hits.append({"rule_id": f"ACT-HARD-{mcc}", "severity": "hard_flag", "detail": f"MCC {mcc}: {act['hard_flag_mcc'][mcc]}"})
        elif mcc in act["soft_flag_mcc"]:
            label = act["soft_flag_mcc"][mcc]
            hits.append({"rule_id": f"ACT-SOFT-{mcc}", "severity": "soft_flag_review", "detail": f"MCC {mcc}: {label}"})
            prompts.append(rules["prompts"]["soft_mcc"].format(mcc=mcc, label=label.split(" (")[0]))
    else:
        basis = "registered_sector"
        sector_status = act["no_mcc_by_sector"].get(sector, "soft_flag_review")
        if sector_status != "compliant":
            hits.append({"rule_id": f"ACT-NOMCC-{sector}", "severity": sector_status,
                         "detail": f"no merchant code; registered sector {sector} does not determine the goods sold"})
            prompts.append(rules["prompts"]["no_mcc_retail"])

    # (b) non-permissible-income and financing screens on the business's own transactions
    if tx is not None and len(tx):
        direction = tx["direction"].astype(str)
        cp = tx["counterparty_type"].astype(str)
        value = tx["amount"].astype(float) * (tx["sample_weight"].astype(float) if "sample_weight" in tx else 1.0)
        inflow = float(value[direction == "in"].sum())
        fi_in = float(value[(direction == "in") & (cp == "financial_institution")].sum())
        share = fi_in / inflow if inflow > 0 else 0.0
        if share >= inc["financial_institution_inflow_share_soft"]:
            hits.append({"rule_id": "INC-FI-SHARE", "severity": "soft_flag_review",
                         "detail": f"{share:.1%} of inflow value from financial institutions (threshold {inc['financial_institution_inflow_share_soft']:.0%})"})
            prompts.append(rules["prompts"]["fi_income"].format(share=f"{share:.0%}"))
        if rules["disclosures"]["existing_financing_prompt"] and ((direction == "out") & (cp == "financial_institution")).any():
            disclosures.append({"disclosure_id": "DISC-EXISTING-FINANCING", "detail": "regular repayments to a financial institution; financing type unknown",
                                "prompt": rules["prompts"]["existing_financing"]})

    sev = {h["severity"] for h in hits}
    status = "hard_flag" if "hard_flag" in sev else "soft_flag_review" if "soft_flag_review" in sev else "compliant"
    return {
        "sharia_screen_status": status,
        "evidence_basis": basis,
        "declared_mcc": mcc,
        "rules_triggered": hits,
        "owner_prompts": prompts,
        "disclosures": disclosures,
        "rule_table_version": rules["version"],
        "rule_table_sha256": rules_sha,
        "rule_table_status": rules["source_status"],
        "deterministic": True,
    }


def compliance_explanation(scr: dict) -> str | None:
    """Fixed-template explanation for the Compliance View / a compliance decline. Never generated."""
    rules, _ = load_rules()
    hard = [h for h in scr["rules_triggered"] if h["severity"] == "hard_flag"]
    soft = [h for h in scr["rules_triggered"] if h["severity"] == "soft_flag_review"]
    if hard:
        return rules["explanations"]["hard_flag"].format(detail=hard[0]["detail"], rule_id=hard[0]["rule_id"])
    if soft:
        return rules["explanations"]["soft_flag"].format(rule_id=", ".join(h["rule_id"] for h in soft))
    return None
