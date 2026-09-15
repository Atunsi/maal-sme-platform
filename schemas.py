"""Pandera schemas for the generator output tables (Schema v2.9 §7, §37.1).

Every table is validated at the point of generation (generator.py) and again in
the Week 3 gate harness before anything reads it. Column names and types are
taken directly from the schema's feature definitions:

  transactions.csv      §7 table 1 — raw daily inflows/outflows
  daily_aggregates.csv  §7 table 2 — what GET /profile reads (features 1–26 ...)
  balances_monthly.csv  §7 table 3 — features 27–31, Zakat only

Plus the registry / label tables the eval harness needs. Latent variables (§14)
are deliberately absent from every engine-facing schema — `assert_no_latent_leak`
enforces that.
"""

import pandas as pd
import pandera.pandas as pa
from pandera.pandas import Check, Column, DataFrameSchema

SECTORS = ["retail_trade", "construction", "food_beverage", "professional_services"]
SIZE_TIERS = ["micro", "small", "medium"]
AGE_TIERS = ["<1yr", "1-3yr", "3-7yr", "7yr+"]
DATA_SOURCES = ["synthetic", "sandbox"]  # §29
DIRECTIONS = ["in", "out"]
COUNTERPARTY_TYPES = [
    "customer",
    "supplier",
    "landlord",
    "payroll",
    "financial_institution",
    "other",
]
CATEGORIES = ["sales", "supplier", "rent", "payroll", "loan_repayment", "transfer"]

# Columns that must never appear in any table a lens can read (§14).
FORBIDDEN_ENGINE_COLUMNS = ("latent_", "p_default", "default_label")

_id = Column(int, Check.gt(0))
_src = Column(str, Check.isin(DATA_SOURCES))


transactions_schema = DataFrameSchema(
    {
        "transaction_id": Column(int, Check.gt(0), unique=True),
        "business_id": _id,
        "date": Column(pa.DateTime, coerce=True),
        "hour": Column(int, Check.in_range(0, 23)),
        "direction": Column(str, Check.isin(DIRECTIONS)),
        "amount": Column(float, Check.gt(0)),
        "counterparty_id": Column(str),
        "counterparty_type": Column(str, Check.isin(COUNTERPARTY_TYPES)),
        "category": Column(str, Check.isin(CATEGORIES)),
        "data_source": _src,
    },
    strict=True,
    name="transactions",
)

daily_aggregates_schema = DataFrameSchema(
    {
        "business_id": _id,
        "date": Column(pa.DateTime, coerce=True),
        "inflow_total": Column(float, Check.ge(0)),
        "inflow_count": Column(int, Check.ge(0)),
        "outflow_total": Column(float, Check.ge(0)),
        "outflow_count": Column(int, Check.ge(0)),
        "recurring_outflow_total": Column(float, Check.ge(0)),
        "net_flow": Column(float),
        "eod_balance": Column(float),
        "data_source": _src,
    },
    unique=["business_id", "date"],
    strict=True,
    name="daily_aggregates",
)

balances_monthly_schema = DataFrameSchema(
    {
        "business_id": _id,
        "month_end": Column(pa.DateTime, coerce=True),
        "cash_and_equivalents_eom": Column(float, Check.ge(0)),  # 27
        "inventory_value_eom": Column(float, Check.ge(0)),  # 28
        "accounts_receivable_eom": Column(float, Check.ge(0)),  # 29
        "accounts_payable_eom": Column(float, Check.ge(0)),  # 30
        "short_term_liabilities_eom": Column(float, Check.ge(0)),  # 31
        "data_source": _src,
    },
    unique=["business_id", "month_end"],
    strict=True,
    name="balances_monthly",
)

businesses_schema = DataFrameSchema(
    {
        "business_id": Column(int, Check.gt(0), unique=True),
        "population": Column(str),
        "sector": Column(str, Check.isin(SECTORS)),
        "size_tier": Column(str, Check.isin(SIZE_TIERS)),
        "age_tier": Column(str, Check.isin(AGE_TIERS)),
        "start_date": Column(pa.DateTime, coerce=True),
        "window_end": Column(pa.DateTime, coerce=True),
        "operating_start_date": Column(pa.DateTime, coerce=True),
        "declared_mcc_code": Column(int),  # 23
        "has_zakat_seed": Column(bool),
        "data_source": _src,
    },
    strict=True,
    name="businesses",
)

labels_schema = DataFrameSchema(
    {
        "business_id": Column(int, Check.gt(0), unique=True),
        "population": Column(str),
        "default_label": Column(int, Check.isin([0, 1])),
        "data_source": _src,
    },
    strict=True,
    name="labels",
)

ENGINE_FACING = {
    "transactions": transactions_schema,
    "daily_aggregates": daily_aggregates_schema,
    "balances_monthly": balances_monthly_schema,
    "businesses": businesses_schema,
}


def assert_no_latent_leak(df: pd.DataFrame, table_name: str) -> None:
    """§14: latent variables and labels must never reach an engine-facing table."""
    bad = [c for c in df.columns if c.startswith(FORBIDDEN_ENGINE_COLUMNS[0]) or c in FORBIDDEN_ENGINE_COLUMNS[1:]]
    if bad:
        raise AssertionError(f"{table_name}: forbidden columns present in engine-facing table: {bad}")


def validate_engine_tables(tables: dict[str, pd.DataFrame]) -> dict[str, pd.DataFrame]:
    """Validate every engine-facing table; returns the coerced frames."""
    out = {}
    for name, schema in ENGINE_FACING.items():
        assert_no_latent_leak(tables[name], name)
        out[name] = schema.validate(tables[name], lazy=True)
    return out
