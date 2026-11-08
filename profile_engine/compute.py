"""CLI: compute the profile feature vector for every business in a data directory.

    python -m profile_engine.compute --dir data          # synthetic
    python -m profile_engine.compute --dir data/berka    # Berka — identical engine, no flags
    python -m profile_engine.compute --dir data --build-reference-stats   # §35: build the pinned v2 stats once (DECISIONS entry 35)

--build-reference-stats writes profile_engine/sector_reference_stats_v2.json from the research population and
re-scores 55–59 with it. It refuses to write v1 (kept for pre-entry-35 receipts) and refuses to replace an existing
v2 unless --overwrite-reference-stats is also passed.

Writes into the data directory (git-ignored):
  profiles.csv          wide: one row per business, features by name (+ financing_outflow_ratio_code diagnostic)
  profile_nulls.csv     long: business_id, feature_id, feature, reason
  profile_status.csv    §15 state per business: scored / partial_profile / insufficient_data
  profile_coverage.csv  coverage share for the counterparty features (SOP_Data_Grounding §6.1)
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

import pandas as pd

from generator import schemas
from generator.generate import load_config
from profile_engine import features as fe

TX_DTYPES = {"direction": "category", "counterparty_type": "category", "category": "category", "subfamily": "category", "data_source": "category", "evidence_class": "category"}


def load_tables(d: Path) -> dict[str, pd.DataFrame]:
    t = {
        "transactions": pd.read_csv(d / "transactions.csv", parse_dates=["date"], dtype=TX_DTYPES),
        "daily_aggregates": pd.read_csv(d / "daily_aggregates.csv", parse_dates=["date"]),
        "businesses": pd.read_csv(d / "businesses.csv", parse_dates=["start_date", "window_end", "operating_start_date"], dtype={"declared_mcc_code": "Int64"}),
    }
    for opt, dates, dtype in (
        ("balances_monthly", ["month_end"], None),
        ("obligations", ["next_date", "final_date", "status_change_date"], None),
        ("facilities", ["emergency_line_since"], None),
        # counterparty_id as object, as pipeline/data.py and eval/gate_week3.py read it (entry 30 review)
        ("counterparty_windows", [], {"counterparty_id": object}),
    ):
        if (d / f"{opt}.csv").exists():
            t[opt] = pd.read_csv(d / f"{opt}.csv", parse_dates=dates, dtype=dtype)
    return t


def check_reference_stats_target(path: Path, overwrite: bool = False) -> None:
    """§35 / DECISIONS entry 35: the pinned stats are built once. Never write v1; never replace an existing file unasked."""
    if path.resolve() == fe.REFERENCE_STATS_V1_PATH.resolve():
        raise SystemExit(f"refusing to write {path.name}: v1 is kept byte-identical so pre-entry-35 receipts stay reproducible (DECISIONS entry 35)")
    if path.exists() and not overwrite:
        raise SystemExit(f"refusing to overwrite {path.name}: the reference stats are pinned once; pass --overwrite-reference-stats to replace them deliberately")


def write_reference_stats(ref: dict, path: Path, overwrite: bool = False) -> None:
    check_reference_stats_target(path, overwrite)
    path.write_text(json.dumps(ref, indent=2), encoding="utf-8")


def ramadan_from_config(cfg: dict) -> tuple[list, set[int]]:
    wins, years = [], set()
    for e in cfg["ramadan_calendar"]:
        wins.append((pd.Timestamp(e["ramadan_start"]), pd.Timestamp(e["eid_end"])))
        years.update({pd.Timestamp(e["ramadan_start"]).year, pd.Timestamp(e["eid_end"]).year})
    return wins, years


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dir", default="data")
    ap.add_argument("--config", default="config.yaml")
    ap.add_argument("--build-reference-stats", action="store_true", help=f"§35: build the pinned sector reference table ({fe.REFERENCE_STATS_PATH.name}) from this directory's research population")
    ap.add_argument("--overwrite-reference-stats", action="store_true", help="with --build-reference-stats: replace an existing pinned file (never v1)")
    args = ap.parse_args(argv)
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    d = Path(args.dir)
    cfg = load_config(args.config)
    t0 = time.time()
    if args.build_reference_stats:  # refuse before the long run, not after it
        check_reference_stats_target(fe.REFERENCE_STATS_PATH, args.overwrite_reference_stats)

    print(f"loading + validating tables from {d.resolve()} …", flush=True)
    tables = load_tables(d)
    validated = schemas.validate_engine_tables({k: v for k, v in tables.items() if k in schemas.ENGINE_FACING})
    tables.update(validated)
    tx = tables["transactions"]
    tx["counterparty_id"] = tx["counterparty_id"].astype(object).where(tx["counterparty_id"].notna(), None)

    wins, years = ramadan_from_config(cfg)
    stats, stats_hash = fe.load_reference_stats()
    if stats is None and not args.build_reference_stats:
        print("  §35 reference stats absent — features 55–59 will be null (reference_stats_missing)", flush=True)
    elif stats is not None:
        print(f"  §35 reference stats: {fe.REFERENCE_STATS_PATH.name}, sha256 (canonical LF) {stats_hash}", flush=True)

    pe = cfg.get("profile_engine", {})
    kwargs = {"hazard_seed": int(pe.get("hazard_seed", 0)), "coverage_min_by_source": pe.get("coverage_min_days_by_source")}
    print(f"  §15 eligibility threshold by source: {kwargs['coverage_min_by_source']}")
    out = fe.compute_profiles(tables, wins, years, reference_stats=stats, **kwargs)
    if args.build_reference_stats:
        ref = fe.build_reference_stats(out["features"], tables["businesses"])
        write_reference_stats(ref, fe.REFERENCE_STATS_PATH, args.overwrite_reference_stats)
        stats, stats_hash = fe.load_reference_stats()
        print(f"  wrote {fe.REFERENCE_STATS_PATH.name} (sha256, canonical LF, {stats_hash}) version {ref['version']}, population {ref['population']}, from {ref['n_businesses']} businesses — re-scoring z-features")
        before = out["features"]
        out = fe.compute_profiles(tables, wins, years, reference_stats=stats, **kwargs)
        z_cols = {fe.F[z] for z in fe.Z_FEATURES}
        base = [c for c in before.columns if c not in z_cols]
        same = before[base].equals(out["features"][base])
        print(f"  re-score check: {len(base)} non-z columns identical between the two passes: {same}; z-features changed: {sorted(z_cols)}")

    for name, df in out.items():
        path = d / f"profile{'s' if name == 'features' else '_' + name}.csv"
        df.to_csv(path, index=False, date_format="%Y-%m-%d")
        print(f"  wrote {path.name:24s} {len(df):>8,} rows", flush=True)
    st = out["status"]["status"].value_counts().to_dict()
    print(f"  status: {st}")
    print(f"  null reasons: {out['nulls']['reason'].value_counts().to_dict()}")
    print(f"done in {time.time() - t0:.0f}s")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
