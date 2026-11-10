"""Hostile-demo scenarios: regenerate one demo business under a disaster picked from a
menu, and run every lens and governance module on it (Demo & Credibility plan item 1).

    python -m scenarios.run --list                          # the menu
    python -m scenarios.run --scenario severe_collapse      # one scenario vs the baseline
    python -m scenarios.run --scenario severe_collapse --out s.json
    python -m scenarios.run --check                         # pre-validate every scenario

The menu is scenarios/library.yaml; a name not on it is refused. Each scenario overlays
the base demo business's spec from config.yaml (never config.yaml itself) and
regenerates that one business in memory. Its ID and seed are unchanged, so the disaster
is the only difference from the baseline. The object then goes through the Week 8 code
path (pipeline.week8), exactly as the CLI and the API run it.

--check asserts, for every scenario: the Week 8 contract (eval.week8_check.check_object),
a byte-identical re-run, and the time budget. It also asserts that held-out anomaly types
are absent from the library and that the baseline equals the full-generation business in
data/ (if present) in every value except the surrogate transaction_id and obligation_id,
which a single-business run numbers from 1.
Exit 0 = every scenario is safe to show.
"""

from __future__ import annotations

import argparse
import contextlib
import copy
import hashlib
import io
import json
import sys
import time
from pathlib import Path

import yaml

from generator.generate import generate
from pipeline.week8 import Context, Prepared, decision_object, make_context, prepare, receipt

LIBRARY = Path("scenarios/library.yaml")
ALLOWED_OVERRIDES = {"inject_cash_crunch", "inject_anomalies", "operating_start_date", "start_date", "zakat_seed"}
BUDGET_S = 30.0  # Demo & Credibility plan item 1: regenerate-and-run well under 30 s
SURROGATE_IDS = {"transaction_id", "obligation_id"}


def load_library(path: Path = LIBRARY) -> tuple[dict, str]:
    raw = path.read_bytes()
    lib = yaml.safe_load(raw)
    for name, s in lib["scenarios"].items():
        bad = set(s.get("overrides") or {}) - ALLOWED_OVERRIDES
        if bad:
            raise ValueError(f"scenario {name}: overrides {sorted(bad)} are not demo levers ({sorted(ALLOWED_OVERRIDES)})")
    return lib, hashlib.sha256(raw.replace(b"\r\n", b"\n")).hexdigest()


def scenario_config(cfg: dict, lib: dict, name: str) -> dict:
    """config.yaml with ONLY the base business, its demo spec overlaid by the scenario."""
    b_id = int(lib["base_business"])
    base = next(d for d in cfg["demo_businesses"] if d["id"] == b_id)
    spec = {**copy.deepcopy(base), **copy.deepcopy(lib["scenarios"][name].get("overrides") or {})}
    pop_name, pop = next((n, p) for n, p in cfg["populations"].items() if p["id_range"][0] <= b_id <= p["id_range"][1])
    c = copy.deepcopy(cfg)
    c["populations"] = {pop_name: {**pop, "id_range": [b_id, b_id]}}  # same seed → same draws
    c["demo_businesses"] = [spec]
    return c


def run_scenario(ctx: Context, lib: dict, lib_sha: str, name: str) -> tuple[dict, Prepared, float]:
    t0 = time.perf_counter()
    with contextlib.redirect_stdout(io.StringIO()):  # the generator's progress lines
        tables = generate(scenario_config(ctx.cfg, lib, name))
    p = prepare(ctx, tables)
    b_id = int(lib["base_business"])
    obj = decision_object(ctx, p, b_id)
    obj.pop("receipt")
    s = lib["scenarios"][name]
    obj["scenario"] = {"id": name, "label": s["label"], "library_version": lib["version"],
                       "library_status": lib["status"], "overrides": s.get("overrides") or {}}
    obj["receipt"] = {**receipt(ctx, p, b_id, obj), "scenario_library_sha256": lib_sha}
    return obj, p, time.perf_counter() - t0


def summary(obj: dict, p: Prepared) -> dict:
    row = {"status": obj["status"]}
    if obj["status"] == "insufficient_data":
        return {**row, "decision": "not decided (insufficient_data)"}
    c, det, fc, an, z = obj["credit"], obj["credit_decision_detail"], obj["forecast"], obj["anomaly"], obj["zakat"]
    injected = set(p.tables["injected_anomalies"]["transaction_id"])
    flagged = {f["transaction_id"] for f in an.get("flags", [])}
    ca = fc.get("crunch_alert") or {}
    return {
        **row,
        "decision": c["decision"] + (f" ({det['decline_origin']})" if det.get("decline_origin") else ""),
        "amount_sar": c["amount_sar"], "markup_pct": c["base_markup_pct"],
        "pd": det.get("pd"), "tier": det.get("risk_tier"),
        "cash_alert": ca.get("level"), "days_to_negative": ca.get("days_to_projected_negative_balance"),
        "hazard_30d": (ca.get("liquidity_hazard") or {}).get("30d"),
        "anomaly_flags": len(flagged), "injected_caught": f"{len(injected & flagged)} of {len(injected)}",
        "zakat_sar": z.get("liability_sar"), "sharia": obj["governance"]["sharia_screen"]["sharia_screen_status"],
    }


def print_comparison(rows: dict[str, dict]) -> None:
    keys = list(dict.fromkeys(k for r in rows.values() for k in r))
    w = max(len(k) for k in keys) + 2
    names = list(rows)
    widths = [max(14, len(n) + 2) for n in names]
    print("".ljust(w) + "".join(n.ljust(wd) for n, wd in zip(names, widths, strict=True)))
    for k in keys:
        print(k.ljust(w) + "".join(str(rows[n].get(k, "—")).ljust(wd) for n, wd in zip(names, widths, strict=True)))


def _equal_to_full_generation(ctx: Context, lib: dict, data_dir: Path) -> str | None:
    """None if the baseline matches data/ in every non-surrogate value; else what differs."""
    from pipeline.data import load_tables

    b_id = int(lib["base_business"])
    with contextlib.redirect_stdout(io.StringIO()):
        mine = generate(scenario_config(ctx.cfg, lib, "baseline"))
    disk = load_tables(data_dir, [b_id])
    for name, t in disk.items():
        a = mine[name][mine[name]["business_id"] == b_id].reset_index(drop=True)
        b = t.reset_index(drop=True)
        cols = [c for c in b.columns if c not in SURROGATE_IDS]
        if set(a.columns) != set(b.columns) or len(a) != len(b):
            return f"{name}: shape/columns differ"
        diff = [c for c in cols if not a[c].astype(str).equals(b[c].astype(str))]
        if diff:
            return f"{name}: columns {diff} differ"
    return None


def check_all(ctx: Context, lib: dict, lib_sha: str, data_dir: Path) -> int:
    from eval import week8_check
    from eval.heldout_anomalies import assert_held_out
    from lenses import load_lens_config

    lc = load_lens_config()
    fails: list[str] = []
    try:
        assert_held_out()
    except AssertionError as e:
        fails.append(str(e))
    rows = {}
    for name in lib["scenarios"]:
        week8_check.FAILURES.clear()
        obj, p, secs = run_scenario(ctx, lib, lib_sha, name)
        week8_check.check_object(obj, lc)
        fails += [f"{name}: {f}" for f in week8_check.FAILURES]
        again, _, _ = run_scenario(ctx, lib, lib_sha, name)
        if json.dumps(obj, sort_keys=True, default=str) != json.dumps(again, sort_keys=True, default=str):
            fails.append(f"{name}: second run is not byte-identical")
        if secs > BUDGET_S:
            fails.append(f"{name}: {secs:.1f}s exceeds the {BUDGET_S:.0f}s budget")
        rows[name] = {**summary(obj, p), "seconds": round(secs, 2)}
    if (data_dir / "businesses.csv").exists():
        why = _equal_to_full_generation(ctx, lib, data_dir)
        if why:
            fails.append(f"baseline differs from the full generation in {data_dir}: {why}")
        else:
            print(f"baseline == business {lib['base_business']} in {data_dir}/ (all values; surrogate IDs excepted)")
    else:
        print(f"note: {data_dir}/ not generated — baseline-vs-full-generation equivalence not checked")
    for name, r in rows.items():
        print(f"\n[{name}] {lib['scenarios'][name]['label']}")
        print("  " + ", ".join(f"{k}={v}" for k, v in r.items()))
    if fails:
        print(f"\nSCENARIO LIBRARY CHECK FAILED — {len(fails)} problem(s):")
        for f in fails:
            print("  - " + f)
        return 1
    print(f"\nSCENARIO LIBRARY CHECK PASSED — {len(rows)} scenarios, Week 8 contract, byte-identical re-runs, "
          f"max {max(r['seconds'] for r in rows.values()):.2f}s per regenerate-and-run (budget {BUDGET_S:.0f}s)")
    return 0


def main(argv: list[str] | None = None) -> int:
    t_start = time.perf_counter()
    lib, lib_sha = load_library()
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument("--list", action="store_true")
    g.add_argument("--scenario", choices=list(lib["scenarios"]))
    g.add_argument("--check", action="store_true")
    ap.add_argument("--out", default=None, help="write the scenario's full JSON here")
    ap.add_argument("--dir", default="data", help="full generation to compare the baseline against (--check)")
    args = ap.parse_args(argv)
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

    if args.list:
        print(f"Scenario library v{lib['version']} ({lib['status']}), base business {lib['base_business']}\n")
        for i, (name, s) in enumerate(lib["scenarios"].items(), 1):
            print(f"  {i}. {name:22s} {s['label']}\n     {'':22s} {s['story']}")
        return 0

    ctx = make_context("scenarios.run")
    if args.check:
        return check_all(ctx, lib, lib_sha, Path(args.dir))

    rows, chosen = {}, None
    for name in dict.fromkeys(["baseline", args.scenario]):
        obj, p, secs = run_scenario(ctx, lib, lib_sha, name)
        rows[name] = {**summary(obj, p), "seconds": round(secs, 2)}
        chosen = obj
    print(f"{lib['scenarios'][args.scenario]['label']}\n{lib['scenarios'][args.scenario]['story']}\n")
    print_comparison(rows)
    print(f"\ntotal wall time including start-up: {time.perf_counter() - t_start:.1f}s")
    if args.out:
        Path(args.out).write_text(json.dumps(chosen, indent=2, ensure_ascii=False, default=str), encoding="utf-8")
        print(f"wrote {args.scenario} -> {args.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
