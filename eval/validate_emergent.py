"""§21 validation — pre-registered targets in config.yaml, compared against what the generator produced.

Two sections, kept apart on purpose (SOP_Saudi_Calibration_Sources §2.1–§2.3, DECISIONS.md entry 12):

  A. calibration_derived_checks — the revenue-share metrics. They are closed-form functions of the
     config (weight × base inflow × E[size scale]); the harness prints the closed form next to the
     realised value and the GASTAT figure. A miss here is a statement about the INPUTS, never evidence
     about the simulation, and correcting an input from a source is not tuning.
  B. targets — genuinely emergent: no closed form, the simulation has to run. A miss is a FINDING,
     never a reason to retune (status_on_fail is always report_as_finding).

Rules (Schema v2.9 §21): bands are read from config, committed before the run; distances not eyeballed
charts; every number labelled with its population and basis. Exit code 0 always — findings are results.

    python -m eval.validate_emergent [--dir data] [--config config.yaml] [--out eval/out/emergent_validation.md]
"""

from __future__ import annotations

import argparse
import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd

from eval import seasonal_recovery as sr
from eval.gate_week3 import MIN_COVERAGE, profile_features
from generator.generate import load_config

SIZE_ORDER = ["micro", "small", "medium"]
LINES: list[str] = []


def say(s: str = "") -> None:
    print(s)
    LINES.append(s)


# --------------------------------------------------------------------------- #
# A. calibration-derived checks
# --------------------------------------------------------------------------- #


def closed_form(cfg: dict) -> dict:
    ssd, econ, scale = cfg["sector_size_distribution"], cfg["sector_economics"], cfg["size_tier_scale"]
    rev = {s: v["weight"] * econ[s]["base_monthly_inflow_sar"] * sum(v["size_tiers"][t] * scale[t] for t in SIZE_ORDER) for s, v in ssd.items()}
    tot = sum(rev.values())
    medium = sum(v["weight"] * econ[s]["base_monthly_inflow_sar"] * v["size_tiers"]["medium"] * scale["medium"] for s, v in ssd.items()) / tot
    within = {s: {t: v["size_tiers"][t] * scale[t] / sum(v["size_tiers"][u] * scale[u] for u in SIZE_ORDER) for t in SIZE_ORDER} for s, v in ssd.items()}
    return {"sector_share": {s: rev[s] / tot for s in rev}, "medium_share": medium, "within_sector": within}


def ks_ordered(sim: pd.Series, pub: pd.Series) -> float:
    s = sim.reindex(SIZE_ORDER).fillna(0).cumsum()
    p = pub.reindex(SIZE_ORDER).fillna(0).cumsum()
    return float((s - p).abs().max())


def tv_unordered(sim: pd.Series, pub: pd.Series) -> float:
    idx = sorted(set(sim.index) | set(pub.index))
    return float(0.5 * (sim.reindex(idx).fillna(0) - pub.reindex(idx).fillna(0)).abs().sum())


def section_a(cfg: dict, d: Path) -> int:
    ev = cfg["emergent_validation_targets"]
    sources = ev["published_sources"]
    daily = pd.read_csv(d / "daily_aggregates.csv", usecols=["business_id", "inflow_total"])
    biz = pd.read_csv(d / "businesses.csv", usecols=["business_id", "sector", "size_tier", "population"])
    r = daily.groupby("business_id")["inflow_total"].sum().rename("rev").reset_index().merge(biz, on="business_id")
    r = r[r["population"] == "research"]
    total = r["rev"].sum()
    sim_sector = r.groupby("sector")["rev"].sum() / total
    sim_size = r.groupby(["sector", "size_tier"])["rev"].sum() / r.groupby("sector")["rev"].sum()
    sim_medium = r.loc[r["size_tier"] == "medium", "rev"].sum() / total
    cf = closed_form(cfg)

    say("## A. Calibration-derived checks (closed form of the inputs — NOT emergent)")
    say("")
    say("Research population, four modelled sectors. `closed form` = weight × base_monthly_inflow_sar × E[size_tier_scale] from config.yaml; no simulation involved.")
    say("")
    say("| metric | closed form | realised | published (GASTAT 2022) | distance | band | status |")
    say("|---|---|---|---|---|---|---|")
    findings = 0
    for t in ev["calibration_derived_checks"]:
        metric, basis = t["metric"], t.get("basis", "")
        if t.get("comparable") is False:
            say(f"| {metric} [{basis}] | — | {sim_medium:.3f} | {t['published_value']:.3f} | — | — | CONTEXT_ONLY (not like-for-like) |")
            continue
        src = sources[t["derived_from"]]
        pub_tbl = pd.DataFrame({k: v for k, v in src.items() if isinstance(v, dict)}).T[SIZE_ORDER]
        if metric == "revenue_share_medium_tier":
            pub = pub_tbl["medium"].sum() / pub_tbl.values.sum()
            rel = abs(sim_medium - pub) / pub
            ok = rel <= t["tolerance_rel"]
            findings += not ok
            say(f"| {metric} [{basis}] | {cf['medium_share']:.3f} | {sim_medium:.3f} | {pub:.3f} | {rel:.3f} rel | {t['tolerance_rel']:.2f} | {'consistent' if ok else 'INPUTS DIFFER FROM GASTAT'} |")
        elif metric == "sector_revenue_share":
            pub = pub_tbl.sum(axis=1) / pub_tbl.values.sum()
            dist = tv_unordered(sim_sector, pub)
            ok = dist <= t["tolerance_abs"]
            findings += not ok
            say(f"| {metric} | — | — | — | {dist:.3f} TV | {t['tolerance_abs']:.2f} | {'consistent' if ok else 'INPUTS DIFFER FROM GASTAT'} |")
            for s in pub.index:
                say(f"| &nbsp;&nbsp;· {s} | {cf['sector_share'][s]:.3f} | {float(sim_sector.get(s, 0.0)):.3f} | {float(pub[s]):.3f} | | | |")
        elif metric == "within_sector_size_revenue_share":
            pub_shares = pub_tbl.div(pub_tbl.sum(axis=1), axis=0)
            for s in pub_shares.index:
                sim_s = sim_size.get(s, pd.Series(dtype=float))
                dist = ks_ordered(sim_s, pub_shares.loc[s])
                ok = dist <= t["tolerance_abs"]
                findings += not ok
                cf_txt = "/".join(f"{cf['within_sector'][s][k]:.2f}" for k in SIZE_ORDER)
                sim_txt = "/".join(f"{sim_s.get(k, 0):.2f}" for k in SIZE_ORDER)
                pub_txt = "/".join(f"{pub_shares.loc[s, k]:.2f}" for k in SIZE_ORDER)
                say(f"| {metric} · {s} | {cf_txt} | {sim_txt} | {pub_txt} | {dist:.3f} KS | {t['tolerance_abs']:.2f} | {'consistent' if ok else 'INPUTS DIFFER FROM GASTAT'} |")
    say("")
    say(f"{findings} input-consistency miss(es). These describe `sector_size_distribution`, `base_monthly_inflow_sar` and `size_tier_scale`; the resolution is a sourced correction of those inputs (DECISIONS.md entries 6, 12), not a validation result.")
    say("")
    return findings


# --------------------------------------------------------------------------- #
# B. emergent targets
# --------------------------------------------------------------------------- #


def section_b(cfg: dict, d: Path) -> int:
    ev = cfg["emergent_validation_targets"]
    daily = pd.read_csv(d / "daily_aggregates.csv", parse_dates=["date"])
    balances = pd.read_csv(d / "balances_monthly.csv", parse_dates=["month_end"])
    biz = pd.read_csv(d / "businesses.csv", parse_dates=["start_date", "window_end", "operating_start_date"])
    labels = pd.read_csv(d / "labels.csv")
    f = profile_features(daily, balances, biz)
    research = f[(f["population"] == "research") & (f["coverage_days_90d"] >= MIN_COVERAGE)]
    findings = 0

    say("## B. Emergent targets (no closed form — the simulation had to run)")
    say("")
    for t in ev["targets"]:
        m = t["metric"]
        if m == "days_negative_balance_distribution":
            neg = research["days_negative_balance_90d"]
            share = float((neg >= 1).mean())
            q = neg[neg >= 1].quantile([0.5, 0.9, 0.99]) if (neg >= 1).any() else pd.Series([np.nan] * 3, index=[0.5, 0.9, 0.99])
            by_sector = research.assign(neg=neg >= 1).groupby("sector")["neg"].mean()
            say(f"### {m} — REPORTED ({t['source_status']})")
            say("")
            say(f"Scorable research businesses n={len(research)}: **{share:.1%}** have ≥ 1 negative-balance day in the trailing 90; among those the 50/90/99th percentiles are {q.iloc[0]:.0f} / {q.iloc[1]:.0f} / {q.iloc[2]:.0f} days. By sector: " + ", ".join(f"{s} {v:.1%}" for s, v in by_sector.items()) + ".")
            say(f"Comparator: {t['source']}. `comparable: false` — no Saudi SME series exists; nothing is judged against it.")
            say("")
        elif m == "realised_dso_vs_archetype":
            say(f"### {m} — machinery test against the §24 archetype bands")
            say("")
            say("| sector | archetype dso_days band | realised median implied_dso_days | inside band? |")
            say("|---|---|---|---|")
            for s, band in cfg["balance_sheet_archetypes"].items():
                med = float(research.loc[research["sector"] == s, "implied_dso_days"].median())
                lo, hi = band["dso_days"]
                ok = lo <= med <= hi
                findings += not ok
                say(f"| {s} | [{lo}, {hi}] | {med:.1f} | {'PASS' if ok else 'FINDING'} |")
            say("")
        elif m == "ramadan_amplitude_recovered":
            rec = sr.recover(daily, biz, cfg)
            rows = sr.compare(rec, cfg, t["tolerance_abs"])
            say(f"### {m} — §22 decomposition fitted to the generated data (tolerance_abs {t['tolerance_abs']})")
            say("")
            say("Research population, businesses operating for the full window; OLS on log sector-daily totals with trend + day-of-week + window dummies. exp(coef) vs the configured multiplier.")
            say("")
            say("| sector | kind | pre_ramadan_10d | ramadan | eid | post_eid_7d | status |")
            say("|---|---|---|---|---|---|---|")
            for s in rec:
                for kind in ("value", "count"):
                    cells = []
                    ok_all = True
                    for w in sr.WINDOWS:
                        row = next(r for r in rows if r["sector"] == s and r["kind"] == kind and r["window"] == w)
                        ok_all &= row["ok"]
                        cells.append(f"{row['recovered']:.2f} (cfg {row['configured']:.2f})")
                    findings += not ok_all
                    say(f"| {s} (n={rec[s]['n_businesses']}) | {kind} | " + " | ".join(cells) + f" | {'PASS' if ok_all else 'FINDING'} |")
            say("")
        elif m == "aggregate_default_rate":
            lab = labels[labels["population"] == "research"]
            say(f"### {m} — NOT REGISTERED ({t['source_status']})")
            say("")
            say(f"Realised: **{lab['default_label'].mean():.3%}** (research, n={len(lab)}, {int(lab['default_label'].sum())} defaults). No citable SME-specific NPL series has been pinned; the target stays unregistered rather than asserting an untraceable number (§21). Bank credit by activity (Phase 4) has no NPL field.")
            say("")
        elif m == "real_vs_synthetic_signal_strength":
            say(f"### {m} — see `python -m eval.compare_real` → eval/out/real_vs_synthetic.md")
            say("")
            say(f"Registered here (tolerance_abs {t['tolerance_abs']}); computed by the comparison harness, not repeated in this script.")
            say("")
    return findings


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dir", default="data")
    ap.add_argument("--config", default="config.yaml")
    ap.add_argument("--out", default="eval/out/emergent_validation.md")
    args = ap.parse_args(argv)
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    cfg = load_config(args.config)
    d = Path(args.dir)

    say(f"# §21 validation — {datetime.now(tz=timezone.utc).date().isoformat()}, tables from `{d.as_posix()}`")
    say("")
    fa = section_a(cfg, d)
    fb = section_b(cfg, d)
    for name, src in cfg["emergent_validation_targets"]["published_sources"].items():
        say(f"source '{name}': {src['source']} — status: {src['source_status']}")
    say("")
    say(f"**{fb} emergent FINDING(s)** (reported, never retuned) and {fa} input-consistency miss(es) against GASTAT.")
    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    Path(args.out).write_text("\n".join(LINES) + "\n", encoding="utf-8")
    print(f"\n→ {args.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
