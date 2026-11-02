"""§10 holdout-shock lead-time test and the §16 Ramadan-window run — DECISIONS entry 36.1–36.2.

    python -m eval.holdout_shock            → eval/out/holdout_shock.md, .png, _per_business.csv

Every definition below was fixed in DECISIONS entry 36 before this file existed.

Population: serving (business_id 10,001–11,000) minus the three demo businesses and the
`<1yr` age tier. Each business is regenerated in memory with its own seed through a
harness-side demo spec that sets only `start_date` and `inject_cash_crunch`; config.yaml
and generator/ are not changed. Variants: control (no shock), 30% shock (primary), 50% shock.
Placements: neutral (start 2025-08-01, no Ramadan or Eid in the window) and Ramadan
(start 2025-11-19, so day 92 is the first day of Ramadan 1447).

Shock: inject_cash_crunch week 14 → revenue drops from day 92 (1-based) to day 180.
Event E: first day ≥ 92 with the shocked actual balance < 0, counted only if the control
balance stays ≥ 0 over days 92–180 (a shock-caused crunch).
Detection D: first as-of day t in [92, E−1] at which the method, fitted on history up to t,
projects a negative balance on any of the next 30 days. Lead time = E − D; a miss is 0.
False alarm: on the control series of businesses whose control stays ≥ 0 over days 92–180,
any detection at as-of days 92–150.
Methods: naive90 (the shipped method, entry 27) and naive30 (the §10 baseline), from
lenses/forecast/methods.py — the functions the lens runs. The liquidity hazard is left out:
both methods would read the same hazard number (entry 36.1).

Data source: synthetic. No method is changed because of this result (entry 36.1).
"""

from __future__ import annotations

import argparse
import contextlib
import copy
import io
import sys
from itertools import pairwise
from pathlib import Path

import numpy as np
import pandas as pd

from generator.generate import generate, load_config, sample_registry
from lenses.forecast.methods import METHODS

SHOCK_WEEK = 14
ONSET = (SHOCK_WEEK - 1) * 7          # 0-based index of day 92
HORIZON = 30
LAST_FA_ASOF = 149                    # 0-based index of day 150
CHART_ASOF = ONSET + 14               # 0-based index of day 106 (shock + 14)
PLACEMENTS = {"neutral": "2025-08-01", "ramadan": "2025-11-19"}
VARIANTS = {"control": None, "shock30": 30, "shock50": 50}
COMPARED = ("naive90", "naive30")
DEMO_IDS = {10001, 10002, 10003}
BATCH = 200
OUT = Path("eval/out")


def sample_ids(cfg: dict) -> list[int]:
    """Serving IDs in the test: not a demo business, not the <1yr thin-file tier."""
    pop = cfg["populations"]["serving"]
    lo, hi = pop["id_range"]
    return [b for b in range(lo, hi + 1)
            if b not in DEMO_IDS and sample_registry(cfg, "serving", pop, b, None)["age_tier"] != "<1yr"]


def generate_variant(cfg: dict, ids: list[int], start: str, severity: int | None, keep_tx: bool = False) -> dict[str, pd.DataFrame]:
    """Regenerate `ids` in memory with the window starting at `start` and an optional week-14 shock.

    Returns daily_aggregates and businesses (and transactions if asked). The populations block keeps
    the serving seed, so each business has the same draws it has in the full generation.
    """
    out: dict[str, list[pd.DataFrame]] = {"daily_aggregates": [], "businesses": [], "transactions": []}
    pop = cfg["populations"]["serving"]
    for i in range(0, len(ids), BATCH):
        chunk = ids[i:i + BATCH]
        c = copy.deepcopy(cfg)
        c["populations"] = {"serving": {**pop, "id_range": [chunk[0], chunk[-1]]}}
        spec = {"start_date": start, **({"inject_cash_crunch": {"week": SHOCK_WEEK, "severity_pct": severity}} if severity else {})}
        c["demo_businesses"] = [{"id": b, **spec} for b in chunk]
        with contextlib.redirect_stdout(io.StringIO()):
            t = generate(c)
        keep = set(chunk)
        for name, parts in out.items():
            if name == "transactions" and not keep_tx:
                continue
            parts.append(t[name][t[name]["business_id"].isin(keep)])
    return {k: pd.concat(v, ignore_index=True) for k, v in out.items() if v}


def first_detection(g: pd.DataFrame, method: str, t_from: int, t_to: int) -> int | None:
    """First as-of index t in [t_from, t_to] whose 30-day projection goes below zero, else None."""
    bal = g["eod_balance"].to_numpy(float)
    for t in range(t_from, t_to + 1):
        hist = g.iloc[: t + 1]
        path = bal[t] + np.cumsum(METHODS[method](hist, HORIZON))
        if (path < 0).any():
            return t
    return None


def evaluate(daily: dict[str, pd.DataFrame], biz: pd.DataFrame, placement: str) -> pd.DataFrame:
    """One row per business × shock severity: event, detections, lead times, false alarms."""
    sector = biz.set_index("business_id")["sector"]
    ctrl = {b: g.sort_values("date").reset_index(drop=True) for b, g in daily["control"].groupby("business_id")}
    rows = []
    for variant in ("shock30", "shock50"):
        for b_id, g in daily[variant].groupby("business_id"):
            g = g.sort_values("date").reset_index(drop=True)
            c = ctrl[b_id]
            ctrl_ok = bool((c["eod_balance"].to_numpy(float)[ONSET:] >= 0).all())
            neg = np.flatnonzero(g["eod_balance"].to_numpy(float)[ONSET:] < 0)
            event = int(ONSET + neg[0]) if len(neg) else None
            row = {"placement": placement, "variant": variant, "business_id": b_id, "sector": sector[b_id],
                   "control_never_negative": ctrl_ok, "event_day": None if event is None else event + 1,
                   "shock_caused_crunch": bool(ctrl_ok and event is not None)}
            for m in COMPARED:
                d = first_detection(g, m, ONSET, event - 1) if row["shock_caused_crunch"] else None
                row[f"{m}_detect_day"] = None if d is None else d + 1
                row[f"{m}_lead_days"] = (event - d if d is not None else 0) if row["shock_caused_crunch"] else None
                # false alarm on the control series (same for both severities; computed once per business)
                row[f"{m}_control_false_alarm"] = (first_detection(c, m, ONSET, LAST_FA_ASOF) is not None) if ctrl_ok else None
            rows.append(row)
    num = ["event_day"] + [f"{m}_{k}" for m in COMPARED for k in ("detect_day", "lead_days")]
    return pd.DataFrame(rows).astype({c: float for c in num})


def bootstrap_median_ci(x: np.ndarray, n: int = 2000, seed: int = 0) -> tuple[float, float]:
    rng = np.random.default_rng(seed)
    meds = np.median(rng.choice(x, size=(n, len(x)), replace=True), axis=1)
    return float(np.percentile(meds, 2.5)), float(np.percentile(meds, 97.5))


def summary_table(r: pd.DataFrame) -> list[str]:
    lines = ["| placement | shock | businesses | shock-caused crunches | method | detected before the event | lead time, median [IQR] days | false alarms (control) |",
             "|---|---|---|---|---|---|---|---|"]
    for (pl, var), g in r.groupby(["placement", "variant"], sort=False):
        ev = g[g["shock_caused_crunch"]]
        fa_base = g[g["control_never_negative"]]
        for m in COMPARED:
            lead = ev[f"{m}_lead_days"].astype(float)
            q1, q3 = (lead.quantile(0.25), lead.quantile(0.75)) if len(lead) else (np.nan, np.nan)
            det = f"{ev[f'{m}_detect_day'].notna().mean():.1%}" if len(ev) else "—"
            ld = f"{lead.median():.0f} [{q1:.0f}, {q3:.0f}]" if len(ev) else "—"
            lines.append(
                f"| {pl} | {var[5:]}% | {len(g):,} | {len(ev):,} | `{m}` | {det} | {ld} | "
                f"{fa_base[f'{m}_control_false_alarm'].astype(bool).mean():.1%} (of {len(fa_base):,}) |"
            )
    return lines


def paired_table(r: pd.DataFrame) -> list[str]:
    lines = ["| placement | shock | N | `naive90` earlier | same day | `naive90` later | median difference (naive90 − naive30), days [95% CI] |",
             "|---|---|---|---|---|---|---|"]
    for (pl, var), g in r.groupby(["placement", "variant"], sort=False):
        ev = g[g["shock_caused_crunch"]]
        diff = (ev["naive90_lead_days"] - ev["naive30_lead_days"]).astype(float).to_numpy()
        if not len(diff):
            continue
        lo, hi = bootstrap_median_ci(diff)
        lines.append(f"| {pl} | {var[5:]}% | {len(diff):,} | {(diff > 0).mean():.1%} | {(diff == 0).mean():.1%} | "
                     f"{(diff < 0).mean():.1%} | {np.median(diff):+.0f} [{lo:+.0f}, {hi:+.0f}] |")
    return lines


def sector_table(r: pd.DataFrame) -> list[str]:
    lines = ["| placement | sector | shock-caused crunches | `naive90` detected | `naive30` detected | `naive90` median lead | `naive30` median lead |",
             "|---|---|---|---|---|---|---|"]
    p = r[(r["variant"] == "shock30") & r["shock_caused_crunch"]]
    for (pl, sec), g in p.groupby(["placement", "sector"], sort=False):
        lines.append(f"| {pl} | {sec} | {len(g):,} | {g['naive90_detect_day'].notna().mean():.1%} | "
                     f"{g['naive30_detect_day'].notna().mean():.1%} | {g['naive90_lead_days'].median():.0f} | {g['naive30_lead_days'].median():.0f} |")
    return lines


def chart(r: pd.DataFrame, daily: dict[str, pd.DataFrame], path: Path) -> int | None:
    """Panel (a): the business picked by the entry-36.1 rule. Panel (b): lead-time distributions."""
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    ink, ink2, grid = "#0b0b0b", "#52514e", "#e4e3df"
    color = {"naive90": "#2a78d6", "naive30": "#eb6834"}
    pick = r[(r["placement"] == "neutral") & (r["variant"] == "shock30") & r["shock_caused_crunch"]]
    if pick.empty:
        return None
    row = pick.sort_values("business_id").iloc[0]
    b_id = int(row["business_id"])
    s = daily["shock30"][daily["shock30"]["business_id"] == b_id].sort_values("date").reset_index(drop=True)
    c = daily["control"][daily["control"]["business_id"] == b_id].sort_values("date").reset_index(drop=True)
    day = np.arange(1, len(s) + 1)

    fig, (ax, bx) = plt.subplots(1, 2, figsize=(13, 4.8), gridspec_kw={"width_ratios": [1.6, 1]})
    fig.patch.set_facecolor("#fcfcfb")
    for a in (ax, bx):
        a.set_facecolor("#fcfcfb")
        a.grid(axis="y", color=grid, linewidth=0.8)
        for sp in ("top", "right"):
            a.spines[sp].set_visible(False)
        for sp in ("left", "bottom"):
            a.spines[sp].set_color(ink2)
        a.tick_params(colors=ink2, labelsize=9)

    ax.plot(day, c["eod_balance"] / 1000, color=ink2, linewidth=1.5, linestyle=(0, (4, 3)), label="actual, no shock")
    ax.plot(day, s["eod_balance"] / 1000, color=ink, linewidth=2, label="actual, 30% shock")
    t = CHART_ASOF
    fut = np.arange(t + 2, t + 2 + HORIZON)
    for m in COMPARED:
        p = s["eod_balance"].iloc[t] + np.cumsum(METHODS[m](s.iloc[: t + 1], HORIZON))
        ax.plot(fut, p / 1000, color=color[m], linewidth=2, label=f"{m} projection made on day {t + 1}")
    ax.axhline(0, color=ink2, linewidth=0.8)
    ax.axvline(ONSET + 1, color=ink2, linewidth=0.8, linestyle=":")
    ax.annotate("shock", (ONSET + 1, ax.get_ylim()[1]), xytext=(3, -12), textcoords="offset points", color=ink2, fontsize=9)
    for m in COMPARED:
        d = row[f"{m}_detect_day"]
        if pd.notna(d):
            ax.plot([d], [0], marker="v", markersize=9, color=color[m], markeredgecolor="#fcfcfb", markeredgewidth=1.5)
    ax.plot([row["event_day"]], [0], marker="X", markersize=10, color=ink, markeredgecolor="#fcfcfb", markeredgewidth=1.5)
    ax.set_xlabel("day of window (triangles: first warning by each method; X: balance first goes negative)", color=ink2, fontsize=9)
    ax.set_ylabel("balance, SAR thousands", color=ink2, fontsize=9)
    ax.set_title(f"(a) Business {b_id} ({row['sector']}), neutral window", color=ink, fontsize=11, loc="left")
    ax.legend(frameon=False, fontsize=8.5, labelcolor=ink, loc="upper left")

    ev = r[(r["placement"] == "neutral") & (r["variant"] == "shock30") & r["shock_caused_crunch"]]
    edges = [1, 8, 15, 22, 29, 36, 43, 50]
    labels = ["missed"] + [f"{a}–{b - 1}" for a, b in pairwise(edges)] + [f"{edges[-1]}+"]
    x = np.arange(len(labels))
    for k, m in enumerate(COMPARED):
        lead = ev[f"{m}_lead_days"].astype(float).to_numpy()
        counts = [int((lead == 0).sum())] + [int(((lead >= a) & (lead < b)).sum()) for a, b in pairwise(edges)]
        counts.append(int((lead >= edges[-1]).sum()))
        bx.bar(x + (k - 0.5) * 0.4, counts, width=0.38, color=color[m], label=m)
    bx.set_xticks(x, labels, fontsize=8.5)
    bx.set_xlabel("warning lead time, days", color=ink2, fontsize=9)
    bx.set_ylabel("businesses", color=ink2, fontsize=9)
    bx.set_title(f"(b) Lead time, neutral window, 30% shock (N = {len(ev):,})", color=ink, fontsize=11, loc="left")
    bx.legend(frameon=False, fontsize=8.5, labelcolor=ink)
    fig.tight_layout()
    fig.savefig(path, dpi=150, facecolor=fig.get_facecolor())
    plt.close(fig)
    return b_id


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--limit", type=int, default=None, help="first N sample businesses only (smoke test)")
    ap.add_argument("--out-prefix", default=str(OUT / "holdout_shock"))
    args = ap.parse_args(argv)
    cfg = load_config("config.yaml")
    ids = sample_ids(cfg)[: args.limit]
    print(f"sample: {len(ids):,} serving businesses (demo and <1yr excluded)", flush=True)

    results, chart_daily = [], None
    for pl, start in PLACEMENTS.items():
        daily, biz = {}, None
        for var, sev in VARIANTS.items():
            t = generate_variant(cfg, ids, start, sev)
            daily[var], biz = t["daily_aggregates"], t["businesses"]
            print(f"  generated {pl}/{var}", flush=True)
        results.append(evaluate(daily, biz, pl))
        if pl == "neutral":
            chart_daily = daily
        print(f"  evaluated {pl}", flush=True)
    r = pd.concat(results, ignore_index=True)

    prefix = Path(args.out_prefix)
    prefix.parent.mkdir(parents=True, exist_ok=True)
    r.to_csv(f"{prefix}_per_business.csv", index=False)
    b_chart = chart(r, chart_daily, Path(f"{prefix}.png"))

    lines = [
        "# Forecast lens — §10 holdout-shock lead time, neutral and Ramadan windows (DECISIONS entry 36)",
        "",
        f"Population: **serving**, demo businesses and the `<1yr` tier excluded, N = {len(ids):,}. Data source: synthetic.",
        "Shock: revenue drop from day 92 (week 14) to the window end. Detection: the 30-day projection goes",
        "below zero at an as-of day before the actual balance does. Misses count as 0 days of lead time.",
        "Definitions fixed in DECISIONS entry 36.1 before this ran. No method was changed because of this result.",
        "",
        "## Detection and lead time",
        "",
        *summary_table(r),
        "",
        "## Paired: does the shipped method warn earlier than the baseline on the same business?",
        "",
        *paired_table(r),
        "",
        "## By sector (30% shock)",
        "",
        *sector_table(r),
        "",
        f"Chart: `{prefix.name}.png` — panel (a) is business {b_chart}, the lowest `business_id` with a shock-caused",
        "crunch in the neutral 30% run (the rule in entry 36.1); panel (b) is the lead-time distribution.",
        "",
        "`ramadan_adjusted` (feature 36) is a coarse flag; the forecast lens makes no seasonal correction (§16).",
    ]
    Path(f"{prefix}.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print("\n".join(lines))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
