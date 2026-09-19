"""Phase 3 — average ticket size per sector = value ÷ count (SOP §6.1).

    python -m calibration.ticket_size [--all-editions]

--all-editions (SOP_Monshaat_Unblock B5): also reports, per sector, the mean across every edition that
carries the sector, the min–max spread as a share of the mean, and two re-pin candidates (the
cross-edition mean and the 2023 monthly annual mean). The APPLIED value stays the archived, dated
bulletin edition: SOP v2.0 §1 non-negotiable 2 freezes the generator through Workstream B, so the
re-pin is recorded as a proposed config change (DECISIONS.md entry 20), not written.

Three editions of the same SAMA measurement, reported side by side so the number is not an artefact
of one week:
  * the archived 12-Sep-2026 weekly bulletin (Table 1, four weeks 16 Aug–12 Sep 2026) — the finest
    activity split (Restaurants & Cafés vs Bakeries & Pastries, Professional & Business Services, …);
  * the weekly national series 2025 (Jan–Jul 2025, the latest full stretch in the archive);
  * the monthly Table 30d series, 2023 (last year of the sector edition).

Mapping to generator sectors (§5.3): food_beverage ← Restaurants & Cafés (bulletin also gives Bakeries);
retail_trade ← value-weighted composite of Clothing + Beverage and Food (grocery) + Electronics +
Furniture + Jewelry (Σvalue ÷ Σcount); construction ← Construction & Building Materials, and
professional_services ← Professional & Business Services (bulletin only) — both consumer-facing POS
lines, reported as class C context, not applied as generator inputs.

Also computes what the current config IMPLIES per sector (base_monthly_inflow_sar ÷ 30 ÷ inflow_tx_per_day)
so the correction is visible as old vs measured.
"""

from __future__ import annotations

import re
import sys

import pandas as pd
import pypdf

from calibration import sources as S
from calibration.seasonality import RETAIL_COMPOSITE
from generator.generate import load_config

BULLETIN_ACTIVITIES = [
    "Transportation", "Airlines", "Auto & Equipment Rentals", "Trade of Vehicles & Spare Parts", "Maintenance & Repair of Vehicles",
    "Freight Transport & Postal & Courier Services", "Health", "Medical Services", "Pharmacies & Medical Supplies", "Personal Care",
    "Restaurants & Caf", "Bakeries & Pastries", "Hotels", "Food & Beverages", "Apparel, Clothing & Accessories", "Recreation & Culture",
    "Books & Stationery", "Recreation", "Professional & Business Services", "Electronic & Electric Devices", "Furniture & Home Supplies",
    "Construction & Building Materials", "Jewelry", "Telecommunication", "Education", "Public Utilities & Services", "Gas Stations",
    "Laundry Services", "Total",
]
LEGACY_INFLOW_TX_PER_DAY = {"retail_trade": 5.0, "food_beverage": 6.0}  # config.yaml values until 2026-09-16 (DECISIONS.md 13.6)
NUM = r"([\d,]+)"
ROW = re.compile(r"\s" + r"\s+".join([NUM] * 8) + r"\s+(-?[\d.]+)\s+(-?[\d.]+)")


def parse_bulletin(pdf_path) -> pd.DataFrame:
    """Table 1 of the weekly bulletin: four weeks × (count, value) per activity, thousands. Parsed by regex on the text layer, then checked against the Total row."""
    text = pypdf.PdfReader(str(pdf_path)).pages[0].extract_text()
    weeks = re.findall(r"(\d+ \w+,\d+)\s+-\s+(\d+ \w+,\d+)", text)[:4]
    rows = []
    for act in BULLETIN_ACTIVITIES:
        i = text.find(act + " ")
        if i < 0:
            i = text.find(act)
        m = ROW.search(text, i)
        if not m:
            continue
        nums = [float(x.replace(",", "")) for x in m.groups()[:8]]
        rows.append({"activity": act, **{f"count_w{k + 1}": nums[2 * k] for k in range(4)}, **{f"value_w{k + 1}": nums[2 * k + 1] for k in range(4)}})
    df = pd.DataFrame(rows).set_index("activity")
    df["count_4w"] = df[[f"count_w{k}" for k in range(1, 5)]].sum(axis=1)
    df["value_4w"] = df[[f"value_w{k}" for k in range(1, 5)]].sum(axis=1)
    df["ticket_latest_week"] = df["value_w4"] / df["count_w4"]
    df["ticket_4w"] = df["value_4w"] / df["count_4w"]
    # the top-level activities (excluding sub-lines) must sum to Total within rounding
    top = ["Transportation", "Health", "Restaurants & Caf", "Bakeries & Pastries", "Hotels", "Food & Beverages", "Apparel, Clothing & Accessories", "Recreation & Culture", "Professional & Business Services", "Electronic & Electric Devices", "Furniture & Home Supplies", "Construction & Building Materials", "Jewelry", "Telecommunication", "Education", "Public Utilities & Services", "Gas Stations", "Laundry Services"]
    others_v = df.loc["Total", "value_w4"] - df.loc[top, "value_w4"].sum()
    assert 0 < others_v < df.loc["Total", "value_w4"] * 0.3, "bulletin parse: activities do not reconcile to Total"
    return df, weeks


def ticket(value: float, count: float) -> float:
    return float(value / count)


def multi_edition(editions: dict) -> dict:
    """Per sector: mean, min, max and spread across the editions that carry it (B5)."""
    out = {}
    for s in ("retail_trade", "food_beverage", "construction", "professional_services", "total"):
        vals = {e: v[s] for e, v in editions.items() if v.get(s) is not None}
        mean = sum(vals.values()) / len(vals)
        lo, hi = min(vals.values()), max(vals.values())
        out[s] = {"editions": {e: round(float(v), 1) for e, v in vals.items()}, "n_editions": len(vals), "mean": round(float(mean), 1), "min": round(float(lo), 1), "max": round(float(hi), 1), "spread_share_of_mean": round(float((hi - lo) / mean), 3)}
    return out


def main(argv: list[str] | None = None) -> int:
    import argparse

    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--all-editions", action="store_true", help="report the cross-edition mean and spread (B5); applied value unchanged")
    args = ap.parse_args(argv)
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    cfg = load_config("config.yaml")
    bull, weeks = parse_bulletin(S.SAMA / S.SAMA_WEEKLY_BULLETIN_PDF)
    weekly = S.load_pos_weekly_sector()
    monthly = S.load_pos_sector_monthly()

    w25 = weekly[(weekly["week_start"] >= "2025-01-01") & (weekly["week_start"] <= "2025-07-06")]
    w25p = w25.pivot_table(index="sector", columns="indicator", values="value", aggfunc="sum")
    w25p["ticket"] = w25p["sales"] / w25p["count"]
    m23 = monthly[monthly["date"].dt.year == 2023].pivot_table(index="sector", columns="indicator", values="value", aggfunc="sum")
    m23["ticket"] = m23["sales"] / m23["count"]

    def composite(p: pd.DataFrame, names: list[str]) -> float:
        sub = p.loc[[n for n in names if n in p.index]]
        return ticket(sub["sales"].sum(), sub["count"].sum())

    bull_retail = ["Apparel, Clothing & Accessories", "Food & Beverages", "Electronic & Electric Devices", "Furniture & Home Supplies", "Jewelry"]
    editions = {
        "bulletin_2026-09-12_latest_week": {
            "food_beverage": ticket(bull.loc["Restaurants & Caf", "value_w4"], bull.loc["Restaurants & Caf", "count_w4"]),
            "food_beverage_bakeries": ticket(bull.loc["Bakeries & Pastries", "value_w4"], bull.loc["Bakeries & Pastries", "count_w4"]),
            "retail_trade": ticket(bull.loc[bull_retail, "value_w4"].sum(), bull.loc[bull_retail, "count_w4"].sum()),
            "construction": bull.loc["Construction & Building Materials", "ticket_latest_week"],
            "professional_services": bull.loc["Professional & Business Services", "ticket_latest_week"],
            "total": bull.loc["Total", "ticket_latest_week"],
        },
        "bulletin_2026-09-12_four_weeks": {
            "food_beverage": bull.loc["Restaurants & Caf", "ticket_4w"],
            "food_beverage_bakeries": bull.loc["Bakeries & Pastries", "ticket_4w"],
            "retail_trade": ticket(bull.loc[bull_retail, "value_4w"].sum(), bull.loc[bull_retail, "count_4w"].sum()),
            "construction": bull.loc["Construction & Building Materials", "ticket_4w"],
            "professional_services": bull.loc["Professional & Business Services", "ticket_4w"],
            "total": bull.loc["Total", "ticket_4w"],
        },
        "weekly_series_2025_jan_jul": {
            "food_beverage": float(w25p.loc[S.RESTAURANTS, "ticket"]),
            "retail_trade": composite(w25p, RETAIL_COMPOSITE),
            "construction": float(w25p.loc["Construction & Building Materials", "ticket"]),
            "professional_services": None,
            "total": float(w25p.loc["Total", "ticket"]),
        },
        "monthly_table30d_2023": {
            "food_beverage": float(m23.loc[S.RESTAURANTS, "ticket"]),
            "retail_trade": composite(m23, RETAIL_COMPOSITE),
            "construction": float(m23.loc["Construction & Building Materials", "ticket"]),
            "professional_services": None,
            "total": float(m23.loc["Total", "ticket"]),
        },
    }
    # "config-implied" = what the PRE-calibration config implied per receipt (base ÷ 30 ÷ inflow_tx_per_day). Retail and
    # F&B no longer carry inflow_tx_per_day (replaced by the measured ticket on 2026-09-16), so their pre-calibration
    # rates are pinned here to keep the old-vs-measured comparison reproducible.
    implied = {s: cfg["sector_economics"][s]["base_monthly_inflow_sar"] / 30.0 / cfg["sector_economics"][s].get("inflow_tx_per_day", LEGACY_INFLOW_TX_PER_DAY.get(s, float("nan"))) for s in cfg["sector_economics"]}

    print("== Average ticket (SAR) = value ÷ count ==")
    print(f"{'sector':24s} {'config-implied':>15s} {'bulletin wk':>12s} {'bulletin 4w':>12s} {'weekly 2025':>12s} {'monthly 2023':>13s}")
    for s in ("retail_trade", "food_beverage", "construction", "professional_services", "total"):
        vals = [editions[e].get(s) for e in editions]

        def f(v):
            return f"{v:12.1f}" if v is not None else f"{'—':>12s}"

        print(f"{s:24s} {implied.get(s, float('nan')):15.1f} {f(vals[0])} {f(vals[1])} {f(vals[2])} {f(vals[3]):>13s}")
    print(f"  bulletin weeks: {weeks};  bakeries (bulletin, 4w): {editions['bulletin_2026-09-12_four_weeks']['food_beverage_bakeries']:.1f} SAR")

    proposed = {  # the applied edition is the archived, dated bulletin (pinned edition, §1.3); the other editions are the stability check
        "retail_trade": round(float(editions["bulletin_2026-09-12_four_weeks"]["retail_trade"]), 1),
        "food_beverage": round(float(editions["bulletin_2026-09-12_four_weeks"]["food_beverage"]), 1),
    }
    payload = {
        "run_at": S.now_iso(),
        "bulletin_weeks": weeks,
        "bulletin_table1": bull.reset_index().to_dict(orient="records"),
        "editions": editions,
        "config_implied_ticket_sar": implied,
        "retail_composition_rule": {"bulletin": bull_retail, "series": RETAIL_COMPOSITE},
        "proposed_config": {"avg_inflow_ticket_sar": proposed, "edition": "SAMA Weekly Points of Sale Transactions bulletin 12-Sep-2026, Table 1, four-week Σvalue ÷ Σcount", "evidence_class": "B"},
        "not_applied": {"construction": "consumer purchases of building materials, not contractor receipts (class C)", "professional_services": "consumer-facing professional services line only (class C)"},
    }
    if args.all_editions:
        me = multi_edition(editions)
        payload["multi_edition"] = me
        payload["re_pin_candidates"] = {
            "cross_edition_mean": {s: me[s]["mean"] for s in ("retail_trade", "food_beverage")},
            "monthly_2023_annual_mean": {s: round(float(editions["monthly_table30d_2023"][s]), 1) for s in ("retail_trade", "food_beverage")},
            "applied_now": proposed,
            "status": "PROPOSED config change, not applied — SOP_Monshaat_Unblock §1 non-negotiable 2 freezes the generator through Workstream B (DECISIONS.md entry 20)",
        }
        print("\n== B5: across editions (applied value unchanged) ==")
        for s, m in me.items():
            print(f"  {s:22s} n={m['n_editions']}  mean {m['mean']:6.1f}  min {m['min']:6.1f}  max {m['max']:6.1f}  spread {m['spread_share_of_mean']:.1%} of mean")
        print(f"  re-pin candidates: cross-edition mean {payload['re_pin_candidates']['cross_edition_mean']}, 2023 annual mean {payload['re_pin_candidates']['monthly_2023_annual_mean']}; applied {proposed}")
    p = S.write_out("phase3_ticket_size", payload)
    print(f"\nproposed avg_inflow_ticket_sar: {proposed}  (construction / professional not applied — class C)\n→ {p}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
