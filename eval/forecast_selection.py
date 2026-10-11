"""Choose the forecast method on a validation window; report it once on an untouched test window.

    python -m eval.forecast_selection [--dir data]        → eval/out/forecast_selection.md

Why two windows. Picking the best of several methods on the same days you then report on
flatters the winner — the choice itself is fitted to those days. So, for every business
with a full 180-day window:

    days   1 … 120   history for VALIDATION (fit on the last 90 of these)
    days 121 … 150   VALIDATION target — the method is chosen here (research population only)
    days   1 … 150   history for TEST
    days 151 … 180   TEST target — reported ONCE, research and serving; never used to choose

Candidates and the criterion were fixed before this ran (lenses/forecast/methods.py,
DECISIONS entry 27). Criterion: lowest median scale-free end-of-horizon balance error,
|projected − actual| / avg monthly outflow (§10's MAPE is undefined at zero balance and is
reported only away from zero). Crunch detection (did the projected path flag a realised
negative balance in advance) is reported beside it for every candidate.

If no candidate beats naive30 on validation, naive30 is selected and that is the result.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import numpy as np
import pandas as pd

from lenses.forecast.methods import BASELINE, METHODS

H = 30


def evaluate(daily: pd.DataFrame, origin_from_end: int) -> pd.DataFrame:
    """Per business × method: end-of-horizon error and crunch outcome for one window."""
    rows = []
    for b_id, g in daily.groupby("business_id", sort=False):
        g = g.reset_index(drop=True)
        T = len(g)
        cut = T - origin_from_end
        if cut < 90 + 1:
            continue
        hist, fut = g.iloc[:cut], g.iloc[cut:cut + H]
        if len(fut) < H:
            continue
        b0 = float(hist["eod_balance"].iloc[-1])
        fit = hist.tail(90)
        scale = max(float(fit["outflow_total"].sum()) / (len(fit) / 30.0), 500.0)
        actual = fut["eod_balance"].to_numpy(float)
        went_neg = bool((actual < 0).any())
        for name, fn in METHODS.items():
            path = b0 + np.cumsum(fn(hist, H))
            rows.append({"business_id": b_id, "method": name, "err": abs(path[-1] - actual[-1]) / scale,
                         "actual": actual[-1], "proj": path[-1], "scale": scale,
                         "went_negative": went_neg, "alert": bool((path < 0).any())})
    return pd.DataFrame(rows)


def summarise(r: pd.DataFrame) -> pd.DataFrame:
    out = []
    base = r[r["method"] == BASELINE].set_index("business_id")["err"]
    for m, g in r.groupby("method", sort=False):
        e = g.set_index("business_id")["err"]
        away = g["actual"].abs() > g["scale"]
        neg, pos = g[g["went_negative"]], g[~g["went_negative"]]
        out.append({
            "method": m,
            "median_err": float(e.median()),
            "mean_err": float(e.mean()),
            "beats_naive30_share": float((e < base.reindex(e.index)).mean()) if m != BASELINE else float("nan"),
            "mape_away_from_zero": float(((g.loc[away, "proj"] - g.loc[away, "actual"]).abs() / g.loc[away, "actual"].abs()).median()),
            "crunch_recall": float(neg["alert"].mean()) if len(neg) else float("nan"),
            "false_alarm": float(pos["alert"].mean()) if len(pos) else float("nan"),
        })
    return pd.DataFrame(out).sort_values("median_err").reset_index(drop=True)


def table(s: pd.DataFrame) -> str:
    lines = ["| method | median error | mean error | better than naive30 for | MAPE (away from zero) | crunch recall | false alarms |",
             "|---|---|---|---|---|---|---|"]
    for r in s.itertuples():
        beat = "—" if np.isnan(r.beats_naive30_share) else f"{r.beats_naive30_share:.1%}"
        lines.append(f"| {r.method} | {r.median_err:.3f} | {r.mean_err:.3f} | {beat} | {r.mape_away_from_zero:.1%} | {r.crunch_recall:.1%} | {r.false_alarm:.1%} |")
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dir", default="data")
    ap.add_argument("--out", default="eval/out/forecast_selection.md")
    args = ap.parse_args(argv)
    d = Path(args.dir)

    status = pd.read_csv(d / "profile_status.csv")
    biz = pd.read_csv(d / "businesses.csv")[["business_id", "population"]].merge(status, on="business_id")
    biz = biz[biz["status"] != "insufficient_data"]
    daily = pd.read_csv(d / "daily_aggregates.csv", parse_dates=["date"],
                        usecols=["business_id", "date", "net_flow", "outflow_total", "recurring_outflow_total", "eod_balance"])
    daily = daily.merge(biz[["business_id", "population"]], on="business_id").sort_values(["business_id", "date"])

    research = daily[daily["population"] == "research"]
    val = summarise(evaluate(research, origin_from_end=2 * H))
    chosen = val.iloc[0]["method"]
    if val.set_index("method").loc[chosen, "median_err"] >= val.set_index("method").loc[BASELINE, "median_err"]:
        chosen = BASELINE
    print(f"validation (research): selected {chosen}")

    test = {}
    for pop in ("research", "serving"):
        r = evaluate(daily[daily["population"] == pop], origin_from_end=H)
        test[pop] = (summarise(r[r["method"].isin([chosen, BASELINE])]), r["business_id"].nunique())

    vn = int(research["business_id"].nunique())
    lines = [
        "# Forecast lens — method selection (validation) and one-time test (§10)",
        "",
        "Data source: synthetic. Scorable businesses (§15). Horizon 30 days. Error = |projected − actual end balance| / avg monthly outflow.",
        "Candidates and criterion fixed before the run (lenses/forecast/methods.py, DECISIONS entry 27).",
        "",
        f"## 1. Validation — days 121–150, research (N = {vn:,}) — the method is chosen here",
        "",
        table(val),
        "",
        f"**Selected: `{chosen}`** (lowest median error{'; no candidate beat naive30, so the baseline is kept' if chosen == BASELINE else ''}).",
        "",
        "## 2. Test — days 151–180, reported once, never used to choose",
        "",
    ]
    for pop, (s, n) in test.items():
        lines += [f"### {pop} (N = {n:,})", "", table(s), ""]
    lines += ["Ramadan falls in days 18–47 of the window, so neither target window contains it; the §16 Ramadan-window",
              "run and the §10 holdout-shock lead-time test are separate, still-open checks."]
    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    Path(args.out).write_text("\n".join(lines) + "\n", encoding="utf-8")
    print("\n".join(lines))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
