"""GET /insights/history (DECISIONS 62): a business's own profile figures as of earlier dates. Read-only.

Needs a serving store (git-ignored, regenerable), like tests/test_api.py; MAAL_STORE picks another one.
Skipped, loudly, if it is absent.
"""

from __future__ import annotations

import itertools
import os
from pathlib import Path

import pandas as pd
import pytest

STORE = Path(os.environ.get("MAAL_STORE", "data/serving.duckdb"))
pytestmark = pytest.mark.skipif(not STORE.exists(), reason=f"serving store missing at {STORE}")

KEY = "unit-test-key"
H = {"X-API-Key": KEY}
ROUTE = "/insights/history"


@pytest.fixture(scope="module")
def client():
    os.environ["MAAL_API_KEY"] = KEY
    os.environ["MAAL_STORE"] = str(STORE)
    from fastapi.testclient import TestClient

    from api.app import app

    with TestClient(app) as c:
        yield c


@pytest.fixture(autouse=True)
def fresh_rate_limit(client):
    client.app.state.svc.limiter.hits.clear()


@pytest.fixture(scope="module")
def statuses():
    """Every serving business's profile status and sector, computed directly."""
    from api.store import ServingStore
    from pipeline.data import run_profiles
    from pipeline.week8 import make_context

    store, ctx = ServingStore(STORE), make_context(generated_by="api")
    tables = store.load(sorted(store.ids))
    out = run_profiles(tables, ctx.cfg)["status"].set_index("business_id")[["status"]]
    out["sector"] = tables["businesses"].set_index("business_id")["sector"]
    return out


def test_history_route_is_keyed_read_only_and_refuses_unknown_businesses(client):
    assert client.get(ROUTE, params={"business_id": 10001}).status_code == 401
    assert client.get(ROUTE, params={"business_id": 10001}, headers={"X-API-Key": "wrong"}).status_code == 401
    assert client.get(ROUTE, params={"business_id": 99999}, headers=H).status_code == 404
    assert client.get(ROUTE, headers=H).status_code == 422
    assert client.post(ROUTE, params={"business_id": 10001}, headers=H).status_code == 405


def test_history_latest_point_equals_the_current_profile(client, statuses):
    from api.insights import METRICS

    ran = statuses[statuses["status"] != "insufficient_data"]
    others = [int(group.index[0]) for _, group in ran.groupby("sector")]
    checked = 0
    for b_id in [10001, *others][:4]:
        body = client.get(ROUTE, params={"business_id": b_id}, headers=H).json()
        points = body["history"]["points"]
        if not points:
            continue
        profile = client.get(f"/profile/{b_id}", headers=H).json()
        assert points[-1]["as_of"] == profile["as_of"] == body["as_of"]
        for m in METRICS:
            if profile["features"][m] is None:
                assert m not in points[-1]["metrics"]
            else:
                assert points[-1]["metrics"][m] == profile["features"][m]  # exactly the value shown today
        checked += 1
    assert checked >= 3  # 10001 and two other businesses


def test_history_points_are_real_periods_only(client):
    from api.insights import MAX_POINTS, METRICS, STEP_DAYS
    from api.store import ServingStore
    from profile_engine.features import TRAILING_DAYS

    store = ServingStore(STORE)
    for b_id in (10001, 10004, 10037):
        h = client.get(ROUTE, params={"business_id": b_id}, headers=H).json()["history"]
        assert h["window_days"] == TRAILING_DAYS and h["step_days"] == STEP_DAYS and h["metrics"] == list(METRICS)
        dates = [pd.Timestamp(p["as_of"]) for p in h["points"]]
        assert dates == sorted(dates) and len(dates) <= MAX_POINTS
        assert all((b - a).days == STEP_DAYS for a, b in itertools.pairwise(dates))  # evenly spaced, no gap filled
        first = pd.Timestamp(store.load([b_id])["daily_aggregates"]["date"].min())
        for d, p in zip(dates, h["points"], strict=True):
            assert d - pd.Timedelta(days=TRAILING_DAYS - 1) >= first  # the whole trailing window is inside the data
            assert set(p["metrics"]) <= set(METRICS) and all(isinstance(v, float) for v in p["metrics"].values())


def test_history_of_a_past_date_ignores_later_rows(client):
    """The value as of an earlier date is the profile of the data up to that date: later rows change nothing."""
    from api import insights
    from api.store import ServingStore
    from pipeline.data import run_profiles

    cfg = client.app.state.svc.ctx.cfg
    tables = ServingStore(STORE).load([10001])
    points = insights.history(cfg, tables, 10001)["points"]
    assert len(points) >= 2
    d = pd.Timestamp(points[0]["as_of"])
    cut = {name: df.copy() for name, df in tables.items()}
    cut["businesses"]["window_end"] = d
    for name, col in insights.DATED_TABLES.items():
        cut[name] = cut[name][pd.to_datetime(cut[name][col]) <= d].reset_index(drop=True)
    row = run_profiles(cut, cfg)["features"].set_index("business_id").loc[10001]
    for m, v in points[0]["metrics"].items():
        assert v == float(row[m])


def test_history_carries_the_same_receipt_as_the_profile(client):
    """Same inputs, so the same data hash as /profile; the output hash is this answer's own, and it is stable."""
    from pipeline.week8 import output_sha256

    body = client.get(ROUTE, params={"business_id": 10001}, headers=H).json()
    profile = client.get("/profile/10001", headers=H).json()
    assert body["receipt"]["data_sha256"] == profile["receipt"]["data_sha256"]
    assert set(body["receipt"]) == set(profile["receipt"])
    without = {k: v for k, v in body.items() if k != "receipt"}
    assert body["receipt"]["output_sha256"] == output_sha256(without)
    again = client.get(ROUTE, params={"business_id": 10001}, headers=H).json()
    assert again == body  # deterministic


def test_history_names_no_other_business_and_compares_with_none(client):
    """U9, schema §36.4: this is a business beside its own past. No group, no percentile, no other business."""
    body = client.get(ROUTE, params={"business_id": 10001}, headers=H).json()
    assert body["business_id"] == 10001
    text = str(body)
    for word in ("peer", "percentile", "p25", "p50", "p75", "sector_n", "rank"):
        assert word not in text
    assert set(body["history"]) == {"window_days", "step_days", "metrics", "points", "deterministic"}


def test_insufficient_data_is_explicit_never_estimated(client, statuses):
    refused = statuses[statuses["status"] == "insufficient_data"]
    if refused.empty:
        pytest.skip("this store has no insufficient_data business")
    body = client.get(ROUTE, params={"business_id": int(refused.index[0])}, headers=H).json()
    assert body["status"] == "insufficient_data" and body["lens_not_run_reason"] == "insufficient_data" and body["history"] is None


def test_history_counts_against_the_business_rate_limit(client, statuses):
    from api.app import RATE_LIMIT_PER_MIN

    refused = statuses[statuses["status"] == "insufficient_data"]
    b_id = int(refused.index[0]) if not refused.empty else 10001  # a refused business answers fastest
    codes = [client.get(ROUTE, params={"business_id": b_id}, headers=H).status_code for _ in range(RATE_LIMIT_PER_MIN + 1)]
    assert codes[:RATE_LIMIT_PER_MIN] == [200] * RATE_LIMIT_PER_MIN and codes[-1] == 429
