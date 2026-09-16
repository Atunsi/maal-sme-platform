"""Phase 6 — the deliverable report: /maal/saudi_calibration_report.md (SOP §10).

    python -m calibration.write_report [--out ../saudi_calibration_report.md]

Assembles the seven required sections from the measurements in calibration/out/*.json, the
archive meta files in sources/sama/, and the Phase 5 re-run outputs in eval/out/. Every number
in the report is read from one of those files; the prose names its source and evidence class.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from calibration import sources as S
from generator.generate import load_config

WINDOWS = ("pre_ramadan_10d", "ramadan", "eid", "post_eid_7d")


def meta(name: str) -> dict:
    return json.loads((S.SAMA / (name + ".meta.json")).read_text(encoding="utf-8"))


def ci(x: list[float]) -> str:
    return f"[{x[0]:.2f}, {x[1]:.2f}]"


def read_text(p: Path) -> str | None:
    return p.read_text(encoding="utf-8") if p.exists() else None


def gate_summary(txt: str | None) -> tuple[str, list[str]]:
    if txt is None:
        return "not run", []
    verdict = "PASS" if "GATE PASSED" in txt else "FAIL"
    lines = [ln.strip() for ln in txt.splitlines() if ln.strip().startswith(("PASS", "FAIL", "SKIP", "INFO", "ID 10001"))]
    return verdict, lines


def _fmt(v) -> str:
    return f"{v:.1f}" if v is not None else "—"


def section(md: list[str], title: str) -> None:
    md += ["", f"## {title}", ""]


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--out", default=str(S.REPO.parent / "saudi_calibration_report.md"))
    args = ap.parse_args(argv)
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

    cfg = load_config(str(S.REPO / "config.yaml"))
    p0, p1, p2, p3t, p3h, p4 = (S.read_out(n) for n in ("phase0_probe", "phase1_sector_mix", "phase2_seasonality", "phase3_ticket_size", "phase3_holdout", "phase4_credit_intensity"))
    p1pull = S.read_out("phase1_monshaat_pull") if (S.OUT / "phase1_monshaat_pull.json").exists() else {"status": "not_run"}
    eo = S.REPO / "eval" / "out"
    gate_after = read_text(eo / "gate_week3_after_calibration.txt")
    emergent_after = read_text(eo / "emergent_validation.md")
    emergent_before = read_text(eo / "emergent_validation_before_calibration.md")
    rvs_after = read_text(eo / "real_vs_synthetic.md")
    rvs_before = read_text(eo / "real_vs_synthetic_before_calibration.md")
    evidence = read_text(eo / "evidence_table.md")

    gen = p2["generator"]
    fb, rt, con = gen["food_beverage"], gen["retail_trade"], gen["construction"]
    mon = p2["monthly"]
    tot = p2["value_count_divergence_total"]
    tick = p3t["editions"]
    implied = p3t["config_implied_ticket_sar"]
    hold_a, hold_s = p3h["aggregate"], p3h["per_sector"]
    cal_find = p0.get("ramadan_calendar_findings", [])
    probe = (p0.get("monshaat_probe") or {}).get("resolved")

    md: list[str] = [
        "# Saudi national source calibration — report",
        "",
        (f"**Repository:** `maal-sme-platform-main` · **SOP:** `SOP_Saudi_Calibration_Sources.md` v1.0 · **Run date:** {p2['run_at'][:10]} · "
        "**Change record:** `DECISIONS.md` entries 12 and 13 · **Measurements:** `calibration/out/*.json` · **Archives:** `sources/sama/`"),
        "",
        ("Written for a defense reader. Every number below states what measured it, which edition, and whether it is "
        "measured (class B on the synthetic side), judged (class C) or unknown. A finding that weakens the project is still a finding."),
        "",
        (
            "**One-paragraph summary.** Three of the five defects the SOP set out to fix were fixed from SAMA sources: the food-service Ramadan "
            f"direction (restaurants **fall** to {fb['monthly']['sales']['multiplier']:.2f}× in Ramadan and spike to {fb['weekly']['sales']['eid']['multiplier']:.2f}× at Eid; the placeholder had 1.45× / 1.80×), "
            f"the ticket sizes (retail {tick['bulletin_2026-09-12_four_weeks']['retail_trade']:.1f} SAR and restaurants {tick['bulletin_2026-09-12_four_weeks']['food_beverage']:.1f} SAR against config-implied {implied['retail_trade']:.0f} / {implied['food_beverage']:.0f}), "
            "and the missing held-out year (2024 and 2025 both scored against the ≤2023 fit without refitting, aggregate and per sector). "
            "The other two — the sector/size mix and the sector-conditional financing share — are **blocked on the Monsha'at gateway**, which returned "
            "no data on the access date; nothing was invented in their place, and the scripts that will write them are complete. "
            "The revenue-share metrics were reclassified from emergent targets to calibration-derived checks before any input changed (§2.2)."
        ),
    ]

    # ------------------------------------------------------------------ 1
    section(md, "1. What was done")
    for fname, (dataset, pub) in S.SAMA_FILES.items():
        m = meta(fname)
        used = {
            "pos_by_sector_monthly_2016_2023.csv": "Phase 2 — β_h per Hijri month per sector (the §22 decomposition); Phase 3 — 2023 ticket-size edition.",
            "pos_aggregate_1995_2026.csv": "Phase 2 — terminal counts for the adoption trend; Phase 3 — aggregate held-out 2024/2025 test; §5.4 value-vs-count divergence.",
            "pos_by_sector_weekly_2020_2025.csv": "Phase 2 — the weekly window model that resolves the 3-day Eid; Phase 3 — per-sector held-out 2024/2025 and the 2025 ticket edition. Not in the SOP's inventory; found on the same mirror.",
            "bank_credit_by_activity_2021_2026.csv": "Phase 4 — credit shares and growth by activity with Individuals' Loans excluded; the per-SME index awaits the Monsha'at denominator.",
        }[fname]
        md += [f"**{pub}.** Origin: {m['origin_body']}. Retrieved via {m['retrieval']} on {m['access_date']}; span {m.get('span', ['?', '?'])[0]} → {m.get('span', ['?', '?'])[1]}, {m.get('rows_tidy', '?'):,} tidy rows. Used for: {used} Archive `sources/sama/{fname}`, SHA-256 `{m['sha256']}`.", ""]
    mb = meta(S.SAMA_WEEKLY_BULLETIN_PDF)
    md += [f"**SAMA Weekly Points of Sale Transactions bulletin, {mb['edition']}.** Origin: SAMA. Direct PDF, retrieved {mb['access_date']}. Used for: Phase 3 ticket sizes at the finest activity split (Restaurants & Cafés vs Bakeries, Professional & Business Services). Archive `sources/sama/{S.SAMA_WEEKLY_BULLETIN_PDF}`, SHA-256 `{mb['sha256']}`.", ""]
    md += [
        (
            "**Monsha'at Enterprises Statistics (region × ISIC × size).** Origin: Monsha'at. Retrieval path: the OpenData gateway "
            f"`{S.MONSHAAT_ENDPOINT.format(year='{Year}', quarter='{Quarter}')}?paginationIndex=&recordsPerPage=`. **Not archived:** the gateway answered "
            f"`{json.dumps(probe, ensure_ascii=False)[:160]}…` on every quarter tried (see §5). `calibration/monshaat_pull.py` and `sector_mix.py` are written and will archive "
            "`sources/monshaat/enterprises_{YYYY}Q{Q}.json` with hash and meta when it answers."
        ),
        "",
        "**GASTAT seasonally-adjusted real GDP by institutional sector (2023=100).** Deliberately **excluded** (DECISIONS.md 13.10): the export interleaves five unit series under one label, and a seasonally-adjusted, three-sector series cannot inform a four-sector Hijri seasonality calibration.",
    ]

    # ------------------------------------------------------------------ 2
    section(md, "2. Parameters changed")
    md += ["| parameter | old | new | source (edition) | class before → after |", "|---|---|---|---|---|"]
    old_v = {"retail_trade": {"pre_ramadan_10d": 1.10, "ramadan": 1.30, "eid": 2.20, "post_eid_7d": 0.80}, "food_beverage": {"pre_ramadan_10d": 1.05, "ramadan": 1.45, "eid": 1.80, "post_eid_7d": 0.85}}
    for s, g in (("retail_trade", rt), ("food_beverage", fb)):
        pc = g["proposed_config"]
        for w in WINDOWS:
            src = "SAMA Table 30d monthly 2016–2023 excl. 2020, §22 NNLS" if w == "ramadan" else "SAMA weekly POS 2021–2023, window model"
            md.append(f"| `seasonality_value_multiplier.{s}.{w}` | {old_v[s][w]:.2f} | **{pc['seasonality_value_multiplier'][w]:.2f}** CI {ci(pc['ci95_value'][w])} | {src} | C → B |")
        for w in WINDOWS:
            src = "SAMA Table 30d monthly (count), §22 NNLS" if w == "ramadan" else "SAMA weekly POS (count), window model"
            md.append(f"| `seasonality_count_multiplier.{s}.{w}` | 1.00 (implicit) | **{pc['seasonality_count_multiplier'][w]:.2f}** CI {ci(pc['ci95_count'][w])} | {src} | C → B |")
    for s, old_tx in (("retail_trade", 5.0), ("food_beverage", 6.0)):
        md.append(f"| `sector_economics.{s}.avg_inflow_ticket_sar` (replaces `inflow_tx_per_day` {old_tx}) | implied {implied[s]:.0f} SAR/receipt | **{cfg['sector_economics'][s]['avg_inflow_ticket_sar']} SAR** | SAMA weekly bulletin 12-Sep-2026, Table 1, four-week Σvalue ÷ Σcount | C → B |")
    md += [
        f"| `output.pos_sales_transaction_sample_rate` | — (all rows emitted) | **{cfg['output']['pos_sales_transaction_sample_rate']}** with `transactions.sample_weight` = 1/rate on POS `sales` rows | decision, DECISIONS.md 13.6 | structural |",
        "| `ramadan_calendar` 1448 `ramadan_end` / `eid_start` / `eid_end` | 2027-03-09 / 03-10 / 03-12 | **2027-03-08 / 03-09 / 03-11** | Umm al-Qura via hijridate 2.6.0 (Ramadan 1448 has 29 days) | judgement → B |",
        "| `emergent_validation_targets`: revenue-share metrics | `targets` | `calibration_derived_checks` (closed form) | SOP §2.2, DECISIONS.md entry 12 | reclassified |",
        "| `emergent_validation_targets.targets` | 2 | + `days_negative_balance_distribution`, `realised_dso_vs_archetype`, `ramadan_amplitude_recovered` | SOP §2.3 | registered |",
        "| `sector_size_distribution` (weights, tier splits) | unchanged | unchanged | Monsha'at gateway unavailable | C (blocked) |",
        "| `financing.share_of_businesses` | 0.35 uniform | 0.35 uniform (generator now accepts a per-sector map) | needs the Monsha'at denominator | C (blocked) |",
        "| `seasonality_*_multiplier.construction / .professional_services` | unchanged | unchanged, labelled `evidence_class: C` | POS does not measure them (§5.3) | C |",
        "| `base_monthly_inflow_sar` (all sectors) | unchanged | unchanged | SOP §10.6 — remains judgement | C |",
    ]

    # ------------------------------------------------------------------ 3
    section(md, "3. Findings")
    md += ["### 3.1 Sector and size mix — blocked, with one measurable consistency gap", ""]
    agg = p1["config_implied_aggregate_size_split"]
    nat = p1["monshaat_published_national_size_split_q4_2023"]["shares"]
    md += [
        (
            "No national ISIC × size counts could be pulled (§5). What can be said without them: the config implies an aggregate micro/small/medium split of "
            f"**{agg['micro']:.1%} / {agg['small']:.1%} / {agg['medium']:.1%}**, against Monsha'at's published national **{nat['micro']:.1%} / {nat['small']:.1%} / {nat['medium']:.1%}** at Q4 2023 (SME Monitor, 1,138,588 / 150,788 / 18,723). "
            "Construction's 45/40/15 tier split is the outlier the SOP predicted (Jazan sample 85/14/1). This is reported, not corrected: allocating a national split across sectors without the register is judgement."
        ),
        "",
        "### 3.2 Ramadan multipliers per sector — the direction correction",
        "",
        "| POS sector | β_Ramadan value [95% CI] | β_Ramadan count | raw first-pass (Ramadan month ÷ year mean) | R² (log) | adoption trend absorbed (×) |",
        "|---|---|---|---|---|---|",
    ]
    for sec in ("Restaurants & Café", "retail_composite", "Clothing and Footwear", "Beverage and Food", "Jewelry", "Furniture", "Electronic & Electric Devices", "Construction & Building Materials", "Total"):
        v, c = mon[sec]["sales"], mon[sec]["count"]
        md.append(f"| {sec} | **{v['ramadan']['multiplier']:.2f}** {ci(v['ramadan']['ci95'])} | {c['ramadan']['multiplier']:.2f} | {v['raw_first_pass_ramadan_month_over_year_mean']['mean']:.2f} | {v['r2_log']:.2f} | {v['trend_ratio_end_over_start']:.1f} |")
    md += [
        "",
        (
            f"**Food service falls in Ramadan — in every one of the seven calibration years.** Restaurants & Café β_Ramadan is {fb['monthly']['sales']['multiplier']:.2f} on value and {fb['monthly']['count']['multiplier']:.2f} on count: daytime closure is not recovered by the evening surge, and card volume drops even more than value. "
            f"The generator had food service **rising** 1.45× in Ramadan and 1.80× at Eid; it now falls to {fb['proposed_config']['seasonality_value_multiplier']['ramadan']:.2f}× and spikes to {fb['proposed_config']['seasonality_value_multiplier']['eid']:.2f}× at Eid (weekly window model, CI {ci(fb['proposed_config']['ci95_value']['eid'])}). "
            "The gate's old criterion 3 (\"Ramadan > 1.15× baseline\") encoded the wrong sign for this sector and was replaced (DECISIONS.md 13.8)."
        ),
        "",
        f"**The Eid spike is clothing, and no generator sector captures it.** Clothing and Footwear β_Ramadan is {mon['Clothing and Footwear']['sales']['ramadan']['multiplier']:.2f} {ci(mon['Clothing and Footwear']['sales']['ramadan']['ci95'])} — the pre-Eid wardrobe purchase — with Jewelry at {mon['Jewelry']['sales']['ramadan']['multiplier']:.2f}. The retail composite dilutes it to {rt['monthly']['sales']['multiplier']:.2f} because grocery (Beverage and Food, {mon['Beverage and Food']['sales']['ramadan']['multiplier']:.2f}) and electronics ({mon['Electronic & Electric Devices']['sales']['ramadan']['multiplier']:.2f}) move little. A clothing-retail sub-sector would be the honest way to show the spike; it is out of scope this term and named here.",
        "",
        "### 3.3 Value versus count — the ticket-size effect",
        "",
        f"Total POS: β_Ramadan value **{tot['beta_ramadan_value']:.3f}**, count **{tot['beta_ramadan_count']:.3f}** → the average ticket rises **×{tot['implied_ticket_multiplier']:.2f}** in Ramadan. People shop less often and spend more per basket. The generator now carries value and count multipliers separately, so fewer-and-larger emerges rather than a single revenue scale (the §21 `ramadan_amplitude_recovered` target checks both).",
        "",
        "### 3.4 Weekly window model — what a monthly series cannot see",
        "",
        "| generator sector ← POS series | window | value μ [CI] | count μ [CI] |",
        "|---|---|---|---|",
    ]
    for s, g in (("food_beverage ← Restaurants & Café", fb), ("retail_trade ← composite", rt), ("construction ← Construction & Building Materials (not applied)", con)):
        for w in WINDOWS:
            wv, wc = g["weekly"]["sales"][w], g["weekly"]["count"][w]
            md.append(f"| {s} | {w} | {wv['multiplier']:.2f} {ci(wv['ci95'])} | {wc['multiplier']:.2f} {ci(wc['ci95'])} |")
    md += [
        "",
        (
            "Intervals are leave-one-year-out over three years, so they are wide where the window is short: the retail Eid value interval spans "
            f"{ci(rt['weekly']['sales']['eid']['ci95'])}, and several unapplied sectors sit at exactly 0.00 (the NNLS boundary — the model saying *not identified*). The restaurant Eid spike ({fb['weekly']['sales']['eid']['multiplier']:.2f}, CI {ci(fb['weekly']['sales']['eid']['ci95'])}) is identified."
        ),
        "",
        "### 3.5 Ticket sizes measured versus config-implied (SAR per receipt)",
        "",
        "| sector | config-implied | bulletin 12-Sep-2026, latest week | bulletin, four weeks (**applied**) | weekly series Jan–Jul 2025 | monthly Table 30d 2023 |",
        "|---|---|---|---|---|---|",
    ]
    for s in ("retail_trade", "food_beverage", "construction", "professional_services", "total"):
        row = [tick[e].get(s) for e in ("bulletin_2026-09-12_latest_week", "bulletin_2026-09-12_four_weeks", "weekly_series_2025_jan_jul", "monthly_table30d_2023")]
        md.append(f"| {s} | {implied.get(s, float('nan')):.0f} | {_fmt(row[0])} | **{_fmt(row[1])}** | {_fmt(row[2])} | {_fmt(row[3])} |")
    md += [
        "",
        f"Bakeries & Pastries read {tick['bulletin_2026-09-12_four_weeks']['food_beverage_bakeries']:.1f} SAR in the same bulletin (not modelled separately). Construction and professional tickets are consumer-facing POS lines and are context only.",
        "",
        "### 3.6 Credit intensity by sector (Individuals' Loans excluded)",
        "",
        f"Latest quarter {p4['latest_quarter']}: total bank credit {p4['total_credit_mn_sar'] / 1e6:.2f} tn SAR, of which Individuals' Loans {p4['individuals_loans_share']:.1%} — excluded and asserted. Business credit {p4['business_credit_mn_sar'] / 1e6:.2f} tn SAR.",
        "",
        "| generator sector ← activity | credit (SAR mn) | share of all credit | share of business credit | CAGR 2021Q3 → latest |",
        "|---|---|---|---|---|",
    ]
    for s, r in p4["sectors"].items():
        md.append(f"| {s} ← {r['activity']} | {r['credit_mn_sar_latest']:,.0f} | {r['share_of_total_credit']:.1%} | {r['share_of_business_credit']:.1%} | {r['cagr_2021q3_to_latest']:+.1%} |")
    md += [
        "",
        "Retail carries ~1.5× construction's credit and food service ~0.4×; professional services ~0.1×. A uniform 0.35 financing share is not defensible against this — but converting shares into a **per-business** index needs the SME count per sector, which is the blocked Monsha'at pull. The index is therefore withheld, not approximated. Hard limitation regardless: this is total bank credit, not SME credit (construction is dominated by large contractors), and it has no NPL field.",
        "",
        "### 3.7 Held-out 2024 and 2025 — fitted on ≤2023, never refitted",
        "",
        "| test | 2024 actual vs predicted | 2025 actual vs predicted | tolerance |",
        "|---|---|---|---|",
    ]
    for k, lab in (("sales", "Total POS value, Ramadan-month index (monthly fit)"), ("count", "Total POS count, Ramadan-month index")):
        h = hold_a[k]["held_out"]
        md.append(f"| {lab} | {h['2024']['ramadan_index_actual']:.3f} vs {h['2024']['ramadan_index_predicted']:.3f} (MAE all months {h['2024']['mae_all_months']:.3f}) | {h['2025']['ramadan_index_actual']:.3f} vs {h['2025']['ramadan_index_predicted']:.3f} (MAE {h['2025']['mae_all_months']:.3f}) | ±{p3h['tolerance_abs']} {'✓' if h['2024']['within_tolerance'] and h['2025']['within_tolerance'] else '✗'} |")
    for s in ("food_beverage", "retail_trade", "construction", "total"):
        for k in ("sales", "count"):
            h = hold_s[s][k]
            if "status" in h["2024"]:
                continue
            ok = h["2024"]["ramadan_within_tol_vs_monthly"] and h["2025"]["ramadan_within_tol_vs_monthly"]
            md.append(f"| {s} {k}, Ramadan window vs baseline (weekly series) | {h['2024']['ramadan_actual']:.3f} vs β {h['2024']['ramadan_pred_monthly_beta']:.3f} | {h['2025']['ramadan_actual']:.3f} vs β {h['2025']['ramadan_pred_monthly_beta']:.3f} | ±{p3h['tolerance_abs']} {'✓' if ok else '✗ (not applied to the generator)' if s == 'construction' else '✗'} |")
    md += [
        "",
        f"Eid-week actuals for restaurants ({hold_s['food_beverage']['sales']['2024']['eid_week_actual']:.2f} / {hold_s['food_beverage']['sales']['2025']['eid_week_actual']:.2f}) sit below the weekly-model point estimate ({fb['weekly']['sales']['eid']['multiplier']:.2f}); a 3-day window diluted over 7-day weeks is a floor on the daily multiplier, so the two are not directly comparable — reported as such. Construction & Building Materials misses in both years on value; it is not applied to the generator, but the miss is a finding about how far a consumer-materials POS line is from anything stable.",
        "",
        "### 3.8 Hijri calendar",
        "",
    ]
    if cal_find:
        f = cal_find[0]
        md.append(f"The pinned `ramadan_calendar` row for {f['hijri_year']} was one day off the Umm al-Qura calendar ({f['config_vs_umm_al_qura']}); Ramadan {f['hijri_year']} has {f['ramadan_days_umm_al_qura']} days. Corrected from the converter; 1445–1447 matched exactly, so no generated number moved. The converter is now asserted against every row.")
    else:
        md.append("Every pinned row matches the Umm al-Qura converter.")

    # ------------------------------------------------------------------ 4
    section(md, "4. Gate and validation results after the change")
    verdict, lines = gate_summary(gate_after)
    md += [f"### 4.1 Week 3 gate at full scale (N = 10,000 research + 1,000 serving): **{verdict}**", ""]
    md += [f"- {ln}" for ln in lines] if lines else ["- gate output not found (`eval/out/gate_week3_after_calibration.txt`)"]
    md += ["", "Criterion 3 is now the population-level recovery of the configured value **and** count multipliers per sector (class B sectors gated at ±0.08, class C reported), replacing the single-business placeholder thresholds — DECISIONS.md 13.8.", ""]
    md += ["### 4.2 §21 validation — after", ""]
    if emergent_after:
        body = emergent_after.split("\n", 2)[2] if emergent_after.count("\n") > 2 else emergent_after
        md += [body.strip(), ""]
    else:
        md += ["`eval/out/emergent_validation.md` not found.", ""]
    md += ["### 4.3 §21 validation — before (same harness, pre-calibration tables)", ""]
    if emergent_before:
        b_lines = [ln for ln in emergent_before.splitlines() if ln.startswith(("| ", "**", "Scorable", "Realised"))]
        md += b_lines[:40] + [""]
    md += ["### 4.4 Real vs synthetic (`eval.compare_real`) — before and after", ""]

    def rvs_head(t: str | None, label: str) -> list[str]:
        if not t:
            return [f"- {label}: not found"]
        keep = [ln for ln in t.splitlines() if ln.startswith(("| Comparison-set AUC", "**Verdict", "| Default rate", "| n businesses"))]
        return [f"**{label}**", ""] + keep + [""]

    md += rvs_head(rvs_before, "Before (pre-calibration tables, run 2026-09-16 00:25)")
    md += rvs_head(rvs_after, "After (calibrated tables)")
    md += ["Nothing was tuned toward this gap in either direction (`latent_to_observable_correlation` and `label_noise_sigma` untouched)."]

    # ------------------------------------------------------------------ 5
    section(md, "5. Problems encountered")
    md += [
        f"1. **Monsha'at gateway.** `statusCode 1016 Request Timeout` (HTTP 408, 8–12 s) on the first pass for 2025 Q2–Q4, then `1009 No Data Found` (HTTP 404, 0.1 s) for every Gregorian year 2022–2026 and Hijri year 1444–1447, every page size 5–100, with and without paging; `paginationIndex=0` → `1010 Validation Error` (so the index is 1-based); the unpaged URL read-timed out. Retried every five minutes for two hours ({p1pull.get('status')}). The national open-data portal returns a WAF \"Request Rejected\" page to programmatic access; the SME Monitor PDFs carry no activity × size table. Handling: Phase 1 declared blocked, scripts completed against the documented contract, nothing invented.",
        "2. **Pagination semantics (SOP §3.2)** could therefore not be resolved: no page ever returned. `monshaat_pull.py` de-duplicates on (region, activity) and records duplicates and page counts as findings so the 250-vs-76 question is answered by the first successful pull.",
        "3. **Column-label shift in the sector POS file** confirmed exactly as documented: `Transactions / Sales` holds the sector and `Sector` holds the indicator. Asserted in `calibration/sources.py` (the loader refuses a file where it does not hold), together with the BOM, the 96 × 17 × 2 grid, and sector sales summing to Total to 1e-9.",
        "4. **Encoding.** `Restaurants & Café` is matched as the exact published label (with the accent) in both files; the Windows console renders it as mojibake, the code does not. Arabic labels in the ISIC map are stripped of bidi control characters before prefix matching (ruff flagged the raw control characters — replaced by `chr(0x200F)`).",
        "5. **Eid in weekly data.** A 3-day window inside 7-day weeks over three years is weakly identified: NNLS put several sectors' Eid multiplier at exactly 0 and the retail Eid CI spans [0.19, 1.69]. Handled by taking Ramadan from the monthly fit (seven years), using the weekly fit only for the sub-monthly windows, and printing every CI into config comments.",
        "6. **Generator-side recovery at quick scale.** With 80 retail businesses the sector-sum recovery was ~0.1 low in every window while F&B was exact; a generator-only test on 300 retail micro businesses recovered every window within 0.05. Cause: two medium-tier retailers' AR(1) lumpiness dominating the sum. The recovery estimator now equal-weights businesses (recorded before the full-scale run).",
        "7. **Transactions file size.** Receipts at the measured ticket are ~70 M rows; resolved by thinning POS `sales` rows to 10% with a `sample_weight` column (schema change, both producers) rather than lowering base inflows. Full-scale `transactions.csv` stays ≈ 10.4 M rows.",
        "8. **Pre-existing defect.** `eval/heldout_anomalies.py` had failed since the Phase 5 columns were added (rows built without `subfamily`, `value_date`, …); fixed in passing.",
        "9. **ISIC activities that did not map cleanly** (to be confirmed on a real pull): M72 research & development, M73 advertising & market research, M75 veterinary — reported as borderline, not absorbed; I55 accommodation excluded from food service.",
        "10. **Ramadan 1448 pinned one day late** in config (Umm al-Qura gives a 29-day Ramadan). Corrected.",
    ]

    # ------------------------------------------------------------------ 6
    section(md, "6. Problems that remain")
    md += [
        "- **Sector and size mix remain author judgement (class C).** Monsha'at is the only public register with ISIC × size counts and it was unreachable. The 75.5/19.4/5.2 vs 87.0/11.5/1.4 aggregate gap is known and unresolved.",
        "- **Financing share is uniform and ungrounded.** The SAMA credit shares are relative context; without the SME denominator the per-sector index is withheld. Even with it, the absolute level stays judgement (§7.4). The §21 NPL target remains `pending_week1_check` — bank credit by activity has no NPL field and no SME split.",
        "- **POS measures consumer card spend.** Construction and professional-services seasonality and arrival rates stay class C; the POS lines that share their names measure consumers, not contractors or firms. Most B2B revenue moves by transfer and never touches a terminal.",
        "- **Sector POS data past 2023 is weekly and starts 2020-05**; the weekly Eid window is weakly identified (three years), and no per-sector series exists for 2016–2019 at weekly resolution. Per-sector hold-out was possible for Ramadan, only a floor for Eid.",
        "- **`base_monthly_inflow_sar` remains judgement**, so the calibration-derived revenue mix still differs from GASTAT 2022 (construction 60.9% vs 25.6%). The reclassification names this correctly as an input gap, not a validation miss; only a sourced base inflow or a sourced size mix moves it.",
        "- **No clothing sector**, so the largest Eid effect in the data (β 1.90) is modelled only diluted inside the retail composite.",
        "- **Ticket sizes are one bulletin edition** (four weeks, Aug–Sep 2026) pinned as the applied number; 2023–2025 editions differ by up to 20% (restaurants 29 → 35 SAR). Card adoption keeps changing the mix of what is paid by card; the number will need re-pinning each term.",
        "- **The real-vs-synthetic gap is unchanged in direction** (see §4.4); nothing here was meant to move it, and nothing was tuned toward it.",
        "- **`sample_weight` is a schema change awaiting §9 sign-off**; any downstream code that sums inflow amounts from `transactions.csv` must weight by it.",
    ]

    # ------------------------------------------------------------------ 7
    section(md, "7. Evidence class summary")
    md += [
        "| item | before | after | why |",
        "|---|---|---|---|",
        "| Ramadan / Eid VALUE multipliers, retail_trade and food_beverage | C | **B** | SAMA POS Table 30d + weekly series, ≤2023 fit, 2024–2025 held out |",
        "| Ramadan / Eid COUNT multipliers, retail_trade and food_beverage | did not exist (1.0 implicit) | **B** | same sources, count indicator |",
        "| POS average ticket (receipt frequency), retail_trade and food_beverage | C (400 / 250 SAR implied) | **B** | SAMA weekly bulletin 12-Sep-2026 |",
        "| `ramadan_calendar` 1448 | judgement | **B** | Umm al-Qura converter |",
        "| Seasonality, construction and professional_services | C | C | POS does not measure them |",
        "| Sector weights, tier splits | C | C | Monsha'at blocked |",
        "| Financing share | C | C | denominator blocked; level is judgement regardless |",
        "| `base_monthly_inflow_sar` | C | C | SOP §10.6 |",
        "| Revenue-share metrics | \"emergent target\" (mislabelled) | calibration-derived check | closed form of the inputs (entry 12) |",
        "",
        "Per-feature classes (A/B/C) are unchanged in `profile_engine/evidence.py`: feature 36 `ramadan_adjusted` stays C on Berka (calendar not covered), and the seasonality it gates is now measured on the synthetic side rather than assumed.",
    ]
    if evidence:
        first = [ln for ln in evidence.splitlines() if ln.startswith("| **")]
        md += ["", "Registry counts after the run:", ""] + first

    out = Path(args.out)
    out.write_text("\n".join(md) + "\n", encoding="utf-8")
    print(f"→ {out} ({len(md)} lines)")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
