"""Owner insights (DECISIONS 62): a read-only view of how a business's own figures have moved.

    GET /insights/history?business_id=   four profile features as of earlier dates (IN3)

This is the self-comparison of schema §36.2: a business beside its own past. It is not peer
benchmarking, which §36.4 rejects and rule U9 forbids; nothing here compares one business with
another.

Nothing here is a new model or a new feature. The view calls the profile engine through
pipeline.data.run_profiles, the function every other route's profile comes from, and reads four of
its features. The four are computed from daily_aggregates alone inside the trailing 90-day window
(profile_engine.features.daily_features), which is what lets them be recomputed as of an earlier
date by moving the as-of date and nothing else.

As-of dates step back STEP_DAYS at a time from the business's own as-of date. A date is included
only if the full trailing window before it lies inside the business's data, so every point is the
same 90-day measure; a date the engine refuses (insufficient_data) or returns no value for is
absent. Nothing is interpolated. The newest point is the value /profile returns today.
"""

from __future__ import annotations

import pandas as pd

from pipeline.data import run_profiles
from profile_engine.features import TRAILING_DAYS

METRICS = ("avg_monthly_inflow", "inflow_outflow_ratio", "avg_daily_balance", "cash_flow_volatility")
STEP_DAYS = 30
MAX_POINTS = 12
DATED_TABLES = {"daily_aggregates": "date", "transactions": "date", "balances_monthly": "month_end"}


def _number(v) -> float | None:
    return None if v is None or pd.isna(v) else float(v)


def _as_of_dates(first: pd.Timestamp, as_of: pd.Timestamp) -> list[pd.Timestamp]:
    """Newest first: as_of, as_of - 30 d, ... while the whole trailing window lies inside the data."""
    out = []
    for k in range(MAX_POINTS):
        d = as_of - pd.Timedelta(days=STEP_DAYS * k)
        if d - pd.Timedelta(days=TRAILING_DAYS - 1) < first:
            break
        out.append(d)
    return out


def history(cfg: dict, tables: dict, b_id: int) -> dict:
    """`tables` is this business's rows, as the store loads them for any route."""
    biz = tables["businesses"]
    as_of = pd.Timestamp(biz["window_end"].iloc[0])
    daily = tables["daily_aggregates"]
    first = max(pd.Timestamp(daily["date"].min()), pd.Timestamp(biz["operating_start_date"].iloc[0])) if len(daily) else as_of
    points = []
    for d in _as_of_dates(first, as_of):
        past = {name: df.copy() for name, df in tables.items()}
        past["businesses"]["window_end"] = d
        for name, col in DATED_TABLES.items():
            if name in past:
                past[name] = past[name][pd.to_datetime(past[name][col]) <= d].reset_index(drop=True)
        prof = run_profiles(past, cfg)
        if prof["status"].set_index("business_id").loc[b_id, "status"] == "insufficient_data":
            continue
        row = prof["features"].set_index("business_id").loc[b_id]
        values = {name: _number(row.get(name)) for name in METRICS}
        values = {name: v for name, v in values.items() if v is not None}
        if values:
            points.append({"as_of": d.date().isoformat(), "metrics": values})
    points.reverse()  # oldest first
    return {"window_days": TRAILING_DAYS, "step_days": STEP_DAYS, "metrics": list(METRICS), "points": points, "deterministic": True}
