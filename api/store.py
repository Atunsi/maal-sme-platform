"""Serving store — the demo population's input rows, indexed for one-business reads (§12, §23, §37.2).

    python -m api.store --dir data --out data/serving.duckdb       # build (git-ignored; regenerable)

Why it exists. The Week 8 CLI streams the full transactions.csv (~700 MB) to find one
business's rows — ~30 s a call, fine for the gate, far over the < 2 s API target (§19).
This store holds the SAME rows for the serving population (business_id 10,001–11,000,
§23 — the demo database), sorted by business, so a request reads only that business.

It is a store of INPUTS, not of answers: the API still runs the profile engine and the
lenses on every request, which is what the Week 7 latency test must measure.

Equivalence with the CLI path is a requirement, not a hope:
  * rows keep their original file order (a `_row` column), because the receipt's
    data_sha256 hashes rows in file order;
  * original pandas dtypes are recorded at build time and restored on read (a code read
    back as 5411.0 instead of 5411 would change the hash and the profile);
  * queries run single-threaded with an explicit ORDER BY (§37.2 determinism rule).
eval/latency_test.py asserts that API decisions equal CLI decisions for the demo businesses.
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import UTC, datetime
from pathlib import Path

import duckdb
import pandas as pd

from pipeline.data import load_tables

TABLES = ("businesses", "daily_aggregates", "balances_monthly", "transactions", "obligations", "facilities", "labels")
DEFAULT_STORE = "data/serving.duckdb"


def build(data_dir: str | Path, out: str | Path, population: str = "serving") -> dict:
    d, out = Path(data_dir), Path(out)
    biz = pd.read_csv(d / "businesses.csv", usecols=["business_id", "population"])
    ids = sorted(biz.loc[biz["population"] == population, "business_id"].astype(int))
    tables = load_tables(d, ids)  # the exact CLI loader, so dtypes and order start identical

    if out.exists():
        out.unlink()
    con = duckdb.connect(str(out))
    con.execute("SET threads TO 1")
    meta = {"population": population, "n_businesses": len(ids), "built_at": datetime.now(UTC).isoformat(timespec="seconds"),
            "source_dir": str(d), "dtypes": {}, "rows": {}}
    for name in TABLES:
        df = tables.get(name)
        if df is None:
            continue
        meta["dtypes"][name] = {c: str(t) for c, t in df.dtypes.items()}
        meta["rows"][name] = len(df)
        frame = df.assign(_row=range(len(df)))
        for c, t in frame.dtypes.items():
            if str(t) == "category":
                frame[c] = frame[c].astype(object)
        con.register("frame", frame)
        con.execute(f"CREATE TABLE {name} AS SELECT * FROM frame ORDER BY business_id, _row")
        con.unregister("frame")
    con.execute("CREATE TABLE _meta (k VARCHAR, v VARCHAR)")
    con.execute("INSERT INTO _meta VALUES ('meta', ?)", [json.dumps(meta)])
    con.close()
    return meta


def _restore(df: pd.DataFrame, dtypes: dict[str, str]) -> pd.DataFrame:
    for c, t in dtypes.items():
        if c not in df.columns:
            continue
        if t.startswith("datetime64"):
            df[c] = pd.to_datetime(df[c]).astype(t)
        elif t == "category":
            df[c] = df[c].astype("category")
        elif t in ("object", "str", "string"):
            df[c] = df[c].astype(object).where(df[c].notna(), float("nan"))
        else:
            df[c] = df[c].astype(t)
    return df


class ServingStore:
    """Read-only, single-threaded access to the serving population's input rows."""

    def __init__(self, path: str | Path = DEFAULT_STORE):
        if not Path(path).exists():
            raise FileNotFoundError(f"serving store not found at {path} — build it: python -m api.store --dir data --out {path}")
        self.con = duckdb.connect(str(path), read_only=True)
        self.con.execute("SET threads TO 1")  # §37.2: any query feeding a receipted value
        self.meta = json.loads(self.con.execute("SELECT v FROM _meta WHERE k = 'meta'").fetchone()[0])
        self.ids = {int(r[0]) for r in self.con.execute("SELECT business_id FROM businesses").fetchall()}

    def __contains__(self, b_id: int) -> bool:
        return int(b_id) in self.ids

    def load(self, business_ids: list[int]) -> dict[str, pd.DataFrame]:
        ids = [int(b) for b in business_ids]
        out = {}
        for name, dtypes in self.meta["dtypes"].items():
            df = self.con.execute(
                f"SELECT * FROM {name} WHERE business_id IN (SELECT UNNEST(?)) ORDER BY business_id, _row", [ids]
            ).df()
            out[name] = _restore(df.drop(columns=["_row"]).reset_index(drop=True), dtypes)
        return out


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dir", default="data")
    ap.add_argument("--out", default=DEFAULT_STORE)
    ap.add_argument("--population", default="serving")
    args = ap.parse_args(argv)
    meta = build(args.dir, args.out, args.population)
    print(f"built {args.out}: {meta['n_businesses']} businesses ({meta['population']})")
    for k, v in meta["rows"].items():
        print(f"  {k:18s} {v:>10,} rows")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
