"""Pure-function tests for the Zakat rules (§17) and the credit policy (§11, §31).

No generated data needed — these build their own tiny inputs, so they run anywhere.
"""

from __future__ import annotations

import math

import pandas as pd
import pytest

from lenses import load_lens_config
from lenses.credit.model import CONTRACT_KEYS, affordable_amount, decide, explain
from lenses.zakat.zakat import compute_zakat, nisab_value_sar

LC = load_lens_config()
Z = LC["zakat"]
AS_OF = pd.Timestamp("2026-07-30")


def balances(cash, inv=0.0, ar=0.0, ap=0.0, stl=0.0):
    return pd.DataFrame([{
        "business_id": 1, "month_end": pd.Timestamp("2026-07-31") - pd.Timedelta(days=1),
        "cash_and_equivalents_eom": cash, "inventory_value_eom": inv, "accounts_receivable_eom": ar,
        "accounts_payable_eom": ap, "short_term_liabilities_eom": stl,
    }])


# --- Zakat (§17): liability only when nisab AND hawl hold; otherwise 0 with a reason ---

def test_zakat_computed_is_base_times_rate():
    out = compute_zakat(balances(200_000, inv=50_000, ar=30_000, ap=20_000, stl=10_000), AS_OF, Z,
                        pd.Timestamp("2025-01-01"), 150_000.0, pd.Timestamp("2025-01-01"))
    assert out["status"] == "computed"
    assert out["zakat_base_sar"] == 250_000.0
    assert out["liability_sar"] == round(250_000 * Z["rate_lunar_year"], 2)


def test_zakat_below_nisab_is_zero_with_reason():
    out = compute_zakat(balances(nisab_value_sar(Z) - 1), AS_OF, Z, pd.Timestamp("2025-01-01"), 1e9, pd.Timestamp("2025-01-01"))
    assert (out["liability_sar"], out["reason"]) == (0.0, "below_nisab")


def test_zakat_hawl_incomplete_is_zero_with_reason():
    out = compute_zakat(balances(1e6), AS_OF, Z, None, None, AS_OF - pd.Timedelta(days=100))
    assert (out["liability_sar"], out["reason"]) == (0.0, "hawl_incomplete")


def test_zakat_needs_nisab_at_hawl_start_too():
    out = compute_zakat(balances(1e6), AS_OF, Z, pd.Timestamp("2025-01-01"), nisab_value_sar(Z) - 1, pd.Timestamp("2025-01-01"))
    assert (out["liability_sar"], out["reason"]) == (0.0, "below_nisab")


def test_zakat_is_marked_deterministic_and_nisab_status_travels():
    out = compute_zakat(balances(1e6), AS_OF, Z, None, None, AS_OF)
    assert out["deterministic"] is True
    assert out["nisab_source_status"] == Z["nisab"]["source_status"]


# --- Credit policy (§11, §31) ---

def test_affordable_amount_respects_alpha_and_fixed_markup():
    c = LC["credit"]
    amount = affordable_amount(10_000.0, 6.5, c)
    months = c["repayment_months"]
    installment = amount * (1 + 6.5 / 100 * months / 12) / months
    assert installment <= c["affordability_alpha"] * 10_000.0 + 1e-6
    assert amount % c["amount_round_down_to_sar"] == 0


def tiny_artifact(intercept: float) -> dict:
    """One-feature model so the tests control the PD exactly."""
    return {"version": "test", "intercept": intercept,
            "features": [{"id": 42, "name": "installment_capacity_sar", "log_transform": False,
                          "median": 0.0, "mean": 0.0, "scale": 1.0, "coef": 0.0}]}


@pytest.mark.parametrize(("pd_target", "decision"), [(0.02, "approved"), (0.20, "declined")])
def test_decision_follows_the_tiers(pd_target, decision):
    art = tiny_artifact(math.log(pd_target / (1 - pd_target)))
    out = decide(pd.Series({"installment_capacity_sar": 20_000.0}), LC["credit"], art)
    c = out["credit"]
    assert c["decision"] == decision
    assert tuple(c) == CONTRACT_KEYS
    assert c["markup_fixed_at_inception"] is True and c["late_penalty_policy"] == "charity_directed"
    if decision == "declined":
        assert c["base_markup_pct"] is None and c["amount_sar"] is None
        assert out["internals"]["decline_reason"] == "risk_model"
    else:
        assert c["base_markup_pct"] in {t["base_markup_pct"] for t in LC["credit"]["tiers"]}


def test_no_capacity_declines_on_affordability():
    out = decide(pd.Series({"installment_capacity_sar": 0.0}), LC["credit"], tiny_artifact(math.log(0.02 / 0.98)))
    assert out["credit"]["decision"] == "declined"
    assert out["internals"]["decline_reason"] == "affordability_no_installment_capacity"


def test_explanation_uses_the_fixed_threshold_table():
    th = LC["credit"]["explanation_thresholds"]
    contribs = [{"feature_id": 1, "feature": "a", "contribution_logodds": th["strong"] + 0.01, "imputed": False},
                {"feature_id": 2, "feature": "b", "contribution_logodds": -(th["moderate"] + 0.01), "imputed": False},
                {"feature_id": 3, "feature": "c", "contribution_logodds": th["moderate"] / 2, "imputed": False}]
    pub = {p["feature_id"]: p for p in explain(contribs, LC["credit"])["public_tier"]}
    assert (pub[1]["magnitude"], pub[1]["direction"]) == ("strongly", "against")
    assert (pub[2]["magnitude"], pub[2]["direction"]) == ("moderately", "supports")
    assert (pub[3]["magnitude"], pub[3]["direction"]) == ("marginally", "either")
