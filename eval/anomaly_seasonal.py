"""§16 anomaly false-positive rate with and without the seasonal gate — DECISIONS entry 36.3.

    python -m eval.anomaly_seasonal          → eval/out/anomaly_seasonal.md

Businesses: the control (unshocked) series of the entry-36.1 sample — serving, demo and `<1yr`
excluded — regenerated in both window placements by eval.holdout_shock. No injected or held-out
row exists in them, so every flag is a false positive by construction.

Measures, gate off and gate on (lens_config.anomaly.seasonal_gate), definitions fixed in 36.3:
  1. Seasonal flag excess (Ramadan placement): share of returned flags dated inside the
     Ramadan-to-Eid season ÷ share of scanned transactions dated inside it. 1.0 = no seasonal bias.
  2. Hard-rule hits before the 10-flag cap, per 1,000 scanned transactions, inside and outside
     the season. Computed here from the lens's own feature table; nothing new leaves the API.
Decision input also reported: injected-type recall on the demo business (data/), gate off and on.
The 36.3 rule: the gate ships on if (1) falls with the gate and injected recall does not fall.
Held-out recall is NOT computed here; it is re-run after the decision (eval.anomaly_eval).

Data source: synthetic.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import pandas as pd

from eval.holdout_shock import PLACEMENTS, generate_variant, sample_ids
from generator.generate import load_config
from lenses import load_lens_config
from lenses.anomaly.anomaly import detect, rule_hits, transaction_features
from pipeline.data import load_tables
from profile_engine.compute import ramadan_from_config


def scan_window(tx: pd.DataFrame, as_of: pd.Timestamp, acfg: dict) -> pd.DataFrame:
    lo = as_of - pd.Timedelta(days=int(acfg["scan_days"]) - 1)
    return tx[(tx["date"] >= lo) & (tx["date"] <= as_of)]


def measure(tx: pd.DataFrame, biz: pd.DataFrame, acfg: dict, windows: list) -> dict:
    flags_in = flags_all = 0
    scanned_in = scanned_out = hits_in = hits_out = 0
    ends = biz.set_index("business_id")["window_end"]
    for b_id, g in tx.groupby("business_id"):
        as_of = pd.Timestamp(ends[b_id])
        w = scan_window(g, as_of, acfg)
        if len(w) < int(acfg["min_transactions"]):
            continue
        t = transaction_features(w, acfg, windows)
        hit = rule_hits(t, acfg)
        season = t["in_season"].to_numpy()
        scanned_in += int(season.sum())
        scanned_out += int((~season).sum())
        hits_in += int((hit & season).sum())
        hits_out += int((hit & ~season).sum())
        out = detect(g, as_of, acfg, windows)
        fd = pd.to_datetime(pd.Series([f["date"] for f in out["flags"]], dtype=object))
        in_s = pd.Series(False, index=fd.index)
        for s, e in windows:
            in_s |= (fd >= s) & (fd <= e)
        flags_in += int(in_s.sum())
        flags_all += len(fd)
    scanned = scanned_in + scanned_out
    flag_share = flags_in / flags_all if flags_all else 0.0
    tx_share = scanned_in / scanned if scanned else 0.0
    return {
        "flags": flags_all, "flags_in_season": flags_in, "scanned": scanned, "scanned_in_season": scanned_in,
        "flag_share_in_season": flag_share, "tx_share_in_season": tx_share,
        "excess": (flag_share / tx_share) if tx_share else None,
        "hits_per_1000_in": 1000 * hits_in / scanned_in if scanned_in else None,
        "hits_per_1000_out": 1000 * hits_out / scanned_out if scanned_out else None,
    }


def injected_recall(acfg: dict, windows: list, data_dir: Path) -> tuple[int, int]:
    inj = pd.read_csv(data_dir / "injected_anomalies.csv")
    t = load_tables(data_dir, sorted(inj["business_id"].unique()))
    caught = 0
    for b_id, g in inj.groupby("business_id"):
        b = t["businesses"].set_index("business_id").loc[b_id]
        out = detect(t["transactions"][t["transactions"]["business_id"] == b_id], pd.Timestamp(b["window_end"]), acfg, windows)
        caught += len(set(g["transaction_id"]) & {f["transaction_id"] for f in out["flags"]})
    return caught, len(inj)


def fmt(v, spec: str) -> str:
    return "—" if v is None or pd.isna(v) else format(v, spec)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dir", default="data", help="full generation, for the injected-type recall on the demo business")
    ap.add_argument("--limit", type=int, default=None)
    ap.add_argument("--out", default="eval/out/anomaly_seasonal.md")
    args = ap.parse_args(argv)
    cfg = load_config("config.yaml")
    windows, _ = ramadan_from_config(cfg)
    base = load_lens_config()["anomaly"]
    gates = {"off": {**base, "seasonal_gate": False}, "on": {**base, "seasonal_gate": True}}
    ids = sample_ids(cfg)[: args.limit]

    rows = []
    for pl, start in PLACEMENTS.items():
        t = generate_variant(cfg, ids, start, None, keep_tx=True)
        tx = t["transactions"].copy()
        tx["date"] = pd.to_datetime(tx["date"])
        for g, acfg in gates.items():
            rows.append({"placement": pl, "gate": g, **measure(tx, t["businesses"], acfg, windows)})
            print(f"  measured {pl} / gate {g}", flush=True)
    r = pd.DataFrame(rows)
    inj = {g: injected_recall(acfg, windows, Path(args.dir)) for g, acfg in gates.items()}

    lines = [
        "# Anomaly lens — §16 false positives with and without the seasonal gate (DECISIONS entry 36.3)",
        "",
        f"Population: **serving**, the entry-36.1 sample (demo and `<1yr` excluded), N = {len(ids):,}, control series",
        "(no shock, no injected or held-out rows: every flag is a false positive). Data source: synthetic.",
        "Season = the pinned Ramadan-to-Eid windows feature 36 uses. The neutral window contains none.",
        "",
        "| placement | gate | flags returned | flags in season | scanned in season | seasonal flag excess | rule hits per 1,000, in season | rule hits per 1,000, out of season |",
        "|---|---|---|---|---|---|---|---|",
    ]
    for x in r.itertuples(index=False):
        lines.append(
            f"| {x.placement} | {x.gate} | {x.flags:,} | {x.flag_share_in_season:.1%} | {x.tx_share_in_season:.1%} | "
            f"{fmt(x.excess, '.2f')} | {fmt(x.hits_per_1000_in, '.2f')} | {fmt(x.hits_per_1000_out, '.2f')} |"
        )
    lines += [
        "",
        "Seasonal flag excess = (share of flags in season) ÷ (share of scanned transactions in season); 1.00 = no seasonal bias.",
        "",
        "## Decision input — injected-type recall (demo business, full data)",
        "",
        "| gate | injected anomalies among the flags |",
        "|---|---|",
        *[f"| {g} | {c} of {n} |" for g, (c, n) in inj.items()],
        "",
        "Rule (entry 36.3): the gate ships on if the seasonal flag excess falls with the gate and injected recall does not fall.",
        "Held-out recall is not part of the decision; it is re-run afterwards with `python -m eval.anomaly_eval`.",
    ]
    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    Path(args.out).write_text("\n".join(lines) + "\n", encoding="utf-8")
    print("\n".join(lines))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
