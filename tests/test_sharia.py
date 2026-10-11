"""Sharia screening (feature 24) and its effect on credit (§10, §27; SOP §2).

The synthetic population contains no impermissible MCC, so the hard-flag path never fires
on generated data — these crafted inputs are the only proof it works. No data needed.
"""

from __future__ import annotations

import math

import pandas as pd
import pytest

from compliance.sharia import compliance_explanation, load_rules, screen
from lenses import load_lens_config
from lenses.credit.model import CONTRACT_KEYS, apply_sharia_gate, decide

RULES, _ = load_rules()


def tx(rows):
    return pd.DataFrame(rows, columns=["direction", "counterparty_type", "amount", "sample_weight"])


@pytest.mark.parametrize("mcc", sorted(RULES["activity"]["hard_flag_mcc"]))
def test_every_hard_mcc_is_a_hard_flag(mcc):
    assert screen("retail_trade", mcc, None)["sharia_screen_status"] == "hard_flag"


@pytest.mark.parametrize("mcc", sorted(RULES["activity"]["soft_flag_mcc"]))
def test_every_soft_mcc_prompts_the_owner(mcc):
    s = screen("retail_trade", mcc, None)
    assert s["sharia_screen_status"] == "soft_flag_review"
    assert s["owner_prompts"] and str(mcc) in s["owner_prompts"][0]


def test_permissible_mcc_is_compliant():
    s = screen("food_beverage", 5812, None)
    assert (s["sharia_screen_status"], s["evidence_basis"], s["rules_triggered"]) == ("compliant", "declared_mcc", [])


@pytest.mark.parametrize(("sector", "status"), [("construction", "compliant"), ("professional_services", "compliant"),
                                                 ("food_beverage", "compliant"), ("retail_trade", "soft_flag_review")])
def test_no_mcc_falls_back_to_the_registered_sector(sector, status):
    s = screen(sector, None, None)
    assert s["sharia_screen_status"] == status and s["evidence_basis"] == "registered_sector"


def test_financial_institution_income_over_threshold_is_soft():
    t = tx([("in", "customer", 900.0, 1.0), ("in", "financial_institution", 100.0, 1.0)])  # 10% ≥ 5%
    s = screen("construction", 1520, t)
    assert s["sharia_screen_status"] == "soft_flag_review"
    assert any(h["rule_id"] == "INC-FI-SHARE" for h in s["rules_triggered"])


def test_financial_institution_income_below_threshold_is_compliant():
    t = tx([("in", "customer", 990.0, 1.0), ("in", "financial_institution", 10.0, 1.0)])  # 1%
    assert screen("construction", 1520, t)["sharia_screen_status"] == "compliant"


def test_existing_financing_is_a_disclosure_not_a_flag():
    t = tx([("in", "customer", 1000.0, 1.0), ("out", "financial_institution", 200.0, 1.0)])
    s = screen("construction", 1520, t)
    assert s["sharia_screen_status"] == "compliant"
    assert s["disclosures"][0]["disclosure_id"] == "DISC-EXISTING-FINANCING"


def test_hard_beats_soft():
    t = tx([("in", "customer", 100.0, 1.0), ("in", "financial_institution", 100.0, 1.0)])
    assert screen("retail_trade", 7995, t)["sharia_screen_status"] == "hard_flag"


def test_screen_is_deterministic_and_hashed():
    a, b = screen("retail_trade", 5999, None), screen("retail_trade", 5999, None)
    assert a == b and a["deterministic"] is True and len(a["rule_table_sha256"]) == 64


# --- effect on credit (§27) ---

ART = {"version": "test", "intercept": math.log(0.02 / 0.98),
       "features": [{"id": 42, "name": "installment_capacity_sar", "log_transform": False, "median": 0.0, "mean": 0.0, "scale": 1.0, "coef": 0.0}]}
ROW = pd.Series({"installment_capacity_sar": 20_000.0})
CCFG = load_lens_config()["credit"]


def gated(mcc):
    s = screen("retail_trade", mcc, None)
    return apply_sharia_gate(decide(ROW, CCFG, ART), s, compliance_explanation(s))


def test_hard_flag_is_a_compliance_decline_with_template_explanation_only():
    out = gated(5813)
    assert tuple(out["credit"]) == CONTRACT_KEYS
    assert out["credit"]["decision"] == "declined"
    assert out["credit"]["amount_sar"] is None and out["credit"]["base_markup_pct"] is None
    assert out["credit"]["recourse"] is None
    assert out["internals"]["decline_origin"] == "compliance"  # recourse can never be generated from this
    assert [p["source"] for p in out["explanation"]["public_tier"]] == ["compliance"]
    assert out["credit"]["markup_fixed_at_inception"] is True and out["credit"]["late_penalty_policy"] == "charity_directed"


def test_soft_flag_makes_an_approval_conditional():
    out = gated(5999)
    assert out["credit"]["decision"] == "approved"
    assert out["internals"]["offer_status"] == "conditional_on_sharia_review"
    assert out["internals"]["conditions"]


def test_compliant_approval_is_unconditional():
    out = gated(5411)
    assert out["credit"]["decision"] == "approved" and out["internals"]["offer_status"] == "unconditional"
