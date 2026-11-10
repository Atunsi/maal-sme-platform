"""Nisab gold price for a Zakat calculation month — DECISIONS 48 and 54.

The nisab is valued at the gold price of the business's calculation month (its `window_end`
month), never at a later date. Source chain, every link archived in `sources/`:

  World Bank Pink Sheet, monthly average gold price, US$ per troy ounce
  × 3.75 SAR per US$ (the riyal's fixed dollar rate)
  ÷ 31.1034768 g per troy ounce

The 3.75 rate is checked each month against SAMA's own rate bulletin: SAMA lists no US-dollar
row (the dollar is the peg), so its SAR-per-UAE-dirham rate × the dirham's 3.6725 dollar peg must
reproduce 3.75 within FX_TOLERANCE. The dirham peg is stated, not archived (entry 54).

    python -m lenses.zakat.nisab_prices --build    # rebuild the table from the archives

Deterministic: no network, no model, no LLM (SOP §2). A month outside the table is refused.
"""

from __future__ import annotations

import argparse
import csv
from functools import lru_cache
from pathlib import Path

import pandas as pd

TABLE = Path("lenses/zakat/gold_monthly_sar_per_gram.csv")
WORLD_BANK = Path("sources/worldbank/CMO-Historical-Data-Monthly_2026-11-03.xlsx")
SAMA_BULLETIN = "sources/sama/fx_bulletin_{month}.xls"
MONTHS = [f"2026-{m:02d}" for m in range(1, 8)]  # the calculation months in the generated data
SAR_PER_USD = 3.75
AED_PER_USD = 3.6725
TROY_OUNCE_G = 31.1034768
FX_TOLERANCE = 0.001
AED_LABEL = "درهم اماراتي"


def _world_bank_gold() -> dict[str, float]:
    import openpyxl

    from calibration.sources import verify_archive

    verify_archive(WORLD_BANK)
    ws = openpyxl.load_workbook(WORLD_BANK, read_only=True, data_only=True)["Monthly Prices"]
    rows = list(ws.iter_rows(values_only=True))
    hdr = next(i for i, r in enumerate(rows[:12]) if any(isinstance(c, str) and c.strip().lower() == "gold" for c in r))
    col = next(j for j, c in enumerate(rows[hdr]) if isinstance(c, str) and c.strip().lower() == "gold")
    if rows[hdr + 1][col] != "($/troy oz)":
        raise ValueError(f"unexpected gold unit {rows[hdr + 1][col]!r}")
    out = {}
    for r in rows[hdr + 2:]:
        if isinstance(r[0], str) and len(r[0]) == 7 and r[0][4] == "M":
            out[f"{r[0][:4]}-{r[0][5:]}"] = float(r[col])
    return out


def _sama_implied_sar_per_usd(month: str) -> float:
    import xlrd

    from calibration.sources import verify_archive

    path = Path(SAMA_BULLETIN.format(month=month))
    verify_archive(path)
    sh = xlrd.open_workbook(path).sheet_by_index(0)
    for r in range(sh.nrows):
        for c in range(sh.ncols - 1):
            if str(sh.cell_value(r, c)).strip() == AED_LABEL:
                return float(sh.cell_value(r, c + 1)) * AED_PER_USD
    raise ValueError(f"{path.name}: no UAE dirham row")


def build(path: Path = TABLE) -> list[dict]:
    gold = _world_bank_gold()
    rows = []
    for m in MONTHS:
        implied = _sama_implied_sar_per_usd(m)
        if abs(implied - SAR_PER_USD) > FX_TOLERANCE:
            raise ValueError(f"{m}: SAMA cross-rate implies {implied:.5f} SAR/USD, not {SAR_PER_USD} within {FX_TOLERANCE}")
        rows.append({
            "month": m,
            "gold_usd_per_troy_oz": gold[m],
            "sar_per_usd": SAR_PER_USD,
            "sama_implied_sar_per_usd": round(implied, 5),
            "gold_sar_per_gram": round(gold[m] * SAR_PER_USD / TROY_OUNCE_G, 4),
        })
    with Path(path).open("w", encoding="utf-8", newline="\n") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0]), lineterminator="\n")
        w.writeheader()
        w.writerows(rows)
    return rows


@lru_cache(maxsize=4)
def _load(path: str) -> dict[str, float]:
    with Path(path).open(encoding="utf-8") as f:
        return {r["month"]: float(r["gold_sar_per_gram"]) for r in csv.DictReader(f)}


def price_for(as_of: pd.Timestamp, path: str | Path = TABLE) -> tuple[str, float]:
    """(calculation month, SAR per gram) for `as_of`. Refuses a month the table does not hold."""
    month = pd.Timestamp(as_of).strftime("%Y-%m")
    table = _load(str(path))
    if month not in table:
        raise ValueError(f"no archived gold price for calculation month {month} (table covers {min(table)}..{max(table)}); DECISIONS 54")
    return month, table[month]


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--build", action="store_true", help="rebuild the table from the archived sources")
    args = ap.parse_args(argv)
    if args.build:
        for r in build():
            print(r)
        print(f"→ {TABLE}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
