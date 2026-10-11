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

import math
import os
import secrets
import threading
import time
from collections import defaultdict, deque
from contextlib import asynccontextmanager
from typing import Annotated

import numpy as np
from fastapi import Depends, FastAPI, Header, HTTPException, Query, Request

from api.store import DEFAULT_STORE, ServingStore
from pipeline.week8 import (
    Context,
    Prepared,
    anomaly_section,
    credit_section,
    forecast_section,
    header,
    make_context,
    output_sha256,
    prepare,
    receipt,
    scorable,
    zakat_section,
)
from profile_engine.registry import FEATURE_NAMES, PROFILE_FEATURE_IDS

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
