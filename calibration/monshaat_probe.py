"""Workstream A2 — resolve the Monsha'at gateway's pagination semantics and period range BEFORE looping.

    python -m calibration.monshaat_probe [--from 2018Q1] [--to <current quarter>] [--per-page 100]

SOP_Monshaat_Unblock §A0–A2. Three questions, answered from the gateway itself and written to
calibration/out/phase1_monshaat_probe.json:

  1. Which periods exist?  Every quarter in the range is called once with real, non-empty paging
     values (paginationIndex=1, recordsPerPage=10). A fast `1009 No Data Found` (HTTP 404, ~0.2 s)
     is the service answering "that quarter is not in the dataset" — it is never a gateway fault.
  2. What do `totalRecords` and `totalPages` mean?  Pages 1 and 2 of the latest quarter are fetched
     at the working page size and compared: rows-on-page vs rows-in-set, and whether rows repeat.
     The last page is found by walking until the first confirmed 1009; `totalPages` is checked
     against that count (on 2026-09-17 it was 94 at 200/page and 1877 at 10/page for EVERY quarter
     — a table-wide figure, not a per-quarter one — and pages past ~120 at 10/page return 1009).
  3. Which page sizes work?  250 and 150 returned HTTP 500 / `1011 Internal Server Error`; 200,
     100 and 50 returned data. 1011 also appears intermittently on any page and succeeds on retry,
     so it is a TRANSIENT status (retried), unlike 1009 (final).

Transient (retry with backoff, shrink the page): 1011, 1016 (HTTP 408 Request Timeout), any
HTTP 5xx, connection errors. Final for that page: 1009. `paginationIndex=0` → 1010 Validation
Error (index is 1-based); empty parameter values → 1010 as well.
"""

from __future__ import annotations

import argparse
import sys
import time
from datetime import datetime, timezone

import requests

from calibration import sources as S

UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)", "Accept": "application/json"}
FIELDS = ("region", "economicActivity", "microEnterprisesCount", "smallEnterprisesCount", "mediumEnterprisesCount", "largeEnterprisesCount")
TRANSIENT_CODES = {1011, 1016}
NO_DATA = 1009
PAGE_SIZES_KNOWN_GOOD = (200, 100, 50, 10)


def call(year: int, quarter: int, page: int, per_page: int, timeout: int = 120) -> dict:
    """One GET. Returns {http, statusCode, rows, pagination, seconds, kind} where kind ∈ data | no_data | transient | error."""
    url = S.MONSHAAT_ENDPOINT.format(year=year, quarter=quarter) + f"?paginationIndex={page}&recordsPerPage={per_page}"
    t0 = time.time()
    try:
        r = requests.get(url, timeout=timeout, headers=UA)
    except requests.RequestException as e:  # connection / read timeout — transient
        return {"url": url, "http": None, "statusCode": None, "rows": [], "pagination": None, "seconds": round(time.time() - t0, 2), "kind": "transient", "error": repr(e)[:160]}
    try:
        body = r.json()
    except ValueError:
        body = {}
    code = body.get("statusCode") if isinstance(body, dict) else None
    rows = list(body.get("statistics") or []) if isinstance(body, dict) else []
    if rows:
        kind = "data"
    elif code == NO_DATA:
        kind = "no_data"
    elif code in TRANSIENT_CODES or r.status_code >= 500:
        kind = "transient"
    else:
        kind = "error"
    return {"url": url, "http": r.status_code, "statusCode": code, "statusDescription": body.get("statusDescription") if isinstance(body, dict) else None, "rows": rows, "pagination": body.get("pagination") if isinstance(body, dict) else None, "seconds": round(time.time() - t0, 2), "kind": kind}


def get(year: int, quarter: int, page: int, per_page: int, tries: int = 6, log: list | None = None) -> dict:
    """call() with backoff on transient statuses. Never retries a 1009."""
    last = None
    for k in range(tries):
        a = call(year, quarter, page, per_page)
        if log is not None:
            log.append({k2: v for k2, v in a.items() if k2 != "rows"} | {"n_rows": len(a["rows"]), "try": k})
        if a["kind"] in ("data", "no_data"):
            return a
        last = a
        time.sleep(1.5 * (k + 1))
    return last


def parse_q(s: str) -> tuple[int, int]:
    return int(s[:4]), int(s[-1])


def quarters_between(a: tuple[int, int], b: tuple[int, int]) -> list[tuple[int, int]]:
    out, (y, q) = [], a
    while (y, q) <= b:
        out.append((y, q))
        q += 1
        if q == 5:
            y, q = y + 1, 1
    return out


def current_quarter() -> tuple[int, int]:
    d = datetime.now(tz=timezone.utc).date()
    return d.year, (d.month - 1) // 3 + 1


def walk_to_end(year: int, quarter: int, per_page: int, log: list) -> tuple[list[dict], int, int]:
    """All rows of one quarter: page 1, 2, … until the first confirmed 1009. Returns (rows, pages_with_data, pages_failed)."""
    rows, page, failed = [], 1, 0
    while page <= 2000:
        a = get(year, quarter, page, per_page, log=log)
        if a["kind"] == "data":
            rows.extend(a["rows"])
            page += 1
            continue
        if a["kind"] == "no_data":
            break
        failed += 1  # transient exhausted: record and stop rather than skip a page silently
        break
    return rows, page - 1, failed


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--from", dest="q_from", default="2018Q1")
    ap.add_argument("--to", dest="q_to", default=None)
    ap.add_argument("--per-page", type=int, default=100)
    args = ap.parse_args(argv)
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    q_to = parse_q(args.q_to) if args.q_to else current_quarter()
    log: list[dict] = []

    print(f"== 1. Period range: {args.q_from} … {q_to[0]}Q{q_to[1]}, one call each (paginationIndex=1&recordsPerPage=10) ==")
    availability = {}
    for y, q in quarters_between(parse_q(args.q_from), q_to):
        a = get(y, q, 1, 10, log=log)
        availability[f"{y}Q{q}"] = {"kind": a["kind"], "http": a["http"], "statusCode": a["statusCode"], "seconds": a["seconds"], "pagination": a["pagination"]}
        print(f"  {y}Q{q}: {a['kind']:9s} http={a['http']} statusCode={a['statusCode']} {a['seconds']}s {a['pagination'] or ''}")
    with_data = [k for k, v in availability.items() if v["kind"] == "data"]
    if not with_data:
        transient = [k for k, v in availability.items() if v["kind"] in ("transient", "error")]
        status = "gateway_error" if transient else "no_data_in_range"
        print(f"\nNo quarter in the range returned data ({status}).")
        S.write_out("phase1_monshaat_probe", {"run_at": S.now_iso(), "status": status, "availability": availability, "log": log})
        return 2
    latest = max(with_data, key=parse_q)
    first_1009_after = next((k for k in availability if parse_q(k) > parse_q(latest) and availability[k]["kind"] == "no_data"), None)
    first_1009_before = next((k for k in reversed(list(availability)) if parse_q(k) < parse_q(with_data[0]) and availability[k]["kind"] == "no_data"), None)
    print(f"  → data for {with_data[0]} … {latest} ({len(with_data)} quarters); 1009 confirmed at {first_1009_before} and {first_1009_after}")

    print(f"\n== 2. Page sizes on {latest} page 1 ==")
    sizes = {}
    for n in (250, 200, 150, 100, 50):
        a = call(*parse_q(latest), 1, n)
        sizes[n] = {"kind": a["kind"], "http": a["http"], "statusCode": a["statusCode"], "n_rows": len(a["rows"]), "pagination": a["pagination"]}
        print(f"  recordsPerPage={n}: {a['kind']:9s} http={a['http']} statusCode={a['statusCode']} rows={len(a['rows'])} {a['pagination'] or ''}")

    y, q = parse_q(latest)
    print(f"\n== 3. Pagination semantics on {latest} at recordsPerPage={args.per_page} ==")
    p1 = get(y, q, 1, args.per_page, log=log)
    p2 = get(y, q, 2, args.per_page, log=log)

    def key(r: dict) -> tuple:
        return (r.get("region"), r.get("economicActivity"))

    k1, k2 = {key(r) for r in p1["rows"]}, {key(r) for r in p2["rows"]}
    rows, pages, failed = walk_to_end(y, q, args.per_page, log)
    keys = [key(r) for r in rows]
    distinct = set(keys)
    total_records_meaning = "rows_on_page" if (p1["pagination"] or {}).get("totalRecords") == len(p1["rows"]) else "rows_in_set_or_other"
    tp = (p1["pagination"] or {}).get("totalPages")
    total_pages_per_quarter = tp is not None and tp == pages
    missing = sorted({f for r in rows for f in FIELDS if f not in r})
    regions = sorted({r["region"] for r in rows})
    activities = sorted({r["economicActivity"] for r in rows})
    print(f"  page 1: {len(p1['rows'])} rows, pagination {p1['pagination']}")
    print(f"  page 2: {len(p2['rows'])} rows; overlap with page 1: {len(k1 & k2)} keys")
    print(f"  walked to the first 1009: {pages} pages with data, {len(rows)} rows, {len(distinct)} distinct (region, activity), {len(keys) - len(distinct)} duplicates, {failed} pages lost to transient errors")
    print(f"  totalRecords means: {total_records_meaning}; totalPages={tp} {'==' if total_pages_per_quarter else '!='} pages actually served → {'per-quarter' if total_pages_per_quarter else 'NOT per-quarter (table-wide or fixed); ignore it and stop at the first 1009'}")
    print(f"  distinct regions: {len(regions)}; distinct activities: {len(activities)}; row fields missing: {missing or 'none'}")
    for r in regions:
        print(f"    region: {r}")

    payload = {
        "run_at": S.now_iso(),
        "status": "ok",
        "endpoint": S.MONSHAAT_ENDPOINT + "?paginationIndex={1-based}&recordsPerPage={n}",
        "availability": availability,
        "quarters_with_data": with_data,
        "latest_quarter": latest,
        "first_1009_before": first_1009_before,
        "first_1009_after": first_1009_after,
        "page_sizes": sizes,
        "semantics": {
            "totalRecords": total_records_meaning,
            "totalPages_reported": tp,
            "pages_actually_served": pages,
            "totalPages_is_per_quarter": total_pages_per_quarter,
            "rows_repeat_across_pages": len(keys) != len(distinct),
            "page1_page2_overlap": len(k1 & k2),
            "stop_rule": "stop at the first confirmed 1009 after retrying transient statuses; never trust totalPages",
            "transient_status_codes": sorted(TRANSIENT_CODES),
            "final_status_codes": [NO_DATA],
        },
        "latest_quarter_shape": {"rows": len(rows), "distinct_region_activity": len(distinct), "regions": regions, "n_activities": len(activities), "activities": activities, "fields": list(FIELDS), "pages_lost_to_transient": failed},
        "log_n_calls": len(log),
    }
    p = S.write_out("phase1_monshaat_probe", payload)
    print(f"→ {p}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
