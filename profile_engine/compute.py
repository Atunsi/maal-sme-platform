"""CLI: compute the profile feature vector for every business in a data directory.

    python -m profile_engine.compute --dir data          # synthetic (also writes the pinned §35 reference stats if absent)
    python -m profile_engine.compute --dir data/berka    # Berka — identical engine, no flags

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
    for opt, dates in (
        ("balances_monthly", ["month_end"]),
        ("obligations", ["next_date", "final_date", "status_change_date"]),
        ("facilities", ["emergency_line_since"]),
    ):
        if (d / f"{opt}.csv").exists():
            t[opt] = pd.read_csv(d / f"{opt}.csv", parse_dates=dates)
    return t


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
    ap.add_argument("--build-reference-stats", action="store_true", help="§35: (re)build the pinned sector reference table from this directory's research population")
    args = ap.parse_args(argv)
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    d = Path(args.dir)
    cfg = load_config(args.config)
    t0 = time.time()

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

    pe = cfg.get("profile_engine", {})
    kwargs = {"hazard_seed": int(pe.get("hazard_seed", 0)), "coverage_min_by_source": pe.get("coverage_min_days_by_source")}
    print(f"  §15 eligibility threshold by source: {kwargs['coverage_min_by_source']}")
    out = fe.compute_profiles(tables, wins, years, reference_stats=stats, **kwargs)
    if args.build_reference_stats:
        ref = fe.build_reference_stats(out["features"], tables["businesses"])
        fe.REFERENCE_STATS_PATH.write_text(json.dumps(ref, indent=2), encoding="utf-8")
        stats, stats_hash = fe.load_reference_stats()
        print(f"  wrote {fe.REFERENCE_STATS_PATH.name} (sha256 {stats_hash[:12]}…) from {ref['n_businesses']} research businesses — re-scoring z-features")
        out = fe.compute_profiles(tables, wins, years, reference_stats=stats, **kwargs)

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
