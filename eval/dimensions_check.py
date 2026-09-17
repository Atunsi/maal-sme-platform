"""Structural assertions on the Phase 5 dimensions (SOP_Data_Grounding §10.2, §12.1, §12.3).

    python -m eval.dimensions_check [--dir data]

Asserted, not commented:
  1. obligations terminate — some final_date is non-null on the synthetic side;
  2. mandate cancellations correlate with latent distress (Spearman > 0, p < 0.01), or feature 64 is noise;
  3. final_amount sometimes differs from amount, or feature 65 is identically zero;
  4. facility utilisation correlates with latent distress; emergency lines exist;
  5. MCC is null on roughly (1 − mcc_coverage_share) of businesses per sector (§12.3);
  6. every class-C row is stamped evidence_class C; base tables stay class B.
Exit code 1 on any failure.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import pandas as pd
from scipy.stats import spearmanr

from generator.generate import load_config

FAILURES: list[str] = []


def check(cond: bool, msg: str) -> None:
    print(("  PASS  " if cond else "  FAIL  ") + msg)
    if not cond:
        FAILURES.append(msg)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dir", default="data")
    ap.add_argument("--config", default="config.yaml")
    args = ap.parse_args(argv)
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    d = Path(args.dir)
    cfg = load_config(args.config)
    obl = pd.read_csv(d / "obligations.csv", parse_dates=["next_date", "final_date", "status_change_date"])
    fac = pd.read_csv(d / "facilities.csv", parse_dates=["emergency_line_since"])
    biz = pd.read_csv(d / "businesses.csv", dtype={"declared_mcc_code": "Int64"})
    lat = pd.read_csv(d / "latents_hidden.csv")[["business_id", "latent_risk_index"]]
    research = set(biz.loc[biz["population"] == "research", "business_id"])

    print(f"== Phase 5 dimensions — {d.resolve()} ==")
    print(f"  obligations by type: {obl['type'].value_counts().to_dict()}; facilities by type: {fac['facility_type'].value_counts().to_dict()}")

    # 1. terminate
    term = obl["final_date"].notna().mean()
    check(term > 0.05, f"obligations terminate: {term:.1%} of rows carry a final_date (loan standing orders + scheduled)")

    # 2. cancellations ↔ latent distress
    dd = obl[obl["type"] == "direct_debit"]
    canc = dd.groupby("business_id")["status"].apply(lambda s: (s == "inactive").sum()).rename("cancellations").reset_index()
    canc = canc[canc["business_id"].isin(research)].merge(lat, on="business_id")
    rho, pval = spearmanr(canc["cancellations"], canc["latent_risk_index"])
    check(rho > 0 and pval < 0.01, f"mandate cancellations correlate with latent distress: Spearman ρ = {rho:.3f}, p = {pval:.2e} (n = {len(canc)} businesses with direct debits)")

    # 3. balloon
    bal = obl[(obl["type"] == "standing_order") & obl["final_amount"].notna()]
    diff = (bal["final_amount"] != bal["amount"]).mean() if len(bal) else 0.0
    check(len(bal) > 0 and diff > 0.5, f"final_amount ≠ amount on {len(bal)} standing orders ({diff:.0%} of those with a final_amount) — feature 65 is not identically zero")

    # 4. facilities
    f = fac[fac["facility_type"] != "none"].merge(lat, on="business_id")
    f = f[f["business_id"].isin(research)]
    util = f["facility_drawn"] / f["facility_limit"]
    rho_f, p_f = spearmanr(util, f["latent_risk_index"])
    check(rho_f > 0 and p_f < 0.01, f"facility utilisation correlates with latent distress: ρ = {rho_f:.3f}, p = {p_f:.2e} (n = {len(f)})")
    em = int(fac["facility_type"].isin(["emergency", "temporary"]).sum())
    check(em > 0, f"emergency/temporary lines present: {em}")
    check((fac["own_funds"] == fac["own_funds"]).all() and ((fac["facility_limit"] - fac["facility_drawn"] - fac["headroom"]).abs() < 0.02).all(), "headroom == limit − drawn on every row")

    # 5. MCC coverage
    share = cfg["ungrounded"]["mcc_coverage_share"]
    for sector, g in biz.groupby("sector"):
        got = g["declared_mcc_code"].notna().mean()
        check(abs(got - share[sector]) < 0.05, f"MCC coverage {sector}: {got:.2f} vs configured {share[sector]:.2f}")

    # 6. evidence stamps
    check((fac["evidence_class"] == "C").all(), "facilities rows are class C")
    check(set(obl["evidence_class"]) <= {"B", "C"} and (obl.loc[obl["type"] != "standing_order", "evidence_class"] == "C").all(), "obligations: standing orders B/C, direct debits and scheduled C")
    print("DIMENSIONS CHECK PASSED" if not FAILURES else f"DIMENSIONS CHECK FAILED — {len(FAILURES)}")
    return 0 if not FAILURES else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
