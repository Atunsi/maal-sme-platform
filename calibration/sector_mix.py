"""Phase 1 — national sector weights and size-tier splits from the Monsha'at register (SOP §4.2–§4.4).

    python -m calibration.sector_mix

Reads every archived sources/monshaat/enterprises_*.json, maps ISIC activities (Arabic labels,
verbatim) onto the four generator sectors, aggregates all regions, EXCLUDES the large tier (scope
is SMEs), and writes calibration/out/phase1_sector_mix.json with, per quarter and for the most
recent quarter:

  * SME count per sector, share of the four-sector total  → `sector_size_distribution.<s>.weight`
  * micro / small / medium split per sector                → `sector_size_distribution.<s>.size_tiers`
  * the full ISIC membership actually matched, and every activity that did NOT map (§4.2, §10.5)
  * stability across the quarters pulled (§4.5)
  * a consistency check of the config-implied aggregate size split against the national split
    Monsha'at published for Q4 2023 (micro 1,138,588 / small 150,788 / medium 18,723)

The ISIC → sector map is JUDGEMENT and is recorded in DECISIONS.md with this membership list.
Nothing here reads a validation target. If no Monsha'at archive exists the script exits 2 and
reports Phase 1 as blocked — it never falls back to a regional sample or an invented split.
"""

from __future__ import annotations

import json
import sys

from calibration import sources as S
from generator.generate import load_config

SECTORS = ["retail_trade", "construction", "food_beverage", "professional_services"]
TIERS = ["micro", "small", "medium"]
FIELD = {"micro": "microEnterprisesCount", "small": "smallEnterprisesCount", "medium": "mediumEnterprisesCount", "large": "largeEnterprisesCount"}

# Arabic key phrases (ISIC Rev.4 divisions as Monsha'at labels them). Matching is by prefix on the
# normalised label; the labels actually matched are written out in full so the mapping is auditable.
ISIC_MAP: dict[str, list[tuple[str, str]]] = {
    "retail_trade": [
        ("تجارة الجملة والتجزئة", "G45 wholesale & retail trade and repair of motor vehicles — counted as retail trade (choice)"),
        ("تجارة الجملة", "G46 wholesale trade — counted as retail trade (choice)"),
        ("تجارة التجزئة", "G47 retail trade"),
    ],
    "construction": [
        ("تشييد المباني", "F41 construction of buildings"),
        ("الهندسة المدنية", "F42 civil engineering — counted as construction (choice)"),
        ("أنشطة التشييد المتخصصة", "F43 specialised construction activities"),
    ],
    "food_beverage": [
        ("أنشطة خدمات الأطعمة والمشروبات", "I56 food and beverage service activities"),
    ],
    "professional_services": [
        ("الأنشطة القانونية وأنشطة المحاسبة", "M69 legal and accounting"),
        ("الأنشطة القانونية والمحاسبة", "M69 legal and accounting (alternate label)"),
        ("أنشطة المكاتب الرئيسية", "M70 head offices; management consultancy"),
        ("الأنشطة المعمارية والهندسية", "M71 architectural and engineering; technical testing"),
        ("أنشطة البرمجة الحاسوبية", "J62 computer programming, consultancy — counted as professional services (choice, per SOP §4.2)"),
        ("الأنشطة المهنية والعلمية والتقنية الأخرى", "M74 other professional, scientific and technical activities"),
    ],
}
# ISIC activities a reader would expect near the four sectors but which the SOP list leaves out —
# reported as "did not map cleanly" rather than silently absorbed (§10.5).
BORDERLINE = {
    "البحث العلمي والتطوير": "M72 scientific research and development — not in the SOP membership list",
    "الإعلان وبحوث السوق": "M73 advertising and market research — not in the SOP membership list",
    "الأنشطة البيطرية": "M75 veterinary activities — not in the SOP membership list",
    "أنشطة الإقامة": "I55 accommodation — not food service; excluded",
}

MONSHAAT_NATIONAL_Q4_2023 = {"micro": 1_138_588, "small": 150_788, "medium": 18_723}  # Monsha'at SME Monitor Q4 2023 (news release node/53859)


def normalise(label: str) -> str:
    return " ".join(str(label).replace(chr(0x200F), "").replace(chr(0x200E), "").split())


def map_activity(label: str) -> tuple[str | None, str | None]:
    n = normalise(label)
    for sector, keys in ISIC_MAP.items():
        for key, note in keys:
            if n.startswith(normalise(key)):
                return sector, note
    return None, None


def summarise_quarter(rows: list[dict]) -> dict:
    regions = sorted({r["region"] for r in rows})
    per_sector = {s: {t: 0 for t in TIERS + ["large"]} for s in SECTORS}
    membership = {s: {} for s in SECTORS}
    unmapped, borderline = {}, {}
    for r in rows:
        sector, note = map_activity(r["economicActivity"])
        counts = {t: int(r.get(FIELD[t]) or 0) for t in TIERS + ["large"]}
        label = normalise(r["economicActivity"])
        if sector is None:
            bucket = borderline if any(label.startswith(normalise(k)) for k in BORDERLINE) else unmapped
            b = bucket.setdefault(label, {t: 0 for t in TIERS + ["large"]})
            for t, v in counts.items():
                b[t] += v
            continue
        for t, v in counts.items():
            per_sector[sector][t] += v
        m = membership[sector].setdefault(label, {"note": note, **{t: 0 for t in TIERS + ["large"]}})
        for t, v in counts.items():
            m[t] += v
    sme_total = {s: sum(per_sector[s][t] for t in TIERS) for s in SECTORS}
    four = sum(sme_total.values())
    all_sme = {t: sum(int(r.get(FIELD[t]) or 0) for r in rows) for t in TIERS}
    return {
        "regions": regions,
        "n_regions": len(regions),
        "n_activities": len({normalise(r["economicActivity"]) for r in rows}),
        "counts_by_sector_tier": per_sector,
        "sme_total_by_sector": sme_total,
        "four_sector_sme_total": four,
        "weight": {s: round(sme_total[s] / four, 4) for s in SECTORS},
        "size_tiers": {s: {t: round(per_sector[s][t] / sme_total[s], 4) for t in TIERS} for s in SECTORS},
        "large_excluded": {s: per_sector[s]["large"] for s in SECTORS},
        "all_activities_sme_by_tier": all_sme,
        "four_sector_share_of_all_smes": round(four / sum(all_sme.values()), 4),
        "membership": membership,
        "borderline_not_mapped": {k: {**v, "note": BORDERLINE[next(b for b in BORDERLINE if k.startswith(normalise(b)))]} for k, v in borderline.items()},
        "unmapped_activities": unmapped,
    }


def config_implied_aggregate_split(cfg: dict) -> dict:
    ssd = cfg["sector_size_distribution"]
    agg = {t: sum(v["weight"] * v["size_tiers"][t] for v in ssd.values()) for t in TIERS}
    return {t: round(agg[t], 4) for t in TIERS}


def main(argv: list[str] | None = None) -> int:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    cfg = load_config("config.yaml")
    archives = sorted(S.MONSHAAT.glob("enterprises_*.json"))
    nat = MONSHAAT_NATIONAL_Q4_2023
    nat_split = {t: round(nat[t] / sum(nat.values()), 4) for t in TIERS}
    payload = {
        "run_at": S.now_iso(),
        "config_implied_aggregate_size_split": config_implied_aggregate_split(cfg),
        "monshaat_published_national_size_split_q4_2023": {"counts": nat, "shares": nat_split, "source": "Monsha'at SME Monitor Q4 2023, via monshaat.gov.sa/en/node/53859 (national totals only; no sector detail)"},
    }
    if not archives:
        payload["status"] = "blocked_no_archive"
        print("No sources/monshaat/enterprises_*.json archive — run calibration.monshaat_pull first. Phase 1 BLOCKED; nothing written to config.")
        print(f"  config-implied aggregate size split: {payload['config_implied_aggregate_size_split']}  vs  Monsha'at national Q4 2023: {nat_split}")
        S.write_out("phase1_sector_mix", payload)
        return 2

    quarters = {}
    for a in archives:
        S.verify_archive(a)
        body = json.loads(a.read_text(encoding="utf-8"))
        key = f"{body['year']}Q{body['quarter']}"
        quarters[key] = summarise_quarter(body["rows"])
        q = quarters[key]
        print(f"== {key}: {len(body['rows'])} rows, {q['n_regions']} regions, {q['n_activities']} activities; four-sector SMEs {q['four_sector_sme_total']:,} ({q['four_sector_share_of_all_smes']:.1%} of all SMEs) ==")
        for s in SECTORS:
            st = q["size_tiers"][s]
            print(f"  {s:22s} weight {q['weight'][s]:.3f}  micro/small/medium {st['micro']:.3f}/{st['small']:.3f}/{st['medium']:.3f}  (n={q['sme_total_by_sector'][s]:,}, large excluded {q['large_excluded'][s]:,})")
        if q["unmapped_activities"]:
            print(f"  {len(q['unmapped_activities'])} activities outside the four sectors (expected: the rest of ISIC)")
        if q["borderline_not_mapped"]:
            print(f"  borderline, NOT mapped (recorded): {list(q['borderline_not_mapped'])}")
    latest = max(quarters, key=lambda k: (int(k[:4]), int(k[-1])))
    stability = {
        s: {
            "weight_range": [min(q["weight"][s] for q in quarters.values()), max(q["weight"][s] for q in quarters.values())],
            "micro_share_range": [min(q["size_tiers"][s]["micro"] for q in quarters.values()), max(q["size_tiers"][s]["micro"] for q in quarters.values())],
        }
        for s in SECTORS
    }
    payload.update({"status": "ok", "latest_quarter": latest, "quarters": quarters, "stability_across_quarters": stability, "proposed_config": {"sector_size_distribution": {s: {"weight": quarters[latest]["weight"][s], "size_tiers": quarters[latest]["size_tiers"][s]} for s in SECTORS}}, "edition": f"Monsha'at Enterprises Statistics {latest[:4]} Q{latest[-1]}"})
    p = S.write_out("phase1_sector_mix", payload)
    print(f"\nlatest quarter {latest}; stability: {json.dumps(stability)}")
    print(f"→ {p}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
