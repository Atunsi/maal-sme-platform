"""GET /businesses (DECISIONS 44): the serving businesses, paged, keyed and rate-limited like every route.

Needs a serving store (git-ignored, regenerable), like tests/test_api.py; MAAL_STORE picks another one.
Skipped, loudly, if it is absent.
"""

from __future__ import annotations

import os
from pathlib import Path

import pytest

STORE = Path(os.environ.get("MAAL_STORE", "data/serving.duckdb"))
pytestmark = pytest.mark.skipif(not STORE.exists(), reason=f"serving store missing at {STORE}")

KEY = "unit-test-key"
H = {"X-API-Key": KEY}


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
    """Each test starts with an empty rate-limit window; the limit itself is tested in tests/test_api.py."""
    client.app.state.svc.limiter.hits.clear()


@pytest.fixture(scope="module")
def store_rows():
    from api.store import ServingStore

    return ServingStore(STORE).business_list()


@pytest.mark.parametrize("headers", [{}, {"X-API-Key": "wrong"}])
def test_new_routes_require_the_api_key(client, headers):
    assert client.get("/businesses", headers=headers).status_code == 401


def test_businesses_route_returns_serving_ids_only(client, store_rows):
    """N4: a research ID (1 to 10,000) never appears, and the response says its population."""
    from pipeline.week8 import make_context

    lo, hi = make_context().cfg["populations"]["serving"]["id_range"]
    body = client.get("/businesses", params={"limit": 50}, headers=H).json()
    assert body["population"] == "serving" and body["data_source"] == "synthetic"
    seen, offset = [], 0
    while offset < body["total"]:
        page = client.get("/businesses", params={"offset": offset, "limit": 50}, headers=H).json()
        seen += [b["business_id"] for b in page["businesses"]]
        offset += 50
    assert seen and all(lo <= b <= hi for b in seen)
    assert not any(b <= 10000 for b in seen)
    assert seen == sorted(seen)
    assert body["total"] == sum(1 for r in store_rows if r[2] == "serving")  # read from the store, not assumed


def test_businesses_pagination_totals_add_up(client):
    total = client.get("/businesses", params={"limit": 50}, headers=H).json()["total"]
    ids = []
    for offset in range(0, total, 50):
        page = client.get("/businesses", params={"offset": offset, "limit": 50}, headers=H).json()
        assert page["total"] == total and page["offset"] == offset and page["limit"] == 50
        assert len(page["businesses"]) == min(50, total - offset)
        ids += [b["business_id"] for b in page["businesses"]]
    assert len(ids) == len(set(ids)) == total
    small = [b["business_id"] for o in (0, 7, 14) for b in client.get("/businesses", params={"offset": o, "limit": 7}, headers=H).json()["businesses"]]
    assert small == ids[:21]  # smaller pages tile the same order
    assert client.get("/businesses", params={"offset": total}, headers=H).json()["businesses"] == []
    assert client.get("/businesses", headers=H).json()["limit"] == 25  # the default


def test_businesses_sector_and_q_filters(client, store_rows):
    serving = [r for r in store_rows if r[2] == "serving"]
    sector = serving[0][1]
    body = client.get("/businesses", params={"sector": sector, "limit": 50}, headers=H).json()
    assert body["total"] == sum(1 for r in serving if r[1] == sector)
    assert {b["sector"] for b in body["businesses"]} == {sector}

    prefix = str(serving[0][0])[:4]
    body = client.get("/businesses", params={"q": prefix, "limit": 50}, headers=H).json()
    assert body["total"] == sum(1 for r in serving if str(r[0]).startswith(prefix))
    assert all(str(b["business_id"]).startswith(prefix) for b in body["businesses"])
    exact = client.get("/businesses", params={"q": str(serving[0][0])}, headers=H).json()
    assert [b["business_id"] for b in exact["businesses"]] == [serving[0][0]]


@pytest.mark.parametrize(
    "params",
    [{"limit": 0}, {"limit": 51}, {"limit": "ten"}, {"offset": -1}, {"offset": "1.5"}, {"q": "10a"}, {"q": "-1"},
     {"sector": "not_a_sector"}, {"page": 2}, {"business_id": 10001}],
)
def test_businesses_bad_params_return_422(client, params):
    r = client.get("/businesses", params=params, headers=H)
    assert r.status_code == 422
    assert isinstance(r.json()["detail"], str)  # the existing error format: {"detail": "<reason>"}


def test_businesses_runs_no_lens(client):
    body = client.get("/businesses", params={"limit": 3}, headers=H).json()
    assert set(body) == {"population", "data_source", "total", "offset", "limit", "businesses"}
    assert all(set(b) == {"business_id", "sector"} for b in body["businesses"])
