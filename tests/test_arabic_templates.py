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

import pytest

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
