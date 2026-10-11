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

# §11 contract keys, in order. Anything else in the credit object is a contract violation.
CONTRACT_KEYS = (
    "decision", "amount_sar", "base_markup_pct", "adjusted_markup_pct",
    "markup_fixed_at_inception", "late_penalty_policy", "repayment_months", "recourse", "stress",
)

# §13 threshold table — fixed, documented, never a per-decision judgement.
# Phrased relative to *approval* so the same sentence reads correctly on a decline.
PHRASES = {
    ("strongly", "supports"): "strongly supported approval",
    ("strongly", "against"): "was the main factor working against approval",
    ("moderately", "supports"): "moderately supported approval",
    ("moderately", "against"): "moderately weighed against approval",
    ("marginally", "either"): "had only a small effect either way",
}


@lru_cache(maxsize=4)
def load_artifact(path: str) -> dict:
    return json.loads(Path(path).read_text(encoding="utf-8"))


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
    ranked = sorted(contribs, key=lambda c: abs(c["contribution_logodds"]), reverse=True)
    public = []
    for c in ranked[: int(ccfg["explanation_top_n"])]:
        mag = _magnitude(c["contribution_logodds"], th)
        direction = "either" if mag == "marginally" else ("against" if c["contribution_logodds"] > 0 else "supports")
        label = c["feature"].replace("_", " ")
        public.append({
            "feature_id": c["feature_id"],
            "text": f"Your {label} {PHRASES[(mag, direction)]}.",
            "magnitude": mag,
            "direction": direction,
        })
    return {
        "public_tier": public,
        "compliance_tier": {
            "units": "log-odds of default, relative to the training-mean business (exact SHAP for this linear model)",
            "threshold_table": {"strongly": f"|c| > {th['strong']}", "moderately": f"{th['moderate']} <= |c| <= {th['strong']}", "marginally": f"|c| < {th['moderate']}"},
            "phrases": {f"{m}/{d}": p for (m, d), p in PHRASES.items()},
            "contributions": [
                {**c, "contribution_logodds": round(c["contribution_logodds"], 6)} for c in ranked
            ],
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
