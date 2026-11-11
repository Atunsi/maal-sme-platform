"""The five API read-paths — schema §8, §15, §29.

    set MAAL_API_KEY=<a secret>                       (env var; never committed, never logged — SOP §8)
    python -m api.store --dir data --out data/serving.duckdb
    uvicorn api.app:app --port 8000

    GET /health                                  no auth
    GET /profile/{business_id}                   transaction-derived features (§8 list; NOT 27–31, 34, 35)
    GET /lenses/credit?business_id=...           §11 decision + §13 explanation
    GET /lenses/forecast?business_id=...         30/60/90-day projection + crunch alert
    GET /lenses/anomaly?business_id=...          flags with flag_reason only — never scores (§29)
    GET /lenses/zakat?business_id=...            Zakat liability from the balance-sheet snapshot (§7)
    GET /businesses?offset=&limit=&sector=&q=   the serving businesses, paged; no lens runs (DECISIONS 44)
    GET /scenarios                               the scenario library and the custom-scenario bounds (DECISIONS 44)
    POST /scenarios/run                          one custom scenario on the library's business (DECISIONS 44)

Every request computes from inputs — the profile engine and the lens run each time; the
serving store holds input rows only (api/store.py). The lenses read the same profile and
none reads another's output (§8). The computation is the SAME code as the Week 8 CLI
(pipeline.week8 sections), so an API answer equals the CLI answer for the same business.

§15: a business in `insufficient_data` gets an explicit refusal with that status, never a
low score and never a silent null. §29: a shared API key (header X-API-Key), compared in
constant time, and a per-business rate limit. A real deployment would need per-owner
authorisation (a business may only read its own profile); that is stated, not built.
"""

from __future__ import annotations

import contextlib
import copy
import io
import math
import os
import re
import secrets
import threading
import time
from collections import defaultdict, deque
from contextlib import asynccontextmanager
from typing import Annotated

import numpy as np
from fastapi import Body, Depends, FastAPI, Header, HTTPException, Query, Request

from api import insights, scenario_bounds
from api.store import DEFAULT_STORE, ServingStore
from generator.generate import generate
from pipeline.week8 import (
    Context,
    Prepared,
    anomaly_section,
    credit_section,
    decision_object,
    forecast_section,
    header,
    make_context,
    output_sha256,
    prepare,
    receipt,
    scorable,
    sharia_section,
    zakat_section,
)
from profile_engine.registry import FEATURE_NAMES, PROFILE_FEATURE_IDS
from scenarios.run import BUDGET_S, scenario_config

RATE_LIMIT_PER_MIN = int(os.environ.get("MAAL_RATE_LIMIT_PER_MIN", "60"))


def _clean(o):
    """JSON-safe: numpy scalars -> Python, NaN/inf -> null (JSON has no NaN)."""
    if isinstance(o, dict):
        return {k: _clean(v) for k, v in o.items()}
    if isinstance(o, (list, tuple)):
        return [_clean(v) for v in o]
    if isinstance(o, np.generic):
        o = o.item()
    if isinstance(o, float) and not math.isfinite(o):
        return None
    return o


class RateLimiter:
    """Sliding one-minute window per business_id (§29: rate-limit queries per business)."""

    def __init__(self, per_minute: int):
        self.per_minute, self.hits, self.lock = per_minute, defaultdict(deque), threading.Lock()

    def check(self, b_id: int) -> None:
        now = time.monotonic()
        with self.lock:
            q = self.hits[b_id]
            while q and now - q[0] > 60.0:
                q.popleft()
            if len(q) >= self.per_minute:
                raise HTTPException(status_code=429, detail=f"rate limit: {self.per_minute} requests/minute per business")
            q.append(now)


class Service:
    def __init__(self, store_path: str):
        key = os.environ.get("MAAL_API_KEY")
        if not key:
            # §29: never silently run an open API.
            raise RuntimeError("MAAL_API_KEY is not set — refusing to start an unauthenticated API")
        self.key = key
        self.ctx: Context = make_context(generated_by="api")
        self.store = ServingStore(store_path)
        self.limiter = RateLimiter(RATE_LIMIT_PER_MIN)

    def prepared(self, b_id: int) -> Prepared:
        if b_id not in self.store:
            raise HTTPException(status_code=404, detail=f"business_id {b_id} is not in the serving population")
        self.limiter.check(b_id)
        return prepare(self.ctx, self.store.load([b_id]))


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.svc = Service(os.environ.get("MAAL_STORE", DEFAULT_STORE))
    yield


app = FastAPI(title="Ma'al SME platform — read-paths (§8)", version="1.0", lifespan=lifespan)


def svc(request: Request) -> Service:
    return request.app.state.svc


def authorised(request: Request, x_api_key: Annotated[str | None, Header()] = None) -> Service:
    s = svc(request)
    if not x_api_key or not secrets.compare_digest(x_api_key, s.key):
        raise HTTPException(status_code=401, detail="missing or invalid X-API-Key")
    return s


def _lens_response(s: Service, b_id: int, section, name: str) -> dict:
    p = s.prepared(b_id)
    body = header(p, b_id)
    if not scorable(p, b_id):
        body.update({"lens_not_run_reason": "insufficient_data", name: None})  # §15: explicit, never silent
    else:
        out = section(s.ctx, p, b_id)
        body.update(out if name == "credit" else {name: out})
    if name == "credit":
        body["sharia_screen"] = sharia_section(p, b_id)  # feature 24 — the credit decision depends on it (§27)
    body["receipt"] = receipt(s.ctx, p, b_id, body)
    return _clean(body)


Authorised = Annotated["Service", Depends(authorised)]
BusinessId = Annotated[int, Query()]


@app.get("/health")
def health(request: Request) -> dict:
    s = svc(request)
    return {"status": "ok", "serving_businesses": len(s.store.ids), "credit_model_version": s.ctx.art["version"]}


@app.get("/profile/{business_id}")
def profile(business_id: int, s: Authorised) -> dict:
    p = s.prepared(business_id)
    body = header(p, business_id)
    row = p.feats.loc[business_id]
    names = [FEATURE_NAMES[f] for f in PROFILE_FEATURE_IDS]  # §8 membership list — Zakat-only features excluded
    body["features"] = {n: row.get(n) for n in names}
    n = p.nulls
    nulls = n[(n["business_id"] == business_id) & (n["feature"].isin(names))]
    body["null_reasons"] = dict(zip(nulls["feature"], nulls["reason"], strict=True))
    body["receipt"] = {**s.ctx.receipt_base, "data_sha256": p.data_hash[business_id], "output_sha256": output_sha256(_clean(body))}
    return _clean(body)


@app.get("/lenses/credit")
def credit(business_id: BusinessId, s: Authorised) -> dict:
    return _lens_response(s, business_id, credit_section, "credit")


@app.get("/lenses/forecast")
def forecast_route(business_id: BusinessId, s: Authorised) -> dict:
    return _lens_response(s, business_id, forecast_section, "forecast")


@app.get("/lenses/anomaly")
def anomaly(business_id: BusinessId, s: Authorised) -> dict:
    return _lens_response(s, business_id, anomaly_section, "anomaly")


@app.get("/lenses/zakat")
def zakat(business_id: BusinessId, s: Authorised) -> dict:
    return _lens_response(s, business_id, zakat_section, "zakat")


# --- DECISIONS 62: owner insights, read-only (Faris Alsharifi, acting API owner) --------------------------


@app.get("/insights/history")
def insights_history(business_id: BusinessId, s: Authorised) -> dict:
    """IN3: a business's own profile figures as of earlier dates, each the full trailing-90-day measure.

    The self-comparison of schema §36.2. It compares a business with no other business (§36.4, U9). No lens runs.
    """
    if business_id not in s.store:
        raise HTTPException(status_code=404, detail=f"business_id {business_id} is not in the serving population")
    s.limiter.check(business_id)
    tables = s.store.load([business_id])
    p = prepare(s.ctx, tables)
    body = header(p, business_id)
    if not scorable(p, business_id):
        body.update({"lens_not_run_reason": "insufficient_data", "history": None})  # §15: explicit, never silent
    else:
        body["history"] = insights.history(s.ctx.cfg, tables, business_id)
    return _clean(body)


# --- DECISIONS 44: the business list and custom scenarios (Faris Alsharifi acted for the API owner) ------

# The rate limiter counts per business; routes not about one business count against these buckets.
LIST_BUCKET, SCENARIO_BUCKET = -1, -2
LIST_PARAMS = {"offset", "limit", "sector", "q"}
LIST_LIMIT_MAX, LIST_LIMIT_DEFAULT = 50, 25
CUSTOM_LABEL = "Custom scenario"


def _int_param(params, name: str, default: int, lo: int, hi: int | None) -> int:
    raw = params.get(name)
    if raw is None:
        return default
    if not re.fullmatch(r"\d{1,6}", raw) or int(raw) < lo or (hi is not None and int(raw) > hi):
        upper = f" to {hi}" if hi is not None else " up"
        raise HTTPException(status_code=422, detail=f"{name} must be a whole number from {lo}{upper}")
    return int(raw)


@app.get("/businesses")
def businesses(request: Request, s: Authorised) -> dict:
    """The serving businesses, by ID, paged. Reads the store only; no lens runs on this route."""
    unknown = set(request.query_params) - LIST_PARAMS
    if unknown:
        raise HTTPException(status_code=422, detail=f"unknown query parameter(s): {sorted(unknown)}")
    params = request.query_params
    offset = _int_param(params, "offset", 0, 0, None)
    limit = _int_param(params, "limit", LIST_LIMIT_DEFAULT, 1, LIST_LIMIT_MAX)
    lo, hi = s.ctx.cfg["populations"]["serving"]["id_range"]
    rows = [r for r in s.store.business_list() if lo <= r[0] <= hi and r[2] == "serving"]  # serving only, twice over
    sector, q = params.get("sector"), params.get("q")
    if sector is not None and sector not in {r[1] for r in rows}:
        raise HTTPException(status_code=422, detail=f"sector must be one of {sorted({r[1] for r in rows})}")
    if q is not None and not re.fullmatch(r"\d{1,9}", q):
        raise HTTPException(status_code=422, detail="q must be digits only (the start of a business ID)")
    s.limiter.check(LIST_BUCKET)
    rows = [r for r in rows if (sector is None or r[1] == sector) and (q is None or str(r[0]).startswith(q))]
    sources = {r[3] for r in rows} or {"synthetic"}
    return {
        "population": "serving",
        "data_source": sources.pop() if len(sources) == 1 else "mixed",
        "total": len(rows),
        "offset": offset,
        "limit": limit,
        "businesses": [{"business_id": r[0], "sector": r[1]} for r in rows[offset : offset + limit]],
    }


@app.get("/scenarios")
def scenarios_list(s: Authorised) -> dict:
    """The scenario library, and the bounds a custom scenario must keep (api/scenario_bounds.py)."""
    s.limiter.check(SCENARIO_BUCKET)
    lib = scenario_bounds.LIB
    return {
        "library_version": lib["version"],
        "library_status": lib["status"],
        "base_business": int(lib["base_business"]),
        "scenario_library_sha256": scenario_bounds.LIB_SHA,
        "scenarios": [{"name": n, "label": v["label"], "story": v["story"]} for n, v in lib["scenarios"].items()],
        "max_shocks": scenario_bounds.MAX_SHOCKS,
        "shock_types": scenario_bounds.describe(),
    }


@app.post("/scenarios/run")
def scenarios_run(s: Authorised, body: Annotated[object, Body()] = None) -> dict:
    """One custom scenario on the library's business, built by the same functions as scenarios.run.

    Nothing is stored or cached. The object has the shape of an exported scenario object, with
    scenario.source "custom", the shocks echoed back, and a receipt whose output_sha256 the object
    hashes to (DECISIONS 41's integrity rule). The same request gives the same bytes. It never reads
    the serving store, so it does not touch the store's shared connection.
    """
    s.limiter.check(SCENARIO_BUCKET)
    if not isinstance(body, dict) or set(body) != {"shocks"}:
        raise HTTPException(status_code=422, detail='body must be {"shocks": [...]} and nothing else')
    try:
        overrides = scenario_bounds.overrides_for(body["shocks"])
    except scenario_bounds.ShockError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e
    lib = copy.deepcopy(scenario_bounds.LIB)
    lib["scenarios"]["custom"] = {"label": CUSTOM_LABEL, "story": "", "overrides": overrides}
    b_id = int(lib["base_business"])
    t0 = time.perf_counter()
    with contextlib.redirect_stdout(io.StringIO()):  # the generator's progress lines
        tables = generate(scenario_config(s.ctx.cfg, lib, "custom"))
    p = prepare(s.ctx, tables)
    obj = decision_object(s.ctx, p, b_id)
    obj.pop("receipt")
    obj["scenario"] = {
        "id": "custom",
        "label": CUSTOM_LABEL,
        "source": "custom",
        "library_version": lib["version"],
        "library_status": lib["status"],
        "overrides": overrides,
        "shocks": body["shocks"],
    }
    obj = _clean(obj)
    obj["receipt"] = {**receipt(s.ctx, p, b_id, obj), "scenario_library_sha256": scenario_bounds.LIB_SHA}
    if time.perf_counter() - t0 > BUDGET_S:
        raise HTTPException(status_code=503, detail=f"the custom scenario took longer than the {BUDGET_S:.0f} s budget")
    return _clean(obj)
