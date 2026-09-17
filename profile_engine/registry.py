"""Feature registry: explicit ID membership lists, names, null reasons, history requirements.

Schema §8 / SOP §8: membership is an explicit list in code, never a range.
"""

from __future__ import annotations

FEATURE_NAMES: dict[int | str, str] = {
    1: "avg_monthly_inflow",
    2: "inflow_count_per_month",
    3: "inflow_regularity_score",
    4: "revenue_growth_rate_90d",
    5: "largest_single_source_ratio",
    6: "avg_monthly_outflow",
    7: "outflow_count_per_month",
    8: "recurring_expense_ratio",
    9: "expense_growth_rate_90d",
    10: "top_expense_category_share",
    11: "cash_flow_volatility",
    12: "inflow_outflow_ratio",
    13: "days_negative_balance_90d",
    14: "overdraft_events_90d",
    15: "volatility_index",
    16: "avg_daily_balance",
    17: "min_daily_balance_90d",
    18: "current_runway_days",
    "18b": "runway_days_avg_balance",
    19: "liquidity_trend_slope",
    20: "unique_counterparties_count",
    21: "counterparty_concentration_index",
    22: "new_counterparty_ratio_30d",
    23: "declared_mcc_code",
    24: "sharia_screen_status",
    25: "esg_proxy_score",
    26: "governance_transparency_score",
    27: "cash_and_equivalents_eom",
    28: "inventory_value_eom",
    29: "accounts_receivable_eom",
    30: "accounts_payable_eom",
    31: "short_term_liabilities_eom",
    32: "coverage_days_90d",
    33: "data_gap_ratio",
    34: "nisab_threshold_met",
    35: "hawl_completion_date",
    36: "ramadan_adjusted",
    37: "implied_dso_days",
    38: "implied_dio_days",
    39: "implied_dpo_days",
    40: "cash_conversion_cycle_days",
    41: "financing_outflow_ratio",
    42: "installment_capacity_sar",
    43: "inflow_break_recency_days",
    44: "net_flow_autocorr_lag7",
    45: "counterparty_persistence_ratio",
    46: "circular_counterparty_count",
    47: "downside_semideviation_90d",
    48: "upside_semideviation_90d",
    49: "flow_asymmetry_ratio",
    50: "revenue_shock_absorption_pct",
    51: "fixed_obligation_coverage_months",
    52: "liquidity_hazard_30d",
    53: "liquidity_hazard_60d",
    54: "liquidity_hazard_90d",
    55: "sector_relative_regularity_z",
    56: "sector_relative_volatility_z",
    57: "sector_relative_days_negative_z",
    58: "sector_relative_balance_z",
    59: "sector_relative_concentration_z",
    # SOP_Data_Grounding §9.2 — obligations (proposed schema §37)
    60: "committed_monthly_outflow",
    61: "obligation_coverage_ratio",
    62: "ocr_forward_3m",
    "62b": "ocr_forward_6m",
    63: "obligation_horizon_months",
    64: "mandate_cancellation_count_90d",
    65: "balloon_exposure_sar",
    # SOP_Data_Grounding §12.1 — credit facilities (proposed schema §38)
    66: "facility_utilisation",
    67: "headroom_days_of_burn",
    68: "max_consecutive_overdraft_days",
    69: "emergency_line_present",
}
NAME_TO_ID = {v: k for k, v in FEATURE_NAMES.items()}

# §8: what GET /profile returns. 37–39 are included because 40 is defined from them and §8 lists 40.
PROFILE_FEATURE_IDS: list[int | str] = [
    *range(1, 19), "18b", *range(19, 27), 32, 33, 36, *range(37, 55), *range(55, 60), 60, 61, 62, "62b", 63, 64, 65, 66, 67, 68, 69
]
# §7: the separate balance-sheet profile read only by the Zakat lens.
ZAKAT_PROFILE_FEATURE_IDS: list[int] = [27, 28, 29, 30, 31, 34, 35]

# §15: features that compare against a prior window need ~180 days of history.
MIN_HISTORY_DAYS: dict[int | str, int] = {4: 180, 9: 180, 43: 180, 45: 180}
COVERAGE_MIN_DAYS = 60  # §15 hard eligibility rule
TRAILING_DAYS = 90
EPS_MONTHLY = 500.0  # §16 epsilon floor on monthly denominators (SAR; applied as-is on other currencies)
GROWTH_CAP_PCT = 300.0

# Null reasons (§15, §16 + SOP_Data_Grounding §6.2). A null without one of these is a bug.
NULL_REASONS = (
    "insufficient_data",  # §15: coverage_days_90d < 60 — the whole business is refused, not scored
    "insufficient_history",  # §15: coverage ok but history < min_history_days for this feature
    "near_zero_denominator",  # §16 epsilon floor
    "not_applicable",  # §16: e.g. runway when not burning cash; no active obligations
    "insufficient_events",  # too few events to form the statistic (e.g. < 3 inflow days for feature 3)
    "no_break_detected",  # feature 43 by definition
    "not_available_in_source",  # SOP_Data_Grounding §6.2: the source has no such field/table
    "not_implemented",  # module owner has not built it yet (24–26, 34, 35)
    "reference_stats_missing",  # §35: pinned sector_reference_stats_v1.json absent
)

# Features whose computation needs a counterparty identity; they carry a coverage share (SOP §6.1).
COUNTERPARTY_FEATURE_IDS: list[int] = [5, 20, 21, 22, 45, 46]
