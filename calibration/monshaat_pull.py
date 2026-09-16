"""Phase 1 — pull every page of Monsha'at Enterprises Statistics for three quarters (SOP §4.1).

    python -m calibration.monshaat_pull [--quarters 2025Q2,2024Q2,2023Q2] [--per-page 100]

Without --quarters it scans backwards from the current quarter for the most recent quarter that
returns data, then takes the quarters roughly one and two years earlier (§4.1: a single snapshot is
weaker than it looks). The paging parameters are REQUIRED by the gateway (§3.1); the loop here is
written against the pagination semantics recorded by `probe_sources` in calibration/out/phase0_probe.json
and re-checks them on every pull: rows are de-duplicated on (region, economicActivity) and any
duplicate across pages, or any page spanning a second period, is recorded as a finding.

Archives: sources/monshaat/enterprises_{YYYY}Q{Q}.json + .sha256 + .meta.json. Labels are kept in
Arabic verbatim — they are the join key for `sector_mix` (§3.1).

Gateway statusCode 1016 (Request Timeout) is retried with backoff and a smaller page; 1009
(No Data Found) is final for that quarter. If no quarter returns data the script exits 2 and
Phase 1 is BLOCKED — nothing is invented in its place (§1.1).
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from datetime import datetime, timezone

import requests

from calibration import sources as S

UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)", "Accept": "application/json"}
FIELDS = ("region", "economicActivity", "microEnterprisesCount", "smallEnterprisesCount", "mediumEnterprisesCount", "largeEnterprisesCount")


def get_page(year: int, quarter: int, page: int, per_page: int, tries: int = 4) -> tuple[dict | None, list[dict]]:
    """Returns (body or None, attempt log). Backs off and shrinks the page on 1016."""
    log = []
    for k in range(tries):
        pp = max(10, per_page // (2**k))
        url = S.MONSHAAT_ENDPOINT.format(year=year, quarter=quarter) + f"?paginationIndex={page}&recordsPerPage={pp}"
        t0 = time.time()
        try:
            r = requests.get(url, timeout=150, headers=UA)
            body = r.json()
        except Exception as e:  # noqa: BLE001
            log.append({"url": url, "try": k, "error": repr(e)[:160], "seconds": round(time.time() - t0, 1)})
            time.sleep(8 * (k + 1))
            continue
        code = body.get("statusCode") if isinstance(body, dict) else None
        log.append({"url": url, "try": k, "http": r.status_code, "statusCode": code, "seconds": round(time.time() - t0, 1), "rows": len(body.get("statistics") or []) if isinstance(body, dict) else 0})
        if isinstance(body, dict) and body.get("statistics") is not None and code in (None, 200, 0, 1000):
            return body, log
        if code == 1009:
            return None, log
        time.sleep(8 * (k + 1))
    return None, log


def pull_quarter(year: int, quarter: int, per_page: int) -> dict | None:
    body, log = get_page(year, quarter, 1, per_page)
    if body is None:
        return {"year": year, "quarter": quarter, "status": "no_data", "log": log}
    pagination = body.get("pagination") or {}
    rows = list(body.get("statistics") or [])
    seen = {(r.get("region"), r.get("economicActivity")) for r in rows}
    duplicates, pages_pulled = 0, 1
    total_pages = pagination.get("totalPages") or pagination.get("TotalPages")
    page = 2
    while True:
        if total_pages is not None and page > int(total_pages):
            break
        nxt, l2 = get_page(year, quarter, page, per_page)
        log.extend(l2)
        if nxt is None or not nxt.get("statistics"):
            break
        pages_pulled += 1
        for r in nxt["statistics"]:
            key = (r.get("region"), r.get("economicActivity"))
            if key in seen:
                duplicates += 1
                continue
            seen.add(key)
            rows.append(r)
        page += 1
        if page > 500:  # a runaway loop is a finding, not a pull
            break
    for r in rows:
        missing = [f for f in FIELDS if f not in r]
        assert not missing, f"row lacks fields {missing}: {r}"
    periods = {(r.get("year"), r.get("quarter")) for r in rows if "year" in r or "quarter" in r}
    return {
        "year": year,
        "quarter": quarter,
        "status": "ok",
        "pagination_first_page": pagination,
        "pages_pulled": pages_pulled,
        "rows": rows,
        "n_rows": len(rows),
        "duplicates_across_pages": duplicates,
        "distinct_regions": sorted({r["region"] for r in rows}),
        "distinct_activities": len({r["economicActivity"] for r in rows}),
        "periods_in_rows": sorted(str(p) for p in periods),
        "log": log,
    }


def auto_quarters(per_page: int) -> list[tuple[int, int]]:
    today = datetime.now(tz=timezone.utc).date()
    y, q = today.year, (today.month - 1) // 3 + 1
    cand = []
    for _ in range(12):
        cand.append((y, q))
        q -= 1
        if q == 0:
            y, q = y - 1, 4
    latest = None
    for yq in cand:
        body, _ = get_page(*yq, 1, 10)
        if body is not None and body.get("statistics"):
            latest = yq
            break
    if latest is None:
        return []
    return [latest, (latest[0] - 1, latest[1]), (latest[0] - 2, latest[1])]


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--quarters", default=None, help="comma-separated, e.g. 2025Q2,2024Q2,2023Q2")
    ap.add_argument("--per-page", type=int, default=100)
    args = ap.parse_args(argv)
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    S.MONSHAAT.mkdir(parents=True, exist_ok=True)

    if args.quarters:
        quarters = [(int(s[:4]), int(s[-1])) for s in args.quarters.split(",")]
    else:
        quarters = auto_quarters(args.per_page)
        if not quarters:
            print("Monsha'at gateway returned no data for any of the last 12 quarters — Phase 1 BLOCKED (nothing is invented in its place).")
            S.write_out("phase1_monshaat_pull", {"run_at": S.now_iso(), "status": "blocked_gateway", "quarters": []})
            return 2

    results = []
    for y, q in quarters:
        print(f"== {y}Q{q} ==")
        res = pull_quarter(y, q, args.per_page)
        results.append({k: v for k, v in res.items() if k != "rows"})
        if res["status"] != "ok":
            print(f"  no data ({res['log'][-1] if res['log'] else 'no attempts'})")
            continue
        content = (json.dumps({k: v for k, v in res.items() if k != "log"}, ensure_ascii=False, indent=1) + "\n").encode("utf-8")
        rec = S.archive(
            S.MONSHAAT / f"enterprises_{y}Q{q}.json",
            content,
            {
                "origin_body": "Monsha'at (Small and Medium Enterprises General Authority)",
                "publication": f"Enterprises Statistics, {y} Q{q} — region × ISIC economic activity × size tier",
                "retrieval": "Monsha'at OpenData gateway (paged JSON)",
                "retrieval_url": S.MONSHAAT_ENDPOINT.format(year=y, quarter=q) + "?paginationIndex={n}&recordsPerPage={size}",
                "edition": f"Monsha'at Enterprises Statistics {y} Q{q}",
                "rows": res["n_rows"],
                "pages": res["pages_pulled"],
                "regions": len(res["distinct_regions"]),
                "activities": res["distinct_activities"],
            },
        )
        print(f"  archived {rec['file']}: {res['n_rows']} rows, {res['pages_pulled']} pages, {len(res['distinct_regions'])} regions, {res['distinct_activities']} activities, {res['duplicates_across_pages']} duplicates dropped")
    ok = [r for r in results if r["status"] == "ok"]
    S.write_out("phase1_monshaat_pull", {"run_at": S.now_iso(), "status": "ok" if ok else "blocked_gateway", "quarters": results})
    return 0 if ok else 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
