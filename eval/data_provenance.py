"""Is the full-scale data/ still what the current generator produces? (evidence-pack data statement)

    python -m eval.data_provenance [--full data] [--quick data/quick] [--out eval/out/data_provenance.md]

`data/` is git-ignored and was generated once; a file date alone does not prove it matches the
code. Generation is deterministic per business (RNG keyed on population seed, business_id and
purpose), and quick mode generates a subset of the same IDs with the same seeds. So if a
`data/quick` generated from the current code matches `data/` row for row on every shared
business, `data/` is what the current generator produces for those businesses. This script
checks that on every engine-facing input table and the labels, and reports file dates, seeds and
the config hashes. It writes nothing under data/.
"""

from __future__ import annotations

import argparse
import datetime as dt
import subprocess
import sys
from pathlib import Path

import pandas as pd

from calibration.check_config import config_sha256, generator_param_hash
from generator.generate import load_config

TABLES = {
    "businesses": ["business_id"],
    "daily_aggregates": ["business_id", "date"],
    "balances_monthly": ["business_id", "month_end"],
    "labels": ["business_id"],
    "obligations": None,
    "facilities": ["business_id"],
}
DROP = {"transaction_id", "obligation_id"}  # surrogate keys number from 1 in each run
# generator/dimensions.py draws these from latent_rank(), a percentile rank over every business in the
# run, so quick mode (600 ranked) and full mode (11,000 ranked) legitimately differ in them.
RANK_DRIVEN = {
    "facilities": {"facility_drawn", "own_funds", "headroom", "facility_type", "emergency_line_since"},
    "obligations": {"status", "status_change_date", "next_date"},
}


def mtime(p: Path) -> str:
    return dt.datetime.fromtimestamp(p.stat().st_mtime).astimezone().strftime("%Y-%m-%d %H:%M") if p.exists() else "absent"


def compare(full: pd.DataFrame, quick: pd.DataFrame, key: list[str] | None, skip: set[str]) -> tuple[int, bool, dict[str, int]]:
    """Returns (rows, identical outside `skip`, {column: mismatching rows} for every column that differs)."""
    ids = set(quick["business_id"])
    f = full[full["business_id"].isin(ids)].drop(columns=[c for c in DROP if c in full], errors="ignore")
    q = quick.drop(columns=[c for c in DROP if c in quick], errors="ignore")
    cols = sorted(set(f.columns) & set(q.columns))
    order = key or sorted(set(cols) - skip)
    f = f[cols].sort_values(order, kind="stable").reset_index(drop=True)
    q = q[cols].sort_values(order, kind="stable").reset_index(drop=True)
    if len(f) != len(q):
        return len(q), False, {"(row count)": abs(len(f) - len(q))}
    diff = {c: int((~((f[c] == q[c]) | (f[c].isna() & q[c].isna()))).sum()) for c in cols}
    diff = {c: n for c, n in diff.items() if n}
    return len(q), not (set(diff) - skip), diff


def tx_compare(full_path: Path, quick_path: Path) -> tuple[int, int, bool]:
    """Transactions are large: compare per-business row counts and value sums, streaming the full file."""
    q = pd.read_csv(quick_path, usecols=["business_id", "direction", "amount", "sample_weight"])
    ids = set(q["business_id"])
    parts = []
    for chunk in pd.read_csv(full_path, usecols=["business_id", "direction", "amount", "sample_weight"], chunksize=2_000_000):
        parts.append(chunk[chunk["business_id"].isin(ids)])
    f = pd.concat(parts)

    def agg(t: pd.DataFrame) -> pd.DataFrame:
        return t.groupby(["business_id", "direction"]).agg(rows=("amount", "size"), value=("amount", "sum"), weight=("sample_weight", "sum")).round(6)

    a, b = agg(f), agg(q)
    return len(q), len(f), a.equals(b)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--full", default="data")
    ap.add_argument("--quick", default="data/quick")
    ap.add_argument("--config", default="config.yaml")
    ap.add_argument("--out", default="eval/out/data_provenance.md")
    args = ap.parse_args(argv)
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    full, quick = Path(args.full), Path(args.quick)
    cfg = load_config(args.config)
    head = subprocess.run(["git", "rev-parse", "--short", "HEAD"], capture_output=True, text=True, check=False).stdout.strip()

    rows = []
    for name, key in TABLES.items():
        f, q = full / f"{name}.csv", quick / f"{name}.csv"
        skip = RANK_DRIVEN.get(name, set())
        n, same, diff = compare(pd.read_csv(f), pd.read_csv(q), key, skip)
        if not diff:
            result = "identical"
        elif same:
            result = "identical outside rank-driven columns (" + ", ".join(f"`{c}` {k}" for c, k in diff.items()) + " rows differ)"
        else:
            result = "DIFFERENT (" + ", ".join(f"`{c}` {k}" for c, k in diff.items()) + ")"
        rows.append((name, n, result))
    nq, nf, same_tx = tx_compare(full / "transactions.csv", quick / "transactions.csv")
    rows.append(("transactions (per business and direction: row count, Σ amount, Σ sample_weight)", nq, "identical" if same_tx and nq == nf else "DIFFERENT"))
    shared = pd.read_csv(quick / "businesses.csv")["business_id"].nunique()
    all_same = all(not r[2].startswith("DIFFERENT") for r in rows)

    pops = cfg["populations"]
    md = [
        "# Data provenance for the evidence pack",
        "",
        f"- Repository head when checked: `{head}`; Python {sys.version.split()[0]}.",
        f"- `config.yaml` sha256 `{config_sha256()}`; generator-parameter hash `{generator_param_hash(cfg)}` (`calibration.check_config`).",
        (
            f"- Seeds: research {pops['research']['seed']} (IDs {pops['research']['id_range'][0]}–{pops['research']['id_range'][1]}), "
            f"serving {pops['serving']['seed']} (IDs {pops['serving']['id_range'][0]}–{pops['serving']['id_range'][1]}); "
            f"quick mode keeps the first {cfg['quick_mode_n_per_population']} per population."
        ),
        "",
        "| Folder | Generated tables written | Profiles written | Serving store written |",
        "|---|---|---|---|",
        f"| `{full.as_posix()}` | {mtime(full / 'transactions.csv')} | {mtime(full / 'profiles.csv')} | {mtime(full / 'serving.duckdb')} |",
        f"| `{quick.as_posix()}` | {mtime(quick / 'transactions.csv')} | {mtime(quick / 'profiles.csv')} | — |",
        "",
        f"## `{full.as_posix()}` against `{quick.as_posix()}` on the {shared} businesses they share",
        "",
        "| Table | Rows compared | Result |",
        "|---|---|---|",
        *[f"| {n} | {k:,} | **{r}** |" for n, k, r in rows],
        "",
        (
            f"**{'Every table identical, apart from the population-rank-driven columns listed' if all_same else 'NOT all identical'}.** "
            + (
                f"The quick folder was generated from the current code, so `{full.as_posix()}` is what the current generator produces for these {shared} businesses, "
                "and, since generation is per business with the same seeds, for the rest of the population as well, outside the rank-driven columns."
                if all_same
                else "Do not treat the full-scale folder as current until the differences are explained."
            )
        ),
        "",
        (
            "Surrogate keys (`transaction_id`, `obligation_id`) are excluded because each run numbers them from 1. "
            "Facility utilisation and obligation cancellations are drawn from `generator/dimensions.py` `latent_rank()`, a percentile rank over every business in the run, "
            "so the same business gets different values in a 600-business run and an 11,000-business run. Those columns cannot be checked by this method, "
            "and they are not 'deterministic per business' in the sense CLAUDE.md states for the generator."
        ),
    ]
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text("\n".join(md) + "\n", encoding="utf-8")
    print("\n".join(md))
    print(f"\n→ {out}")
    return 0 if all_same else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
