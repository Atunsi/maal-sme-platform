"""Pandera schemas for every table the profile engine reads (Schema v2.9 §7, §37.1).

Every table is validated at the point of generation (generator.py) or ingestion
(berka_adapter/build.py) and again in the Week 3 gate harness before anything
reads it. Column names and types are taken directly from the schema's feature
definitions:

  transactions.csv      §7 table 1 — raw dated inflows/outflows
  daily_aggregates.csv  §7 table 2 — what GET /profile reads (features 1–26 ...)
  balances_monthly.csv  §7 table 3 — features 27–31, Zakat only (synthetic only)
  balances_daily.csv    SOP_Data_Grounding §5.5 — daily closing balance (features 13, 16–19, 50–54)
  obligations.csv       SOP_Data_Grounding §9.1 — standing orders / direct debits / scheduled (features 60–65)

Plus the registry / label tables the eval harness needs. Latent variables (§14)
are deliberately absent from every engine-facing schema — `assert_no_latent_leak`
enforces that.

Changes under SOP_Data_Grounding §14 (DECISIONS.md entry 8): `external_real`
data source; `evidence_class` on every row; `subfamily` and nullable
`counterparty_id` on transactions; `not_available_in_source` sentinel on the
registry categoricals; two new tables. Nothing existing was removed.
"""

import pandas as pd
import pandera.pandas as pa
from pandera.pandas import Check, Column, DataFrameSchema

SECTORS = ["retail_trade", "construction", "food_beverage", "professional_services"]
SIZE_TIERS = ["micro", "small", "medium"]
AGE_TIERS = ["<1yr", "1-3yr", "3-7yr", "7yr+"]
DATA_SOURCES = ["synthetic", "sandbox", "external_real"]  # §29 + SOP_Data_Grounding §14
EVIDENCE_CLASSES = ["A", "B", "C"]  # SOP_Data_Grounding §1
NA_SENTINEL = "not_available_in_source"  # registry categoricals a real source cannot supply
DIRECTIONS = ["in", "out"]
COUNTERPARTY_TYPES = [
    "customer",
    "supplier",
    "landlord",
    "payroll",
    "financial_institution",
    "other",
]
# Original six (generator) + seven that only a real bank feed produces (Berka k_symbol / operation).
CATEGORIES = [
    "sales",
    "supplier",
    "rent",
    "payroll",
    "loan_repayment",
    "transfer",
    "cash_deposit",
    "cash_withdrawal",
    "bank_interest",
    "bank_fee",
    "household",
    "insurance",
    "pension",
]
# ISO 20022 bank-transaction-code SubFamily-style vocabulary (SOP_Data_Grounding §12.2, Appendix B).
# Codes follow the ISO 20022 BTC SubFamily list where one exists (RCDT, DMCT, STDO, SALA, CDPT,
# CWDL, CCRD, INTR, CHRG); the rest are local extensions, named so they cannot be mistaken for MCC.
SUBFAMILIES = ["RCDT", "DMCT", "STDO", "SALA", "LOAN", "CDPT", "CWDL", "CCRD", "INTR", "SANC", "CHRG", "INSU", "HOUS", "PENS"]
CATEGORY_SUBFAMILY = {  # generator side: category → subfamily
    "sales": "RCDT",
    "supplier": "DMCT",
    "rent": "STDO",
    "payroll": "SALA",
    "loan_repayment": "LOAN",
    "transfer": "DMCT",
}
OBLIGATION_TYPES = ["standing_order", "direct_debit", "scheduled"]
TX_STATUSES = ["booked", "pending"]
FACILITY_TYPES = ["none", "pre_agreed", "emergency", "temporary"]
FREQUENCIES = ["monthly", "weekly", "quarterly", "one_off", "unknown"]
OBLIGATION_STATUSES = ["active", "inactive"]
LOAN_STATUSES = ["A", "B", "C", "D"]

# Columns that must never appear in any table a lens can read (§14).
FORBIDDEN_ENGINE_COLUMNS = ("latent_", "p_default", "default_label")

_id = Column(int, Check.gt(0))
_src = Column(str, Check.isin(DATA_SOURCES))
_evc = Column(str, Check.isin(EVIDENCE_CLASSES))


transactions_schema = DataFrameSchema(
    {
        "transaction_id": Column(int, Check.gt(0), unique=True),
        "business_id": _id,
        "date": Column(pa.DateTime, coerce=True),
        "hour": Column(int, Check.in_range(0, 23)),
        "direction": Column(str, Check.isin(DIRECTIONS)),
        "amount": Column(float, Check.gt(0)),
        "counterparty_id": Column(str, nullable=True),  # null = source carries no partner identity (cash, bank-originated)
        "counterparty_type": Column(str, Check.isin(COUNTERPARTY_TYPES)),
        "category": Column(str, Check.isin(CATEGORIES)),
        "subfamily": Column(str, Check.isin(SUBFAMILIES)),
        "own_transfer_flag": Column(bool),  # SOP_Data_Grounding §5.3 — netted own-account transfers are visible, never silent
        # SOP_Data_Grounding §12.2 sub-fields. Berka has none of them: value_date null, status booked, charge_amount null.
        "value_date": Column(pa.DateTime, nullable=True, coerce=True),
        "status": Column(str, Check.isin(TX_STATUSES)),
        "charge_amount": Column(float, nullable=True),
        "data_source": _src,
        "evidence_class": _evc,
    },
    strict=True,
    name="transactions",
)

# SOP_Data_Grounding §12.1 — credit facilities snapshot at window_end (class C on the synthetic side; no real source).
facilities_schema = DataFrameSchema(
    {
        "business_id": Column(int, Check.gt(0), unique=True),
        "facility_type": Column(str, Check.isin(FACILITY_TYPES)),
        "facility_limit": Column(float, Check.ge(0)),
        "facility_drawn": Column(float, Check.ge(0)),
        "included_in_balance": Column(bool),  # AIS `Included` flag: reported balance already contains the drawn amount
        "own_funds": Column(float),  # reported balance with the drawn facility stripped out — never interpret a raw balance
        "headroom": Column(float),
        "emergency_line_since": Column(pa.DateTime, nullable=True, coerce=True),
        "data_source": _src,
        "evidence_class": _evc,
    },
    strict=True,
    name="facilities",
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
        "evidence_class": _evc,
    },
    unique=["business_id", "date"],
    strict=True,
    name="daily_aggregates",
)

balances_daily_schema = DataFrameSchema(
    {
        "business_id": _id,
        "date": Column(pa.DateTime, coerce=True),
        "closing_balance": Column(float),
        "data_source": _src,
        "evidence_class": _evc,
    },
    unique=["business_id", "date"],
    strict=True,
    name="balances_daily",
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
        "evidence_class": _evc,
    },
    unique=["business_id", "month_end"],
    strict=True,
    name="balances_monthly",
)

obligations_schema = DataFrameSchema(
    {
        "business_id": _id,
        "obligation_id": Column(int, Check.gt(0), unique=True),
        "type": Column(str, Check.isin(OBLIGATION_TYPES)),
        "counterparty_id": Column(str, nullable=True),
        "amount": Column(float, Check.gt(0)),
        "frequency": Column(str, Check.isin(FREQUENCIES)),
        "next_date": Column(pa.DateTime, nullable=True, coerce=True),
        "final_date": Column(pa.DateTime, nullable=True, coerce=True),
        "final_amount": Column(float, nullable=True),
        "status": Column(str, Check.isin(OBLIGATION_STATUSES)),
        "status_change_date": Column(pa.DateTime, nullable=True, coerce=True),
        "data_source": _src,
        "evidence_class": _evc,
    },
    strict=True,
    name="obligations",
)

businesses_schema = DataFrameSchema(
    {
        "business_id": Column(int, Check.gt(0), unique=True),
        "population": Column(str),
        "sector": Column(str, Check.isin(SECTORS + [NA_SENTINEL])),
        "size_tier": Column(str, Check.isin(SIZE_TIERS + [NA_SENTINEL])),
        "age_tier": Column(str, Check.isin(AGE_TIERS + [NA_SENTINEL])),
        "start_date": Column(pa.DateTime, coerce=True),
        "window_end": Column(pa.DateTime, coerce=True),
        "operating_start_date": Column(pa.DateTime, coerce=True),
        "declared_mcc_code": Column("Int64", nullable=True, coerce=True),  # 23 — null when the source has no MCC
        "has_zakat_seed": Column(bool),
        "data_source": _src,
        "evidence_class": _evc,
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
        "evidence_class": _evc,
    },
    strict=True,
    name="labels",
)

# Berka-only label table (SOP_Data_Grounding §5.1, §7.1). Two label sets, censoring named.
berka_labels_schema = DataFrameSchema(
    {
        "business_id": Column(int, Check.gt(0), unique=True),
        "loan_id": Column(int, Check.gt(0), unique=True),
        "loan_date": Column(pa.DateTime, coerce=True),
        "loan_amount": Column(float, Check.gt(0)),
        "duration_months": Column(int, Check.gt(0)),
        "monthly_payment": Column(float, Check.gt(0)),
        "status": Column(str, Check.isin(LOAN_STATUSES)),
        "label_primary": Column("Int64", nullable=True, coerce=True),  # A→0, B→1, C/D→null (finished contracts only)
        "label_secondary": Column(int, Check.isin([0, 1])),  # A+C→0, B+D→1 (censored)
        "censored": Column(bool),
        "data_source": _src,
        "evidence_class": _evc,
    },
    strict=True,
    name="berka_labels",
)

REQUIRED_ENGINE_TABLES = ("transactions", "daily_aggregates", "businesses")
OPTIONAL_ENGINE_TABLES = ("balances_monthly", "balances_daily", "obligations", "facilities")
ENGINE_FACING = {
    "transactions": transactions_schema,
    "daily_aggregates": daily_aggregates_schema,
    "balances_monthly": balances_monthly_schema,
    "balances_daily": balances_daily_schema,
    "obligations": obligations_schema,
    "facilities": facilities_schema,
    "businesses": businesses_schema,
}


def assert_no_latent_leak(df: pd.DataFrame, table_name: str) -> None:
    """§14: latent variables and labels must never reach an engine-facing table."""
    bad = [c for c in df.columns if c.startswith(FORBIDDEN_ENGINE_COLUMNS[0]) or c in FORBIDDEN_ENGINE_COLUMNS[1:]]
    if bad:
        raise AssertionError(f"{table_name}: forbidden columns present in engine-facing table: {bad}")


def validate_engine_tables(tables: dict[str, pd.DataFrame]) -> dict[str, pd.DataFrame]:
    """Validate every engine-facing table present; the three required ones must be present.

    `balances_monthly` is optional because a real bank feed has no balance sheet
    (SOP_Data_Grounding §5.1); `balances_daily` and `obligations` are optional
    until every producer emits them. Returns the coerced frames.
    """
    missing = [n for n in REQUIRED_ENGINE_TABLES if n not in tables]
    if missing:
        raise KeyError(f"required engine tables missing: {missing}")
    out = {}
    for name, schema in ENGINE_FACING.items():
        if name not in tables:
            continue
        assert_no_latent_leak(tables[name], name)
        out[name] = schema.validate(tables[name], lazy=True)
    return out
