"""Arabic template tables (DECISIONS 57): rules A1, A2 and A3.

A1  every English template key has an Arabic template
A2  an Arabic template has the same placeholders as its English template and no digit the English one lacks
A3  the `_ar` fields are deterministic and leave every English field byte for byte unchanged
"""

from __future__ import annotations

import json
import re
import string
from pathlib import Path

import pandas as pd
import pytest

from compliance import sharia
from lenses.credit import model as credit

QUICK = Path("data/quick")

# Pre-change output_sha256 of three demo objects on the quick data (main 8eaa4b5, before any `_ar` field
# existed). output_sha256 hashes the object without its receipt, so stripping the `_ar` keys from a new
# object must give exactly these hashes again. Checked only when the business's input data is the same.
BEFORE = {
    10001: ("54031a72bbbb69608a05c9db96749d5e172e3dda62bb1f4aa880f4c007c306a1", "58ad076504cc9c3adafeb37da49df647cc5e8198b099f973b4342b4fc58b8a28"),
    10004: ("caf416ef1fdf6772e0ba467425d34adbe9722699e48294ac5a0b327deab87c84", "814a53e9d973c59bbf80f3747da22533bc01a48e884fc5ef5f45cb8c3054750a"),
    10037: ("1850454ce972d21594bfd688556e5694b28c3e98574fe4736c6c7914263818d7", "bd0136e24ccea783173e6d50e02c371655d80f42b5855dc73390038c73ef4595"),
}


def placeholders(template: str) -> set[str]:
    return {name for _, name, _, _ in string.Formatter().parse(template) if name is not None}


def digits(template: str) -> set[str]:
    return set(re.findall(r"[0-9]", re.sub(r"\{[^}]*\}", "", template)))


def assert_pair(en: str, ar: str, where: str) -> None:
    assert placeholders(ar) == placeholders(en), f"{where}: placeholders {placeholders(ar)} != {placeholders(en)}"
    assert digits(ar) <= digits(en), f"{where}: digits {digits(ar) - digits(en)} not in the English template"
    assert not re.search(r"[A-Za-z]{2,}", re.sub(r"\{[^}]*\}", "", ar)), f"{where}: Latin word in the Arabic template"


def strip_ar(o):
    if isinstance(o, dict):
        return {k: strip_ar(v) for k, v in o.items() if not k.endswith("_ar")}
    if isinstance(o, list):
        return [strip_ar(v) for v in o]
    return o


# ---- credit (B1) -----------------------------------------------------------------------------------------

def test_every_english_template_has_an_arabic_template_credit():
    ar = credit.load_templates_ar()
    assert set(ar["feature_labels"]) == set(credit.FEATURE_LABELS)
    assert set(ar["phrases"]) == {f"{m}/{d}" for m, d in credit.PHRASES}
    assert ar["units"].strip()


def test_arabic_templates_keep_the_english_placeholders_and_numbers_credit():
    ar = credit.load_templates_ar()
    assert placeholders(ar["frame"]) == {"label", "phrase"}
    for (m, d), en in credit.PHRASES.items():
        assert_pair(en, ar["phrases"][f"{m}/{d}"], f"phrase {m}/{d}")
    for key, en in credit.FEATURE_LABELS.items():
        assert_pair(en, ar["feature_labels"][key], f"label {key}")


def _contribs():
    names = list(credit.FEATURE_LABELS)
    values = [0.9, -0.5, 0.2, -0.05, 0.31, -0.29, 0.0]
    return [{"feature_id": i, "feature": names[i], "contribution_logodds": v, "imputed": False} for i, v in enumerate(values)]


CCFG = {"explanation_thresholds": {"strong": 0.3, "moderate": 0.1}, "explanation_top_n": 7}


def test_credit_arabic_line_uses_the_same_magnitude_and_direction_as_the_english_line():
    ar = credit.load_templates_ar()
    names = {c["feature_id"]: c["feature"] for c in _contribs()}
    out = credit.explain(_contribs(), CCFG)
    for line in out["public_tier"]:
        phrase = ar["phrases"][f"{line['magnitude']}/{line['direction']}"]
        en_phrase = credit.PHRASES[(line["magnitude"], line["direction"])]
        assert line["text"].endswith(f"{en_phrase}.")
        assert line["text_ar"] == f"«{ar['feature_labels'][names[line['feature_id']]]}» {phrase}."
    tier = out["compliance_tier"]
    assert set(tier["phrases_ar"]) == set(tier["phrases"])
    assert set(tier["feature_labels_ar"]) == {c["feature"] for c in tier["contributions"]}


def test_credit_english_fields_are_unchanged_by_the_arabic_fields():
    out = credit.explain(_contribs(), CCFG)
    for line in out["public_tier"]:
        assert set(line) == {"feature_id", "text", "text_ar", "magnitude", "direction"}
    assert strip_ar(out) == strip_ar(credit.explain(_contribs(), CCFG))


# ---- Sharia (B2) -----------------------------------------------------------------------------------------

# The detail lines compliance/sharia.py writes itself, as templates (the f-strings in screen()).
SHARIA_DETAILS_EN = {
    "mcc": "MCC {mcc}: {label}",
    "no_mcc": "no merchant code; registered sector {sector} does not determine the goods sold",
    "fi_share": "{share} of inflow value from financial institutions (threshold {threshold})",
    "existing_financing": "regular repayments to a financial institution; financing type unknown",
}


def test_every_english_template_has_an_arabic_template_sharia():
    rules, _ = sharia.load_rules()
    ar = sharia.load_templates_ar()
    assert set(ar["prompts"]) == set(rules["prompts"])
    assert set(ar["explanations"]) == set(rules["explanations"])
    assert set(ar["mcc_labels"]) == set(rules["activity"]["hard_flag_mcc"]) | set(rules["activity"]["soft_flag_mcc"])
    assert set(ar["sector_labels"]) == set(rules["activity"]["no_mcc_by_sector"])
    assert set(ar["details"]) == set(SHARIA_DETAILS_EN)


def test_arabic_templates_keep_the_english_placeholders_and_numbers_sharia():
    rules, _ = sharia.load_rules()
    ar = sharia.load_templates_ar()
    for group in ("prompts", "explanations"):
        for key, en in rules[group].items():
            assert_pair(en, ar[group][key], f"{group}.{key}")
    for key, en in SHARIA_DETAILS_EN.items():
        assert_pair(en, ar["details"][key], f"details.{key}")
    labels = rules["activity"]["hard_flag_mcc"] | rules["activity"]["soft_flag_mcc"]
    for mcc, en in labels.items():
        assert_pair(en, ar["mcc_labels"][mcc], f"mcc {mcc}")
        assert (" (" in en) == (" (" in ar["mcc_labels"][mcc]), f"mcc {mcc}: the short form differs"


def _sharia_tx():
    return pd.DataFrame([("in", "customer", 900.0, 1.0), ("in", "financial_institution", 100.0, 1.0), ("out", "financial_institution", 50.0, 1.0)],
                        columns=["direction", "counterparty_type", "amount", "sample_weight"])


@pytest.mark.parametrize("sector, mcc", [("retail_trade", 5999), ("retail_trade", None), ("food_beverage", 5813), ("construction", 1520)])
def test_sharia_arabic_fields_mirror_the_english_ones(sector, mcc):
    s = sharia.screen(sector, mcc, _sharia_tx())
    assert len(s["owner_prompts_ar"]) == len(s["owner_prompts"])
    for h in s["rules_triggered"]:
        assert h["detail_ar"]
    for d in s["disclosures"]:
        assert d["detail_ar"] and d["prompt_ar"]
    assert (sharia.compliance_explanation(s) is None) == (sharia.compliance_explanation_ar(s) is None)
    assert sharia.screen(sector, mcc, _sharia_tx()) == s
    english = {k: v for k, v in strip_ar(s).items()}
    assert "owner_prompts_ar" not in english and english["owner_prompts"] == s["owner_prompts"]


def test_hard_flag_compliance_line_carries_arabic():
    from lenses import load_lens_config

    s = sharia.screen("food_beverage", 5813, None)
    row = pd.Series({c["feature"]: 0.0 for c in _contribs()} | {"installment_capacity_sar": 10000.0})
    art = credit.load_artifact("lenses/credit/model_v1.json")
    out = credit.apply_sharia_gate(credit.decide(row, load_lens_config()["credit"], art), s,
                                   sharia.compliance_explanation(s), sharia.compliance_explanation_ar(s))
    (line,) = out["explanation"]["public_tier"]
    assert line["text"] == sharia.compliance_explanation(s)
    assert line["text_ar"] == sharia.compliance_explanation_ar(s) and "5813" in line["text_ar"]


def test_rule_table_hash_is_unchanged():
    assert sharia.load_rules()[1] == "e90efd67c9ad7887c520fec5d589ed0bb8b9a952a0d37be93b99657110a30cf3"


# ---- A3 on real output -----------------------------------------------------------------------------------

@pytest.fixture(scope="module")
def objects():
    if not (QUICK / "businesses.csv").exists():
        pytest.skip("quick data not generated (python -m generator.generate --quick)")
    from pipeline.week8 import build_objects

    first = build_objects(str(QUICK), list(BEFORE))
    second = build_objects(str(QUICK), list(BEFORE))
    return first, second


def test_arabic_fields_change_no_english_field(objects):
    from pipeline.week8 import output_sha256

    first, second = objects
    assert json.dumps(first, sort_keys=True, default=str) == json.dumps(second, sort_keys=True, default=str)
    for o in first:
        data_hash, before = BEFORE[o["business_id"]]
        if o["receipt"]["data_sha256"] != data_hash:
            pytest.skip(f"{o['business_id']}: quick data differs from the reference run")
        assert output_sha256(strip_ar(o)) == before, f"{o['business_id']}: an English field moved"
