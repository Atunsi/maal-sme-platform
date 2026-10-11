"""§10 forecast backtest — the model against the naive baseline, on days it never saw.

    python -m eval.forecast_backtest [--dir data] [--holdout-days 30]

For every scorable research business: cut the series `holdout` days before its
window end, fit both projections on the history before the cut, and compare the
projected end balance with the realised one.

Error metric. §10 names MAPE, but percentage error on a balance or a net flow is
undefined at zero and explodes near it — and SME balances cross zero routinely. So
the headline is a scale-free MAE: |projected - actual| / avg monthly outflow (the
business's own scale), with the share of businesses where the model beats naive.
MAPE is reported too, restricted to businesses whose actual end balance is not
near zero, so the §10 number exists but cannot be dominated by division by ~0.

Crunch detection: among businesses whose realised balance went negative inside the
holdout, the share each projection flagged in advance — and its false-alarm rate.

Population: research (business_id 1–10,000, §23). Data source: synthetic.
Writes eval/out/forecast_backtest.md.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import numpy as np
import pandas as pd

from lenses import load_lens_config
from lenses.forecast.forecast import METHOD_LABELS
from lenses.forecast.methods import BASELINE, METHODS


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dir", default="data")
    ap.add_argument("--holdout-days", type=int, default=30)
    ap.add_argument("--out", default="eval/out/forecast_backtest.md")
    args = ap.parse_args(argv)
    d, H = Path(args.dir), args.holdout_days
    fcfg = load_lens_config()["forecast"]
    fit_n, naive_n, damp, method = int(fcfg["fit_window_days"]), int(fcfg["naive_window_days"]), float(fcfg["trend_damping"]), fcfg["method"]

    status = pd.read_csv(d / "profile_status.csv")
    biz = pd.read_csv(d / "businesses.csv", parse_dates=["window_end"])
    keep = biz.merge(status, on="business_id")
    keep = keep[(keep["population"] == "research") & (keep["status"] != "insufficient_data")]
    daily = pd.read_csv(d / "daily_aggregates.csv", parse_dates=["date"], usecols=["business_id", "date", "net_flow", "outflow_total", "recurring_outflow_total", "eod_balance"])
    daily = daily[daily["business_id"].isin(set(keep["business_id"]))].sort_values(["business_id", "date"])

    rows = []
    for b_id, g in daily.groupby("business_id", sort=False):
        if len(g) < fit_n + H:
            continue
        hist, fut = g.iloc[:-H], g.iloc[-H:]
        fit = hist.tail(fit_n)
        b0 = float(hist["eod_balance"].iloc[-1])
        scale = max(float(fit["outflow_total"].sum()) / (len(fit) / 30.0), 500.0)  # avg monthly outflow, §16 floor
        actual_path = fut["eod_balance"].to_numpy(float)
        p_model = b0 + np.cumsum(METHODS[method](hist, H, damping=damp))   # the shipped method (lens_config)
        p_naive = b0 + np.cumsum(METHODS[BASELINE](hist, H))
        rows.append({
            "business_id": b_id, "actual": actual_path[-1], "model": p_model[-1], "naive": p_naive[-1], "scale": scale,
            "went_negative": bool((actual_path < 0).any()),
            "model_alert": bool((p_model < 0).any()), "naive_alert": bool((p_naive < 0).any()),
        })
    r = pd.DataFrame(rows)
    r["err_model"] = (r["model"] - r["actual"]).abs() / r["scale"]
    r["err_naive"] = (r["naive"] - r["actual"]).abs() / r["scale"]
    away = r["actual"].abs() > r["scale"]  # MAPE only where the actual is at least a month of outflow from zero
    mape_m = float(((r.loc[away, "model"] - r.loc[away, "actual"]).abs() / r.loc[away, "actual"].abs()).median())
    mape_n = float(((r.loc[away, "naive"] - r.loc[away, "actual"]).abs() / r.loc[away, "actual"].abs()).median())

    neg = r[r["went_negative"]]
    pos = r[~r["went_negative"]]
    lines = [
        f"# Forecast lens — §10 backtest ({H}-day holdout)",
        "",
        (
            f"Population: **research**, scorable (§15), N = {len(r):,}. Data source: synthetic. "
            f"Each business's last {H} days are held out; projections are fitted only on the days before."
        ),
        "",
        "## End-of-holdout balance error (scale-free: |error| / avg monthly outflow)",
        "",
        "| projection | median error | mean error | businesses where it is the better of the two |",
        "|---|---|---|---|",
        f"| model — `{method}` ({METHOD_LABELS[method]}) | {r['err_model'].median():.3f} | {r['err_model'].mean():.3f} | {(r['err_model'] < r['err_naive']).mean():.1%} |",
        f"| naive (trailing-{naive_n}d mean) | {r['err_naive'].median():.3f} | {r['err_naive'].mean():.3f} | {(r['err_naive'] < r['err_model']).mean():.1%} |",
        "",
        (
            f"MAPE (median, only the {int(away.sum()):,} businesses whose actual balance is ≥ 1 month of outflow from zero): "
            f"model {mape_m:.1%}, naive {mape_n:.1%}."
        ),
        "",
        f"## Crunch detection — {len(neg):,} businesses went negative inside the holdout",
        "",
        "| projection | caught in advance (recall) | false alarms among the rest |",
        "|---|---|---|",
        f"| model | {neg['model_alert'].mean():.1%} | {pos['model_alert'].mean():.1%} |",
        f"| naive | {neg['naive_alert'].mean():.1%} | {pos['naive_alert'].mean():.1%} |",
        "",
        "Not yet covered (§10, owner's next step): the holdout-shock test — inject a deliberate revenue drop and",
        "report detection lead time vs the naive baseline — and a run across a Ramadan window (§16).",
    ]
    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    Path(args.out).write_text("\n".join(lines) + "\n", encoding="utf-8")
    print("\n".join(lines))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
