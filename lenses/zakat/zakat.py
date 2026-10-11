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

import pandas as pd

ZAKATABLE = ("cash_and_equivalents_eom", "inventory_value_eom", "accounts_receivable_eom")
DEDUCTIBLE = ("accounts_payable_eom", "short_term_liabilities_eom")


def nisab_value_sar(zcfg: dict) -> float:
    n = zcfg["nisab"]
    return float(n["grams"]) * float(n["price_sar_per_gram"])


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
    nisab = nisab_value_sar(zcfg)
    base = {
        "liability_sar": 0.0,
        "nisab_value_sar": round(nisab, 2),
        "nisab_basis": f"{zcfg['nisab']['grams']}g {zcfg['nisab']['basis']}",
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
        }
    # Start-of-hawl nisab check: only possible when the opening state is known.
    if opening_net_assets_sar is None:
        return {
            **out,
            "status": "zero_liability",
            "reason": "hawl_incomplete",
            "detail": "no evidence of net assets at hawl start; nisab at start cannot be verified",
        }
    if float(opening_net_assets_sar) < nisab:
        return {**out, "status": "zero_liability", "reason": "below_nisab", "detail": "below nisab at hawl start"}

    liability = round(zakat_base * float(zcfg["rate_lunar_year"]), 2)
    return {**out, "status": "computed", "liability_sar": liability, "reason": None}
