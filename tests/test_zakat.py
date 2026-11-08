
"""Unit tests for the deterministic Zakat calculation."""

import pandas as pd

from lenses.zakat.zakat import compute_zakat, nisab_value_sar

ZCFG = {
    "rate_lunar_year": 0.025,
    "lunar_year_days": 354,
    "hawl_rule": "nisab_at_start_and_end",
    "nisab": {
        "basis": "gold",
        "grams": 85,
        "price_sar_per_gram": 400.0,
        "source_status": "placeholder_unverified",
    },
}


def make_balances(cash=100000):
    return pd.DataFrame(
        [{
            "month_end": pd.Timestamp("2026-12-31"),
            "cash_and_equivalents_eom": cash,
            "inventory_value_eom": 50000,
            "accounts_receivable_eom": 30000,
            "accounts_payable_eom": 20000,
            "short_term_liabilities_eom": 10000,
        }]
    )


def calculate(cash=100000, opening=150000):
    return compute_zakat(
        balances=make_balances(cash),
        as_of=pd.Timestamp("2026-12-31"),
        zcfg=ZCFG,
        hawl_start_date=pd.Timestamp("2026-01-01"),
        opening_net_assets_sar=opening,
        history_start=pd.Timestamp("2026-01-01"),
    )


def test_nisab_calculation():
    assert nisab_value_sar(ZCFG) == 34000


def test_zakat_calculation():
    result = calculate()

    assert result["status"] == "computed"
    assert result["zakat_base_sar"] == 150000
    assert result["liability_sar"] == 3750


def test_below_nisab():
    balances = make_balances(cash=0)
    balances["inventory_value_eom"] = 10000
    balances["accounts_receivable_eom"] = 5000

    result = compute_zakat(
        balances=balances,
        as_of=pd.Timestamp("2026-12-31"),
        zcfg=ZCFG,
        hawl_start_date=pd.Timestamp("2026-01-01"),
        opening_net_assets_sar=150000,
        history_start=pd.Timestamp("2026-01-01"),
    )

    assert result["status"] == "zero_liability"
    assert result["reason"] == "below_nisab"
    assert result["liability_sar"] == 0


def test_hawl_incomplete():
    balances = make_balances()
    balances["month_end"] = pd.Timestamp("2026-05-31")

    result = compute_zakat(
        balances=balances,
        as_of=pd.Timestamp("2026-06-01"),
        zcfg=ZCFG,
        hawl_start_date=pd.Timestamp("2026-01-01"),
        opening_net_assets_sar=150000,
        history_start=pd.Timestamp("2026-01-01"),
    )

    assert result["status"] == "zero_liability"
    assert result["reason"] == "hawl_incomplete"
    assert result["liability_sar"] == 0


def test_missing_opening_assets():
    result = calculate(opening=None)

    assert result["status"] == "zero_liability"
    assert result["reason"] == "hawl_incomplete"
    assert result["liability_sar"] == 0
