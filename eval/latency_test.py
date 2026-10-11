"""Week 7 serving-path latency smoke test — schema §19, SOP §5.

    python -m api.store --dir data --out data/serving.duckdb   # once
    python -m eval.latency_test [--n 1000] [--http-sample 50]

§19: "run the full serving path — profile computation, XGBoost inference, and SHAP
explanation generation — end-to-end at N = 1,000 (§23's serving scale) and check against
both named metrics: API response < 2s and SHAP explanation generation < 1s."

What this does:
  0. equivalence — API answers for the demo businesses must equal the Week 8 CLI's
     answers exactly (same code path, different data access). If not, timing is moot.
  1. every one of the N serving businesses through /lenses/credit — the §19 path
     (store read -> profile engine -> model -> exact log-odds SHAP -> §13 text);
  2. the other four routes on a sample;
  3. SHAP generation timed on its own (score + explanation) for a sample;
  4. a sample over REAL HTTP through uvicorn, so network + JSON serialisation are
     included, not just in-process handler time.

Every request computes from inputs; nothing is cached between requests. The credit
model is regularised logistic regression, not XGBoost (DECISIONS entry 21 measured it
winning); the "XGBoost inference" step of §19 is therefore logistic inference.

PASS requires the MAXIMUM, not just a percentile, to be under target. p50/p95/p99
are reported beside it. Writes eval/out/latency_week7.md. Exit 0 = PASS.
"""

from __future__ import annotations

import argparse
import os
import platform
import random
import secrets
import socket
import subprocess
import sys
import time
from datetime import UTC, datetime
from pathlib import Path

import numpy as np

API_TARGET_S, SHAP_TARGET_S = 2.0, 1.0
ROUTES = {
    "/lenses/credit": "credit", "/lenses/forecast": "forecast",
    "/lenses/anomaly": "anomaly", "/lenses/zakat": "zakat",
}


def stats(xs: list[float]) -> dict:
    a = np.array(xs)
    return {"n": len(a), "p50": float(np.percentile(a, 50)), "p95": float(np.percentile(a, 95)),
            "p99": float(np.percentile(a, 99)), "max": float(a.max())}


def fmt(s: dict, decimals: int = 0) -> str:
    v = [s[k] * 1000 for k in ("p50", "p95", "p99", "max")]
    return f"{s['n']:>5} | " + " | ".join(f"{x:7.{decimals}f}" for x in v)


def free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def http_sample(ids: list[int], key: str) -> list[float]:
    import httpx

    port = free_port()
    env = {**os.environ, "MAAL_API_KEY": key, "MAAL_RATE_LIMIT_PER_MIN": "1000"}
    proc = subprocess.Popen([sys.executable, "-m", "uvicorn", "api.app:app", "--port", str(port), "--log-level", "warning"],
                            env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        base = f"http://127.0.0.1:{port}"
        for _ in range(120):
            try:
                if httpx.get(base + "/health", timeout=1.0).status_code == 200:
                    break
            except httpx.HTTPError:
                time.sleep(0.5)
        else:
            raise RuntimeError("uvicorn did not come up")
        out = []
        with httpx.Client(base_url=base, headers={"X-API-Key": key}, timeout=30.0) as c:
            c.get("/lenses/credit", params={"business_id": ids[0]})  # warm-up, excluded
            for b in ids:
                t0 = time.perf_counter()
                r = c.get("/lenses/credit", params={"business_id": b})
                out.append(time.perf_counter() - t0)
                r.raise_for_status()
        return out
    finally:
        proc.terminate()
        proc.wait(timeout=30)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--n", type=int, default=1000, help="serving businesses through /lenses/credit")
    ap.add_argument("--route-sample", type=int, default=100)
    ap.add_argument("--shap-sample", type=int, default=200)
    ap.add_argument("--http-sample", type=int, default=50)
    ap.add_argument("--out", default="eval/out/latency_week7.md")
    args = ap.parse_args(argv)

    key = os.environ.get("MAAL_API_KEY") or secrets.token_hex(16)  # a throwaway key for this run; never printed
    os.environ["MAAL_API_KEY"] = key
    os.environ.setdefault("MAAL_RATE_LIMIT_PER_MIN", "1000")

    from fastapi.testclient import TestClient

    from api.app import app
    from lenses.credit.model import explain, score
    from pipeline.week8 import DEMO_IDS, build_objects, prepare

    H = {"X-API-Key": key}
    with TestClient(app) as c:
        svc = app.state.svc
        ids = sorted(svc.store.ids)[: args.n]

        # 0. equivalence with the Week 8 CLI
        cli = {o["business_id"]: o for o in build_objects("data", DEMO_IDS)}
        mismatches = []
        for b in DEMO_IDS:
            for path, name in ROUTES.items():
                r = c.get(path, params={"business_id": b}, headers=H).json()
                if name == "credit":
                    same = all(r.get(k) == cli[b].get(k) for k in ("credit", "credit_decision_detail"))
                else:
                    same = r.get(name) == cli[b].get(name)
                if not same:
                    mismatches.append(f"{b} {path}")
        print(f"equivalence with the CLI on {DEMO_IDS}: {'IDENTICAL' if not mismatches else 'MISMATCH ' + str(mismatches)}")

        c.get("/lenses/credit", params={"business_id": ids[0]}, headers=H)  # warm-up, excluded
        timings: dict[str, list[float]] = {p: [] for p in ROUTES}
        timings["/profile/{id}"] = []
        statuses = {}
        t_all = time.perf_counter()
        for b in ids:
            t0 = time.perf_counter()
            r = c.get("/lenses/credit", params={"business_id": b}, headers=H)
            timings["/lenses/credit"].append(time.perf_counter() - t0)
            r.raise_for_status()
            statuses[r.json()["status"]] = statuses.get(r.json()["status"], 0) + 1
        sample = random.Random(0).sample(ids, min(args.route_sample, len(ids)))
        for path in ("/lenses/forecast", "/lenses/anomaly", "/lenses/zakat"):
            for b in sample:
                t0 = time.perf_counter()
                c.get(path, params={"business_id": b}, headers=H).raise_for_status()
                timings[path].append(time.perf_counter() - t0)
        for b in sample:
            t0 = time.perf_counter()
            c.get(f"/profile/{b}", headers=H).raise_for_status()
            timings["/profile/{id}"].append(time.perf_counter() - t0)
        wall = time.perf_counter() - t_all

        # 3. SHAP generation on its own
        shap_t = []
        ccfg, art = svc.ctx.lc["credit"], svc.ctx.art
        for b in random.Random(1).sample(ids, min(args.shap_sample, len(ids))):
            p = prepare(svc.ctx, svc.store.load([b]))
            if p.status.loc[b, "status"] == "insufficient_data":
                continue
            row = p.feats.loc[b]
            t0 = time.perf_counter()
            _, _, contribs = score(row, art)
            explain(contribs, ccfg)
            shap_t.append(time.perf_counter() - t0)

    http_t = http_sample(random.Random(2).sample(ids, min(args.http_sample, len(ids))), key) if args.http_sample else []

    st = {k: stats(v) for k, v in timings.items() if v}
    sh = stats(shap_t)
    ht = stats(http_t) if http_t else None
    api_ok = all(s["max"] < API_TARGET_S for s in st.values()) and (ht is None or ht["max"] < API_TARGET_S)
    shap_ok = sh["max"] < SHAP_TARGET_S
    ok = api_ok and shap_ok and not mismatches

    try:
        import psutil  # optional
        ram = f"{psutil.virtual_memory().total / 2**30:.1f} GB"
    except ImportError:
        ram = "n/a"
    lines = [
        "# Week 7 serving-path latency smoke test (§19)",
        "",
        (
            f"Run {datetime.now(UTC).date().isoformat()} · {platform.platform()} · {os.cpu_count()} logical CPUs · RAM {ram} · "
            f"serving store: {svc.store.meta['n_businesses']} businesses (§23 serving scale). Nothing cached between requests."
        ),
        "",
        f"**Equivalence with the Week 8 CLI** (demo businesses, all four lenses): **{'identical' if not mismatches else 'MISMATCH'}**.",
        "",
        f"Targets: API response < {API_TARGET_S:.0f} s, SHAP explanation < {SHAP_TARGET_S:.0f} s — **PASS requires the maximum under target**.",
        "",
        "| route (in-process, FastAPI TestClient) | n | p50 ms | p95 ms | p99 ms | max ms |",
        "|---|---|---|---|---|---|",
        *[f"| `{k}` | {fmt(v)} |" for k, v in st.items()],
        *([f"| `/lenses/credit` over **real HTTP** (uvicorn) | {fmt(ht)} |"] if ht else []),
        f"| SHAP generation alone (score + §13 explanation) | {fmt(sh, 3)} |",
        "",
        (
            f"`/lenses/credit` covered every one of the {len(ids):,} serving businesses (statuses: {statuses}); the other routes a "
            f"random {len(sample)}. Wall time for the timed requests: {wall:.0f} s."
        ),
        "",
        f"## Verdict: API **{'PASS' if api_ok else 'FAIL'}** · SHAP **{'PASS' if shap_ok else 'FAIL'}** · overall **{'PASS' if ok else 'FAIL'}**",
        "",
        "The model is regularised logistic regression (entry 21), so §19's \"XGBoost inference\" step is logistic",
        "inference, and SHAP is the exact closed form `coef × z` — which is why it costs microseconds.",
    ]
    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    Path(args.out).write_text("\n".join(lines) + "\n", encoding="utf-8")
    print("\n".join(lines))
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
