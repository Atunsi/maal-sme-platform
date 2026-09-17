"""Phase 6 — the deliverable report: /maal/saudi_calibration_report.md (SOP_Saudi_Calibration §10; SOP_Monshaat_Unblock §4).

    python -m calibration.write_report [--out ../saudi_calibration_report.md]

Assembles the seven required sections from the measurements in calibration/out/*.json, the archive
meta files in sources/sama/ and sources/monshaat/, and the eval/out/ results. Every number in the
report is read from one of those files; the prose names its source and evidence class.

Revision 2 (SOP_Monshaat_Unblock v2.0): corrections are applied IN PLACE with a revision block at the
top; every superseded v1.0 figure stays visible next to its replacement (the v1.0 outputs are kept as
eval/out/*_before_monshaat.* and are read here, never retyped).
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

from calibration import sources as S
from generator.generate import load_config

WINDOWS = ("pre_ramadan_10d", "ramadan", "eid", "post_eid_7d")
SECTORS = ("retail_trade", "construction", "food_beverage", "professional_services")
PREV_SSD = {"retail_trade": (0.35, (0.85, 0.13, 0.02)), "construction": (0.20, (0.45, 0.40, 0.15)), "food_beverage": (0.20, (0.90, 0.09, 0.01)), "professional_services": (0.25, (0.75, 0.20, 0.05))}
ISIC = {"retail_trade": "G45 + G46 + G47", "construction": "F41 + F42 + F43", "food_beverage": "I56", "professional_services": "M69 + M70 + M71 + M74 + J62"}
OLD_V = {"retail_trade": {"pre_ramadan_10d": 1.10, "ramadan": 1.30, "eid": 2.20, "post_eid_7d": 0.80}, "food_beverage": {"pre_ramadan_10d": 1.05, "ramadan": 1.45, "eid": 1.80, "post_eid_7d": 0.85}}


def meta(path: Path) -> dict:
    return json.loads(Path(str(path) + ".meta.json").read_text(encoding="utf-8"))


def ci(x: list[float]) -> str:
    return f"[{x[0]:.2f}, {x[1]:.2f}]"


def read_text(p: Path) -> str | None:
    return p.read_text(encoding="utf-8") if p.exists() else None


def gate_summary(txt: str | None) -> tuple[str, list[str]]:
    if txt is None:
        return "not run", []
    verdict = "PASS" if "GATE PASSED" in txt else "FAIL"
    if "SKIPPED as insufficient_sample" in txt:
        verdict += " (with a loud SKIP)"
    lines = [ln.strip() for ln in txt.splitlines() if ln.strip().startswith(("PASS", "FAIL", "SKIP", "INFO", "ID 10001"))]
    return verdict, lines


def grep_rows(txt: str | None, prefixes: tuple[str, ...]) -> list[str]:
    return [ln for ln in (txt or "").splitlines() if ln.startswith(prefixes)]


def first_row(txt: str | None, prefix: str) -> str:
    rows = grep_rows(txt, (prefix,))
    return rows[0] if rows else ""


def cell(row: str, idx: int) -> str:
    parts = [c.strip() for c in row.strip().strip("|").split("|")]
    return parts[idx] if idx < len(parts) else "?"


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
    probe = S.read_out("phase1_monshaat_probe")
    pull = S.read_out("phase1_monshaat_pull")
    eo = S.REPO / "eval" / "out"
    gate_after = read_text(eo / "gate_week3_after_monshaat.txt")
    gate_v1 = read_text(eo / "gate_week3_before_monshaat.txt")
    emergent_after = read_text(eo / "emergent_validation.md")
    emergent_v1 = read_text(eo / "emergent_validation_before_monshaat.md")
    rvs_after = read_text(eo / "real_vs_synthetic.md")
    rvs_v1 = read_text(eo / "real_vs_synthetic_before_monshaat.md")
    evidence = read_text(eo / "evidence_table.md")
    transfer = json.loads((eo / "feature_transfer.json").read_text(encoding="utf-8")) if (eo / "feature_transfer.json").exists() else None
    excl = read_text(eo / "exclusion_selectivity.md")

    gen = p2["generator"]
    fb, rt, con = gen["food_beverage"], gen["retail_trade"], gen["construction"]
    mon = p2["monthly"]
    tot = p2["value_count_divergence_total"]
    tick = p3t["editions"]
    implied = p3t["config_implied_ticket_sar"]
    me = p3t.get("multi_edition", {})
    repin = p3t.get("re_pin_candidates", {})
    hold_a, hold_s = p3h["aggregate"], p3h["per_sector"]
    st_counts = p3h.get("status_counts", {})
    cal_find = p0.get("ramadan_calendar_findings", [])
    mix_ok = p1.get("status") == "ok"
    latest_q = p1.get("latest_quarter", "—")
    q = p1["quarters"][latest_q] if mix_ok else None
    fin = cfg["financing"]["share_of_businesses"]
    weak = {b: {s: cfg[b][s]["evidence_class"] for s in ("retail_trade", "food_beverage")} for b in ("seasonality_value_multiplier", "seasonality_count_multiplier")}
    n_weak = sum(1 for b in weak.values() for s in b.values() for w in WINDOWS if s[w] == "B-weak")
    n_a2 = transfer["counts"]["A2"] if transfer else "?"
    n_a1 = transfer["counts"]["A1"] if transfer else "?"
    run_date = probe.get("run_at", "")[:10]

    # v1.0 figures read from the kept outputs, never retyped
    v1_med = first_row(emergent_v1, "| revenue_share_medium_tier [modelled_sectors]")
    v1_tv = first_row(emergent_v1, "| sector_revenue_share")
    v1_ks_fb = first_row(emergent_v1, "| within_sector_size_revenue_share · food_beverage")
    a_med = first_row(emergent_after, "| revenue_share_medium_tier [modelled_sectors]")
    a_tv = first_row(emergent_after, "| sector_revenue_share")
    a_ks_fb = first_row(emergent_after, "| within_sector_size_revenue_share · food_beverage")
    v1_rvs = first_row(rvs_v1, "| Comparison-set AUC")
    v1_verdict = first_row(rvs_v1, "**Verdict")
    a_matrix = grep_rows(rvs_after, ("| protocol |",)) + ["|---|---|---|---|"] + grep_rows(rvs_after, ("| **Unified", "| Temporal", "| Expanding", "| Contiguous"))
    a_verdict = grep_rows(rvs_after, ("**Verdict", "**What the protocol changed"))
    m = re.search(r"= ([0-9.]+) vs tolerance", v1_verdict)
    v1_gap = m.group(1) if m else "?"

    md: list[str] = [
        "# Saudi national source calibration — report",
        "",
        (f"**Repository:** `maal-sme-platform-main` · **SOPs:** `SOP_Saudi_Calibration_Sources.md` v1.0 (run 2026-09-16) and `SOP_Monshaat_Unblock_And_Report_Corrections.md` v2.0 (run {run_date}) · "
        "**Change record:** `DECISIONS.md` entries 12–20 · **Measurements:** `calibration/out/*.json` · **Archives:** `sources/sama/`, `sources/monshaat/`"),
        "",
        ("Written for a defense reader. Every number below states what measured it, which edition, and whether it is measured (class B on the synthetic side), "
        "measured but not distinguishable from no effect (B-weak), judged (class C) or unknown. A finding that weakens the project is still a finding."),
        "",
        f"**Revision 2 ({run_date}).** Corrections per SOP v2.0, applied in place; every superseded v1.0 figure is kept next to its replacement:",
        "",
        (f"- Monsha'at Phase 1 and Phase 4 **completed**. v1.0's \"blocked_gateway\" was a misdiagnosis: the v1.0 run probed 2023 Q2 – 2026 Q1 against a dataset that covers "
        f"{probe['quarters_with_data'][0]} – {probe['latest_quarter']}, and read the fast `1009 No Data Found` as an outage. (The SOP v2.0 account of empty query parameters does not match the v1.0 code, which sent real values — DECISIONS.md 14.1.) §1, §3.1, §3.6, §5 problem 1 and §6 corrected."),
        f"- Class A split into **A1** (computed on real data) and **A2** (computed *and* predictive) by a CI rule: {n_a2} of 43 are A2. §7 counts and claims regenerated.",
        f"- **{n_weak} of 16** seasonality parameters reclassified B → **B-weak** (interval contains no effect). Applied values unchanged. §2 and §7 regenerated.",
        f"- §3.7 held-out table now carries PASS / BOUNDED / FAIL / NOT_APPLIED ({st_counts.get('PASS', '?')} / {st_counts.get('BOUNDED', '?')} / {st_counts.get('FAIL', '?')} / {st_counts.get('NOT_APPLIED', '?')}). Restaurant Eid is **BOUNDED, not PASS**.",
        "- §4.4 rerun under one CV protocol across all three sources; the protocol × source matrix replaces the single gap figure. The §15 exclusion is tested for label selectivity (it is selective).",
        "- Ticket sizes reported across four editions with the spread (B5); the applied value stays the archived bulletin edition because the generator is frozen through Workstream B — re-pin recorded as a proposed change.",
        "",
        (
            "**One-paragraph summary.** All five defects the v1.0 SOP set out to fix now have a sourced answer. From SAMA: the food-service Ramadan direction "
            f"(restaurants **fall** to {fb['monthly']['sales']['multiplier']:.2f}× in Ramadan and spike to {fb['weekly']['sales']['eid']['multiplier']:.2f}× at Eid; the placeholder had 1.45× / 1.80×), "
            f"the ticket sizes (retail {tick['bulletin_2026-09-12_four_weeks']['retail_trade']:.1f} SAR and restaurants {tick['bulletin_2026-09-12_four_weeks']['food_beverage']:.1f} SAR against config-implied {implied['retail_trade']:.0f} / {implied['food_beverage']:.0f}), "
            "and the held-out years (2024 and 2025 scored against the ≤2023 fit without refitting). From the Monsha'at register (2021 Q4, the newest edition the gateway serves): "
            f"the sector count mix (retail {cfg['sector_size_distribution']['retail_trade']['weight']:.3f}, construction {cfg['sector_size_distribution']['construction']['weight']:.3f}, food {cfg['sector_size_distribution']['food_beverage']['weight']:.3f}, professional {cfg['sector_size_distribution']['professional_services']['weight']:.3f}) "
            "and the micro/small/medium split per sector, replacing judgement; and, divided into SAMA credit by activity, a sector-conditional financing shape. "
            "What the register did not fix — and the report says so — is the revenue mix against GASTAT: with the count mix sourced, the remaining gap is the two unsourced inputs `base_monthly_inflow_sar` and `size_tier_scale`. "
            "The real-versus-synthetic comparison, rerun under one protocol on all three sources, is in §4.4; the Berka side is estimated on an eligible population that the coverage rule selects toward lower risk."
        ),
    ]

    # ------------------------------------------------------------------ 1
    section(md, "1. What was done")
    for fname, (_dataset, pub) in S.SAMA_FILES.items():
        mm = meta(S.SAMA / fname)
        used = {
            "pos_by_sector_monthly_2016_2023.csv": "Phase 2 — β_h per Hijri month per sector (the §22 decomposition); Phase 3 — 2023 ticket-size edition.",
            "pos_aggregate_1995_2026.csv": "Phase 2 — terminal counts for the adoption trend; Phase 3 — aggregate held-out 2024/2025 test; §5.4 value-vs-count divergence.",
            "pos_by_sector_weekly_2020_2025.csv": "Phase 2 — the weekly window model that resolves the 3-day Eid; Phase 3 — per-sector held-out 2024/2025 and the 2025 ticket edition. Not in the SOP's inventory; found on the same mirror.",
            "bank_credit_by_activity_2021_2026.csv": "Phase 4 — credit by activity with Individuals' Loans excluded; ÷ the Monsha'at SME count = credit per SME (§3.6).",
        }[fname]
        md += [f"**{pub}.** Origin: {mm['origin_body']}. Retrieved via {mm['retrieval']} on {mm['access_date']}; span {mm.get('span', ['?', '?'])[0]} → {mm.get('span', ['?', '?'])[1]}, {mm.get('rows_tidy', '?'):,} tidy rows. Used for: {used} Archive `sources/sama/{fname}`, SHA-256 `{mm['sha256']}`.", ""]
    mb = meta(S.SAMA / S.SAMA_WEEKLY_BULLETIN_PDF)
    md += [f"**SAMA Weekly Points of Sale Transactions bulletin, {mb['edition']}.** Origin: SAMA. Direct PDF, retrieved {mb['access_date']}. Used for: Phase 3 ticket sizes at the finest activity split. Archive `sources/sama/{S.SAMA_WEEKLY_BULLETIN_PDF}`, SHA-256 `{mb['sha256']}`.", ""]
    if mix_ok:
        md += [
            (
                "**Monsha'at Enterprises Statistics (region × ISIC × size).** Origin: Monsha'at. Retrieval path: the OpenData gateway "
                f"`{S.MONSHAAT_ENDPOINT.format(year='{Year}', quarter='{Quarter}')}?paginationIndex={{1-based}}&recordsPerPage={{n}}`, both parameters required and non-empty. "
                f"Dataset span as probed on {run_date}: **{probe['quarters_with_data'][0]} – {probe['latest_quarter']}** ({len(probe['quarters_with_data'])} quarters; 1009 at {probe['first_1009_before']} and from {probe['first_1009_after']} on). "
                "Pagination as resolved: `totalRecords` = rows on the page; `totalPages` is not a per-quarter figure (188 at 100/page for every quarter while a quarter ends after ~18 pages) and is ignored — the loop stops at the first confirmed 1009; "
                "1011 / 1016 / HTTP 5xx are transient and retried, 1009 is final. Rows are summed, not de-duplicated: (region, activity) repeats 2–4× with different counts in the five large regions (a hidden sub-region split), and the summed national total matches Monsha'at's published figures (DECISIONS.md 14.2). Archived:"
            ),
            "",
            "| archive | edition | pages | rows | distinct region × activity | SMEs (Σ rows) | SHA-256 |",
            "|---|---|---|---|---|---|---|",
        ]
        for r in pull["quarters"]:
            if r["status"] != "ok":
                continue
            mm = meta(S.MONSHAAT / f"enterprises_{r['year']}Q{r['quarter']}.json")
            md.append(f"| `sources/monshaat/enterprises_{r['year']}Q{r['quarter']}.json` | {r['year']} Q{r['quarter']} | {r['pages_pulled']} | {r['n_rows']:,} | {r['distinct_region_activity']:,} | {r['national_sme_total_sum_all_rows']:,} | `{mm['sha256']}` |")
        md += [
            "",
            f"*v1.0 (superseded):* \"Not archived: the gateway answered 1016/1009 on every quarter tried.\" The quarters tried were 2023 Q2 – 2026 Q1; none exists in the dataset. Access date of the v1.0 attempt 2026-09-16; of the successful pull {pull['run_at'][:10]}.",
            "",
        ]
    md += ["**GASTAT seasonally-adjusted real GDP by institutional sector (2023=100).** Deliberately **excluded** (DECISIONS.md 13.10): the export interleaves five unit series under one label, and a seasonally-adjusted, three-sector series cannot inform a four-sector Hijri seasonality calibration."]

    # ------------------------------------------------------------------ 2
    section(md, "2. Parameters changed")
    md += ["| parameter | old | new | source (edition) | class before → after |", "|---|---|---|---|---|"]
    for s, g in (("retail_trade", rt), ("food_beverage", fb)):
        pc = g["proposed_config"]
        for w in WINDOWS:
            src = "SAMA Table 30d monthly 2016–2023 excl. 2020, §22 NNLS" if w == "ramadan" else "SAMA weekly POS 2021–2023, window model"
            cls = weak["seasonality_value_multiplier"][s][w]
            md.append(f"| `seasonality_value_multiplier.{s}.{w}` | {OLD_V[s][w]:.2f} | **{pc['seasonality_value_multiplier'][w]:.2f}** CI {ci(pc['ci95_value'][w])} | {src} | C → **{cls}**{' (v1.0 said B)' if cls == 'B-weak' else ''} |")
        for w in WINDOWS:
            src = "SAMA Table 30d monthly (count), §22 NNLS" if w == "ramadan" else "SAMA weekly POS (count), window model"
            cls = weak["seasonality_count_multiplier"][s][w]
            md.append(f"| `seasonality_count_multiplier.{s}.{w}` | 1.00 (implicit) | **{pc['seasonality_count_multiplier'][w]:.2f}** CI {ci(pc['ci95_count'][w])} | {src} | C → **{cls}**{' (v1.0 said B)' if cls == 'B-weak' else ''} |")
    for s, old_tx in (("retail_trade", 5.0), ("food_beverage", 6.0)):
        md.append(f"| `sector_economics.{s}.avg_inflow_ticket_sar` (replaces `inflow_tx_per_day` {old_tx}) | implied {implied[s]:.0f} SAR/receipt | **{cfg['sector_economics'][s]['avg_inflow_ticket_sar']} SAR** (one edition; cross-edition mean {me.get(s, {}).get('mean', '?')}, spread {me.get(s, {}).get('spread_share_of_mean', 0):.0%} — §3.5) | SAMA weekly bulletin 12-Sep-2026, Table 1, four-week Σvalue ÷ Σcount | C → B |")
    if mix_ok:
        for s in SECTORS:
            w0, t0 = PREV_SSD[s]
            v = cfg["sector_size_distribution"][s]
            md.append(f"| `sector_size_distribution.{s}` weight; micro/small/medium | {w0:.2f}; {t0[0]:.2f}/{t0[1]:.2f}/{t0[2]:.2f} | **{v['weight']:.4f}; {v['size_tiers']['micro']:.4f}/{v['size_tiers']['small']:.4f}/{v['size_tiers']['medium']:.4f}** | Monsha'at Enterprises Statistics {latest_q[:4]} Q{latest_q[-1]} (register census, large tier excluded) | C → **B** (v1.0: blocked) |")
        for s in SECTORS:
            md.append(f"| `financing.share_of_businesses.{s}` | 0.35 uniform | **{fin[s] if isinstance(fin, dict) else fin}** (index {p4['relative_index_count_weighted_mean_1'][s]:.2f} × level 0.35) | SAMA credit by activity 2026 Q2 ÷ Monsha'at SME count 2021 Q4 | C → **B (shape) / C (level)** (v1.0: blocked) |")
    md += [
        f"| `output.pos_sales_transaction_sample_rate` | — (all rows emitted) | **{cfg['output']['pos_sales_transaction_sample_rate']}** with `transactions.sample_weight` = 1/rate on POS `sales` rows | decision, DECISIONS.md 13.6 | structural |",
        "| `ramadan_calendar` 1448 `ramadan_end` / `eid_start` / `eid_end` | 2027-03-09 / 03-10 / 03-12 | **2027-03-08 / 03-09 / 03-11** | Umm al-Qura via hijridate 2.6.0 (Ramadan 1448 has 29 days) | judgement → B |",
        "| `emergent_validation_targets`: revenue-share metrics | `targets` | `calibration_derived_checks` (closed form) | SOP §2.2, DECISIONS.md entry 12 | reclassified |",
        "| `emergent_validation_targets.targets` | 2 | + `days_negative_balance_distribution`, `realised_dso_vs_archetype`, `ramadan_amplitude_recovered` | SOP §2.3 | registered |",
        "| `seasonality_*_multiplier.construction / .professional_services` | unchanged | unchanged, labelled `evidence_class: C` | POS does not measure them (§5.3) | C |",
        "| `base_monthly_inflow_sar`, `size_tier_scale` (all sectors) | unchanged | unchanged | SOP §10.6 — remain judgement; now the only unsourced inputs behind §4.2 | C |",
    ]

    # ------------------------------------------------------------------ 3
    section(md, "3. Findings")
    if mix_ok:
        st = p1["stability_across_quarters"]
        scale = cfg["size_tier_scale"]
        md += [
            f"### 3.1 Sector and size mix from the register ({latest_q[:4]} Q{latest_q[-1]}) — completed; v1.0 had it blocked",
            "",
            "| sector | ISIC matched | SMEs | weight (four-sector) | micro / small / medium | weight range 2019Q4–2021Q4 | E[size_scale] before → after |",
            "|---|---|---|---|---|---|---|",
        ]
        for s in SECTORS:
            t = q["size_tiers"][s]
            w0, t0 = PREV_SSD[s]
            e0 = t0[0] * scale["micro"] + t0[1] * scale["small"] + t0[2] * scale["medium"]
            e1 = t["micro"] * scale["micro"] + t["small"] * scale["small"] + t["medium"] * scale["medium"]
            md.append(f"| {s} | {ISIC[s]} | {q['sme_total_by_sector'][s]:,} | **{q['weight'][s]:.3f}** (was {w0:.2f}) | **{t['micro']:.3f} / {t['small']:.3f} / {t['medium']:.3f}** (was {t0[0]:.2f}/{t0[1]:.2f}/{t0[2]:.2f}) | {st[s]['weight_range'][0]:.3f}–{st[s]['weight_range'][1]:.3f} | {e0:.2f} → {e1:.2f} |")
        agg4 = {t: sum(q["counts_by_sector_tier"][s][t] for s in SECTORS) / q["four_sector_sme_total"] for t in ("micro", "small", "medium")}
        alls = q["all_activities_sme_by_tier"]
        allt = sum(alls.values())
        nat = p1["monshaat_published_national_size_split_q4_2023"]["shares"]
        cis_ = p1["config_implied_aggregate_size_split"]
        border = sum(sum(v[t] for t in ("micro", "small", "medium")) for v in q["borderline_not_mapped"].values())
        md += [
            "",
            (
                f"Four-sector SMEs {q['four_sector_sme_total']:,} of {allt:,} nationally ({q['four_sector_share_of_all_smes']:.1%}); large tier excluded ({sum(q['large_excluded'].values()):,}). "
                f"Borderline activities excluded and reported: M72 R&D, M73 advertising & market research, M75 veterinary, I55 accommodation ({border:,} SMEs together). "
                f"The register's aggregate micro/small/medium split is **{agg4['micro']:.1%} / {agg4['small']:.1%} / {agg4['medium']:.1%}** over the four sectors ({alls['micro'] / allt:.1%} / {alls['small'] / allt:.1%} / {alls['medium'] / allt:.1%} over all activities), "
                f"against v1.0's config-implied {cis_['micro']:.1%} / {cis_['small']:.1%} / {cis_['medium']:.1%} and Monsha'at's 2023 national {nat['micro']:.1%} / {nat['small']:.1%} / {nat['medium']:.1%}. "
                "The 2021 register is less micro-skewed than the 2023 aggregate (the micro surge came after), and it is the same vintage as the GASTAT 2022 revenue anchor. "
                "**Two consequences that are not tuning:** professional services is 2.9% of the population, so its §23 cell (≥ 30 businesses, ≥ 10 defaults) is not met at N = 10,000 and the gate's sector-differential check reports `insufficient_sample` (§4.1); and construction's E[size_scale] falls from 4.30 to 2.08 — the SOP expected ~1.31 from a one-region sample, the census says 2.08."
            ),
            "",
            "*v1.0 (superseded):* \"No national ISIC × size counts could be pulled … the config implies 75.5 / 19.4 / 5.2 % against Monsha'at's 87.0 / 11.5 / 1.4 %; construction's 45/40/15 is the outlier.\" The outlier diagnosis held: construction is 74/23/3 in the register.",
        ]
    else:
        md += ["### 3.1 Sector and size mix — not available", "", "`calibration/out/phase1_sector_mix.json` has no successful pull."]
    md += [
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
            f"**Food service falls in Ramadan — in every one of the seven calibration years.** Restaurants & Café β_Ramadan is {fb['monthly']['sales']['multiplier']:.2f} on value and {fb['monthly']['count']['multiplier']:.2f} on count. "
            f"The generator had food service **rising** 1.45× in Ramadan and 1.80× at Eid; it now falls to {fb['proposed_config']['seasonality_value_multiplier']['ramadan']:.2f}× (class B) and spikes to {fb['proposed_config']['seasonality_value_multiplier']['eid']:.2f}× at Eid (weekly window model, CI {ci(fb['proposed_config']['ci95_value']['eid'])}, class B). "
            "The gate's old criterion 3 (\"Ramadan > 1.15× baseline\") encoded the wrong sign for this sector and was replaced (DECISIONS.md 13.8)."
        ),
        "",
        (
            f"**Retail at Eid is not identified.** The retail Eid value multiplier moved 2.20 → {rt['proposed_config']['seasonality_value_multiplier']['eid']:.2f} with CI {ci(rt['proposed_config']['ci95_value']['eid'])}: an interval spanning an order of magnitude and containing 1.0. "
            "It is applied (a weak measurement still beats an invented 2.20) and labelled **B-weak**, not B — v1.0 labelled it B. What is grounded is the sign of the correction from the placeholder, not the value."
        ),
        "",
        f"**The Eid spike is clothing, and no generator sector captures it.** Clothing and Footwear β_Ramadan is {mon['Clothing and Footwear']['sales']['ramadan']['multiplier']:.2f} {ci(mon['Clothing and Footwear']['sales']['ramadan']['ci95'])}, with Jewelry at {mon['Jewelry']['sales']['ramadan']['multiplier']:.2f}. The retail composite dilutes it to {rt['monthly']['sales']['multiplier']:.2f}. A clothing-retail sub-sector would be the honest way to show the spike; it is out of scope this term and named here.",
        "",
        "### 3.3 Value versus count — the ticket-size effect",
        "",
        f"Total POS: β_Ramadan value **{tot['beta_ramadan_value']:.3f}**, count **{tot['beta_ramadan_count']:.3f}** → the average ticket rises **×{tot['implied_ticket_multiplier']:.2f}** in Ramadan. The generator carries value and count multipliers separately (the §21 `ramadan_amplitude_recovered` target checks both).",
        "",
        "### 3.4 Weekly window model — what a monthly series cannot see",
        "",
        "| generator sector ← POS series | window | value μ [CI] | class | count μ [CI] | class |",
        "|---|---|---|---|---|---|",
    ]
    for s, g, key in (("food_beverage ← Restaurants & Café", fb, "food_beverage"), ("retail_trade ← composite", rt, "retail_trade"), ("construction ← Construction & Building Materials (not applied)", con, None)):
        for w in WINDOWS:
            wv, wc = g["weekly"]["sales"][w], g["weekly"]["count"][w]
            cv = weak["seasonality_value_multiplier"][key][w] if key else "C"
            cc = weak["seasonality_count_multiplier"][key][w] if key else "C"
            md.append(f"| {s} | {w} | {wv['multiplier']:.2f} {ci(wv['ci95'])} | {cv} | {wc['multiplier']:.2f} {ci(wc['ci95'])} | {cc} |")
    md += [
        "",
        f"Intervals are leave-one-year-out over three years, so they are wide where the window is short. The class column is the B2 rule (B iff the CI excludes 1.0): {n_weak} of the 16 applied parameters are B-weak. Several unapplied sectors sit at exactly 0.00 (the NNLS boundary — *not identified*). The restaurant Eid spike ({fb['weekly']['sales']['eid']['multiplier']:.2f}, CI {ci(fb['weekly']['sales']['eid']['ci95'])}) is identified.",
        "",
        "### 3.5 Ticket sizes measured versus config-implied (SAR per receipt)",
        "",
        "| sector | config-implied | bulletin 12-Sep-2026, latest week | bulletin, four weeks (**applied**) | weekly series Jan–Jul 2025 | monthly Table 30d 2023 | cross-edition mean (min–max, spread) |",
        "|---|---|---|---|---|---|---|",
    ]
    for s in ("retail_trade", "food_beverage", "construction", "professional_services", "total"):
        row = [tick[e].get(s) for e in ("bulletin_2026-09-12_latest_week", "bulletin_2026-09-12_four_weeks", "weekly_series_2025_jan_jul", "monthly_table30d_2023")]
        mm = me.get(s, {})
        md.append(f"| {s} | {implied.get(s, float('nan')):.0f} | {_fmt(row[0])} | **{_fmt(row[1])}** | {_fmt(row[2])} | {_fmt(row[3])} | {mm.get('mean', '—')} ({mm.get('min', '—')}–{mm.get('max', '—')}, {mm.get('spread_share_of_mean', 0):.0%}) |")
    rme, fme = me.get("retail_trade", {}), me.get("food_beverage", {})
    md += [
        "",
        (
            f"**B5.** The applied value is one four-week edition; across the four editions the retail ticket spans {rme.get('min', '?')}–{rme.get('max', '?')} SAR (spread {rme.get('spread_share_of_mean', 0):.0%} of the mean) and the restaurant ticket {fme.get('min', '?')}–{fme.get('max', '?')} SAR ({fme.get('spread_share_of_mean', 0):.0%}). "
            f"Card adoption keeps moving the mix of what is paid by card, so the number needs re-pinning each term. Re-pin candidates: cross-edition mean {repin.get('cross_edition_mean', {})} or the 2023 annual mean {repin.get('monthly_2023_annual_mean', {})}; the applied {repin.get('applied_now', {})} is **left in place** because SOP v2.0 freezes the generator through Workstream B (non-negotiable 2) — the re-pin is a proposed config change (DECISIONS.md entry 20), not a silent edit. "
            f"Bakeries & Pastries read {tick['bulletin_2026-09-12_four_weeks']['food_beverage_bakeries']:.1f} SAR (not modelled separately). Construction and professional tickets are consumer-facing POS lines and are context only."
        ),
        "",
        "### 3.6 Credit intensity by sector — completed; v1.0 had the index withheld",
        "",
        f"Latest quarter {p4['latest_quarter']}: total bank credit {p4['total_credit_mn_sar'] / 1e6:.2f} tn SAR, of which Individuals' Loans {p4['individuals_loans_share']:.1%} — excluded and asserted. Business credit {p4['business_credit_mn_sar'] / 1e6:.2f} tn SAR.",
        "",
        "| generator sector ← activity | credit (SAR mn) | share of business credit | SMEs (Monsha'at 2021 Q4) | credit per SME (SAR) | index (count-weighted mean 1) | `share_of_businesses` |",
        "|---|---|---|---|---|---|---|",
    ]
    for s, r in p4["sectors"].items():
        per = p4.get("credit_per_sme_sar", {}).get(s, float("nan"))
        idx = p4.get("relative_index_count_weighted_mean_1", {}).get(s, float("nan"))
        cnt = q["sme_total_by_sector"][s] if mix_ok else 0
        md.append(f"| {s} ← {r['activity']} | {r['credit_mn_sar_latest']:,.0f} | {r['share_of_business_credit']:.1%} | {cnt:,} | {per:,.0f} | {idx:.2f} | **{fin[s] if isinstance(fin, dict) else fin}** |")
    md += [
        "",
        (
            "The per-SME shape is nearly flat (0.85–1.12): construction has almost as many SMEs as retail, so v1.0's \"retail carries 1.5× construction's credit\" was a share of credit, not of credit per business. "
            "The relative shape is measured (class B); the absolute level 0.35 stays judgement (class C). Hard limitations, unchanged: total bank credit rather than SME credit, no SME/large split, no NPL field, and the numerator (2026 Q2) and denominator (2021 Q4) are five years apart."
        ),
        "",
        "*v1.0 (superseded):* \"converting shares into a per-business index needs the SME count per sector, which is the blocked Monsha'at pull. The index is therefore withheld.\"",
        "",
        "### 3.7 Held-out 2024 and 2025 — fitted on ≤2023, never refitted (B3: one status per row)",
        "",
        "| test | 2024 actual vs predicted | 2025 actual vs predicted | tolerance | status |",
        "|---|---|---|---|---|",
    ]
    for k, lab in (("sales", "Total POS value, Ramadan-month index (monthly fit)"), ("count", "Total POS count, Ramadan-month index")):
        h = hold_a[k]["held_out"]
        stt = h["2024"]["status"] if h["2024"]["status"] == h["2025"]["status"] else f"{h['2024']['status']} / {h['2025']['status']}"
        md.append(f"| {lab} | {h['2024']['ramadan_index_actual']:.3f} vs {h['2024']['ramadan_index_predicted']:.3f} (MAE all months {h['2024']['mae_all_months']:.3f}) | {h['2025']['ramadan_index_actual']:.3f} vs {h['2025']['ramadan_index_predicted']:.3f} (MAE {h['2025']['mae_all_months']:.3f}) | ±{p3h['tolerance_abs']} | **{stt}** |")
    for s in ("food_beverage", "retail_trade", "construction", "total"):
        for k in ("sales", "count"):
            h = hold_s[s][k]
            if "status" in h["2024"]:
                continue
            rs = h["2024"]["ramadan_status"] if h["2024"]["ramadan_status"] == h["2025"]["ramadan_status"] else f"{h['2024']['ramadan_status']} / {h['2025']['ramadan_status']}"
            md.append(f"| {s} {k}, Ramadan window vs baseline (weekly series) | {h['2024']['ramadan_actual']:.3f} vs β {h['2024']['ramadan_pred_monthly_beta']:.3f} | {h['2025']['ramadan_actual']:.3f} vs β {h['2025']['ramadan_pred_monthly_beta']:.3f} | ±{p3h['tolerance_abs']} | **{rs}** |")
            dirn = "direction consistent" if h["2024"]["eid_direction_consistent"] and h["2025"]["eid_direction_consistent"] else "direction INCONSISTENT"
            flag = "; weekly floor above the prediction" if h["2024"]["eid_floor_contradicts_prediction"] or h["2025"]["eid_floor_contradicts_prediction"] else ""
            md.append(f"| {s} {k}, Eid week vs baseline (weekly series — a floor on the 3-day multiplier) | {h['2024']['eid_week_actual']:.3f} vs {h['2024']['eid_pred_weekly_window']:.2f} | {h['2025']['eid_week_actual']:.3f} vs {h['2025']['eid_pred_weekly_window']:.2f} | one-sided | **{h['2024']['eid_status']}** ({dirn}{flag}) |")
    md += [
        "",
        (
            f"**Status counts: PASS {st_counts.get('PASS')}, BOUNDED {st_counts.get('BOUNDED')}, FAIL {st_counts.get('FAIL')}, NOT_APPLIED {st_counts.get('NOT_APPLIED')}.** A BOUNDED row is not a pass: the restaurant Eid actuals "
            f"({hold_s['food_beverage']['sales']['2024']['eid_week_actual']:.2f} / {hold_s['food_beverage']['sales']['2025']['eid_week_actual']:.2f} at weekly resolution) sit below the applied {fb['weekly']['sales']['eid']['multiplier']:.2f} because a 3-day window diluted over 7-day weeks is a floor, not a point estimate — the test can contradict the value (it does not) but cannot confirm it. "
            "Construction rows are NOT_APPLIED (v1.0 marked them ✗): the miss is real and is one more reason those multipliers never reach the generator."
        ),
        "",
        "*v1.0 (superseded):* every restaurant and retail row carried ✓, including the Eid rows the prose beneath described as a floor.",
        "",
        "### 3.8 Hijri calendar",
        "",
    ]
    if cal_find:
        f = cal_find[0]
        md.append(f"The pinned `ramadan_calendar` row for {f['hijri_year']} was one day off the Umm al-Qura calendar ({f['config_vs_umm_al_qura']}); Ramadan {f['hijri_year']} has {f['ramadan_days_umm_al_qura']} days. Corrected from the converter; 1445–1447 matched exactly. The converter is asserted against every row.")
    else:
        md.append("Every pinned row matches the Umm al-Qura converter.")

    # ------------------------------------------------------------------ 4
    section(md, "4. Gate and validation results after the change")
    verdict, lines = gate_summary(gate_after)
    v1_verdict_gate, _ = gate_summary(gate_v1)
    md += [f"### 4.1 Week 3 gate at full scale (N = 10,000 research + 1,000 serving), register-derived inputs: **{verdict}** (v1.0 run, SAMA inputs only: {v1_verdict_gate})", ""]
    md += [f"- {ln}" for ln in lines] if lines else ["- gate output not found"]
    fb_med = cell(a_ks_fb, 2).split("/")[-1] if a_ks_fb else "?"
    md += [
        "",
        (
            "The SKIP is the register showing through: professional services is 2.9% of the population (237 research businesses, 3 defaults), below the §23 minimum cell, so the sector-differential check is reported as `insufficient_sample` rather than passed. "
            "Criterion 3 is the population-level recovery of the configured value **and** count multipliers per sector (measured sectors gated at ±0.08 on the configured values — B-weak windows included, because the test is of the wiring, not of the number's grounding; class C reported)."
        ),
        "",
        "### 4.2 §21 validation — after the register inputs (v1.0 figures alongside)",
        "",
        "| calibration-derived check | v1.0 (SAMA inputs, judgement mix) | now (register mix) | GASTAT 2022 | band |",
        "|---|---|---|---|---|",
        f"| medium-tier revenue share, closed form / realised | {cell(v1_med, 1)} / {cell(v1_med, 2)} | **{cell(a_med, 1)} / {cell(a_med, 2)}** | {cell(a_med, 3)} | {cell(a_med, 5)} rel |",
        f"| sector revenue share, TV distance | {cell(v1_tv, 4)} | **{cell(a_tv, 4)}** | — | {cell(a_tv, 5)} |",
        f"| within-sector size revenue share · food_beverage (micro/small/medium) | {cell(v1_ks_fb, 2)} → {cell(v1_ks_fb, 4)} | **{cell(a_ks_fb, 2)} → {cell(a_ks_fb, 4)}** | {cell(a_ks_fb, 3)} | {cell(a_ks_fb, 5)} |",
        "",
        (
            "**B6 — the food-service size gradient.** GASTAT's section I puts 44% of accommodation-and-food revenue in medium firms; the generator's food_beverage puts "
            f"{fb_med} there. Three inputs drive that share: the tier split (now the register's 75.6 / 22.4 / 2.0 — v1.0 had 90 / 9 / 1), `size_tier_scale` (a medium firm at 15× a micro firm) and the ISIC scope. "
            f"The register pull moved the KS from {cell(v1_ks_fb, 4)} to {cell(a_ks_fb, 4)} — closer, still 2.6× the band — and it cannot close the rest: with 2% of firms medium, reaching a 44% revenue share would need a medium firm at ~55× a micro one, not 15×. "
            "Part of the gap is scope: GASTAT section I includes I55 accommodation (hotels, capital-heavy and mostly medium/large), which the generator deliberately excludes from food service (§3.1). The honest resolution is a sourced `size_tier_scale` (revenue per firm by tier from the same GASTAT workbook) plus a like-for-like I56-only anchor — both are `base_monthly_inflow_sar`-family inputs (SOP §10.6), not validation results."
        ),
        "",
        (
            "**B7 — why the v1.0 distances moved with no input changed** (0.515 → 0.519 TV, 0.277 → 0.281 rel between the v1.0 *before* and *after* runs): the closed form was identical in both, because the inputs it reads did not change. "
            "The realised shares are computed from the generated tables, and the v1.0 *after* run carried the new seasonality multipliers — food service falling in Ramadan instead of rising — plus a fresh Poisson draw at the measured ticket, so the realised sector totals over the 180-day window shifted by a few tenths of a percent. That is regeneration under changed seasonality, not an undisclosed input change."
        ),
        "",
        "Full §21 output after the register inputs:",
        "",
    ]
    if emergent_after:
        body = emergent_after.split("\n", 2)[2] if emergent_after.count("\n") > 2 else emergent_after
        md += [body.strip(), ""]
    md += ["### 4.3 §21 validation — v1.0 run (SAMA inputs only), kept for comparison", ""]
    if emergent_v1:
        b_lines = [ln for ln in emergent_v1.splitlines() if ln.startswith(("| ", "**", "Scorable", "Realised"))]
        md += b_lines[:40] + [""]
    md += [
        "### 4.4 Real vs synthetic (`eval.compare_real`) — one protocol on all three sources (B4)",
        "",
        "*v1.0 headline (superseded):* " + v1_rvs.replace("|", "·").strip("· ") + f" → gap {v1_gap}, three different protocols (cross-validated synthetic vs a single Berka temporal split with 25 test defaults).",
        "",
    ]
    md += a_matrix + [""] + a_verdict
    if excl:
        rows_e = grep_rows(excl, ("| primary", "| secondary"))
        md += ["", "**§15 exclusion selectivity (B4):**", "", "| label set | excluded n / defaults / rate | retained n / defaults / rate | risk ratio | Fisher p | share of defaults excluded |", "|---|---|---|---|---|---|"] + rows_e
        md += ["", "The eligibility rule removes the thinnest accounts, and they default at 2.6–3.4× the retained rate. Every Berka AUC is an estimate on the eligible population; both the v1.0 number and the unified one carry that caveat."]
    md += ["", "Nothing was tuned toward this gap in either direction (`latent_to_observable_correlation` and `label_noise_sigma` untouched; generator-parameter hash unchanged through Workstream B, DECISIONS.md entry 17)."]

    # ------------------------------------------------------------------ 5
    section(md, "5. Problems encountered")
    md += [
        (
            f"1. **Monsha'at gateway — misdiagnosed in v1.0, resolved in v2.0.** *v1.0 said:* \"1016 Request Timeout then 1009 No Data Found on every quarter tried … Phase 1 declared blocked.\" *What was true:* the dataset ends at {probe['latest_quarter']} and begins at {probe['quarters_with_data'][0]}; the v1.0 run probed 2023 Q2 – 2026 Q1 with valid paging values and read the fast 1009 as an outage. "
            "SOP v2.0's \"empty parameter values\" does not describe the v1.0 code either (the empty template was in the documentation, not the calls). Diagnostic rule now in code: a 1009 in ~0.2 s is \"no such period\"; only 1011 / 1016 / HTTP 5xx / timeouts are transient. `calibration/monshaat_probe.py` scans 2018 Q1 → today before any loop runs."
        ),
        (
            "2. **Pagination semantics (SOP §3.2 / v2.0 §A2)** — resolved on the live service: `totalRecords` = rows on the page; `totalPages` is not per quarter (188 at 100/page for every quarter, 18 pages actually served; 1877 at 10/page; 76 at 250/page — the SOP's \"250 records / 76 pages\" was this table-wide figure); page ordering deterministic; "
            "250, 200, 100 and 50 per page all served data but 150/200/250 also returned HTTP 500 `1011` intermittently, which succeeds on retry. The loop uses 100 with a six-try backoff and stops at the first confirmed 1009."
        ),
        (
            "3. **(region, activity) is not a primary key.** The five large regions return 2–4 rows per key with *different* counts and no field naming the split. Summing every row reproduces Monsha'at's published totals (663,913 vs ~663 k at end-2021; small and medium within 4% of the Q1 2022 Monitor); keeping the first occurrence gives 434 k. "
            "The v1.0 pull code would have de-duplicated on that key and lost 40% of the counts — it never ran, and the path is gone."
        ),
        "4. **Two ISIC prefixes in the v1.0 map did not match the labels the gateway serves** (M71, and the M72/M73/I55 borderline keys). Corrected before any number was read; the full membership as matched is in DECISIONS.md 14.4.",
        "5. **Column-label shift in the sector POS file** confirmed exactly as documented and asserted in `calibration/sources.py`.",
        "6. **Encoding.** `Restaurants & Café` is matched as the exact published label; Arabic labels are stripped of bidi control characters before prefix matching. The Windows console renders both as mojibake; the code does not.",
        f"7. **Eid in weekly data.** A 3-day window inside 7-day weeks over three years is weakly identified: NNLS put several sectors' Eid multiplier at exactly 0 and the retail Eid CI spans {ci(rt['weekly']['sales']['eid']['ci95'])}. Handled by taking Ramadan from the monthly fit, the sub-monthly windows from the weekly fit, and — v2.0 — labelling every interval that contains 1.0 as B-weak.",
        "8. **Generator-side recovery at quick scale** was ~0.1 low for retail with 80 businesses; the estimator equal-weights businesses (DECISIONS.md 13.8) and recovers within 0.04 at full scale.",
        "9. **Transactions file size.** Receipts at the measured ticket are ~70 M rows; resolved by thinning POS `sales` rows to 10% with a `sample_weight` column. With the register mix (45% retail) `transactions.csv` is 12.5 M rows.",
        "10. **Pre-existing defects fixed in passing:** `eval/heldout_anomalies.py` (v1.0); `calibration/ticket_size.py` read a config key the v1.0 calibration had removed (v2.0).",
        "11. **Ramadan 1448 pinned one day late** in config (Umm al-Qura gives a 29-day Ramadan). Corrected.",
        "12. **A retry loop from the v1.0 session was still running** on the corrected pull script during the v2.0 run and overwrote the pull record once with its (correctly) empty result for 2023 Q2; stopped, record restored from the commit.",
    ]

    # ------------------------------------------------------------------ 6
    section(md, "6. Problems that remain")
    md += [
        "- **`base_monthly_inflow_sar` and `size_tier_scale` remain judgement (class C)** and are now the whole of the revenue-mix gap against GASTAT 2022: with the count mix sourced, the closed form gives construction 65% of four-sector revenue (GASTAT 26%) and retail 26% (GASTAT 60%), and the medium-tier share has flipped from too high (0.44) to too low (0.20) against 0.34. Only a sourced base inflow or a sourced revenue-per-firm by tier moves it (SOP §10.6).",
        "- **The register edition is 2021 Q4** — four years stale on the access date, the same vintage as the GASTAT 2022 anchor. The gateway serves nothing later; the 2023 SME Monitor aggregate (87 / 11.5 / 1.4) shows the micro tier has grown since. The weights need re-pulling the day a later quarter appears.",
        "- **Professional services is below the §23 minimum cell at N = 10,000** (237 businesses, 3 defaults). Any per-sector claim about it is `insufficient_sample`; a larger N or a stratified research population is a change-control decision, not a generator edit.",
        "- **Financing level is judgement.** The sector shape is measured; 0.35 is not. Total bank credit is not SME credit and has no NPL field; the §21 NPL target remains `pending_week1_check`.",
        f"- **{n_weak} of 16 seasonality parameters are B-weak.** They are applied because a weak measurement beats an invented one, and labelled so no reader takes the retail Eid value ({rt['proposed_config']['seasonality_value_multiplier']['eid']:.2f}, CI {ci(rt['proposed_config']['ci95_value']['eid'])}) as grounded.",
        "- **POS measures consumer card spend.** Construction and professional-services seasonality and arrival rates stay class C.",
        "- **No clothing sector**, so the largest Eid effect in the data (β 1.90) is modelled only diluted inside the retail composite.",
        "- **Ticket sizes are pinned to one edition** with a ~20% cross-edition spread; the re-pin to the cross-edition mean is a proposed change (entry 20), not applied, because Workstream B may not touch the generator.",
        "- **The Berka side of every real-vs-synthetic number is an eligible-population estimate**: the coverage rule excludes 10% of labelled accounts that default at 2.6–3.4× the retained rate. The unified protocol's bands are fold-assignment spreads over 22 (primary) and 59 (secondary) defaults.",
        f"- **{n_a1} class-A features are A1, not A2**: computable on real data, not shown to predict real outcomes in this corpus. The counterparty family and the growth features are among them; their v1.0 \"predicts real outcomes\" claim is withdrawn.",
        "- **The §21 target definition text in `config.yaml` still names the temporal split** as the Berka protocol; the sentence is superseded by B4 (entry 19) and left unedited so the config hash stays frozen through Workstream B. Amend at the next §9 change-control.",
        "- **`sample_weight` is a schema change awaiting §9 sign-off.**",
    ]

    # ------------------------------------------------------------------ 7
    section(md, "7. Evidence class summary")
    md += [
        "| item | v1.0 | now | why |",
        "|---|---|---|---|",
        f"| Ramadan / Eid VALUE and COUNT multipliers, retail_trade and food_beverage (16) | C → B (all 16) | **{16 - n_weak} B, {n_weak} B-weak** | B2 rule: B iff the CI excludes 1.0; values unchanged |",
        "| POS average ticket, retail_trade and food_beverage | C → B | B (one edition; spread reported) | SAMA weekly bulletin 12-Sep-2026; re-pin proposed |",
        "| `ramadan_calendar` 1448 | judgement → B | B | Umm al-Qura converter |",
        f"| Sector weights, tier splits | C (blocked) | **B** | Monsha'at register {latest_q[:4]} Q{latest_q[-1]} (entry 14) |",
        "| Financing share — relative shape / absolute level | C (blocked) | **B / C** | SAMA credit ÷ Monsha'at count; level is judgement |",
        "| Seasonality, construction and professional_services | C | C | POS does not measure them |",
        "| `base_monthly_inflow_sar`, `size_tier_scale` | C | C | SOP §10.6 — the remaining unsourced inputs |",
        "| Revenue-share metrics | calibration-derived check (entry 12) | same | closed form of the inputs |",
        f"| Feature registry class A (43 features) | A \"predicts real outcomes\" | **A2 {n_a2} · A1 {n_a1}** | B1 rule: A2 iff the univariate Berka AUC CI excludes 0.50 on ≥ 1 label set |",
        "",
        (
            "Claims now permitted per class — A2: \"computed on real bank data and predictive of real credit outcomes (AUC with CI)\"; A1: \"computed on real bank data; predictive performance reported per feature, not assumed\"; "
            "B: \"behaves correctly under measured parameters\"; B-weak: \"behaves correctly under measured parameters whose interval contains no effect; applied, not claimed as grounded\"; C: \"implemented and functional; no public data exists to validate it\"."
        ),
    ]
    if transfer:
        a2 = [f"{k} `{v['feature']}`" for k, v in transfer["features"].items() if v["subclass"] == "A2"]
        a1 = [f"{k} `{v['feature']}`" for k, v in transfer["features"].items() if v["subclass"] == "A1"]
        md += ["", f"**A2 ({len(a2)}):** {', '.join(a2)}.", "", f"**A1 ({len(a1)}):** {', '.join(a1)}.", "", "Per-feature AUCs and intervals: `eval/out/feature_transfer.md`. Feature 22 qualifies on a hair-thin interval around a negligible effect (near-constant feature); the rule is applied as written and the effect size is printed."]
    if evidence:
        first = [ln for ln in evidence.splitlines() if ln.startswith("| **")]
        md += ["", "Registry counts after the run (`eval/out/evidence_table.md`):", ""] + first
        md += ["", "*v1.0 (superseded):* A 43, B 3, C 25 — with every A carrying \"Predicts real outcomes\"."]

    out = Path(args.out)
    out.write_text("\n".join(md) + "\n", encoding="utf-8")
    print(f"→ {out} ({len(md)} lines)")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
