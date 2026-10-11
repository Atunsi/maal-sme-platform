"""API guarantees (schema §8, §15, §29; SOP §2) — asserted on real responses.

Needs the serving store (git-ignored, regenerable):
    python -m api.store --dir data --out data/serving.duckdb
Skipped, loudly, if it is absent.
"""

from __future__ import annotations

import os
from pathlib import Path

import pytest

STORE = Path("data/serving.duckdb")
pytestmark = pytest.mark.skipif(not STORE.exists(), reason="serving store missing — run: python -m api.store --dir data --out data/serving.duckdb")

KEY = "unit-test-key"
H = {"X-API-Key": KEY}
ZAKAT_ONLY = {"cash_and_equivalents_eom", "inventory_value_eom", "accounts_receivable_eom", "accounts_payable_eom",
              "short_term_liabilities_eom", "nisab_threshold_met", "hawl_completion_date"}
FORBIDDEN = {"stressed_markup_pct", "eligible", "fraud_reason", "score", "anomaly_score", "threshold"}


@pytest.fixture(scope="module")
def client():
    os.environ["MAAL_API_KEY"] = KEY
    from fastapi.testclient import TestClient

    from api.app import app

    with TestClient(app) as c:
        yield c


def keys_deep(o):
    if isinstance(o, dict):
        for k, v in o.items():
            yield k
            yield from keys_deep(v)
    elif isinstance(o, list):
        for v in o:
            yield from keys_deep(v)


def test_refuses_to_start_without_a_key(monkeypatch):
    from api.app import Service

    monkeypatch.delenv("MAAL_API_KEY", raising=False)
    with pytest.raises(RuntimeError, match="MAAL_API_KEY"):
        Service(str(STORE))


def test_health_needs_no_key(client):
    r = client.get("/health")
    assert r.status_code == 200 and r.json()["serving_businesses"] == 1000


@pytest.mark.parametrize("headers", [{}, {"X-API-Key": "wrong"}])
def test_every_data_route_requires_the_key(client, headers):
    for path, params in (("/profile/10001", {}), ("/lenses/credit", {"business_id": 10001}),
                         ("/lenses/forecast", {"business_id": 10001}), ("/lenses/anomaly", {"business_id": 10001}),
                         ("/lenses/zakat", {"business_id": 10001})):
        assert client.get(path, params=params, headers=headers).status_code == 401


def test_research_businesses_are_not_served(client):
    """§23: the demo population is disjoint from training — the API cannot reach a research business."""
    assert client.get("/lenses/credit", params={"business_id": 5}, headers=H).status_code == 404


def test_credit_contract_and_non_negotiables(client):
    from lenses.credit.model import CONTRACT_KEYS

    r = client.get("/lenses/credit", params={"business_id": 10001}, headers=H).json()
    c = r["credit"]
    assert tuple(c) == CONTRACT_KEYS
    assert c["markup_fixed_at_inception"] is True
    assert c["late_penalty_policy"] == "charity_directed"
    assert c["adjusted_markup_pct"] is None and c["recourse"] is None and c["stress"] is None
    assert not FORBIDDEN & set(keys_deep(r))


def test_insufficient_data_is_explicit(client):
    """§15: a refusal with a reason, never a low score or a silent null."""
    for path, name in (("/lenses/credit", "credit"), ("/lenses/forecast", "forecast"),
                       ("/lenses/anomaly", "anomaly"), ("/lenses/zakat", "zakat")):
        r = client.get(path, params={"business_id": 10003}, headers=H).json()
        assert r["status"] == "insufficient_data"
        assert r["lens_not_run_reason"] == "insufficient_data"
        assert r[name] is None


def test_anomaly_returns_reasons_never_scores(client):
    a = client.get("/lenses/anomaly", params={"business_id": 10001}, headers=H).json()["anomaly"]
    assert a["flags"], "demo 10001 carries injected anomalies"
    for f in a["flags"]:
        assert f["flag_reason"]
        assert not FORBIDDEN & set(f)


def test_profile_excludes_zakat_only_features(client):
    """§7/§8: the balance-sheet profile is read only by the Zakat lens."""
    feats = client.get("/profile/10001", headers=H).json()["features"]
    assert not ZAKAT_ONLY & set(feats)


def test_responses_are_deterministic(client):
    a = client.get("/lenses/credit", params={"business_id": 10002}, headers=H).json()
    b = client.get("/lenses/credit", params={"business_id": 10002}, headers=H).json()
    assert a == b and a["receipt"]["output_sha256"] == b["receipt"]["output_sha256"]


def test_rate_limit_per_business(client):
    from api.app import RateLimiter

    svc = client.app.state.svc
    saved = svc.limiter
    svc.limiter = RateLimiter(2)
    try:
        codes = [client.get("/lenses/zakat", params={"business_id": 10050}, headers=H).status_code for _ in range(3)]
        assert codes == [200, 200, 429]
        assert client.get("/lenses/zakat", params={"business_id": 10051}, headers=H).status_code == 200  # per business
    finally:
        svc.limiter = saved
