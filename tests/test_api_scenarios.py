"""GET /scenarios and POST /scenarios/run (DECISIONS 44): custom scenarios, bounded and labelled (N5).

Needs a serving store only so the app can start (the scenario routes never read it); MAAL_STORE picks
another one. Skipped, loudly, if it is absent.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path

import pytest

STORE = Path(os.environ.get("MAAL_STORE", "data/serving.duckdb"))
pytestmark = pytest.mark.skipif(not STORE.exists(), reason=f"serving store missing at {STORE}")

KEY = "unit-test-key"
H = {"X-API-Key": KEY}
SHOCKS = [{"type": "cash_crunch", "params": {"week": 16, "severity_pct": 40}}, {"type": "large_transfer", "params": {"week": 10}}]


@pytest.fixture(scope="module")
def client():
    os.environ["MAAL_API_KEY"] = KEY
    os.environ["MAAL_STORE"] = str(STORE)
    os.environ.setdefault("MAAL_RATE_LIMIT_PER_MIN", "60")
    from fastapi.testclient import TestClient

    from api.app import app

    with TestClient(app) as c:
        yield c


@pytest.fixture(autouse=True)
def fresh_rate_limit(client):
    """Each test starts with an empty rate-limit window; the limit itself is tested in tests/test_api.py."""
    client.app.state.svc.limiter.hits.clear()


@pytest.fixture(scope="module")
def custom(client):
    r = client.post("/scenarios/run", json={"shocks": SHOCKS}, headers=H)
    assert r.status_code == 200, r.text
    return r


def test_scenarios_route_lists_the_library_with_bounds(client):
    from scenarios.run import load_library

    lib, sha = load_library()
    body = client.get("/scenarios", headers=H).json()
    assert body["scenario_library_sha256"] == sha
    assert [s["name"] for s in body["scenarios"]] == list(lib["scenarios"])
    assert all(set(s) == {"name", "label", "story"} for s in body["scenarios"])
    crunch = body["shock_types"]["cash_crunch"]["params"]
    library_weeks = [s["overrides"]["inject_cash_crunch"]["week"] for s in lib["scenarios"].values() if (s.get("overrides") or {}).get("inject_cash_crunch")]
    assert crunch["week"]["min"] == min(library_weeks) and crunch["week"]["max"] == max(library_weeks)
    for params in (t["params"] for t in body["shock_types"].values()):
        for p in params.values():
            assert set(p) == {"min", "max", "step", "unit"} and p["min"] <= p["max"]
    assert body["shock_types"]["newcomer"]["fixed"]["operating_start_date"] == lib["scenarios"]["thin_file_newcomer"]["overrides"]["operating_start_date"]


@pytest.mark.parametrize(
    "shocks",
    [
        [{"type": "cash_crunch", "params": {"week": 11, "severity_pct": 40}}],
        [{"type": "cash_crunch", "params": {"week": 16, "severity_pct": 71}}],
        [{"type": "large_transfer", "params": {"week": 24}}],
        [{"type": "odd_hours_transaction", "params": {"week": 8}}],
        [{"type": "cash_crunch", "params": {"week": 16.5, "severity_pct": 40}}],
        [{"type": "cash_crunch", "params": {"week": 16}}],
        [{"type": "cash_crunch", "params": {"week": 16, "severity_pct": 40, "markup": 1}}],
        [{"type": "large_transfer", "params": {"week": True}}],
        [],
        [{"type": "large_transfer", "params": {"week": 10}}] * 4,
        [{"type": "cash_crunch", "params": {"week": 16, "severity_pct": 40}}] * 2,
    ],
)
def test_custom_scenario_rejects_out_of_bound_params(client, shocks):
    r = client.post("/scenarios/run", json={"shocks": shocks}, headers=H)
    assert r.status_code == 422 and isinstance(r.json()["detail"], str)


@pytest.mark.parametrize("body", [{"shocks": [{"type": "unusual_combination", "params": {"week": 10}}]}, {"shocks": [{"type": "set_markup", "params": {}}]}, {"shocks": SHOCKS, "extra": 1}, [], "x"])
def test_custom_scenario_rejects_unknown_shock_types(client, body):
    assert client.post("/scenarios/run", json=body, headers=H).status_code == 422


def test_custom_scenario_integrity_hash_matches_its_receipt(custom):
    from pipeline.week8 import output_sha256
    from scenarios.run import load_library

    obj = custom.json()
    assert output_sha256(obj) == obj["receipt"]["output_sha256"]
    assert obj["receipt"]["scenario_library_sha256"] == load_library()[1]
    for key in ("config_sha256", "lens_config_sha256", "credit_model_sha256", "data_sha256", "code_commit", "scope"):
        assert obj["receipt"][key]


def test_custom_scenario_is_byte_identical_on_re_run(client, custom):
    again = client.post("/scenarios/run", json={"shocks": SHOCKS}, headers=H)
    assert again.content == custom.content


def test_custom_scenario_result_is_labelled_custom(custom):
    s = custom.json()["scenario"]
    assert s["source"] == "custom" and s["id"] == "custom" and s["label"] == "Custom scenario"
    assert s["shocks"] == SHOCKS
    assert s["overrides"] == {"inject_cash_crunch": {"week": 16, "severity_pct": 40}, "inject_anomalies": [{"type": "large_transfer", "week": 10}]}


def test_custom_scenario_has_the_shape_of_a_library_object(custom):
    library = json.loads(Path("web/scenarios-data/baseline.json").read_text(encoding="utf-8"))
    obj = custom.json()
    assert set(obj) == set(library)
    assert set(obj["scenario"]) == set(library["scenario"]) | {"source", "shocks"}


def test_custom_scenario_has_no_terms_parameters(client):
    """U1: no shock parameter can set markup, amount, months or any other term of an offer."""
    from api.scenario_bounds import BOUNDS, TERMS

    body = client.get("/scenarios", headers=H).json()
    names = {p for t in body["shock_types"].values() for p in [*t["params"], *t["fixed"]]} | {p for t in BOUNDS.values() for p in t}
    assert names and not any(TERMS & set(n.split("_")) for n in names)


def test_scenarios_run_check_still_exits_0():
    r = subprocess.run([sys.executable, "-m", "scenarios.run", "--check"], capture_output=True, text=True, encoding="utf-8", errors="replace", check=False)
    assert r.returncode == 0, r.stdout[-2000:] + r.stderr[-2000:]
