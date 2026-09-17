"""Evidence registry — SOP_Data_Grounding §1, §6.3; SOP_Monshaat_Unblock B1 / B2.

Every feature is exactly one of:
  A2  real_predictive     computed on Berka AND its univariate AUC CI excludes 0.50 on ≥ 1 label set
  A1  real_computed       computed on Berka against real outcomes; performance reported, not assumed
  B   grounded_synthetic  synthetic, every parameter traces to a published or measured source whose
                          interval excludes the null
  B-weak                  measured and applied, but the interval contains the null (1.0 for a multiplier);
                          reported, never claimed as grounded
  C   demonstrated_only   synthetic, no source exists anywhere

The registry below is typed with the BASE class (A / B / C). The A1 / A2 split is never typed by
hand: it is read from `profile_engine/feature_transfer.json`, written by `calibration.reclass_evidence`
from `eval.feature_transfer` (per-feature Berka AUC, percentile bootstrap ≥ 1,000 resamples, both
label sets). If that file is absent every A feature is A1 — the weaker claim is the default.

A metric whose inputs are mixed reports the WEAKEST class present. Class-C features never carry a
performance claim (§13.4) and never enter the §21 target list (§13.3). Base membership was set
from the Phase 0 probe results (DECISIONS.md entry 7): all four probes passed, so no feature moved
from A to C.
"""

from __future__ import annotations

import json
from pathlib import Path

from profile_engine.registry import FEATURE_NAMES

CLASS_LABELS = {"A2": "real_predictive", "A1": "real_computed", "B": "grounded_synthetic", "B-weak": "grounded_synthetic_weak", "C": "demonstrated_only"}
CLASS_CLAIM = {
    "A2": "Computed on real bank data and predictive of real credit outcomes (univariate AUC with CI in eval/out/feature_transfer.md)",
    "A1": "Computed on real bank data; predictive performance reported per feature, not assumed",
    "B": "Behaves correctly under measured parameters",
    "B-weak": "Behaves correctly under measured parameters whose interval contains no effect; the measurement is applied but not claimed as grounded",
    "C": "Implemented and functional; no public data exists to validate it",
}
CLASS_ORDER = ("A2", "A1", "B", "B-weak", "C")  # strongest → weakest
RANK = {c: i for i, c in enumerate(reversed(CLASS_ORDER))}  # C = 0 … A2 = 4
REAL_CLASSES = ("A1", "A2")
TRANSFER_PATH = Path(__file__).with_name("feature_transfer.json")

_BERKA = "Berka: computed on real accounts, point-in-time before loan.date"
_BASE: dict[int | str, tuple[str, str]] = {  # typed base class A / B / C (see module docstring)
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


def base_class(feature: int | str) -> str:
    """The typed class before the A1/A2 split (A, B or C)."""
    return _BASE[feature][0]


def _load_transfer() -> dict:
    if not TRANSFER_PATH.exists():
        return {}
    data = json.loads(TRANSFER_PATH.read_text(encoding="utf-8"))
    return {str(k): v["subclass"] for k, v in data.get("features", {}).items()}


_SUBCLASS = _load_transfer()


def _resolve(feature: int | str) -> str:
    cls = _BASE[feature][0]
    if cls != "A":
        return cls
    sub = _SUBCLASS.get(str(feature), "A1")
    assert sub in REAL_CLASSES, f"feature {feature}: transfer file carries {sub}"
    return sub


EVIDENCE: dict[int | str, tuple[str, str]] = {f: (_resolve(f), basis) for f, (_, basis) in _BASE.items()}


def evidence_class(feature: int | str) -> str:
    return EVIDENCE[feature][0]


def is_real(cls: str) -> bool:
    return cls in REAL_CLASSES


def weakest_class(features) -> str:
    """A metric over mixed inputs reports the weakest class present (§6.3)."""
    return min((EVIDENCE[f][0] for f in features), key=RANK.get)


def counts() -> dict[str, int]:
    return {c: sum(1 for f in FEATURE_NAMES if EVIDENCE[f][0] == c) for c in CLASS_ORDER}


def assert_complete() -> None:
    missing = [f for f in FEATURE_NAMES if f not in EVIDENCE]
    extra = [f for f in EVIDENCE if f not in FEATURE_NAMES]
    if missing or extra:
        raise AssertionError(f"EVIDENCE registry gaps — missing {missing}, unknown {extra}")
    if _SUBCLASS:
        typed_a = {str(f) for f in _BASE if _BASE[f][0] == "A"}
        unknown = set(_SUBCLASS) - typed_a
        if unknown:
            raise AssertionError(f"feature_transfer.json carries subclasses for non-A features {sorted(unknown)}")


assert_complete()
