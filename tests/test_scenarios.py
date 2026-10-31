"""Hostile-demo scenario library (scenarios/). Needs no generated data: each scenario regenerates
its one business in memory."""

from __future__ import annotations

import pytest

from eval import week8_check
from eval.heldout_anomalies import HELD_OUT_TYPES, assert_held_out
from lenses import load_lens_config
from pipeline.week8 import make_context
from scenarios.run import ALLOWED_OVERRIDES, load_library, run_scenario, scenario_config


@pytest.fixture(scope="module")
def lib():
    return load_library()


@pytest.fixture(scope="module")
def ctx():
    return make_context("tests")


def test_menu_uses_only_demo_levers_and_no_held_out_types(lib):
    menu, _ = lib
    assert 6 <= len(menu["scenarios"]) <= 8
    for s in menu["scenarios"].values():
        assert set(s.get("overrides") or {}) <= ALLOWED_OVERRIDES
        for a in (s.get("overrides") or {}).get("inject_anomalies", []):
            assert a["type"] not in HELD_OUT_TYPES
    assert_held_out()


def test_scenario_keeps_seed_and_touches_only_its_business(lib, ctx):
    menu, _ = lib
    c = scenario_config(ctx.cfg, menu, "severe_collapse")
    (pop,) = c["populations"].values()
    b = menu["base_business"]
    assert pop["id_range"] == [b, b]
    assert pop["seed"] == next(p["seed"] for p in ctx.cfg["populations"].values() if p["id_range"][0] <= b <= p["id_range"][1])
    assert c["demo_businesses"][0]["inject_cash_crunch"] == {"week": 14, "severity_pct": 60}


@pytest.mark.parametrize("name", ["severe_collapse", "thin_file_newcomer"])
def test_scenario_output_meets_week8_contract(lib, ctx, name):
    menu, sha = lib
    obj, _, secs = run_scenario(ctx, menu, sha, name)
    week8_check.FAILURES.clear()
    week8_check.check_object(obj, load_lens_config())
    assert week8_check.FAILURES == []
    assert obj["scenario"]["id"] == name and obj["receipt"]["scenario_library_sha256"] == sha
    assert secs < 30


def test_unknown_override_is_refused(tmp_path):
    p = tmp_path / "lib.yaml"
    p.write_text("version: '0'\nstatus: x\nbase_business: 10001\nscenarios:\n  bad:\n    label: b\n    story: s\n"
                 "    overrides: { latent_to_observable_correlation: 0.9 }\n", encoding="utf-8")
    with pytest.raises(ValueError, match="not demo levers"):
        load_library(p)
