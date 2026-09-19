"""Phase 1 — pull every page of Monsha'at Enterprises Statistics for three quarters (SOP §4.1; SOP_Monshaat_Unblock §A3).

    python -m calibration.monshaat_pull [--quarters 2021Q4,2020Q4,2019Q4] [--per-page 100]

Without --quarters it takes the availability recorded by `calibration.monshaat_probe` (or scans
2018Q1 … the current quarter itself) and pulls the latest quarter that returns data plus the same
quarter one and two years earlier — a single snapshot is weaker than it looks (§4.1).

Gateway contract as resolved by the probe on 2026-09-17 (calibration/out/phase1_monshaat_probe.json):
  * both paging parameters are REQUIRED and must be non-empty; `paginationIndex` is 1-based;
  * `totalRecords` = rows on the page and `totalPages` is NOT a per-quarter figure (188 at 100/page
    for every quarter, while a quarter ends after ~18 pages) — the loop ignores it and stops at the
    first confirmed `1009 No Data Found`;
  * `1009` returning in ~0.2 s is the service saying "that period is not in the dataset" (the dataset
    covers 2019 Q2 – 2021 Q4). It is FINAL and is never reported as a blocked gateway;
  * `1011 Internal Server Error` (HTTP 500) and `1016 Request Timeout` (HTTP 408) are TRANSIENT —
    they appear intermittently on any page and size and succeed on retry; retried with backoff;
  * page ordering is deterministic (two full passes were identical), so paging is reproducible.

Rows are NOT de-duplicated. (region, economicActivity) is not a primary key: the five large regions
return 2–4 rows per key with DIFFERENT counts (a hidden sub-region split the response does not
name); the small regions return exactly one. The rows are additive components — summing every row
reproduces the published national SME total (2021 Q4: 663,913 vs Monsha'at's ~663 k) while keeping
only the first occurrence gives 434 k. The multiplicity is recorded per region as a finding.

Archives: sources/monshaat/enterprises_{YYYY}Q{Q}.json + .sha256 + .meta.json. Labels are kept in
Arabic verbatim — they are the join key for `sector_mix` (§3.1). A quarter that loses a page to an
exhausted transient retry is reported `incomplete` and NOT archived. Exit 2 only when no requested
quarter could be archived.
"""

from __future__ import annotations

import argparse
import collections
import json
import sys

from calibration import sources as S
from calibration.monshaat_probe import FIELDS, current_quarter, get, parse_q, quarters_between

TIERS = ("microEnterprisesCount", "smallEnterprisesCount", "mediumEnterprisesCount", "largeEnterprisesCount")


def pull_quarter(year: int, quarter: int, per_page: int) -> dict:
    log: list[dict] = []
    rows: list[dict] = []
    page = 1
    status = "ok"
    while page <= 2000:
        a = get(year, quarter, page, per_page, log=log)
        if a["kind"] == "data":
            rows.extend(a["rows"])
            page += 1
            continue
        if a["kind"] == "no_data":
            status = "no_data_for_period" if page == 1 else "ok"
            break
        status = "incomplete"  # transient retries exhausted on this page — never skip it silently
        break
    if status != "ok":
        return {"year": year, "quarter": quarter, "status": status, "pages_pulled": page - 1, "n_rows": len(rows), "log": log}
    for r in rows:
        missing = [f for f in FIELDS if f not in r]
        assert not missing, f"row lacks fields {missing}: {r}"
    keys = [(r["region"], r["economicActivity"]) for r in rows]
    mult = collections.Counter(keys)
    per_region = collections.defaultdict(list)
    for (reg, _), m in mult.items():
        per_region[reg].append(m)
    totals = {t: sum(int(r.get(t) or 0) for r in rows) for t in TIERS}
    return {
        "year": year,
        "quarter": quarter,
        "status": status,
        "pagination_first_page": log[0].get("pagination") if log else None,
        "pages_pulled": page - 1,
        "per_page": per_page,
        "rows": rows,
        "n_rows": len(rows),
        "distinct_region_activity": len(mult),
        "rows_per_key_max": max(mult.values()),
        "multiplicity_by_region": {reg: dict(sorted(collections.Counter(ms).items())) for reg, ms in per_region.items()},
        "aggregation_rule": "sum every row; (region, activity) repeats are additive sub-region components with different counts (see module docstring)",
        "national_totals_sum_all_rows": totals,
        "national_sme_total_sum_all_rows": sum(totals[t] for t in TIERS[:3]),
        "distinct_regions": sorted({r["region"] for r in rows}),
        "distinct_activities": len({r["economicActivity"] for r in rows}),
        "log": log,
    }


def choose_quarters(per_page: int) -> tuple[list[tuple[int, int]], dict]:
    probe_path = S.OUT / "phase1_monshaat_probe.json"
    if probe_path.exists():
        probe = S.read_out("phase1_monshaat_probe")
        avail = [parse_q(k) for k, v in probe.get("availability", {}).items() if v.get("kind") == "data"]
        source = f"phase1_monshaat_probe.json ({probe.get('run_at', '')[:10]})"
    else:
        avail, source = [], "live scan 2018Q1 … current quarter"
        for y, q in quarters_between((2018, 1), current_quarter()):
            if get(y, q, 1, 10)["kind"] == "data":
                avail.append((y, q))
    if not avail:
        return [], {"source": source, "available": []}
    latest = max(avail)
    wanted = [latest, (latest[0] - 1, latest[1]), (latest[0] - 2, latest[1])]
    chosen = [q for q in wanted if q in avail]
    for q in sorted(avail, reverse=True):  # fall back to the next-earlier quarters if the same-quarter-earlier ones are absent
        if len(chosen) >= 3:
            break
        if q not in chosen:
            chosen.append(q)
    return chosen, {"source": source, "available": [f"{y}Q{q}" for y, q in sorted(avail)]}


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--quarters", default=None, help="comma-separated, e.g. 2021Q4,2020Q4,2019Q4")
    ap.add_argument("--per-page", type=int, default=100, help="100 is reliable; 250 works but 1011 is more frequent; 150/200 intermittent")
    args = ap.parse_args(argv)
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    S.MONSHAAT.mkdir(parents=True, exist_ok=True)

    if args.quarters:
        quarters, chosen_from = [parse_q(s) for s in args.quarters.split(",")], {"source": "--quarters"}
    else:
        quarters, chosen_from = choose_quarters(args.per_page)
        if not quarters:
            print("No quarter between 2018Q1 and today returned data (every answer a fast 1009, or transient errors exhausted) — see phase1_monshaat_probe.json. Nothing invented.")
            S.write_out("phase1_monshaat_pull", {"run_at": S.now_iso(), "status": "no_data_in_range", "chosen_from": chosen_from, "quarters": []})
            return 2
    print(f"quarters: {', '.join(f'{y}Q{q}' for y, q in quarters)}  (chosen from {chosen_from['source']})")

    results = []
    for y, q in quarters:
        print(f"== {y}Q{q} ==")
        res = pull_quarter(y, q, args.per_page)
        results.append({k: v for k, v in res.items() if k not in ("rows", "log")} | {"last_call": res["log"][-1] if res.get("log") else None})
        if res["status"] != "ok":
            print(f"  {res['status']} after {res['pages_pulled']} pages ({res['log'][-1] if res['log'] else 'no attempts'})")
            continue
        content = (json.dumps({k: v for k, v in res.items() if k != "log"}, ensure_ascii=False, indent=1) + "\n").encode("utf-8")
        rec = S.archive(
            S.MONSHAAT / f"enterprises_{y}Q{q}.json",
            content,
            {
                "origin_body": "Monsha'at (Small and Medium Enterprises General Authority)",
                "publication": f"Enterprises Statistics, {y} Q{q} — region × ISIC economic activity × size tier",
                "retrieval": "Monsha'at OpenData gateway (paged JSON; 1-based paginationIndex, stop at first 1009)",
                "retrieval_url": S.MONSHAAT_ENDPOINT.format(year=y, quarter=q) + f"?paginationIndex={{1..{res['pages_pulled']}}}&recordsPerPage={args.per_page}",
                "edition": f"Monsha'at Enterprises Statistics {y} Q{q} (dataset covers 2019 Q2 – 2021 Q4 on the access date)",
                "rows": res["n_rows"],
                "pages": res["pages_pulled"],
                "regions": len(res["distinct_regions"]),
                "activities": res["distinct_activities"],
                "distinct_region_activity": res["distinct_region_activity"],
                "aggregation_rule": res["aggregation_rule"],
                "national_sme_total_sum_all_rows": res["national_sme_total_sum_all_rows"],
            },
        )
        t = res["national_totals_sum_all_rows"]
        print(f"  archived {rec['file']}: {res['n_rows']} rows over {res['pages_pulled']} pages, {len(res['distinct_regions'])} regions, {res['distinct_activities']} activities, {res['distinct_region_activity']} distinct (region, activity), max {res['rows_per_key_max']} rows per key; SMEs {res['national_sme_total_sum_all_rows']:,} (micro {t[TIERS[0]]:,} / small {t[TIERS[1]]:,} / medium {t[TIERS[2]]:,}; large {t[TIERS[3]]:,} excluded downstream)")
    ok = [r for r in results if r["status"] == "ok"]
    status = "ok" if ok else ("incomplete" if any(r["status"] == "incomplete" for r in results) else "no_data_for_period")
    S.write_out("phase1_monshaat_pull", {"run_at": S.now_iso(), "status": status, "chosen_from": chosen_from, "quarters": results})
    return 0 if ok else 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
