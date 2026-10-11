"""Load generator tables and run the shared profile engine for a set of businesses.

The engine is the same code path as `python -m profile_engine.compute` — this
module only narrows its input to the requested businesses. That is valid because
every engine computation is per business (the hazard RNG is keyed on business_id
and the §35 z-scores use the pinned reference table, never recomputed), so a
business's profile is identical whether computed alone or in the full batch.

Tables are validated against the Pandera schemas before the engine sees them
(§37.1), exactly as profile_engine.compute does.
"""

from __future__ import annotations

from pathlib import Path

import pandas as pd

from generator import schemas
from generator.generate import load_config
from profile_engine import features as fe
from profile_engine.compute import TX_DTYPES, ramadan_from_config

CHUNK_ROWS = 1_000_000


def _read(d: Path, name: str, ids: set[int] | None, **kw) -> pd.DataFrame | None:
    path = d / f"{name}.csv"
    if not path.exists():
        return None
    df = pd.read_csv(path, **kw)
    return df[df["business_id"].isin(ids)].reset_index(drop=True) if ids else df


def load_tables(d: str | Path, business_ids: list[int] | None = None) -> dict[str, pd.DataFrame]:
    """All tables for `business_ids` (all businesses if None). Transactions are streamed."""
    d = Path(d)
    ids = {int(b) for b in business_ids} if business_ids else None
    t: dict[str, pd.DataFrame] = {
        "businesses": _read(d, "businesses", ids, parse_dates=["start_date", "window_end", "operating_start_date"], dtype={"declared_mcc_code": "Int64"}),
        "daily_aggregates": _read(d, "daily_aggregates", ids, parse_dates=["date"]),
        "balances_monthly": _read(d, "balances_monthly", ids, parse_dates=["month_end"]),
        "labels": _read(d, "labels", ids),
        "obligations": _read(d, "obligations", ids, parse_dates=["next_date", "final_date", "status_change_date"]),
        "facilities": _read(d, "facilities", ids, parse_dates=["emergency_line_since"]),
    }
    tx_path = d / "transactions.csv"
    if ids:
        parts = []
        for c in pd.read_csv(tx_path, parse_dates=["date"], dtype=TX_DTYPES, chunksize=CHUNK_ROWS):
            hit = c[c["business_id"].isin(ids)]
            if len(hit):
                parts.append(hit)
        t["transactions"] = pd.concat(parts, ignore_index=True)
    else:
        t["transactions"] = pd.read_csv(tx_path, parse_dates=["date"], dtype=TX_DTYPES)
    t = {k: v for k, v in t.items() if v is not None}
    if ids:
        missing = ids - set(t["businesses"]["business_id"])
        if missing:
            raise KeyError(f"business_id(s) not in {d}/businesses.csv: {sorted(missing)}")
    return t


def run_profiles(tables: dict[str, pd.DataFrame], cfg: dict | None = None) -> dict[str, pd.DataFrame]:
    """Validate, then run the profile engine. Returns features / status / nulls frames."""
    cfg = cfg or load_config()
    validated = schemas.validate_engine_tables({k: v for k, v in tables.items() if k in schemas.ENGINE_FACING})
    tables = {**tables, **validated}
    tx = tables["transactions"]
    tx["counterparty_id"] = tx["counterparty_id"].astype(object).where(tx["counterparty_id"].notna(), None)
    wins, years = ramadan_from_config(cfg)
    stats, _ = fe.load_reference_stats()
    pe = cfg.get("profile_engine", {})
    return fe.compute_profiles(
        tables, wins, years, reference_stats=stats,
        hazard_seed=int(pe.get("hazard_seed", 0)),
        coverage_min_by_source=pe.get("coverage_min_days_by_source"),
    )
