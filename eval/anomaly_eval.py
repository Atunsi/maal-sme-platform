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

from eval.heldout_anomalies import HELD_OUT_TYPES, assert_held_out, inject_held_out
from lenses import load_lens_config
from lenses.anomaly.anomaly import detect
from pipeline.data import load_tables


def score(tx: pd.DataFrame, biz: pd.DataFrame, truth: pd.DataFrame, acfg: dict) -> pd.DataFrame:
    rows = []
    as_of = biz.set_index("business_id")["window_end"]
    for b_id, g in truth.groupby("business_id"):
        out = detect(tx[tx["business_id"] == b_id], pd.Timestamp(as_of[b_id]), acfg)
        flagged = [f["transaction_id"] for f in out["flags"]]
        for r in g.itertuples(index=False):
            rows.append({
                "business_id": b_id, "transaction_id": r.transaction_id, "anomaly_type": r.anomaly_type,
                "caught": r.transaction_id in flagged,
                "rank": flagged.index(r.transaction_id) + 1 if r.transaction_id in flagged else None,
                "flags_returned": len(flagged), "anomalous_rows_in_business": len(g),
                "reason": next((f["flag_reason"] for f in out["flags"] if f["transaction_id"] == r.transaction_id), None),
            })
    return pd.DataFrame(rows)


def summarise(res: pd.DataFrame) -> pd.DataFrame:
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
        })
    return pd.DataFrame(out)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dir", default="data")
    ap.add_argument("--seed", type=int, default=7)
    ap.add_argument("--n-businesses", type=int, default=50)
    ap.add_argument("--out", default="eval/out/anomaly_eval.md")
    args = ap.parse_args(argv)
    d = Path(args.dir)
    acfg = load_lens_config()["anomaly"]
    k = int(acfg["max_flags"])

    assert_held_out(".", data_dir=d)
    print("held-out guard passed: config, generator and lenses/anomaly do not name the held-out types")

    biz_all = pd.read_csv(d / "businesses.csv", parse_dates=["start_date", "window_end", "operating_start_date"])
    serving_ids = biz_all.loc[biz_all["population"] == "serving", "business_id"].tolist()

    # --- injected types (generated into the demo businesses by the generator) ---
    inj = pd.read_csv(d / "injected_anomalies.csv")
    inj_t = load_tables(d, sorted(inj["business_id"].unique()))
    res_inj = score(inj_t["transactions"], inj_t["businesses"], inj, acfg)

    # --- held-out types (appended to the serving population here, never generated) ---
    t = load_tables(d, serving_ids)
    tx2, truth = inject_held_out(t["transactions"], t["businesses"], seed=args.seed, n_businesses=args.n_businesses)
    assert set(truth["anomaly_type"]) <= set(HELD_OUT_TYPES)
    res_ho = score(tx2, t["businesses"], truth, acfg)

    s_inj, s_ho = summarise(res_inj), summarise(res_ho)
    cols = ["anomaly_type", "businesses", "anomalous_rows", "recall_at_k", "precision_at_k", "precision_ceiling", "median_rank_when_caught", "reasons"]
    lines = [
        "# Anomaly lens — §12 evaluation (injected vs held-out, reported separately)",
        "",
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
        s_ho[cols].to_markdown(index=False),
        "",
        "`precision_ceiling` is the best precision@K achievable given how few anomalous rows each business holds;",
        "read `precision_at_k` against it, never alone. `recall_at_k` is the headline: did the anomaly surface",
        "among the flags an analyst would review.",
    ]
    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    Path(args.out).write_text("\n".join(lines) + "\n", encoding="utf-8")
    print("\n".join(lines))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
