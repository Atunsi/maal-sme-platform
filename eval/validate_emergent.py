"""§21 emergent validation — compare what the generator produced against
pre-registered published targets in config.yaml.

Rules (Schema v2.9 §21):
  * every target and its tolerance band is read from config, committed BEFORE
    the run — nothing here is chosen after seeing the result;
  * a miss is reported as a FINDING, never used to retune;
  * distributional comparisons use a distance (KS D for ordered size tiers,
    total-variation for unordered sectors), not an eyeballed chart;
  * every number is labelled with its population and its basis.

Exit code is 0 whether or not there are findings — findings are results.

Usage (from the repo root):
        python -m eval.validate_emergent [--dir data] [--config config.yaml]
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import pandas as pd

from generator.generate import load_config

SIZE_ORDER = ["micro", "small", "medium"]


def emergent_from_tables(d: Path) -> pd.DataFrame:
    daily = pd.read_csv(d / "daily_aggregates.csv", usecols=["business_id", "inflow_total"])
    biz = pd.read_csv(d / "businesses.csv", usecols=["business_id", "sector", "size_tier", "population"])
    rev = daily.groupby("business_id")["inflow_total"].sum().rename("rev").reset_index().merge(biz, on="business_id")
    return rev[rev["population"] == "research"]


def ks_ordered(sim: pd.Series, pub: pd.Series) -> float:
    s = sim.reindex(SIZE_ORDER).fillna(0).cumsum()
    p = pub.reindex(SIZE_ORDER).fillna(0).cumsum()
    return float((s - p).abs().max())


def tv_unordered(sim: pd.Series, pub: pd.Series) -> float:
    idx = sorted(set(sim.index) | set(pub.index))
    return float(0.5 * (sim.reindex(idx).fillna(0) - pub.reindex(idx).fillna(0)).abs().sum())


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dir", default="data", help="directory holding the generated tables")
    ap.add_argument("--config", default="config.yaml")
    args = ap.parse_args(argv)
    cfg = load_config(args.config)
    ev = cfg["emergent_validation_targets"]
    sources = ev["published_sources"]

    r = emergent_from_tables(Path(args.dir))
    total = r["rev"].sum()
    sim_sector = r.groupby("sector")["rev"].sum() / total
    sim_size_in_sector = r.groupby(["sector", "size_tier"])["rev"].sum() / r.groupby("sector")["rev"].sum()
    sim_medium = r.loc[r["size_tier"] == "medium", "rev"].sum() / total

    rows = []
    for t in ev["targets"]:
        metric, basis = t["metric"], t.get("basis", "")
        if t.get("comparable") is False:
            rows.append((metric, basis, sim_medium if "medium" in metric else None, t.get("published_value"), None, None, "CONTEXT_ONLY", "not like-for-like"))
            continue
        if t.get("published_value") is None and "derived_from" not in t:
            rows.append((metric, basis, None, None, None, None, "NOT_REGISTERED", t.get("source_status", "")))
            continue

        src = sources[t["derived_from"]] if "derived_from" in t else None
        pub_tbl = pd.DataFrame({k: v for k, v in src.items() if isinstance(v, dict)}).T[SIZE_ORDER] if src else None

        if metric == "revenue_share_medium_tier":
            pub = pub_tbl["medium"].sum() / pub_tbl.values.sum()
            rel = abs(sim_medium - pub) / pub
            ok = rel <= t["tolerance_rel"]
            rows.append((metric, basis, sim_medium, pub, rel, t["tolerance_rel"], "PASS" if ok else "FINDING", "rel diff"))
        elif metric == "sector_revenue_share":
            pub = pub_tbl.sum(axis=1) / pub_tbl.values.sum()
            dist = tv_unordered(sim_sector, pub)
            ok = dist <= t["tolerance_abs"]
            rows.append((metric, basis, None, None, dist, t["tolerance_abs"], "PASS" if ok else "FINDING", "TV distance"))
            for s in pub.index:
                rows.append((f"  · {s}", "", float(sim_sector.get(s, 0.0)), float(pub[s]), None, None, "", ""))
        elif metric == "within_sector_size_revenue_share":
            pub_shares = pub_tbl.div(pub_tbl.sum(axis=1), axis=0)
            for s in pub_shares.index:
                sim_s = sim_size_in_sector.get(s, pd.Series(dtype=float))
                dist = ks_ordered(sim_s, pub_shares.loc[s])
                ok = dist <= t["tolerance_abs"]
                sim_txt = "/".join(f"{sim_s.get(k, 0):.2f}" for k in SIZE_ORDER)
                pub_txt = "/".join(f"{pub_shares.loc[s, k]:.2f}" for k in SIZE_ORDER)
                rows.append((f"{metric} · {s}", "", sim_txt, pub_txt, dist, t["tolerance_abs"], "PASS" if ok else "FINDING", "KS D (micro<small<medium)"))
        else:
            rows.append((metric, basis, None, t.get("published_value"), None, None, "UNHANDLED", ""))

    print("§21 emergent validation — research population (N=10,000), four modelled sectors\n")
    hdr = f"{'metric':52s} {'generator':>16s} {'published':>16s} {'distance':>9s} {'band':>6s}  status"
    print(hdr)
    print("-" * len(hdr))
    findings = 0
    for metric, basis, sim, pub, dist, band, status, how in rows:
        name = f"{metric} [{basis}]" if basis else metric
        f_sim = f"{sim:.3f}" if isinstance(sim, float) else (sim or "")
        f_pub = f"{pub:.3f}" if isinstance(pub, float) else (pub or "")
        f_dist = f"{dist:.3f}" if dist is not None else ""
        f_band = f"{band:.2f}" if band is not None else ""
        print(f"{name:52s} {f_sim!s:>16s} {f_pub!s:>16s} {f_dist:>9s} {f_band:>6s}  {status} {('(' + how + ')') if how and status else ''}")
        findings += status == "FINDING"

    print()
    for name, src in sources.items():
        print(f"source '{name}': {src['source']} — status: {src['source_status']}")
    print(f"\n{findings} FINDING(s). Per §21 these are reported, never retuned.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
