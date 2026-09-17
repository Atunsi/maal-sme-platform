"""Berka coverage bands — SOP_Data_Grounding §6.1. A code constant, never prose.

Membership derived from the Phase 0 probes (DECISIONS.md entry 7): Probe 1
PASS keeps 13–15, Probe 2 PASS keeps 5, 20–22, 45, 46, Probe 4 PASS keeps
business_id = account_id. `partial` features carry their coverage share in
the engine output so a consumer can see what fraction of value the feature saw.
"""

from __future__ import annotations

from profile_engine.registry import FEATURE_NAMES

COMPUTABLE: list[int | str] = [1, 2, 3, 4, 6, 7, 8, 9, 10, 11, 12, 16, 17, 18, "18b", 19, 26, 32, 41, 42, 43, 44, 47, 48, 49, 50, 51, 52, 53, 54, 60, 61]
PARTIAL: list[int | str] = [5, 13, 14, 15, 20, 21, 22, 33, 45, 46, 62, "62b", 63, 68]
NOT_COMPUTABLE: list[int | str] = [23, 24, 25, 27, 28, 29, 30, 31, 34, 35, 36, 37, 38, 39, 40, 55, 56, 57, 58, 59, 64, 65, 66, 67, 69]

WHY_PARTIAL: dict[int | str, str] = {
    5: "counterparty identity exists only on PREVOD (transfer) rows — 27.5% of window transactions; coverage share reported",
    13: "base rate: 6.4% of accounts ever negative — near-constant for most accounts",
    14: "same as 13",
    15: "composite of 11–14; inherits 13/14's base rate",
    20: "same as 5",
    21: "same as 5",
    22: "same as 5",
    33: "operating-day calendar is Czech (Sat/Sun), not the Saudi Fri/Sat the schema names",
    45: "same as 5",
    46: "same as 5",
    62: "Berka has no final_date, so the forward ratio collapses to 61 on real data",
    "62b": "same as 62",
    63: "no final_date in source → null (not_available_in_source) on every Berka row",
    68: "same base rate as 13: most accounts never go negative",
}
WHY_NOT_COMPUTABLE: dict[int | str, str] = {
    23: "no MCC in Berka",
    24: "screen depends on MCC",
    25: "ESG: no source in Berka",
    27: "balance sheet: Berka has no receivables, inventory or payables",
    28: "same as 27",
    29: "same as 27",
    30: "same as 27",
    31: "same as 27",
    34: "zakat: no balance sheet",
    35: "same as 34",
    36: "Ramadan calendar not pinned for 1993–1998",
    37: "balance-sheet derived",
    38: "balance-sheet derived",
    39: "balance-sheet derived",
    40: "balance-sheet derived",
    55: "sector-relative z-score; Berka has district (geography), never a sector proxy (§15.8)",
    56: "same as 55",
    57: "same as 55",
    58: "same as 55",
    59: "same as 55",
    64: "no mandate status history in any public dataset",
    65: "no balloon field in any public dataset",
    66: "no credit-facility data in Berka or any public dataset",
    67: "same as 66",
    69: "same as 66",
}


def band_of(feature: int | str) -> str:
    if feature in COMPUTABLE:
        return "computable"
    if feature in PARTIAL:
        return "partial"
    if feature in NOT_COMPUTABLE:
        return "not_computable"
    raise KeyError(feature)


def assert_partition() -> None:
    all_ = COMPUTABLE + PARTIAL + NOT_COMPUTABLE
    dup = {f for f in all_ if all_.count(f) > 1}
    missing = [f for f in FEATURE_NAMES if f not in all_]
    unknown = [f for f in all_ if f not in FEATURE_NAMES]
    if dup or missing or unknown:
        raise AssertionError(f"coverage bands are not a partition — dup {dup}, missing {missing}, unknown {unknown}")


assert_partition()
