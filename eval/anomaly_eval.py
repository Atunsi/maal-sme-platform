"""§12 anomaly-lens evaluation — injected and held-out types reported SEPARATELY.

    python -m eval.anomaly_eval [--dir data] [--seed 7] [--n-businesses 50]

Measuring only against the types the generator injects proves only that the
detector finds what it was told to hide (§12). So:

  injected   the types in config.yaml (generated into the demo businesses).
  held-out   types defined ONLY in eval/heldout_anomalies.py, appended here to the
             serving population's transactions. assert_held_out() first confirms
             neither the generator, the config nor the detector names them.

Per type:
  recall@K     share of anomalous rows that appear among the lens's K flags for
               their business — "did it surface where an analyst would look".
  precision@K  share of the K flags in affected businesses that are the anomaly.
               Bounded above by (anomalous rows per business) / K, which is
               reported beside it — a rare-event precision is meaningless without
               its ceiling.

Population: serving (business_id 10,001–11,000, §23). Data source: synthetic.
Writes eval/out/anomaly_eval.md.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import pandas as pd
import yaml

from eval.heldout_anomalies import HELD_OUT_TYPES, assert_held_out, inject_held_out
from generator.generate import load_config
from lenses import load_lens_config
from lenses.anomaly.anomaly import detect, rule_hits, transaction_features
from pipeline.data import load_tables
from profile_engine.compute import ramadan_from_config


def score(tx: pd.DataFrame, biz: pd.DataFrame, truth: pd.DataFrame, acfg: dict, windows: list | None = None) -> pd.DataFrame:
    rows = []
    as_of = biz.set_index("business_id")["window_end"]
    for b_id, g in truth.groupby("business_id"):
        g_tx = tx[tx["business_id"] == b_id]
        out = detect(g_tx, pd.Timestamp(as_of[b_id]), acfg, windows)
        flagged = [f["transaction_id"] for f in out["flags"]]
        # Did a hard rule fire on the row before the K-flag cap? Separates "not detected" from "cut by the cap".
        lo = pd.Timestamp(as_of[b_id]) - pd.Timedelta(days=int(acfg["scan_days"]) - 1)
        f = transaction_features(g_tx[(g_tx["date"] >= lo) & (g_tx["date"] <= pd.Timestamp(as_of[b_id]))], acfg, windows)
        ruled = set(f.loc[rule_hits(f, acfg), "transaction_id"].astype(int))
        for r in g.itertuples(index=False):
            rows.append({
                "business_id": b_id, "transaction_id": r.transaction_id, "anomaly_type": r.anomaly_type,
                "caught": r.transaction_id in flagged,
                "rule_hit_before_cap": r.transaction_id in ruled,
                "rank": flagged.index(r.transaction_id) + 1 if r.transaction_id in flagged else None,
                "flags_returned": len(flagged), "anomalous_rows_in_business": len(g),
                "reason": next((f["flag_reason"] for f in out["flags"] if f["transaction_id"] == r.transaction_id), None),
            })
    return pd.DataFrame(rows)


def clean_hits(tx: pd.DataFrame, biz: pd.DataFrame, ids: list[int], acfg: dict, windows: list) -> dict:
    """Per hard rule: hits and businesses hit, over the scan windows of `ids` (no anomaly rows in them)."""
    ends = biz.set_index("business_id")["window_end"]
    rules = {"amount_z": [0, 0], "rare_hour": [0, 0], "repeat_payment": [0, 0]}
    scanned = 0
    for b_id in ids:
        g = tx[tx["business_id"] == b_id]
        as_of = pd.Timestamp(ends[b_id])
        w = g[(g["date"] >= as_of - pd.Timedelta(days=int(acfg["scan_days"]) - 1)) & (g["date"] <= as_of)]
        if len(w) < int(acfg["min_transactions"]):
            continue
        f = transaction_features(w, acfg, windows)
        scanned += len(f)
        for name, m in (("amount_z", f["amount_z"] >= acfg["amount_z"]), ("rare_hour", f["hour_share"] < acfg["rare_hour_share"]),
                        ("repeat_payment", f["repeat_payment"].astype(bool))):
            rules[name][0] += int(m.sum())
            rules[name][1] += int(m.any())
    return {"businesses": len(ids), "scanned": max(scanned, 1), "rules": {k: tuple(v) for k, v in rules.items()}}


def summarise(res: pd.DataFrame, designed_for: set[str] | None = None) -> pd.DataFrame:
    out = []
    for t, g in res.groupby("anomaly_type"):
        # Rows of THIS type per business (a business can hold both types), and the flags it actually
        # returned (can be < K). Best achievable precision = min(rows, flags) / flags, per business.
        per_biz = g.groupby("business_id").agg(caught=("caught", "sum"), rows=("transaction_id", "size"), flags=("flags_returned", "first"))
        flags = per_biz["flags"].clip(lower=1)
        prec = (per_biz["caught"] / flags).mean()
        ceiling = (per_biz["rows"].clip(upper=per_biz["flags"]) / flags).mean()
        out.append({
            "anomaly_type": t, "businesses": int(g["business_id"].nunique()), "anomalous_rows": len(g),
            "recall_at_k": round(float(g["caught"].mean()), 4),
            "precision_at_k": round(float(prec), 4), "precision_ceiling": round(float(ceiling), 4),
            "median_rank_when_caught": g["rank"].median() if g["caught"].any() else None,
            "reasons": ", ".join(f"{r}×{n}" for r, n in g["reason"].dropna().value_counts().items()) or "—",
            "rule_hit_before_cap": round(float(g["rule_hit_before_cap"].mean()), 4),
            "status": "designed-for (not held-out)" if t in (designed_for or set()) else "",
        })
    return pd.DataFrame(out)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dir", default="data")
    ap.add_argument("--seed", type=int, default=7)
    ap.add_argument("--n-businesses", type=int, default=50)
    ap.add_argument("--out", default="eval/out/anomaly_eval.md")
    ap.add_argument("--with", dest="overrides", action="append", default=[], metavar="KEY=VALUE",
                    help="evaluate with a lens_config.anomaly value overridden (repeatable); named in the report")
    args = ap.parse_args(argv)
    d = Path(args.dir)
    over = {k: yaml.safe_load(v) for k, v in (o.split("=", 1) for o in args.overrides)}
    unknown = set(over) - set(load_lens_config()["anomaly"])
    if unknown:
        raise SystemExit(f"unknown lens_config.anomaly key(s): {sorted(unknown)}")
    acfg = {**load_lens_config()["anomaly"], **over}
    windows, _ = ramadan_from_config(load_config())  # as pipeline.week8 passes them (entry 36.3)
    k = int(acfg["max_flags"])

    assert_held_out(".", data_dir=d)
    print("held-out guard passed: config, generator and lenses/anomaly do not name the held-out types")

    biz_all = pd.read_csv(d / "businesses.csv", parse_dates=["start_date", "window_end", "operating_start_date"])
    serving_ids = biz_all.loc[biz_all["population"] == "serving", "business_id"].tolist()

    # --- injected types (generated into the demo businesses by the generator) ---
    inj = pd.read_csv(d / "injected_anomalies.csv")
    inj_t = load_tables(d, sorted(inj["business_id"].unique()))
    res_inj = score(inj_t["transactions"], inj_t["businesses"], inj, acfg, windows)

    # --- held-out types (appended to the serving population here, never generated) ---
    t = load_tables(d, serving_ids)
    tx2, truth = inject_held_out(t["transactions"], t["businesses"], seed=args.seed, n_businesses=args.n_businesses)
    assert set(truth["anomaly_type"]) <= set(HELD_OUT_TYPES)
    res_ho = score(tx2, t["businesses"], truth, acfg, windows)

    # Entry 36.4: once the repeat-payment rule is on, the same-day held-out type is one it was designed for.
    designed_for = {"duplicate_payment"} if acfg.get("repeat_payment_rule") else set()
    s_inj, s_ho = summarise(res_inj), summarise(res_ho, designed_for)
    cols = ["anomaly_type", "businesses", "anomalous_rows", "recall_at_k", "precision_at_k", "precision_ceiling", "median_rank_when_caught", "reasons", "rule_hit_before_cap"]
    ho_cols = cols + (["status"] if designed_for else [])

    # Hard-rule hits on serving businesses that received no held-out row: every hit there is a false positive.
    clean_ids = sorted(set(serving_ids) - set(truth["business_id"]))
    clean = clean_hits(t["transactions"], t["businesses"], clean_ids, acfg, windows)

    lines = [
        "# Anomaly lens — §12 evaluation (injected vs held-out, reported separately)",
        "",
        *([f"**Evaluated with lens_config overrides: {', '.join(f'`{k}: {v}`' for k, v in over.items())}** — not the shipped configuration.", ""] if over else []),
        (
            f"Population: **serving** for held-out (business_id 10,001–11,000, §23); demo businesses for injected. "
            f"Data source: synthetic. K = {k} flags per business. Held-out seed {args.seed}, {args.n_businesses} businesses per type."
        ),
        "",
        "## Injected types (the generator was told to create these)",
        "",
        s_inj[cols].to_markdown(index=False),
        "",
        "## Held-out types (defined only in eval/heldout_anomalies.py — unseen by generator, config and detector)",
        "",
        s_ho[ho_cols].to_markdown(index=False),
        "",
        f"## Hard-rule hits on clean serving businesses ({clean['businesses']:,} with no held-out row; every hit is a false positive)",
        "",
        "| rule | hits | per 1,000 transactions | businesses with at least one |",
        "|---|---|---|---|",
        *[f"| {name} | {h:,} | {1000 * h / clean['scanned']:.2f} | {b:,} |" for name, (h, b) in clean["rules"].items()],
        "",
        "`precision_ceiling` is the best precision@K achievable given how few anomalous rows each business holds;",
        "read `precision_at_k` against it, never alone. `recall_at_k` is the headline: did the anomaly surface",
        "among the flags an analyst would review. `rule_hit_before_cap`: share of the rows a hard rule fired on",
        "before the list was cut to K — a row with a rule hit that is not caught was detected but cut by the cap.",
    ]
    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    Path(args.out).write_text("\n".join(lines) + "\n", encoding="utf-8")
    print("\n".join(lines))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
