"""Archived national sources — paths, loaders and the file quirks asserted in code (SOP §3.1, §3.3).

Origin bodies: SAMA (Saudi Central Bank) for the three payments/credit series, Monsha'at for
the enterprise register. Retrieval paths are recorded separately in each `.meta.json`
(KAPSARC data portal mirror for SAMA tables; the Monsha'at OpenData gateway).
"""

from __future__ import annotations

import hashlib
import json
from datetime import date, datetime, timezone
from pathlib import Path

import pandas as pd

REPO = Path(__file__).resolve().parents[1]
SOURCES = REPO / "sources"
SAMA = SOURCES / "sama"
MONSHAAT = SOURCES / "monshaat"
OUT = REPO / "calibration" / "out"

EXCLUDED_YEAR = 2020  # SOP §1.5: Ramadan 1441 fell inside the COVID lockdown; never enters seasonality estimation

KAPSARC_EXPORT = "https://datasource.kapsarc.org/api/explore/v2.1/catalog/datasets/{dataset}/exports/csv?delimiter=%3B&use_labels=true"
KAPSARC_PAGE = "https://datasource.kapsarc.org/explore/dataset/{dataset}/"

# archive file name → (KAPSARC dataset id, SAMA publication the mirror cites)
SAMA_FILES = {
    "pos_by_sector_monthly_2016_2023.csv": (
        "points-of-sale-transactions-and-sales-by-sector",
        "SAMA Monetary and Financial Statistics, Table 30d — Points of Sale Transactions by Sectors",
    ),
    "pos_aggregate_1995_2026.csv": (
        "pos-transactions",
        "SAMA Monetary and Financial Statistics — Points of Sale Transactions (aggregate)",
    ),
    "bank_credit_by_activity_2021_2026.csv": (
        "bank-credit-by-economic-activity-17-sectors",
        "SAMA Monetary and Financial Statistics — Bank Credit by Economic Activity (17 sectors)",
    ),
    "pos_by_sector_weekly_2020_2025.csv": (
        "point-of-sale-transactions-by-sector-and-city",
        "SAMA Weekly Points of Sale Transactions (by activity and city)",
    ),
}
SAMA_WEEKLY_BULLETIN_PDF = "sama_weekly_pos_bulletin_2026-09-12.pdf"
SAMA_WEEKLY_BULLETIN_URL = "https://www.sama.gov.sa/en-US/Statistics/Indices/POS_EN/Weekly_Points_of_Sale_Transactions_Report_12-Sep-2026.pdf"

MONSHAAT_ENDPOINT = "https://pservices.monshaat.gov.sa/BI/TaskService/OpenData/EnterprisesStatistics/{year}/{quarter}"

POS_SECTOR_INDICATORS = {"Sales": "sales", "Number of Transactions": "count"}
RESTAURANTS = "Restaurants & Café"  # accent + ampersand exactly as published; asserted, never retyped
INDIVIDUALS = "Individuals' Loans"  # consumer credit — excluded from every business-sector share (§7.2)

AGG_SALES = "Total POS :  Sales (In Thousand Riyals)"
AGG_COUNT = "Total POS :  Number of Transactions"
AGG_TERMINALS = "Total POS :  Number of Points of Sale Terminals"


# --------------------------------------------------------------------------- #
# Archive discipline (§1.2): file + .sha256 + .meta.json, written on download
# --------------------------------------------------------------------------- #


def sha256_bytes(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()


def sha256_file(path: Path) -> str:
    return sha256_bytes(Path(path).read_bytes())


def archive(dest: Path, content: bytes, meta: dict) -> dict:
    """Write the file, its SHA-256 and a meta record. Returns the meta record as written."""
    dest = Path(dest)
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(content)
    digest = sha256_bytes(content)
    dest.with_suffix(dest.suffix + ".sha256").write_text(f"{digest}  {dest.name}\n", encoding="utf-8")
    record = {"file": dest.name, "sha256": digest, "bytes": len(content), "access_date": today_iso(), **meta}
    dest.with_suffix(dest.suffix + ".meta.json").write_text(json.dumps(record, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return record


def verify_archive(path: Path) -> dict:
    """Re-hash an archived file against its .sha256 sidecar; returns the meta record."""
    path = Path(path)
    recorded = path.with_suffix(path.suffix + ".sha256").read_text(encoding="utf-8").split()[0]
    actual = sha256_file(path)
    if recorded != actual:
        raise AssertionError(f"{path.name}: archived sha256 {recorded[:12]}… != current {actual[:12]}…")
    return json.loads(path.with_suffix(path.suffix + ".meta.json").read_text(encoding="utf-8"))


def _read_semicolon(path: Path) -> pd.DataFrame:
    # UTF-8 BOM, semicolon delimiter, CRLF — §3.1
    raw = Path(path).read_bytes()
    assert raw[:3] == b"\xef\xbb\xbf", f"{Path(path).name}: expected a UTF-8 BOM"
    return pd.read_csv(path, sep=";", encoding="utf-8-sig")


# --------------------------------------------------------------------------- #
# Loaders — every documented quirk is asserted, not assumed
# --------------------------------------------------------------------------- #


def load_pos_sector_monthly(path: Path | None = None) -> pd.DataFrame:
    """SAMA POS by sector, monthly 2016–2023 → tidy (date, sector, indicator, value).

    Column-shift quirk (§3.1): the header `Transactions / Sales` holds the SECTOR and the
    header `Sector` holds the INDICATOR. Read by the corrected mapping and assert it.
    Units: sales in thousand SAR, counts in thousand transactions.
    """
    df = _read_semicolon(path or SAMA / "pos_by_sector_monthly_2016_2023.csv")
    expected = ["Periodicity", "Year", "Month", "Quarter", "Transactions / Sales", "Sector", "Value in different units", "Date_Object", "Date", "Name"]
    assert list(df.columns) == expected, f"unexpected header: {list(df.columns)}"
    assert set(df["Sector"].unique()) == set(POS_SECTOR_INDICATORS), "column shift not as documented: 'Sector' should hold Sales / Number of Transactions"
    sectors = set(df["Transactions / Sales"].unique())
    assert "Total" in sectors and RESTAURANTS in sectors, f"column shift not as documented: 'Transactions / Sales' should hold sector labels, got {sorted(sectors)[:5]}"
    assert set(df["Periodicity"].unique()) == {"Monthly", "Quarterly", "Annually"}
    m = df[df["Periodicity"] == "Monthly"].copy()
    tidy = pd.DataFrame(
        {
            "date": pd.to_datetime(m["Date_Object"]),
            "sector": m["Transactions / Sales"].astype(str),
            "indicator": m["Sector"].map(POS_SECTOR_INDICATORS),
            "value": m["Value in different units"].astype(float),
        }
    ).sort_values(["indicator", "sector", "date"]).reset_index(drop=True)
    n_months, n_sectors = tidy["date"].nunique(), tidy["sector"].nunique()
    assert n_months == 96 and n_sectors == 17, f"expected 96 months × 17 sectors, got {n_months} × {n_sectors}"
    assert len(tidy) == 96 * 17 * 2 and not tidy["value"].isna().any()
    assert tidy["date"].min() == pd.Timestamp("2016-01-01") and tidy["date"].max() == pd.Timestamp("2023-12-01")
    piv = tidy[tidy["indicator"] == "sales"].pivot(index="date", columns="sector", values="value")
    ratio = piv.drop(columns="Total").sum(axis=1) / piv["Total"]
    assert (ratio - 1).abs().max() < 1e-9, "sector sales do not sum to Total"
    return tidy


def load_pos_aggregate_monthly(path: Path | None = None) -> pd.DataFrame:
    """SAMA aggregate POS, monthly 1995–2026 → tidy (date, indicator, value). No sector breakdown (§3.1)."""
    df = _read_semicolon(path or SAMA / "pos_aggregate_1995_2026.csv")
    expected = ["Periodicity", "Year", "Quarter", "Month", "Indicator", "Value in Different Units", "Date", "Date_Object"]
    assert list(df.columns) == expected, f"unexpected header: {list(df.columns)}"
    m = df[df["Periodicity"] == "Monthly"]
    tidy = pd.DataFrame({"date": pd.to_datetime(m["Date_Object"]), "indicator": m["Indicator"].str.strip(), "value": m["Value in Different Units"].astype(float)})
    tidy = tidy.sort_values(["indicator", "date"]).reset_index(drop=True)
    assert tidy["indicator"].nunique() == 9, f"expected 9 indicators, got {tidy['indicator'].nunique()}"
    total_sales = tidy[tidy["indicator"] == AGG_SALES]
    assert len(total_sales) == 379, f"expected 379 monthly aggregate observations, got {len(total_sales)}"
    return tidy


def load_pos_weekly_sector(path: Path | None = None) -> pd.DataFrame:
    """SAMA weekly POS by activity, national total (city = Total), 2020-05 → 2025-07 → tidy (week_start, sector, indicator, value).

    Newer sector edition than the monthly Table 30d (which ends 2023). Weekly, so it also resolves the
    three-day Eid window the monthly series cannot. Units: thousand transactions / thousand SAR.
    """
    df = _read_semicolon(path or SAMA / "pos_by_sector_weekly_2020_2025.csv")
    assert list(df.columns) == ["Starting date", "Indicator", "Sectors", "City", "value (Multiple units)"], f"unexpected header: {list(df.columns)}"
    t = df[df["City"] == "Total"].copy()
    ind = {"Number of Transactions (In Thousand)": "count", "Value of Transactions (In Thousand SAR)": "sales"}
    t = t[t["Indicator"].isin(ind)]
    tidy = pd.DataFrame(
        {
            "week_start": pd.to_datetime(t["Starting date"]),
            "sector": t["Sectors"].astype(str),
            "indicator": t["Indicator"].map(ind),
            "value": t["value (Multiple units)"].astype(float),
        }
    )
    tidy = tidy.dropna().sort_values(["indicator", "sector", "week_start"]).reset_index(drop=True)
    assert RESTAURANTS in set(tidy["sector"]) and "Total" in set(tidy["sector"])
    assert tidy["week_start"].min() == pd.Timestamp("2020-05-10") and tidy["week_start"].max() >= pd.Timestamp("2025-07-06")
    return tidy


def load_bank_credit_quarterly(path: Path | None = None) -> pd.DataFrame:
    """SAMA bank credit by economic activity, quarterly 2021Q3–2026Q2 → tidy (quarter_start, activity, value_mn_sar)."""
    df = _read_semicolon(path or SAMA / "bank_credit_by_activity_2021_2026.csv")
    expected = ["Periodicity", "Year", "Month", "Quarter", "Economic Activity", "Bank Credit in (Million Riyals)", "Date", "Date_Object"]
    assert list(df.columns) == expected, f"unexpected header: {list(df.columns)}"
    q = df[df["Periodicity"] == "Quarterly"]
    tidy = pd.DataFrame(
        {
            "quarter_start": pd.to_datetime(q["Date_Object"]),
            "activity": q["Economic Activity"].astype(str),
            "value_mn_sar": q["Bank Credit in (Million Riyals)"].astype(float),
        }
    )
    tidy = tidy.sort_values(["activity", "quarter_start"]).reset_index(drop=True)
    acts = set(tidy["activity"])
    assert INDIVIDUALS in acts and "Total" in acts and len(acts) == 18, f"expected 17 activities + Total, got {len(acts)}"
    piv = tidy.pivot(index="quarter_start", columns="activity", values="value_mn_sar")
    diff = (piv.drop(columns="Total").sum(axis=1) - piv["Total"]).abs() / piv["Total"]
    assert diff.max() < 1e-6, "activities do not sum to Total"
    return tidy


def exclude_year(df: pd.DataFrame, col: str = "date") -> pd.DataFrame:
    """§1.5 — 2020 never enters seasonality estimation; the exclusion is asserted here, not assumed upstream."""
    out = df[df[col].dt.year != EXCLUDED_YEAR].copy()
    assert not (out[col].dt.year == EXCLUDED_YEAR).any()
    return out


def now_iso() -> str:
    return datetime.now(tz=timezone.utc).isoformat(timespec="seconds")


def today_iso() -> str:
    return datetime.now(tz=timezone.utc).date().isoformat()


def write_out(name: str, payload: dict) -> Path:
    OUT.mkdir(parents=True, exist_ok=True)
    p = OUT / f"{name}.json"
    p.write_text(json.dumps(payload, ensure_ascii=False, indent=2, default=_json_default) + "\n", encoding="utf-8")
    return p


def read_out(name: str) -> dict:
    return json.loads((OUT / f"{name}.json").read_text(encoding="utf-8"))


def _json_default(o):
    if isinstance(o, (pd.Timestamp, date)):
        return o.isoformat()
    if hasattr(o, "item"):
        return o.item()
    raise TypeError(type(o))
