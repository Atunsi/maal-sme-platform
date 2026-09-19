"""Raw Berka loading with a verified column map (SOP_Data_Grounding §5.4).

Every table goes through `load_table`, which checks the upload's header against
column_map.yaml and fails with the actual column list on mismatch. Dates are
parsed from YYMMDD; value domains are asserted. Nothing is silently coerced.
"""

from __future__ import annotations

from pathlib import Path

import pandas as pd
import yaml

RAW_DIR = Path("data/berka_raw")
COLUMN_MAP = Path(__file__).with_name("column_map.yaml")

# Text columns that must stay strings (partner account numbers lose leading
# zeros and become floats under pandas' default inference).
_STRING_COLS = {"bank", "account", "bank_to", "account_to", "k_symbol", "operation", "type", "status", "birth_number"}


def load_column_map(path: Path = COLUMN_MAP) -> dict:
    with open(path, encoding="utf-8") as f:
        return yaml.safe_load(f)


def load_table(name: str, raw_dir: Path = RAW_DIR, cmap: dict | None = None) -> pd.DataFrame:
    cmap = cmap or load_column_map()
    spec = cmap["tables"][name]
    path = raw_dir / spec["file"]
    if not path.exists():
        raise FileNotFoundError(f"{path} not found — extract sources/berka/the-berka-dataset.zip into {raw_dir}")

    header = pd.read_csv(path, sep=cmap["delimiter"], nrows=0).columns.tolist()
    wanted = spec["columns"]  # canonical -> upload column
    missing = [u for u in wanted.values() if u not in header]
    if missing:
        raise ValueError(
            f"{path.name}: expected upload columns {missing} not found. "
            f"Actual header: {header}. Fix berka_adapter/column_map.yaml, do not coerce."
        )

    dtype = {u for c, u in wanted.items() if c in _STRING_COLS}
    df = pd.read_csv(
        path,
        sep=cmap["delimiter"],
        usecols=list(wanted.values()),
        dtype={u: "string" for u in dtype},
        keep_default_na=True,
    )
    df = df.rename(columns={u: c for c, u in wanted.items()})

    for col in spec.get("dates", []):
        raw = df[col].astype("string").str.strip().str[:6]
        parsed = pd.to_datetime(raw, format=cmap["date_format"], errors="coerce")
        bad = parsed.isna() & df[col].notna()
        if bad.any():
            raise ValueError(f"{path.name}.{col}: {int(bad.sum())} unparseable dates, e.g. {df.loc[bad, col].head(3).tolist()}")
        df[col] = parsed

    for col, allowed in spec.get("domains", {}).items():
        vals = df[col].fillna("").astype(str).str.strip()
        outside = sorted(set(vals.unique()) - {a.strip() for a in allowed})
        if outside:
            raise ValueError(f"{path.name}.{col}: values outside declared domain: {outside}")
        df[col] = vals
    return df


def load_all(raw_dir: Path = RAW_DIR, tables: tuple[str, ...] | None = None) -> dict[str, pd.DataFrame]:
    cmap = load_column_map()
    names = tables or tuple(cmap["tables"])
    return {n: load_table(n, raw_dir, cmap) for n in names}
