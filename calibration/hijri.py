"""Hijri ↔ Gregorian re-indexing for the §22 decomposition (Umm al-Qura calendar via `hijridate`).

w_{m,h} = fraction of Gregorian period m (a month, or a week) that falls in Hijri month h.
Eid al-Fitr is taken as the first three days of Shawwal, matching the generator's pinned
`ramadan_calendar` (asserted against it for 1445–1447 in `assert_matches_config`).
"""

from __future__ import annotations

import numpy as np
import pandas as pd
from hijridate import Gregorian, Hijri

HIJRI_MONTHS = [
    "Muharram",
    "Safar",
    "Rabi I",
    "Rabi II",
    "Jumada I",
    "Jumada II",
    "Rajab",
    "Shaban",
    "Ramadan",
    "Shawwal",
    "Dhu al-Qadah",
    "Dhu al-Hijjah",
]
RAMADAN, SHAWWAL = 9, 10
EID_DAYS = 3


def hijri_of(day: pd.Timestamp) -> tuple[int, int, int]:
    h = Gregorian(day.year, day.month, day.day).to_hijri()
    return h.year, h.month, h.day


def hijri_month_series(days: pd.DatetimeIndex) -> np.ndarray:
    """Hijri month number (1–12) for each Gregorian day."""
    return np.array([hijri_of(d)[1] for d in days], dtype=int)


def overlap_weights(period_starts: pd.DatetimeIndex, period_ends: pd.DatetimeIndex) -> np.ndarray:
    """W[m, h-1] = share of days of period m (inclusive start/end) that fall in Hijri month h. Rows sum to 1."""
    W = np.zeros((len(period_starts), 12))
    for i, (s, e) in enumerate(zip(period_starts, period_ends, strict=True)):
        days = pd.date_range(s, e, freq="D")
        months = hijri_month_series(days)
        for h in range(1, 13):
            W[i, h - 1] = (months == h).sum() / len(days)
    assert np.allclose(W.sum(axis=1), 1.0)
    return W


def month_bounds(dates: pd.DatetimeIndex) -> tuple[pd.DatetimeIndex, pd.DatetimeIndex]:
    starts = pd.DatetimeIndex([pd.Timestamp(d.year, d.month, 1) for d in dates])
    ends = starts + pd.offsets.MonthEnd(0)
    return starts, ends


def ramadan_window(hijri_year: int) -> dict:
    r1 = Hijri(hijri_year, RAMADAN, 1)
    s1 = Hijri(hijri_year, SHAWWAL, 1)
    r_start = pd.Timestamp(r1.to_gregorian().isoformat())
    e_start = pd.Timestamp(s1.to_gregorian().isoformat())
    return {
        "hijri_year": hijri_year,
        "ramadan_start": r_start,
        "ramadan_end": e_start - pd.Timedelta(days=1),
        "eid_start": e_start,
        "eid_end": e_start + pd.Timedelta(days=EID_DAYS - 1),
        "ramadan_days": int(r1.month_length()),
    }


def ramadan_windows_for_gregorian_years(years) -> list[dict]:
    years = {int(y) for y in years}
    out = []
    for hy in range(1430, 1460):
        w = ramadan_window(hy)
        if w["ramadan_start"].year in years or w["ramadan_end"].year in years:
            out.append(w)
    return out


def assert_matches_config(cfg: dict) -> None:
    """The generator's pinned Umm al-Qura table and the converter must agree — otherwise the fit and the generator disagree on what 'Ramadan' means."""
    for e in cfg["ramadan_calendar"]:
        w = ramadan_window(int(e["hijri_year"]))
        for k in ("ramadan_start", "ramadan_end", "eid_start", "eid_end"):
            assert w[k] == pd.Timestamp(e[k]), f"ramadan_calendar {e['hijri_year']} {k}: config {e[k]} vs Umm al-Qura converter {w[k].date()}"
