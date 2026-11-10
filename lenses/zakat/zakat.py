"""Zakat lens — schema §7, §8 (/lenses/zakat), §17.

100% deterministic, permanently (SOP §2, §36.1). No model, no LLM, no randomness.

Reads the balance-sheet snapshot (`balances_monthly`, features 27–31) — a separate
profile from the transaction-derived one, never merged into /profile (§7, §8).

Net Working Capital method (§7):
    zakatable assets = cash + inventory + receivables
    deductible       = payables + short-term liabilities
    zakat base       = zakatable assets - deductible

Liability is computed only if BOTH hold (§17), otherwise liability_sar = 0 with an
explicit reason — never a figure that silently assumes them:
    nisab_threshold_met   (feature 34)  zakat base >= nisab value
    hawl complete         (feature 35)  one lunar year of holding at/above nisab

Hawl rule (lens_config.zakat.hawl_rule = nisab_at_start_and_end): nisab is checked
at the start and the end of the lunar year. Intermediate dips are not tracked —
there is no balance history before the generated window. This is a stated
simplification for the Sharia advisor to confirm, not a silent one.
"""

from __future__ import annotations

from pathlib import Path

import pandas as pd

from lenses.arabic import load_templates, plural

ZAKATABLE = ("cash_and_equivalents_eom", "inventory_value_eom", "accounts_receivable_eom")
DEDUCTIBLE = ("accounts_payable_eom", "short_term_liabilities_eom")
# Arabic siblings of nisab_basis and detail (DECISIONS 57); they fill nisab_basis_ar and detail_ar only.
TEMPLATES_AR_PATH = str(Path(__file__).with_name("templates_ar.yaml"))


def nisab_price(zcfg: dict, as_of: pd.Timestamp | None = None) -> tuple[float, str | None]:
    """(SAR per gram, calculation month or None). An explicit price (a saved quotation, or a test) wins;
    otherwise the price of the calculation month from the archived table (DECISIONS 48, 54)."""
    n = zcfg["nisab"]
    if n.get("price_sar_per_gram") is not None:
        return float(n["price_sar_per_gram"]), None
    if as_of is None:
        raise ValueError("the nisab is valued at the calculation month's gold price: pass as_of")
    from lenses.zakat.nisab_prices import price_for

    month, price = price_for(as_of, n["price_table"])
    return price, month


def _grams_ar(grams, ar: dict) -> str:
    """The configured grams with their Arabic plural form; a fractional weight keeps its digits as configured."""
    g = float(grams)
    return plural(int(g), ar["grams"]) if g.is_integer() else ar["grams"]["other"].format(n=grams)


def nisab_value_sar(zcfg: dict, as_of: pd.Timestamp | None = None) -> float:
    return float(zcfg["nisab"]["grams"]) * nisab_price(zcfg, as_of)[0]


def compute_zakat(
    balances: pd.DataFrame,
    as_of: pd.Timestamp,
    zcfg: dict,
    hawl_start_date: pd.Timestamp | None,
    opening_net_assets_sar: float | None,
    history_start: pd.Timestamp,
) -> dict:
    """Zakat for one business as of `as_of`.

    balances               this business's balances_monthly rows
    hawl_start_date        start of the holding year, if known (a seeded opening state, §17);
                           otherwise the earliest date we have evidence for (`history_start`)
    opening_net_assets_sar net assets at hawl start, if known — needed for the start-of-hawl nisab check
    """
    price, price_month = nisab_price(zcfg, as_of)
    nisab = float(zcfg["nisab"]["grams"]) * price
    ar = load_templates(TEMPLATES_AR_PATH)
    base = {
        "liability_sar": 0.0,
        "nisab_value_sar": round(nisab, 2),
        "nisab_price_sar_per_gram": round(price, 4),
        "nisab_price_month": price_month,  # null when an explicit (quoted) price was used
        "nisab_basis": f"{zcfg['nisab']['grams']}g {zcfg['nisab']['basis']}",
        "nisab_basis_ar": ar["nisab_basis"].format(grams=_grams_ar(zcfg["nisab"]["grams"], ar), basis=ar["basis"][zcfg["nisab"]["basis"]]),
        "nisab_source_status": zcfg["nisab"]["source_status"],
        "rate": zcfg["rate_lunar_year"],
        "method": "net_working_capital",
        "hawl_rule": zcfg["hawl_rule"],
        "deterministic": True,
    }

    rows = balances[balances["month_end"] <= as_of].sort_values("month_end")
    if rows.empty:
        return {**base, "status": "not_computed", "reason": "no_balance_sheet_snapshot"}

    snap = rows.iloc[-1]
    assets = float(sum(snap[c] for c in ZAKATABLE))
    deduct = float(sum(snap[c] for c in DEDUCTIBLE))
    zakat_base = assets - deduct
    lunar = int(zcfg["lunar_year_days"])

    hawl_start = pd.Timestamp(hawl_start_date) if hawl_start_date is not None else pd.Timestamp(history_start)
    hawl_completion = hawl_start + pd.Timedelta(days=lunar)  # feature 35
    nisab_now = zakat_base >= nisab  # feature 34 (end of hawl)

    out = {
        **base,
        "snapshot_month_end": snap["month_end"].date().isoformat(),
        "zakatable_assets_sar": round(assets, 2),
        "deductible_liabilities_sar": round(deduct, 2),
        "zakat_base_sar": round(zakat_base, 2),
        "nisab_threshold_met": bool(nisab_now),
        "hawl_start_date": hawl_start.date().isoformat(),
        "hawl_completion_date": hawl_completion.date().isoformat(),
        "hawl_start_source": "seeded_opening_state" if hawl_start_date is not None else "earliest_observed_history",
    }

    if not nisab_now:
        return {**out, "status": "zero_liability", "reason": "below_nisab"}
    if as_of < hawl_completion:
        days = (as_of - hawl_start).days
        return {
            **out,
            "status": "zero_liability",
            "reason": "hawl_incomplete",
            "detail": f"{days} days held of a {lunar}-day lunar year",
            "detail_ar": ar["details"]["hawl_days"].format(days=plural(days, ar["days"]), lunar=plural(lunar, ar["days"])),
        }
    # Start-of-hawl nisab check: only possible when the opening state is known.
    if opening_net_assets_sar is None:
        return {
            **out,
            "status": "zero_liability",
            "reason": "hawl_incomplete",
            "detail": "no evidence of net assets at hawl start; nisab at start cannot be verified",
            "detail_ar": ar["details"]["no_opening_state"],
        }
    if float(opening_net_assets_sar) < nisab:
        return {**out, "status": "zero_liability", "reason": "below_nisab", "detail": "below nisab at hawl start",
                "detail_ar": ar["details"]["below_nisab_at_start"]}

    liability = round(zakat_base * float(zcfg["rate_lunar_year"]), 2)
    return {**out, "status": "computed", "liability_sar": liability, "reason": None}
