"""Bounds for custom scenarios (POST /scenarios/run) — DECISIONS 44, PROPOSED.

Every bound is read from scenarios/library.yaml at import, never typed in: for each numeric parameter,
the smallest and largest value it takes anywhere in the library. A parameter with a single library
value is allowed from 0 up to that value when it is the size of a shock, and is otherwise fixed at the
library value. No parameter can set markup, amount, months or any other term of an offer (U1): the
shock types below are the generator's own demo levers (scenarios/run.py ALLOWED_OVERRIDES), and only
the ones that describe a disaster are offered.

Shock types and the library lever each one sets:
  cash_crunch            inject_cash_crunch {week, severity_pct}       revenue drop from a week
  large_transfer         one inject_anomalies entry of that type        a large transfer out in a week
  odd_hours_transaction  one inject_anomalies entry of that type        a night-time sale in a week
  newcomer               operating_start_date (a date, fixed)           trading for a short time only

A lever no shock names keeps the base business's own demo spec, exactly as library scenarios do (for
example mild_slowdown sets a crunch and keeps the baseline's anomalies).
"""

from __future__ import annotations

from scenarios.run import load_library

LIB, LIB_SHA = load_library()
MAX_SHOCKS = 3

# Parameters that are sizes of a shock: a single library value means 0 up to it, not fixed.
SIZE_PARAMS = {"severity_pct"}
UNITS = {"week": "week", "severity_pct": "percent"}
ANOMALY_TYPES = ("large_transfer", "odd_hours_transaction")
TERMS = {"markup", "amount", "months", "repayment", "term", "rate", "price"}  # U1: never a parameter


def _library_values() -> dict[str, dict[str, list]]:
    """Every value each shock parameter takes anywhere in the library."""
    seen: dict[str, dict[str, list]] = {"cash_crunch": {"week": [], "severity_pct": []}, "newcomer": {"operating_start_date": []}}
    for t in ANOMALY_TYPES:
        seen[t] = {"week": []}
    for s in LIB["scenarios"].values():
        o = s.get("overrides") or {}
        crunch = o.get("inject_cash_crunch")
        if crunch:
            for k in ("week", "severity_pct"):
                seen["cash_crunch"][k].append(crunch[k])
        for a in o.get("inject_anomalies") or []:
            if a["type"] in seen:
                seen[a["type"]]["week"].append(a["week"])
        if "operating_start_date" in o:
            seen["newcomer"]["operating_start_date"].append(o["operating_start_date"])
    return seen


def _bounds() -> dict[str, dict[str, dict]]:
    out: dict[str, dict[str, dict]] = {}
    for shock, params in _library_values().items():
        out[shock] = {}
        for name, values in params.items():
            if not values:
                continue
            if not all(isinstance(v, (int, float)) for v in values):
                out[shock][name] = {"fixed": values[0], "reason": "not numeric in the library; fixed at the library value"}
                continue
            lo, hi = min(values), max(values)
            if lo == hi and name in SIZE_PARAMS:
                lo, reason = 0, "one library value, and it is the size of a shock: 0 up to it"
            elif lo == hi:
                reason = "one library value, not a size: fixed at it"
            else:
                reason = "smallest and largest value in the library"
            out[shock][name] = {"min": lo, "max": hi, "step": 1, "unit": UNITS.get(name, ""), "reason": reason}
    return out


BOUNDS = _bounds()
assert not any(TERMS & set(p.split("_")) for shock in BOUNDS.values() for p in shock), "U1: a shock parameter names a term"


def describe() -> dict:
    """Shock types and their parameters, as GET /scenarios returns them."""
    return {
        shock: {
            "params": {k: {f: v[f] for f in ("min", "max", "step", "unit")} for k, v in params.items() if "min" in v},
            "fixed": {k: v["fixed"] for k, v in params.items() if "fixed" in v},
        }
        for shock, params in BOUNDS.items()
    }


class ShockError(ValueError):
    """A custom scenario request that the bounds refuse (HTTP 422)."""


def overrides_for(shocks: object) -> dict:
    """Validate a list of shocks against BOUNDS and turn it into library-style overrides."""
    if not isinstance(shocks, list) or not 1 <= len(shocks) <= MAX_SHOCKS:
        raise ShockError(f"shocks must be a list of 1 to {MAX_SHOCKS} shocks")
    overrides: dict = {}
    anomalies: list[dict] = []
    for i, shock in enumerate(shocks):
        if not isinstance(shock, dict) or set(shock) - {"type", "params"}:
            raise ShockError(f"shock {i}: must be an object with type and params only")
        kind, params = shock.get("type"), shock.get("params", {})
        if kind not in BOUNDS:
            raise ShockError(f"shock {i}: unknown type {kind!r}; known types are {sorted(BOUNDS)}")
        if not isinstance(params, dict):
            raise ShockError(f"shock {i}: params must be an object")
        allowed = {k for k, v in BOUNDS[kind].items() if "min" in v}
        if set(params) != allowed:
            raise ShockError(f"shock {i}: {kind} takes exactly {sorted(allowed)}")
        for name, value in params.items():
            b = BOUNDS[kind][name]
            if isinstance(value, bool) or not isinstance(value, int) or not b["min"] <= value <= b["max"]:
                raise ShockError(f"shock {i}: {name} must be a whole number from {b['min']} to {b['max']}")
        if kind == "cash_crunch":
            if "inject_cash_crunch" in overrides:
                raise ShockError("at most one cash_crunch shock")
            overrides["inject_cash_crunch"] = {"week": params["week"], "severity_pct": params["severity_pct"]}
        elif kind == "newcomer":
            if "operating_start_date" in overrides:
                raise ShockError("at most one newcomer shock")
            overrides["operating_start_date"] = BOUNDS["newcomer"]["operating_start_date"]["fixed"]
        else:
            anomalies.append({"type": kind, "week": params["week"]})
    if anomalies:
        overrides["inject_anomalies"] = anomalies
    return overrides
