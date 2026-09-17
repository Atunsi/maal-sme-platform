"""Phase 2 — Berka coverage bands + evidence registry report (SOP_Data_Grounding §6).

Reads the engine output in data/berka/ (profiles.csv, profile_nulls.csv,
profile_status.csv, profile_coverage.csv), checks the §6.4 acceptance criteria
as assertions, and writes eval/out/berka_coverage.md.

    python -m eval.berka_coverage [--dir data/berka] [--out eval/out/berka_coverage.md]

Exit code 1 if an acceptance criterion fails.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import pandas as pd

from berka_adapter import coverage as cov
from profile_engine.evidence import CLASS_LABELS, EVIDENCE
from profile_engine.registry import COUNTERPARTY_FEATURE_IDS, FEATURE_NAMES

F = FEATURE_NAMES
FAILURES: list[str] = []


def check(cond: bool, msg: str) -> None:
    print(("  PASS  " if cond else "  FAIL  ") + msg)
    if not cond:
        FAILURES.append(msg)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dir", default="data/berka")
    ap.add_argument("--out", default="eval/out/berka_coverage.md")
    args = ap.parse_args(argv)
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    d = Path(args.dir)
    prof = pd.read_csv(d / "profiles.csv")
    nulls = pd.read_csv(d / "profile_nulls.csv", dtype={"feature_id": str})
    status = pd.read_csv(d / "profile_status.csv")
    cshare = pd.read_csv(d / "profile_coverage.csv", dtype={"feature_id": str})
    labels = pd.read_csv(d / "labels.csv")
    src = pd.read_csv(d / "businesses.csv", usecols=["data_source"])["data_source"].iloc[0]
    check(src == "external_real", f"engine ran on data_source={src}")

    scored_ids = status.loc[status["status"] != "insufficient_data", "business_id"]
    n_scored = len(scored_ids)
    nulls_s = nulls[nulls["business_id"].isin(scored_ids)]
    print(f"\n== Berka coverage — {n_scored} scored of {len(status)} accounts; status {status['status'].value_counts().to_dict()} ==")

    rows = []
    for fid, name in F.items():
        band = cov.band_of(fid)
        cls, basis = EVIDENCE[fid]
        n_nonnull = int(prof.loc[prof["business_id"].isin(scored_ids), name].notna().sum())
        reasons = nulls_s.loc[nulls_s["feature_id"] == str(fid), "reason"].value_counts().to_dict()
        # a null that is the feature's own definition (runway when not burning, no CUSUM break) or an unbuilt module is not a coverage gap
        n_nonnull += sum(v for k, v in reasons.items() if k in ("not_applicable", "no_break_detected", "not_implemented"))
        share = ""
        if fid in COUNTERPARTY_FEATURE_IDS:
            cs = cshare.loc[cshare["feature_id"] == str(fid), "coverage_share"]
            share = f"{cs.median():.2f} (median value share with a counterparty)"
        rows.append((str(fid), name, band, cls, n_nonnull / n_scored if n_scored else 0.0, reasons, share, basis))

    # §6.4 acceptance criteria, as assertions
    for fid in cov.NOT_COMPUTABLE:
        reasons = nulls_s.loc[nulls_s["feature_id"] == str(fid), "reason"].unique().tolist()
        check(
            set(reasons) <= {"not_available_in_source"} and len(reasons) == 1,
            f"not_computable feature {fid} ({F[fid]}) returns only not_available_in_source (got {reasons})",
        )
    for fid in COUNTERPARTY_FEATURE_IDS:
        check((cshare["feature_id"] == str(fid)).sum() == n_scored, f"partial feature {fid} ({F[fid]}) reports a coverage share for every scored account")
    check(set(EVIDENCE) == set(F), "EVIDENCE registry covers every feature, no gaps")
    computable_nonnull = [r for r in rows if r[2] == "computable" and r[4] < 0.5]
    check(
        not computable_nonnull,
        "every `computable` feature is non-null (or null by its own definition) on ≥50% of scored accounts "
        f"(short: {[(r[0], round(r[4], 2)) for r in computable_nonnull]})",
    )

    counts = {b: sum(1 for r in rows if r[2] == b) for b in ("computable", "partial", "not_computable")}
    cls_counts = {c: sum(1 for r in rows if r[3] == c) for c in "ABC"}
    thr = "coverage_days_90d ≥ 10 for external_real (DECISIONS.md entry 9)"

    md = [
        "# Berka coverage bands and evidence registry (Phase 2)",
        "",
        f"Source: `data_source = external_real` (PKDD'99 Berka, archived `sources/berka/`). Eligibility: {thr}.",
        (f"Accounts: {len(status)} total → {n_scored} scored ({status['status'].value_counts().to_dict()}); "
        f"labelled accounts scorable: {int(labels['business_id'].isin(scored_ids).sum())} / {len(labels)}."),
        "",
        (f"Band sizes: computable {counts['computable']}, partial {counts['partial']}, not_computable {counts['not_computable']} "
        f"(the SOP expected ~33 / ~10 / ~16 over 59 features; this registry has {len(rows)} entries because 18b, 60–65 and 62b are included)."),
        f"Evidence classes: A {cls_counts['A']}, B {cls_counts['B']}, C {cls_counts['C']}.",
        "",
        "Population caveat: Czech retail and small-account banking data, 1993–1998. Never presented as Saudi SME data.",
        "",
        "| # | Feature | Band | Class | Available share (scored; null-by-definition counts as available) | Null reasons | Coverage share | Basis |",
        "|---|---|---|---|---|---|---|---|",
    ]
    for fid, name, band, cls, nn, reasons, share, basis in rows:
        why = cov.WHY_PARTIAL.get(fid) or cov.WHY_NOT_COMPUTABLE.get(fid)
        r_txt = ", ".join(f"{k} {v}" for k, v in reasons.items()) or "—"
        md.append(f"| {fid} | `{name}` | {band} | {cls} ({CLASS_LABELS[cls]}) | {nn:.0%} | {r_txt} | {share or '—'} | {basis}{(' — ' + why) if why else ''} |")
    md += ["", "## Acceptance (§6.4)", ""]
    md += [f"- {'PASS' if m not in FAILURES else 'FAIL'}: {m}" for m in _all_checks]
    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    Path(args.out).write_text("\n".join(md) + "\n", encoding="utf-8")
    print(f"\nreport → {args.out}")
    print("PHASE 2 ACCEPTED" if not FAILURES else f"PHASE 2 FAILED — {len(FAILURES)} criterion/criteria")
    return 0 if not FAILURES else 1


_all_checks: list[str] = []
_orig_check = check


def check(cond: bool, msg: str) -> None:
    _all_checks.append(msg)
    _orig_check(cond, msg)


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
