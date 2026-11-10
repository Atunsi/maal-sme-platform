"""DECISIONS 48 and 54: the nisab is valued at the gold price of the calculation month."""

from __future__ import annotations

import csv

import pandas as pd
import pytest

from lenses import load_lens_config
from lenses.zakat import nisab_prices as npr
from lenses.zakat.zakat import compute_zakat, nisab_value_sar

Z = load_lens_config()["zakat"]


def balances(net: float, month_end: str = "2026-06-30") -> pd.DataFrame:
    return pd.DataFrame([{"month_end": pd.Timestamp(month_end), "cash_and_equivalents_eom": net, "inventory_value_eom": 0.0,
                          "accounts_receivable_eom": 0.0, "accounts_payable_eom": 0.0, "short_term_liabilities_eom": 0.0}])


def test_committed_table_is_exactly_what_the_archives_build(tmp_path):
    """Rebuilding from sources/ (hashes re-verified) reproduces the committed table, cross-check included."""
    out = tmp_path / "rebuilt.csv"
    npr.build(out)
    assert out.read_bytes() == npr.TABLE.read_bytes()


def test_every_month_passes_the_sama_cross_check():
    with npr.TABLE.open(encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    assert [r["month"] for r in rows] == npr.MONTHS
    for r in rows:
        assert abs(float(r["sama_implied_sar_per_usd"]) - npr.SAR_PER_USD) <= npr.FX_TOLERANCE
        assert float(r["gold_sar_per_gram"]) == pytest.approx(float(r["gold_usd_per_troy_oz"]) * 3.75 / 31.1034768, abs=1e-4)


def test_price_is_the_calculation_months_and_differs_by_month():
    jan, jul = npr.price_for(pd.Timestamp("2026-01-27")), npr.price_for(pd.Timestamp("2026-07-30"))
    assert jan[0] == "2026-01" and jul[0] == "2026-07"
    assert jan[1] != jul[1]
    assert nisab_value_sar(Z, pd.Timestamp("2026-07-30")) == pytest.approx(85 * jul[1])


def test_a_month_outside_the_table_is_refused():
    with pytest.raises(ValueError, match="no archived gold price"):
        npr.price_for(pd.Timestamp("2026-11-08"))
    with pytest.raises(ValueError, match="pass as_of"):
        nisab_value_sar(Z)


def test_zakat_output_names_the_month_and_price():
    out = compute_zakat(balances(1e6), pd.Timestamp("2026-07-30"), Z, None, None, pd.Timestamp("2026-07-30"))
    assert out["nisab_price_month"] == "2026-07"
    assert out["nisab_value_sar"] == round(85 * npr.price_for(pd.Timestamp("2026-07-30"))[1], 2)
    assert out["nisab_source_status"] == "world_bank_monthly_average_pending_sharia_advisor"


def test_an_explicit_quoted_price_still_wins():
    zq = {**Z, "nisab": {**Z["nisab"], "price_sar_per_gram": 400.0}}
    out = compute_zakat(balances(1e6), pd.Timestamp("2026-07-30"), zq, None, None, pd.Timestamp("2026-07-30"))
    assert (out["nisab_value_sar"], out["nisab_price_month"]) == (34000.0, None)
