"""Phase 0 — verify and archive the national sources (SOP §3). Reads, prints, writes ONLY archives.

    python -m calibration.probe_sources [--skip-monshaat] [--offline]

What it does, in order:
  1. Downloads each SAMA table from the KAPSARC mirror export API and the latest SAMA weekly POS
     bulletin PDF, archiving each with SHA-256 + access date + edition label (§1.2, §3.3). With
     --offline it verifies the existing archives against their .sha256 sidecars instead.
  2. Loads every archive through the loaders in calibration/sources.py, so every documented file
     quirk (column shift, BOM, delimiter, spans, Individuals' Loans present, sums to Total) is
     asserted in code rather than assumed (§3.4).
  3. Probes the Monsha'at gateway for pages 1, 2 and 76 of the most recent quarters, with retries
     and backoff, and records the pagination semantics — or the failure — in
     calibration/out/phase0_probe.json (§3.2). No sector-mix loop is written here.

Exit code 0 when the SAMA archives verify and load; the Monsha'at probe result is reported,
not gated — an unreachable gateway blocks Phase 1, it does not invalidate Phases 2–4.
"""

from __future__ import annotations

import argparse
import json
import sys
import time

import pandas as pd
import requests

from calibration import hijri
from calibration import sources as S
from generator.generate import load_config

UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)", "Accept": "application/json, text/csv, application/pdf, */*"}


def fetch(url: str, timeout: int = 300, tries: int = 3) -> bytes:
    last = None
    for k in range(tries):
        try:
            r = requests.get(url, timeout=timeout, headers=UA)
            r.raise_for_status()
            return r.content
        except Exception as e:  # noqa: BLE001
            last = e
            time.sleep(3 * (k + 1))
    raise RuntimeError(f"download failed after {tries} tries: {url} — {last!r}")


# --------------------------------------------------------------------------- #
# 1. SAMA archives
# --------------------------------------------------------------------------- #


def archive_sama(offline: bool) -> list[dict]:
    records = []
    for fname, (dataset, publication) in S.SAMA_FILES.items():
        dest = S.SAMA / fname
        if offline:
            rec = S.verify_archive(dest)
            print(f"  verified  {fname:44s} sha256 {rec['sha256'][:12]}…  ({rec['access_date']})")
        else:
            content = fetch(S.KAPSARC_EXPORT.format(dataset=dataset))
            rec = S.archive(
                dest,
                content,
                {
                    "origin_body": "Saudi Central Bank (SAMA)",
                    "publication": publication,
                    "retrieval": "KAPSARC Data Portal mirror (OpenDataSoft export API)",
                    "retrieval_url": S.KAPSARC_EXPORT.format(dataset=dataset),
                    "dataset_page": S.KAPSARC_PAGE.format(dataset=dataset),
                    "edition": "KAPSARC export as served on the access date; span recorded below after loading",
                },
            )
            print(f"  archived  {fname:44s} {rec['bytes']:>9,} bytes  sha256 {rec['sha256'][:12]}…")
        records.append(rec)

    dest = S.SAMA / S.SAMA_WEEKLY_BULLETIN_PDF
    if offline:
        rec = S.verify_archive(dest)
        print(f"  verified  {dest.name:44s} sha256 {rec['sha256'][:12]}…")
    else:
        content = fetch(S.SAMA_WEEKLY_BULLETIN_URL, tries=4)
        assert content[:4] == b"%PDF", "SAMA bulletin download is not a PDF"
        rec = S.archive(
            dest,
            content,
            {
                "origin_body": "Saudi Central Bank (SAMA)",
                "publication": "Weekly Points of Sale Transactions — report for the week 6–12 Sep 2026 (Table 1: by activity; Tables 2.1–2.2: by city)",
                "retrieval": "SAMA website, direct PDF",
                "retrieval_url": S.SAMA_WEEKLY_BULLETIN_URL,
                "edition": "12-Sep-2026 bulletin (four weeks: 16 Aug–12 Sep 2026)",
            },
        )
        print(f"  archived  {dest.name:44s} {rec['bytes']:>9,} bytes  sha256 {rec['sha256'][:12]}…")
    records.append(rec)
    return records


def load_and_assert() -> dict:
    """Run every loader; each one asserts the documented quirks. Returns spans for the meta files."""
    out = {}
    m = S.load_pos_sector_monthly()
    out["pos_by_sector_monthly_2016_2023.csv"] = {"rows_tidy": len(m), "months": int(m["date"].nunique()), "sectors": int(m["sector"].nunique()), "span": [str(m["date"].min().date()), str(m["date"].max().date())]}
    print(f"  pos_by_sector_monthly: {out['pos_by_sector_monthly_2016_2023.csv']}  — column-shift quirk asserted")
    a = S.load_pos_aggregate_monthly()
    sales = a[a["indicator"] == S.AGG_SALES]
    out["pos_aggregate_1995_2026.csv"] = {"rows_tidy": len(a), "indicators": int(a["indicator"].nunique()), "span": [str(sales["date"].min().date()), str(sales["date"].max().date())], "monthly_sales_obs": len(sales)}
    print(f"  pos_aggregate: {out['pos_aggregate_1995_2026.csv']}")
    w = S.load_pos_weekly_sector()
    out["pos_by_sector_weekly_2020_2025.csv"] = {"rows_tidy": len(w), "weeks": int(w["week_start"].nunique()), "sectors": int(w["sector"].nunique()), "span": [str(w["week_start"].min().date()), str(w["week_start"].max().date())]}
    print(f"  pos_by_sector_weekly (national total): {out['pos_by_sector_weekly_2020_2025.csv']}")
    c = S.load_bank_credit_quarterly()
    ind_share = c[c["activity"] == S.INDIVIDUALS].set_index("quarter_start")["value_mn_sar"] / c[c["activity"] == "Total"].set_index("quarter_start")["value_mn_sar"]
    out["bank_credit_by_activity_2021_2026.csv"] = {"rows_tidy": len(c), "activities_excl_total": int(c["activity"].nunique()) - 1, "span": [str(c["quarter_start"].min().date()), str(c["quarter_start"].max().date())], "individuals_loans_share_latest": round(float(ind_share.iloc[-1]), 4)}
    print(f"  bank_credit: {out['bank_credit_by_activity_2021_2026.csv']}  — Individuals' Loans present, sums to Total")
    return out


def stamp_spans(records: list[dict], spans: dict) -> None:
    for rec in records:
        if rec["file"] in spans:
            meta_path = S.SAMA / (rec["file"] + ".meta.json")
            rec.update({"span": spans[rec["file"]]["span"], "rows_tidy": spans[rec["file"]]["rows_tidy"]})
            meta_path.write_text(json.dumps(rec, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


# --------------------------------------------------------------------------- #
# 3. Monsha'at pagination probe (§3.2)
# --------------------------------------------------------------------------- #


def monshaat_get(year: int, quarter: int, page: int, per_page: int, timeout: int = 120) -> dict:
    url = S.MONSHAAT_ENDPOINT.format(year=year, quarter=quarter) + f"?paginationIndex={page}&recordsPerPage={per_page}"
    t0 = time.time()
    try:
        r = requests.get(url, timeout=timeout, headers=UA)
        try:
            body = r.json()
        except ValueError:
            body = {"raw": r.text[:300]}
        return {"url": url, "http": r.status_code, "seconds": round(time.time() - t0, 1), "statusCode": body.get("statusCode") if isinstance(body, dict) else None, "body": body}
    except Exception as e:  # noqa: BLE001
        return {"url": url, "http": None, "seconds": round(time.time() - t0, 1), "statusCode": None, "error": repr(e)[:200]}


def probe_monshaat(quarters: list[tuple[int, int]], pages=(1, 2, 76), per_page: int = 50, tries: int = 3) -> dict:
    """Fetch pages 1, 2 and 76 and report what totalRecords / totalPages mean — or record that the gateway did not answer."""
    result = {"probed_at": S.now_iso(), "attempts": [], "resolved": None}
    for year, q in quarters:
        for page in pages:
            for k in range(tries):
                a = monshaat_get(year, q, page, per_page if k == 0 else max(10, per_page // (2 * (k + 1))))
                a.update({"year": year, "quarter": q, "page": page, "try": k})
                body = a.pop("body", None)
                stats = body.get("statistics") if isinstance(body, dict) else None
                if stats:
                    a["n_rows"] = len(stats)
                    a["pagination"] = body.get("pagination")
                    a["regions"] = sorted({s.get("region") for s in stats})
                    a["activities"] = len({s.get("economicActivity") for s in stats})
                    a["first_row"] = stats[0]
                    (S.MONSHAAT / f"probe_{year}Q{q}_p{page}.json").write_text(json.dumps(body, ensure_ascii=False) + "\n", encoding="utf-8")
                result["attempts"].append(a)
                code = a.get("statusCode")
                print(f"  Monsha'at {year}Q{q} page {page} try {k}: http={a['http']} statusCode={code} {a['seconds']}s {'rows=' + str(a['n_rows']) if stats else ''}")
                if stats or code == 1009:  # data, or an explicit 'No Data Found' — retrying does not change either
                    break
                time.sleep(5 * (k + 1))  # 1016 Request Timeout: back off, shrink the page
    with_data = [a for a in result["attempts"] if "n_rows" in a]
    if with_data:
        by_q = {}
        for a in with_data:
            by_q.setdefault((a["year"], a["quarter"]), {})[a["page"]] = a
        result["resolved"] = {f"{y}Q{q}": {p: {k: v for k, v in a.items() if k in ("n_rows", "pagination", "regions", "activities")} for p, a in pages_.items()} for (y, q), pages_ in by_q.items()}
    else:
        codes = sorted({str(a.get("statusCode")) for a in result["attempts"]})
        result["resolved"] = {"status": "gateway_unavailable", "status_codes_seen": codes, "note": "1016 = Request Timeout at the provider; 1009 = No Data Found for every year/quarter tried (Gregorian 2022–2026 and Hijri 1444–1447)"}
    return result


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--offline", action="store_true", help="verify existing archives instead of downloading")
    ap.add_argument("--skip-monshaat", action="store_true")
    ap.add_argument("--config", default="config.yaml")
    args = ap.parse_args(argv)
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

    print("== Phase 0.1: SAMA archives (§1.2 archive on download) ==")
    S.SAMA.mkdir(parents=True, exist_ok=True)
    S.MONSHAAT.mkdir(parents=True, exist_ok=True)
    records = archive_sama(args.offline)

    print("\n== Phase 0.2: load every archive through its quirk-asserting loader (§3.4) ==")
    spans = load_and_assert()
    if not args.offline:
        stamp_spans(records, spans)

    print("\n== Phase 0.3: Hijri converter vs the pinned ramadan_calendar ==")
    cfg = load_config(args.config)
    calendar_findings = []
    for e in cfg["ramadan_calendar"]:
        w = hijri.ramadan_window(int(e["hijri_year"]))
        bad = {k: (e[k], str(w[k].date())) for k in ("ramadan_start", "ramadan_end", "eid_start", "eid_end") if w[k] != pd.Timestamp(e[k])}
        if bad:
            calendar_findings.append({"hijri_year": e["hijri_year"], "config_vs_umm_al_qura": bad, "ramadan_days_umm_al_qura": w["ramadan_days"]})
            print(f"  FINDING  ramadan_calendar {e['hijri_year']}: config vs Umm al-Qura converter differ on {bad}")
        else:
            print(f"  ok       ramadan_calendar {e['hijri_year']} matches the Umm al-Qura converter")
    if not calendar_findings:
        hijri.assert_matches_config(cfg)  # the strict form the Phase 2 fit relies on

    probe = None
    if not args.skip_monshaat:
        print("\n== Phase 0.4: Monsha'at pagination probe (§3.2) — pages 1, 2, 76 ==")
        probe = probe_monshaat([(2025, 2), (2025, 4), (2026, 1)])
        print(f"  resolved: {json.dumps(probe['resolved'], ensure_ascii=False)[:400]}")

    payload = {
        "run_at": S.now_iso(),
        "sama_archives": records,
        "spans": spans,
        "ramadan_calendar_findings": calendar_findings,
        "monshaat_probe": probe,
    }
    p = S.write_out("phase0_probe", payload)
    print(f"\n→ {p}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
