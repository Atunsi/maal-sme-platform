"""Evidence registry — SOP_Data_Grounding §1, §6.3.

Every feature is exactly one of:
  A  real_validated       computed on Berka against real outcomes
  B  grounded_synthetic   synthetic, every parameter traces to a published or measured source
  C  demonstrated_only    synthetic, no source exists anywhere

A metric whose inputs are mixed reports the WEAKEST class present. Class-C
features never carry a performance claim (§13.4) and never enter the §21 target
list (§13.3). Membership was set from the Phase 0 probe results (DECISIONS.md
entry 7): all four probes passed, so no feature moved from A to C.
"""

from __future__ import annotations

from profile_engine.registry import FEATURE_NAMES

CLASS_LABELS = {"A": "real_validated", "B": "grounded_synthetic", "C": "demonstrated_only"}
CLASS_CLAIM = {
    "A": "Predicts real outcomes",
    "B": "Behaves correctly under measured parameters",
    "C": "Implemented and functional; no public data exists to validate it",
}

_BERKA = "Berka: computed on real accounts, point-in-time before loan.date"
EVIDENCE: dict[int | str, tuple[str, str]] = {
    1: ("A", _BERKA + " (absolute CZK; never in the comparison set)"),
    2: ("A", _BERKA),
    3: ("A", "Berka: inflow interval CV on real accounts"),
    4: ("A", _BERKA),
    5: ("A", "Berka: bank+account partner key (Probe 2 PASS); coverage share reported"),
    6: ("A", _BERKA + " (absolute CZK; never in the comparison set)"),
    7: ("A", _BERKA),
    8: ("A", "Berka: declared `order` table vs inferred classification (§8.4)"),
    9: ("A", _BERKA),
    10: ("A", "Berka: category from k_symbol/operation codes"),
    11: ("A", _BERKA),
    12: ("A", _BERKA),
    13: ("A", "Berka: 6.4% of accounts ever negative (Probe 1 PASS)"),
    14: ("A", "Berka: Probe 1 PASS"),
    15: ("A", "Berka: composite of 11–14; formula PROPOSED (DECISIONS.md entry 8)"),
    16: ("A", _BERKA + " (absolute CZK)"),
    17: ("A", _BERKA + " (absolute CZK)"),
    18: ("A", _BERKA),
    "18b": ("A", _BERKA),
    19: ("A", _BERKA + " (currency/day; never in the comparison set)"),
    20: ("A", "Berka: Probe 2 PASS; coverage share reported"),
    21: ("A", "Berka: Probe 2 PASS; coverage share reported"),
    22: ("A", "Berka: Probe 2 PASS; coverage share reported"),
    23: ("C", "MCC assigned by the generator to every business; no public source pairs MCC coverage with SMEs (§12.3)"),
    24: ("C", "Sharia screen depends on MCC; compliance module not built; no real MCC exists in any public dataset"),
    25: ("C", "ESG proxy: no public source; module not built"),
    26: ("A", "reuses features 3 and 11 (both A); weighting formula not yet signed off — not_implemented"),
    27: ("C", "Balance sheet from §24 sector archetypes; author judgement, Berka has no balance sheet"),
    28: ("C", "same as 27"),
    29: ("C", "same as 27"),
    30: ("C", "same as 27"),
    31: ("C", "same as 27"),
    32: ("A", _BERKA),
    33: ("A", "Berka: operating-day calendar is Sat/Sun for external_real (Czech), Fri/Sat for synthetic"),
    34: ("C", "nisab/hawl: zakat module not built; no source"),
    35: ("C", "same as 34"),
    36: ("C", "Ramadan calendar pinned for 1445–1448 only; Berka window (1993–98) not covered → not_available_in_source"),
    37: ("C", "implied DSO from §24 archetype receivables (author judgement)"),
    38: ("C", "same as 37"),
    39: ("C", "same as 37"),
    40: ("C", "same as 37"),
    41: ("A", "Berka: k_symbol=UVER loan payments (code path); MCC path does not exist on real data (§8.4)"),
    42: ("A", "derived from 1, 6, 49 — all A"),
    43: ("A", _BERKA),
    44: ("A", _BERKA),
    45: ("A", "Berka: Probe 2 PASS; coverage share reported"),
    46: ("A", "Berka: Probe 2 PASS; coverage share reported"),
    47: ("A", _BERKA),
    48: ("A", _BERKA),
    49: ("A", _BERKA),
    50: ("A", "Berka: fixed costs = declared standing-order outflow, variable = the rest"),
    51: ("A", _BERKA),
    52: ("A", "Berka: block-bootstrap hazard over real net flows (naive trailing-mean model)"),
    53: ("A", "same as 52"),
    54: ("A", "same as 52"),
    55: ("C", "z-score against the SYNTHETIC N=10,000 sector reference table; Berka has no sector (§15.8)"),
    56: ("C", "same as 55"),
    57: ("C", "same as 55"),
    58: ("C", "same as 55"),
    59: ("C", "same as 55"),
    60: ("A", "Berka: `order` table, declared standing orders (frequency measured from executions)"),
    61: ("A", "Berka: `order` table + real inflow"),
    62: ("B", "termination dates drawn from Berka loan.duration distribution (synthetic side only)"),
    "62b": ("B", "same as 62"),
    63: ("B", "same as 62"),
    64: ("C", "mandate cancellation: no public source; must correlate with latent distress in the generator (§10.2)"),
    65: ("C", "balloon payments: no public source"),
    66: ("C", "credit facilities: no public source pairs facility state with outcomes (§12.1)"),
    67: ("C", "same as 66"),
    68: ("A", "Berka: longest run of consecutive negative-balance days on real accounts (Probe 1 PASS)"),
    69: ("C", "same as 66"),
}


def evidence_class(feature: int | str) -> str:
    return EVIDENCE[feature][0]


def weakest_class(features) -> str:
    """A metric over mixed inputs reports the weakest class present (§6.3)."""
    classes = {EVIDENCE[f][0] for f in features}
    return "C" if "C" in classes else ("B" if "B" in classes else "A")


def assert_complete() -> None:
    missing = [f for f in FEATURE_NAMES if f not in EVIDENCE]
    extra = [f for f in EVIDENCE if f not in FEATURE_NAMES]
    if missing or extra:
        raise AssertionError(f"EVIDENCE registry gaps — missing {missing}, unknown {extra}")


assert_complete()
