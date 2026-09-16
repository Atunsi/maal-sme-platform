"""Phase 4 — sector-conditional financing share from bank credit by economic activity (SOP §7).

    python -m calibration.credit_intensity

Bank credit outstanding by activity (SAMA, quarterly 2021Q3–2026Q2), Individuals' Loans EXCLUDED
(asserted), mapped to the four generator sectors:
    retail_trade          ← Wholesale and Retail Trade
    construction          ← Construction
    food_beverage         ← Accommodation and Food Service Activities
    professional_services ← Professional, Scientific and Technical Activities

Credit per business = sector credit ÷ sector SME count. The SME count comes from Phase 1
(calibration/out/phase1_sector_mix.json). If Phase 1 is blocked (Monsha'at gateway), this
script still reports the credit SHARES and their five-year growth, but writes no per-business
index and proposes no config change — a relative index needs the denominator (§7.3).

Hard limitation (§7.4, stated in the output): this is TOTAL bank credit, not SME credit, and has no
NPL series. The index makes `financing.share_of_businesses` relatively correct across sectors; its
absolute level stays judgement (the count-weighted mean is pinned to the current 0.35).
"""

from __future__ import annotations

import sys

import numpy as np

from calibration import sources as S
from generator.generate import load_config

ACTIVITY_MAP = {
    "retail_trade": "Wholesale and Retail Trade",
    "construction": "Construction",
    "food_beverage": "Accommodation and Food Service Activities",
    "professional_services": "Professional, Scientific and Technical Activities",
}


def main(argv: list[str] | None = None) -> int:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    cfg = load_config("config.yaml")
    c = S.load_bank_credit_quarterly()
    piv = c.pivot(index="quarter_start", columns="activity", values="value_mn_sar").sort_index()
    business = piv.drop(columns=["Total", S.INDIVIDUALS])
    assert S.INDIVIDUALS not in business.columns and "Total" not in business.columns  # §7.2 exclusion asserted
    latest = piv.index.max()
    total_all = float(piv.loc[latest, "Total"])
    business_total = float(business.loc[latest].sum())
    share_of_total = (piv.loc[latest].drop(["Total"]) / total_all).sort_values(ascending=False)
    share_of_business = (business.loc[latest] / business_total).sort_values(ascending=False)

    first = piv.index.min()
    years = (latest - first).days / 365.25
    growth = {a: float((business.loc[latest, a] / business.loc[first, a]) ** (1 / years) - 1) for a in business.columns}

    print(f"== Bank credit by activity, latest quarter {latest.date()} (SAR mn; Individuals' Loans = {piv.loc[latest, S.INDIVIDUALS] / total_all:.1%} of total, EXCLUDED) ==")
    sector_rows = {}
    for gsec, act in ACTIVITY_MAP.items():
        sector_rows[gsec] = {"activity": act, "credit_mn_sar_latest": float(piv.loc[latest, act]), "share_of_total_credit": float(share_of_total[act]), "share_of_business_credit": float(share_of_business[act]), "cagr_2021q3_to_latest": growth[act]}
        print(f"  {gsec:22s} ← {act:52s} {piv.loc[latest, act]:>12,.0f}  {share_of_total[act]:6.1%} of all credit  {share_of_business[act]:6.1%} of business credit  CAGR {growth[act]:+.1%}")

    payload = {
        "run_at": S.now_iso(),
        "latest_quarter": str(latest.date()),
        "first_quarter": str(first.date()),
        "total_credit_mn_sar": total_all,
        "individuals_loans_share": float(piv.loc[latest, S.INDIVIDUALS] / total_all),
        "business_credit_mn_sar": business_total,
        "share_of_business_credit_all_activities": {a: float(v) for a, v in share_of_business.items()},
        "cagr_all_activities": growth,
        "sectors": sector_rows,
        "limitation": "Total bank credit by activity, not SME credit; no SME-vs-large split, no NPLs. Construction's share is dominated by large contractors. Index is relative only; absolute level stays judgement (§7.4). §21 NPL target remains pending_week1_check.",
    }

    p1 = S.OUT / "phase1_sector_mix.json"
    mix = S.read_out("phase1_sector_mix") if p1.exists() else None
    current = cfg["financing"]["share_of_businesses"]
    level = float(np.mean(list(current.values()))) if isinstance(current, dict) else float(current)
    if mix and mix.get("status") == "ok":
        latest_q = mix["latest_quarter"]
        counts = mix["quarters"][latest_q]["sme_total_by_sector"]
        weights = mix["quarters"][latest_q]["weight"]
        per_biz = {s: sector_rows[s]["credit_mn_sar_latest"] * 1e6 / counts[s] for s in ACTIVITY_MAP}
        wmean = sum(weights[s] * per_biz[s] for s in ACTIVITY_MAP)
        index = {s: per_biz[s] / wmean for s in ACTIVITY_MAP}
        share = {s: round(min(0.95, level * index[s]), 3) for s in ACTIVITY_MAP}
        payload.update({"sme_counts_from": f"phase1_sector_mix {latest_q}", "credit_per_sme_sar": per_biz, "relative_index_count_weighted_mean_1": index, "proposed_config": {"financing.share_of_businesses": share, "absolute_level_pinned_to": level, "evidence_class": "B (relative), C (level)"}})
        print("\ncredit per SME (SAR) and relative index:")
        for s in ACTIVITY_MAP:
            print(f"  {s:22s} {per_biz[s]:>12,.0f}  index {index[s]:.2f}  → share_of_businesses {share[s]:.3f}")
    else:
        payload.update({"status": "index_blocked_no_sme_counts", "note": "Phase 1 (Monsha'at) blocked — credit shares reported, per-business index and config proposal withheld (§7.3)"})
        print("\nNo Phase 1 SME counts: per-business credit index withheld. Credit shares above are reported only; financing.share_of_businesses stays 0.35 uniform (author judgement, class C).")
    p = S.write_out("phase4_credit_intensity", payload)
    print(f"→ {p}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
