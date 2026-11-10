"""Base Murabaha credit lens — schema §8 (/lenses/credit), §11, §13, §31.

Scores one business from its /profile feature vector with a logistic model stored
as plain JSON (lenses/credit/model_v1.json, built by lenses/credit/train.py):

    x  -> signed log1p for absolute-currency features
       -> impute with the training median
       -> z = (x - mean) / scale
    logit = intercept + sum(coef_i * z_i);   PD = sigmoid(logit)

Explanation (§13). For this model the per-feature contribution coef_i * z_i is
exactly its SHAP value against the training-mean business, in log-odds, and the
contributions plus the intercept sum to the logit. No SHAP library, no sampling,
no approximation — and therefore fully auditable by the Compliance View.

Non-negotiables enforced by construction (§11, §34, SOP §2):
  * markup_fixed_at_inception is always True; the rate comes from a fixed tier.
  * there is no stressed_markup_pct key and no code path that varies a markup
    from stress, forecast or generated output.
  * late_penalty_policy is always "charity_directed".
  * adjusted_markup_pct, recourse and stress stay null until their modules exist.
  * explanation text is template-only — no generated language.
"""

from __future__ import annotations

import json
import math
from functools import lru_cache
from pathlib import Path

import numpy as np
import pandas as pd
import yaml

# Arabic siblings of PHRASES, FEATURE_LABELS and the units line (DECISIONS 57). Fixed tables, never generated;
# they fill the additive `_ar` fields only and leave every English field as it was.
TEMPLATES_AR_PATH = Path(__file__).with_name("templates_ar.yaml")

# §11 contract keys, in order. Anything else in the credit object is a contract violation.
CONTRACT_KEYS = (
    "decision", "amount_sar", "base_markup_pct", "adjusted_markup_pct",
    "markup_fixed_at_inception", "late_penalty_policy", "repayment_months", "recourse", "stress",
)

# §13 threshold table — fixed, documented, never a per-decision judgement.
# Phrased relative to *approval* so the same sentence reads correctly on a decline.
PHRASES = {
    ("strongly", "supports"): "was a major factor supporting the credit assessment",
    ("strongly", "against"): "was a major factor increasing the estimated credit risk",
    ("moderately", "supports"): "contributed to a lower estimated credit risk",
    ("moderately", "against"): "contributed to a higher estimated credit risk",
    ("marginally", "either"): "had only a small effect on the credit risk assessment",
}

# Fixed customer-facing labels for all 58 Credit Lens model features.
# These labels are presentation-only and must not affect model scoring.
FEATURE_LABELS = {
    "avg_monthly_inflow": "average monthly money received",
    "inflow_count_per_month": "number of incoming payments each month",
    "inflow_regularity_score": "consistency of incoming payments",
    "revenue_growth_rate_90d": "recent revenue growth",
    "largest_single_source_ratio": "reliance on your largest income source",
    "avg_monthly_outflow": "average monthly spending",
    "outflow_count_per_month": "number of outgoing payments each month",
    "recurring_expense_ratio": "share of recurring expenses",
    "expense_growth_rate_90d": "recent expense growth",
    "top_expense_category_share": "concentration of expenses in one category",
    "cash_flow_volatility": "cash flow stability",
    "inflow_outflow_ratio": "balance between incoming and outgoing payments",
    "days_negative_balance_90d": "days with a negative account balance",
    "overdraft_events_90d": "recent overdraft occurrences",
    "volatility_index": "overall cash flow variability",
    "avg_daily_balance": "average daily account balance",
    "min_daily_balance_90d": "lowest recent account balance",
    "current_runway_days": "estimated cash runway",
    "runway_days_avg_balance": "cash runway based on average balances",
    "liquidity_trend_slope": "recent trend in available cash",
    "unique_counterparties_count": "number of customers and payment partners",
    "counterparty_concentration_index": "concentration of payment relationships",
    "new_counterparty_ratio_30d": "share of new payment relationships",
    "coverage_days_90d": "days of available transaction history",
    "data_gap_ratio": "gaps in transaction records",
    "implied_dso_days": "estimated time to collect customer payments",
    "implied_dio_days": "estimated inventory holding period",
    "implied_dpo_days": "estimated time to pay suppliers",
    "cash_conversion_cycle_days": "estimated cash conversion cycle",
    "financing_outflow_ratio": "share of outgoing payments used for financing",
    "installment_capacity_sar": "estimated monthly installment capacity",
    "inflow_break_recency_days": "time since the last interruption in incoming payments",
    "net_flow_autocorr_lag7": "weekly cash flow consistency",
    "counterparty_persistence_ratio": "continuity of payment relationships",
    "downside_semideviation_90d": "variability of unfavorable cash flow changes",
    "upside_semideviation_90d": "variability of favorable cash flow changes",
    "flow_asymmetry_ratio": "imbalance between cash flow gains and losses",
    "revenue_shock_absorption_pct": "ability to absorb a revenue decline",
    "fixed_obligation_coverage_months": "months of coverage for fixed obligations",
    "liquidity_hazard_30d": "estimated short-term cash shortage risk",
    "liquidity_hazard_60d": "estimated medium-term cash shortage risk",
    "liquidity_hazard_90d": "estimated three-month cash shortage risk",
    "sector_relative_regularity_z": "payment consistency compared with similar businesses",
    "sector_relative_volatility_z": "cash flow variability compared with similar businesses",
    "sector_relative_days_negative_z": "negative balance frequency compared with similar businesses",
    "sector_relative_balance_z": "account balance compared with similar businesses",
    "sector_relative_concentration_z": "payment concentration compared with similar businesses",
    "committed_monthly_outflow": "monthly committed payments",
    "obligation_coverage_ratio": "ability to cover recurring obligations",
    "ocr_forward_3m": "projected obligation coverage over three months",
    "ocr_forward_6m": "projected obligation coverage over six months",
    "obligation_horizon_months": "remaining months of identified obligations",
    "mandate_cancellation_count_90d": "recent payment mandate cancellations",
    "balloon_exposure_sar": "outstanding large lump-sum payment exposure",
    "facility_utilisation": "share of available financing already used",
    "headroom_days_of_burn": "days of available funds at the current spending rate",
    "max_consecutive_overdraft_days": "longest recent period of negative balance",
    "emergency_line_present": "availability of emergency financing",
}

@lru_cache(maxsize=4)
def load_artifact(path: str) -> dict:
    return json.loads(Path(path).read_text(encoding="utf-8"))


@lru_cache(maxsize=1)
def load_templates_ar(path: str = str(TEMPLATES_AR_PATH)) -> dict:
    return yaml.safe_load(Path(path).read_bytes().decode("utf-8"))


def signed_log1p(v: float) -> float:
    return math.copysign(math.log1p(abs(v)), v)


def _value(row: pd.Series, name: str) -> float:
    v = row.get(name, np.nan)
    if isinstance(v, (bool, np.bool_)):
        return float(v)
    if v is None or (isinstance(v, str) and v.strip() == ""):
        return np.nan
    if isinstance(v, str):
        if v in ("True", "False"):
            return 1.0 if v == "True" else 0.0
        try:
            return float(v)
        except ValueError:
            return np.nan
    try:
        return float(v)
    except (TypeError, ValueError):
        return np.nan


def score(row: pd.Series, art: dict) -> tuple[float, float, list[dict]]:
    """(pd, logit, contributions) for one profile row."""
    contribs, logit = [], float(art["intercept"])
    for f in art["features"]:
        x = _value(row, f["name"])
        if not math.isnan(x) and f["log_transform"]:
            x = signed_log1p(x)
        imputed = math.isnan(x)
        if imputed:
            x = f["median"]
        z = (x - f["mean"]) / f["scale"] if f["scale"] else 0.0
        c = f["coef"] * z
        logit += c
        contribs.append({"feature_id": f["id"], "feature": f["name"], "contribution_logodds": c, "imputed": imputed})
    pd_ = 1.0 / (1.0 + math.exp(-logit))
    return pd_, logit, contribs


def _magnitude(c: float, th: dict) -> str:
    a = abs(c)
    return "strongly" if a > th["strong"] else "moderately" if a >= th["moderate"] else "marginally"


def explain(contribs: list[dict], ccfg: dict) -> dict:
    th = ccfg["explanation_thresholds"]
    ar = load_templates_ar()
    ranked = sorted(contribs, key=lambda c: abs(c["contribution_logodds"]), reverse=True)
    public = []
    for c in ranked[: int(ccfg["explanation_top_n"])]:
        mag = _magnitude(c["contribution_logodds"], th)
        direction = "either" if mag == "marginally" else ("against" if c["contribution_logodds"] > 0 else "supports")
        label = FEATURE_LABELS[c["feature"]]
        public.append({
            "feature_id": c["feature_id"],
            "text": f"Your {label} {PHRASES[(mag, direction)]}.",
            "text_ar": ar["frame"].format(label=ar["feature_labels"][c["feature"]], phrase=ar["phrases"][f"{mag}/{direction}"]),
            "magnitude": mag,
            "direction": direction,
        })
    return {
        "public_tier": public,
        "compliance_tier": {
            "units": "log-odds of default, relative to the standardized training-mean baseline (exact additive linear-model contributions)",
            "threshold_table": {"strongly": f"|c| > {th['strong']}", "moderately": f"{th['moderate']} <= |c| <= {th['strong']}", "marginally": f"|c| < {th['moderate']}"},
            "phrases": {f"{m}/{d}": p for (m, d), p in PHRASES.items()},
            "contributions": [
                {**c, "contribution_logodds": round(c["contribution_logodds"], 6)} for c in ranked
            ],
            "units_ar": ar["units"],
            "phrases_ar": {f"{m}/{d}": ar["phrases"][f"{m}/{d}"] for (m, d) in PHRASES},
            "feature_labels_ar": {c["feature"]: ar["feature_labels"][c["feature"]] for c in ranked},
        },
    }


def affordable_amount(capacity: float, markup_pct: float, ccfg: dict) -> float:
    """Largest principal whose Murabaha installment fits alpha × capacity (§31)."""
    months = int(ccfg["repayment_months"])
    total_factor = 1.0 + markup_pct / 100.0 * months / 12.0  # fixed markup on cost, set at inception
    raw = ccfg["affordability_alpha"] * capacity * months / total_factor
    step = float(ccfg["amount_round_down_to_sar"])
    return min(math.floor(raw / step) * step, float(ccfg["max_amount_sar"]))


def decide(row: pd.Series, ccfg: dict, art: dict) -> dict:
    """Credit decision for a scored (or partial_profile) business: (§11 object, explanation, internals)."""
    pd_, logit, contribs = score(row, art)
    tier = next((t for t in ccfg["tiers"] if pd_ < t["pd_below"]), None)

    decision, reason, amount, markup = "approved", None, None, None
    if pd_ >= ccfg["decline_pd_at_or_above"] or tier is None:
        decision, reason = "declined", "risk_model"
    else:
        markup = float(tier["base_markup_pct"])
        cap = _value(row, "installment_capacity_sar")
        if math.isnan(cap) or cap <= 0:
            decision, reason, markup = "declined", "affordability_no_installment_capacity", None
        else:
            amount = affordable_amount(cap, markup, ccfg)
            if amount < ccfg["min_amount_sar"]:
                decision, reason, amount, markup = "declined", "affordability_below_minimum_amount", None, None

    credit = {
        "decision": decision,
        "amount_sar": amount,
        "base_markup_pct": markup,
        "adjusted_markup_pct": None,           # null unless the ESG module is built (§11)
        "markup_fixed_at_inception": True,     # always (§11, §17)
        "late_penalty_policy": "charity_directed",  # always (§11, §17)
        "repayment_months": int(ccfg["repayment_months"]) if decision == "approved" else None,
        "recourse": None,                      # null until the §27 module exists
        "stress": None,                        # null until the §34 module exists; never a markup input
    }
    assert tuple(credit) == CONTRACT_KEYS
    internals = {
        "decline_reason": reason,
        "pd": round(pd_, 6),
        "logit": round(logit, 6),
        "risk_tier": tier["name"] if (tier and decision == "approved") else None,
        "model_version": art["version"],
        "model_sha256": art.get("sha256"),
    }
    return {"credit": credit, "explanation": explain(contribs, ccfg), "internals": internals}


def apply_sharia_gate(result: dict, scr: dict, compliance_text: str | None, compliance_text_ar: str | None = None) -> dict:
    """Apply feature 24 to a risk decision (§27, SOP §2). Deterministic; template text only.

    hard_flag         -> a COMPLIANCE decline: no amount, no rate, explanation is the compliance
                         template only. decline_origin = "compliance", so recourse (§27) can
                         never be generated from it.
    soft_flag_review  -> the risk decision stands, but the offer is conditional on the owner
                         answering the fixed prompts (§10).
    compliant         -> unchanged.
    """
    status = scr["sharia_screen_status"]
    credit, internals, expl = dict(result["credit"]), dict(result["internals"]), dict(result["explanation"])
    internals["sharia_screen_status"] = status
    if status == "hard_flag":
        credit.update({"decision": "declined", "amount_sar": None, "base_markup_pct": None, "repayment_months": None, "recourse": None})
        internals.update({"decline_reason": "sharia_hard_flag", "decline_origin": "compliance", "risk_tier": None,
                          "offer_status": None, "risk_assessment_used_for_decision": False})
        expl["public_tier"] = [{"feature_id": None, "text": compliance_text, "text_ar": compliance_text_ar, "magnitude": None, "direction": None,
                                "source": "compliance"}]
    else:
        reason = internals.get("decline_reason")
        internals["decline_origin"] = None if reason is None else ("risk_model" if reason == "risk_model" else "affordability")
        if credit["decision"] == "approved":
            internals["offer_status"] = "conditional_on_sharia_review" if status == "soft_flag_review" else "unconditional"
        else:
            internals["offer_status"] = None
        internals["risk_assessment_used_for_decision"] = True
    if status == "soft_flag_review":
        internals["conditions"] = list(scr["owner_prompts"])
        internals["conditions_ar"] = list(scr["owner_prompts_ar"])
    assert tuple(credit) == CONTRACT_KEYS
    return {"credit": credit, "explanation": expl, "internals": internals}
