"""Week 8 contract check — the non-negotiables asserted against real CLI output.

    python -m eval.week8_check [--dir data] [--sample 40]

Runs pipeline.week8 on the demo businesses plus a random sample of the serving
population and asserts, on the JSON actually produced (not on the code):

  §9   every object has a status, and insufficient_data is an explicit state with
       no lens output — never a silent null
  §11  the credit object has EXACTLY the contract keys; markup_fixed_at_inception
       is true; late_penalty_policy is charity_directed; adjusted_markup_pct,
       recourse and stress are null; approved → a tier rate and an amount in
       bounds; declined → no rate, no amount
  §2   no key anywhere named stressed_markup_pct, eligible or fraud_reason
  §29  no anomaly score or threshold anywhere in the output; every flag has a reason
  §17  Zakat is deterministic; a zero liability always carries below_nisab or
       hawl_incomplete; a computed liability equals base × rate
  §10  the forecast is always shown beside its naive baseline
  receipt  every hash present (config, lens config, model, §35 reference stats, data,
           output, code), output_sha256 consistent, and a second run byte-identical

Exit code 0 = all assertions hold, 1 = at least one failed.
"""

from __future__ import annotations

import argparse
import json
import random
import sys
from pathlib import Path

import pandas as pd

from lenses import load_lens_config
from lenses.credit.model import CONTRACT_KEYS
from pipeline.week8 import DEMO_IDS, build_objects, output_sha256

FORBIDDEN_KEYS = {"stressed_markup_pct", "eligible", "fraud_reason", "score", "anomaly_score", "threshold", "decision_threshold"}
RECEIPT_KEYS = ("config_sha256", "lens_config_sha256", "credit_model_sha256", "reference_stats_sha256",
                "data_sha256", "output_sha256", "code_commit", "scope")  # Demo & Credibility plan item 2
FAILURES: list[str] = []


def check(cond: bool, msg: str) -> None:
    if not cond:
        FAILURES.append(msg)


def walk_keys(o, path: str = ""):
    if isinstance(o, dict):
        for k, v in o.items():
            yield f"{path}.{k}", k
            yield from walk_keys(v, f"{path}.{k}")
    elif isinstance(o, list):
        for i, v in enumerate(o):
            yield from walk_keys(v, f"{path}[{i}]")


def check_object(o: dict, lc: dict) -> None:
    b = o["business_id"]
    check(o.get("status") in {"scored", "partial_profile", "insufficient_data"}, f"{b}: status missing/invalid")
    for p, k in walk_keys(o):
        check(k not in FORBIDDEN_KEYS, f"{b}: forbidden key {p}")
    rec = o.get("receipt", {})
    for k in RECEIPT_KEYS:
        check(rec.get(k), f"{b}: receipt missing {k}")
    check(rec.get("output_sha256") == output_sha256(o), f"{b}: receipt output_sha256 does not match the object")

    if o["status"] == "insufficient_data":
        check(o.get("lenses_not_run_reason") == "insufficient_data", f"{b}: insufficient_data without explicit reason")
        for lens in ("credit", "forecast", "anomaly", "zakat"):
            check(o.get(lens) is None, f"{b}: {lens} ran on an insufficient_data business")
        return

    c = o["credit"]
    check(tuple(c) == CONTRACT_KEYS, f"{b}: credit keys {tuple(c)} != §11 contract")
    check(c["markup_fixed_at_inception"] is True, f"{b}: markup not fixed at inception")
    check(c["late_penalty_policy"] == "charity_directed", f"{b}: late penalty not charity-directed")
    for k in ("adjusted_markup_pct", "recourse", "stress"):
        check(c[k] is None, f"{b}: {k} not null")
    ccfg = lc["credit"]
    rates = {t["base_markup_pct"] for t in ccfg["tiers"]}
    if c["decision"] == "approved":
        check(c["base_markup_pct"] in rates, f"{b}: approved at a non-tier rate {c['base_markup_pct']}")
        check(ccfg["min_amount_sar"] <= c["amount_sar"] <= ccfg["max_amount_sar"], f"{b}: amount out of bounds")
        check(c["repayment_months"] == ccfg["repayment_months"], f"{b}: repayment months")
    else:
        check(c["decision"] == "declined", f"{b}: unknown decision {c['decision']}")
        check(c["base_markup_pct"] is None and c["amount_sar"] is None, f"{b}: declined but carries terms")
    check(all("text" in x for x in o["credit_explanation"]["public_tier"]), f"{b}: explanation without template text")

    a = o["anomaly"]
    check("flags" in a, f"{b}: anomaly has no flags list")
    for f in a.get("flags", []):
        check(f.get("flag_reason"), f"{b}: flag without flag_reason")

    z = o["zakat"]
    check(z.get("deterministic") is True, f"{b}: zakat not marked deterministic")
    check(z["liability_sar"] >= 0, f"{b}: negative zakat")
    if z["status"] == "zero_liability":
        check(z["reason"] in {"below_nisab", "hawl_incomplete"}, f"{b}: zero zakat with reason {z['reason']}")
    if z["status"] == "computed":
        check(abs(z["liability_sar"] - round(z["zakat_base_sar"] * z["rate"], 2)) < 0.011, f"{b}: zakat != base × rate")

    fc = o["forecast"]
    if fc["status"] == "computed":
        check("naive_baseline" in fc and len(fc["naive_baseline"]) == len(fc["model"]), f"{b}: forecast without its baseline")


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dir", default="data")
    ap.add_argument("--sample", type=int, default=40)
    args = ap.parse_args(argv)
    lc = load_lens_config()

    biz = pd.read_csv(Path(args.dir) / "businesses.csv")
    serving = sorted(set(biz.loc[biz["population"] == "serving", "business_id"]) - set(DEMO_IDS))
    ids = DEMO_IDS + random.Random(0).sample(serving, min(args.sample, len(serving)))

    objs = build_objects(args.dir, ids)
    for o in objs:
        check_object(o, lc)
    statuses = pd.Series([o["status"] for o in objs]).value_counts().to_dict()
    decisions = pd.Series([o["credit"]["decision"] for o in objs if o.get("credit")]).value_counts().to_dict()

    again = build_objects(args.dir, DEMO_IDS)
    first = {o["business_id"]: o for o in objs}
    for o in again:
        a = json.dumps(o, sort_keys=True, default=str)
        b = json.dumps(first[o["business_id"]], sort_keys=True, default=str)
        check(a == b, f"{o['business_id']}: second run is not byte-identical")

    print(f"checked {len(objs)} objects (demo + {len(ids) - len(DEMO_IDS)} serving sample); statuses {statuses}; decisions {decisions}")
    print("determinism: demo objects re-run byte-identical" if not any("byte-identical" in f for f in FAILURES) else "determinism: FAILED")
    if FAILURES:
        print(f"\nWEEK 8 CONTRACT CHECK FAILED — {len(FAILURES)} assertion(s):")
        for f in FAILURES[:40]:
            print("  - " + f)
        return 1
    print("WEEK 8 CONTRACT CHECK PASSED")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
