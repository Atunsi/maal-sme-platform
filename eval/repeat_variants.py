"""Repeat-payment detector variants: choose on seen types, report once on test-only types — DECISIONS entry 37.

    python -m eval.repeat_variants [--dir data]        → eval/out/repeat_variants.md

Protocol, fixed in entry 37 before this file existed:

  Validation (choose)   the entry 36.8 held-out run (serving, seed 7, 50 businesses per type, K = 10,
                        seasonal gate on), scored for every variant. Seen types used to choose:
                        duplicate_payment and late_repeat_charge.
  Guard rails           round_trip_transfer recall >= 0.90, and at most 1.0 flag per clean serving
                        business carrying the repeat signal (flag_reason repeat_payment).
  Choice                among variants passing both, the highest mean recall over the two seen types,
                        ties to fewer clean repeat flags; `off` unless a variant beats it.
  Test (report once)    resent_payment and vendor_record_duplicate, injected only now, scored for the
                        chosen variant and for `off`. Nothing is changed after this report.

`window` (the entry 36.4 rule) is shown for reference only; it is not a candidate (entry 37.1).
Data source: synthetic.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import pandas as pd

from eval.anomaly_eval import score
from eval.heldout_anomalies import TEST_ONLY_TYPES, assert_held_out, inject_held_out
from generator.generate import load_config
from lenses import load_lens_config
from lenses.anomaly.anomaly import detect
from pipeline.data import load_tables
from profile_engine.compute import ramadan_from_config

CANDIDATES = ("off", "exact", "rarity", "forest_feature")
REFERENCE = ("window",)
SEEN = ("duplicate_payment", "late_repeat_charge")
RT_FLOOR = 0.90
MAX_CLEAN_REPEAT_FLAGS = 1.0


def clean_repeat_flags(tx: pd.DataFrame, biz: pd.DataFrame, ids: list[int], acfg: dict, windows: list) -> tuple[float, int]:
    """Mean number of repeat_payment flags per clean business, and how many businesses got at least one."""
    ends = biz.set_index("business_id")["window_end"]
    per = []
    for b_id in ids:
        out = detect(tx[tx["business_id"] == b_id], pd.Timestamp(ends[b_id]), acfg, windows)
        per.append(sum(f["flag_reason"] == "repeat_payment" for f in out["flags"]))
    s = pd.Series(per, dtype=float)
    return float(s.mean()), int((s > 0).sum())


def per_type(res: pd.DataFrame) -> dict[str, dict]:
    out = {}
    for t, g in res.groupby("anomaly_type"):
        pb = g.groupby("business_id").agg(caught=("caught", "sum"), rows=("transaction_id", "size"), flags=("flags_returned", "first"))
        flags = pb["flags"].clip(lower=1)
        out[t] = {"recall": float(g["caught"].mean()), "precision": float((pb["caught"] / flags).mean()),
                  "ceiling": float((pb["rows"].clip(upper=pb["flags"]) / flags).mean()), "n": len(g)}
    return out


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dir", default="data")
    ap.add_argument("--seed", type=int, default=7)
    ap.add_argument("--n-businesses", type=int, default=50)
    ap.add_argument("--out", default="eval/out/repeat_variants.md")
    ap.add_argument("--validation-only", action="store_true", help="smoke runs: never inject or score the test-only types")
    ap.add_argument("--limit-clean", type=int, default=None, help="smoke runs: first N clean businesses only")
    args = ap.parse_args(argv)
    d = Path(args.dir)
    assert_held_out(".", data_dir=d)
    base = load_lens_config()["anomaly"]
    windows, _ = ramadan_from_config(load_config())

    biz_all = pd.read_csv(d / "businesses.csv")
    serving_ids = biz_all.loc[biz_all["population"] == "serving", "business_id"].tolist()
    t = load_tables(d, serving_ids)
    tx_val, truth_val = inject_held_out(t["transactions"], t["businesses"], seed=args.seed, n_businesses=args.n_businesses)
    assert not set(truth_val["anomaly_type"]) & set(TEST_ONLY_TYPES)
    clean_ids = sorted(set(serving_ids) - set(truth_val["business_id"]))[: args.limit_clean]

    # ---- validation: every variant ----------------------------------------------------------------
    val = {}
    for mode in CANDIDATES + REFERENCE:
        acfg = {**base, "repeat_payment_mode": mode}
        pt = per_type(score(tx_val, t["businesses"], truth_val, acfg, windows))
        flags_pb, hit_b = clean_repeat_flags(t["transactions"], t["businesses"], clean_ids, acfg, windows)
        val[mode] = {"types": pt, "seen_mean": sum(pt[s]["recall"] for s in SEEN) / len(SEEN),
                     "clean_flags_per_business": flags_pb, "clean_businesses_hit": hit_b}
        print(f"  validated {mode}", flush=True)

    def eligible(m: str) -> bool:
        v = val[m]
        return v["types"]["round_trip_transfer"]["recall"] >= RT_FLOOR and v["clean_flags_per_business"] <= MAX_CLEAN_REPEAT_FLAGS

    ranked = sorted((m for m in CANDIDATES if eligible(m)), key=lambda m: (-val[m]["seen_mean"], val[m]["clean_flags_per_business"]))
    chosen = ranked[0] if ranked and val[ranked[0]]["seen_mean"] > val["off"]["seen_mean"] else "off"

    # ---- test: once, chosen and off -----------------------------------------------------------------
    if args.validation_only:
        for m in CANDIDATES + REFERENCE:
            v = val[m]
            print(m, {k: round(x["recall"], 2) for k, x in v["types"].items()}, round(v["clean_flags_per_business"], 2), eligible(m))
        print("chosen (validation only):", chosen)
        return 0
    tx_test, truth_all = inject_held_out(t["transactions"], t["businesses"], seed=args.seed, n_businesses=args.n_businesses, include_test=True)
    truth_test = truth_all[truth_all["anomaly_type"].isin(TEST_ONLY_TYPES)]
    test = {}
    for mode in dict.fromkeys((chosen, "off")):
        acfg = {**base, "repeat_payment_mode": mode}
        test[mode] = per_type(score(tx_test, t["businesses"], truth_test, acfg, windows))
        print(f"  tested {mode}", flush=True)

    lines = [
        "# Anomaly lens — repeat-payment detector variants (DECISIONS entry 37)",
        "",
        f"Population: **serving**, held-out seed {args.seed}, {args.n_businesses} businesses per type, K = {int(base['max_flags'])},",
        f"seasonal gate on. Clean businesses (no anomaly row): {len(clean_ids):,}. Data source: synthetic.",
        "",
        "## Validation — the variants compared (used to choose)",
        "",
        "| variant | same-day duplicate (seen) | late repeat (seen) | mean of the two | round-trip (held-out guard) | repeat flags per clean business | clean businesses with one | passes guard rails |",
        "|---|---|---|---|---|---|---|---|",
    ]
    for m in CANDIDATES + REFERENCE:
        v = val[m]
        tag = " (reference, not a candidate)" if m in REFERENCE else ""
        lines.append(
            f"| `{m}`{tag} | {v['types']['duplicate_payment']['recall']:.2f} | {v['types']['late_repeat_charge']['recall']:.2f} | "
            f"{v['seen_mean']:.3f} | {v['types']['round_trip_transfer']['recall']:.2f} | {v['clean_flags_per_business']:.2f} | "
            f"{v['clean_businesses_hit']:,} | {'yes' if eligible(m) else 'no'} |"
        )
    lines += [
        "",
        f"Guard rails: round-trip recall ≥ {RT_FLOOR:.2f}; at most {MAX_CLEAN_REPEAT_FLAGS:.1f} repeat flag per clean business.",
        f"**Chosen by the entry 37.2 rule: `{chosen}`.**",
        "",
        "## Test — reported once (types defined in entry 37.3, injected only for this run)",
        "",
        "| variant | type | rows | recall@10 | precision@10 | ceiling |",
        "|---|---|---|---|---|---|",
    ]
    for m, pt in test.items():
        for ty in TEST_ONLY_TYPES:
            if ty in pt:
                x = pt[ty]
                lines.append(f"| `{m}` | {ty} | {x['n']} | {x['recall']:.2f} | {x['precision']:.4f} | {x['ceiling']:.4f} |")
    lines += [
        "",
        "Recall on the seen types is a validation number, not a held-out result. Only the test table is held-out,",
        "and only for the variants shown in it. `vendor_record_duplicate` uses a second counterparty ID, which no",
        "counterparty-keyed variant can link (stated in entry 37.3 before this ran).",
    ]
    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    Path(args.out).write_text("\n".join(lines) + "\n", encoding="utf-8")
    print("\n".join(lines))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
