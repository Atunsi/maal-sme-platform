"""DECISIONS entry 30 — do the transaction features survive POS thinning? Measured against the true full stream.

    python -m eval.thinning_bias [--config config.yaml] [--out eval/out/thinning_bias.md]

`transactions.csv` keeps 10% of POS `sales` rows (`output.pos_sales_transaction_sample_rate`),
each with `sample_weight` = 1/rate (entry 13.6). The thinning draws from its own RNG stream
`[seed, business_id, 3]`, so regenerating the same population with the rate set to 1.0 gives the
exact stream the thinned file was sampled from: same businesses, same receipts, same amounts.
That regeneration is the *true* value. Both populations are generated here, in memory, from
config.yaml (quick mode, the same 600 businesses as `data/quick`); nothing is written to data/.
The script asserts that daily_aggregates are identical between the two runs, which proves the
rate is the only difference.

For each thinned business, three values per feature: the engine as it runs today (no weights),
the engine on `amount × sample_weight` (weighted), and the engine on the full stream (true).
Features 20, 21, 22 are the claim under test; 5, 10, 45, 46 are controls. Nothing in the engine
changes; the finding is the output.
"""

from __future__ import annotations

import argparse
import copy
import sys
import textwrap
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

from generator import schemas
from generator.generate import generate, load_config
from profile_engine import features as fe

FEATURES = (20, 21, 22, 5, 10, 45, 46)
UNDER_TEST = (20, 21, 22)
SURFACE, INK, INK2, GRID = "#fcfcfb", "#0b0b0b", "#52514e", "#e4e3df"
COLOURS = {"no weights (today)": "#2a78d6", "weighted": "#eb6834"}


def engine_tables(cfg: dict) -> dict[str, pd.DataFrame]:
    t = generate(cfg, quick=True)
    t = {k: v for k, v in t.items() if k in schemas.ENGINE_FACING}
    t = schemas.validate_engine_tables(t)
    tx = t["transactions"]
    tx["counterparty_id"] = tx["counterparty_id"].astype(object).where(tx["counterparty_id"].notna(), None)
    return t


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--config", default="config.yaml")
    ap.add_argument("--out", default="eval/out/thinning_bias.md")
    args = ap.parse_args(argv)
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    cfg = load_config(args.config)
    rate = float(cfg["output"]["pos_sales_transaction_sample_rate"])
    full_cfg = copy.deepcopy(cfg)
    full_cfg["output"]["pos_sales_transaction_sample_rate"] = 1.0

    print("generating the quick population as shipped (thinned) …", flush=True)
    thin = engine_tables(cfg)
    print("generating the same population with the sample rate at 1.0 (full stream) …", flush=True)
    full = engine_tables(full_cfg)
    key = ["business_id", "date"]
    da, db = (x["daily_aggregates"].sort_values(key).reset_index(drop=True) for x in (thin, full))
    pd.testing.assert_frame_equal(da, db)  # the rate is the only difference between the two runs

    tx_t, tx_f, biz = thin["transactions"], full["transactions"], thin["businesses"]
    ids = sorted(set(tx_t.loc[tx_t["sample_weight"] > 1, "business_id"]))
    tx_w = tx_t.copy()
    tx_w["amount"] = tx_w["amount"] * tx_w["sample_weight"]
    variants = {
        "no weights (today)": fe.transaction_features(tx_t, biz)[0].set_index("business_id"),
        "weighted": fe.transaction_features(tx_w, biz)[0].set_index("business_id"),
        "true (full stream)": fe.transaction_features(tx_f, biz)[0].set_index("business_id"),
    }
    n_rows = {"thinned": len(tx_t), "full": len(tx_f)}

    per_biz = []
    for b in ids:
        row = {"business_id": b}
        for f in FEATURES:
            for v, df in variants.items():
                row[f"{fe.F[f]} | {v}"] = df.loc[b, fe.F[f]]
        per_biz.append(row)
    per_biz = pd.DataFrame(per_biz)

    summary = []
    for f in FEATURES:
        name = fe.F[f]
        true = per_biz[f"{name} | true (full stream)"].astype(float)
        rec = {"id": f, "feature": name, "role": "under test" if f in UNDER_TEST else "control", "median true": true.median()}
        for v in ("no weights (today)", "weighted"):
            x = per_biz[f"{name} | {v}"].astype(float)
            rec[f"median {v}"] = x.median()
            rec[f"median abs error {v}"] = (x - true).abs().median()
            ratio = (x / true).replace([np.inf, -np.inf], np.nan).dropna()  # businesses whose true value is 0 have no ratio
            rec[f"median ratio to true {v}"] = ratio.median() if len(ratio) else np.nan
        summary.append(rec)
    summary = pd.DataFrame(summary)

    # Feature 20: how many true customers never appear in the thinned file at all?
    sales_t = tx_t[(tx_t["business_id"].isin(ids)) & (tx_t["direction"] == "in")]
    sales_f = tx_f[(tx_f["business_id"].isin(ids)) & (tx_f["direction"] == "in")]
    seen_t = sales_t.groupby("business_id")["counterparty_id"].apply(set)
    seen_f = sales_f.groupby("business_id")["counterparty_id"].apply(set)
    unseen = pd.Series({b: len(seen_f[b] - seen_t.get(b, set())) / max(len(seen_f[b]), 1) for b in ids})

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    per_biz.to_csv(out.with_name("thinning_bias_per_business.csv"), index=False)
    summary.to_csv(out.with_name("thinning_bias_summary.csv"), index=False)

    # Chart: median ratio to the true value, one bar per variant per feature, drawn from 1.0 (unbiased)
    # on a log axis so 3× too high and 3× too low are the same length.
    fig, ax = plt.subplots(figsize=(10, 4.6), facecolor=SURFACE)
    ax.set_facecolor(SURFACE)
    x = np.arange(len(FEATURES))
    w = 0.36
    for i, (v, c) in enumerate(COLOURS.items()):
        r = summary[f"median ratio to true {v}"].to_numpy()
        pos = x + (i - 0.5) * (w + 0.02)
        ax.bar(pos, np.where(np.isnan(r), 0.0, r - 1.0), bottom=1.0, width=w, color=c, label=v, zorder=2)
        for p, val in zip(pos, r, strict=True):
            above = np.isnan(val) or val >= 1
            ax.text(p, 1.0 if np.isnan(val) else val * (1.08 if above else 0.92), "n/a" if np.isnan(val) else f"{val:.2f}",
                    ha="center", va="bottom" if above else "top", fontsize=8, color=INK2)
    ax.set_yscale("log")
    ax.set_ylim(0.3, 40)
    ax.set_yticks([0.5, 1, 2, 5, 10, 20], ["0.5", "1", "2", "5", "10", "20"])
    ax.minorticks_off()
    ax.axhline(1.0, color=INK, lw=1, zorder=3)
    ax.text(-0.5, 1.06, "unbiased = 1", ha="left", va="bottom", fontsize=8, color=INK)
    labels = [f"{f}\n" + textwrap.fill(fe.F[f].replace("_", " "), 13) + ("\n(control)" if f not in UNDER_TEST else "") for f in FEATURES]
    ax.set_xticks(x, labels, fontsize=7.5, color=INK2)
    ax.set_ylabel("median of computed ÷ true (log)", color=INK2)
    ax.set_title(f"Transaction features on {len(ids)} thinned POS businesses: computed vs the true full stream", fontsize=10, color=INK, loc="left")
    ax.grid(axis="y", color=GRID, lw=0.8, zorder=0)
    for s in ("top", "right"):
        ax.spines[s].set_visible(False)
    for s in ("left", "bottom"):
        ax.spines[s].set_color(GRID)
    ax.tick_params(colors=INK2)
    ax.legend(frameon=False, fontsize=8, loc="upper right", bbox_to_anchor=(1.0, 0.92))
    fig.tight_layout()
    fig.savefig(out.with_name("thinning_bias.png"), dpi=150, facecolor=SURFACE)

    def fmt(v: float) -> str:
        return "n/a" if pd.isna(v) else f"{v:.4f}"

    t, w = "no weights (today)", "weighted"
    srow = summary.set_index("id")
    n_ratio = {f: int((per_biz[f"{fe.F[f]} | true (full stream)"].astype(float) != 0).sum()) for f in FEATURES}
    true22 = per_biz[f"{fe.F[22]} | true (full stream)"].astype(float)
    md = [
        "# POS thinning and the transaction features (DECISIONS entry 30)",
        "",
        (
            f"Population: quick mode, {len(biz)} businesses generated from `config.yaml`; **{len(ids)}** have thinned POS `sales` rows "
            f"(sample rate {rate}, `sample_weight` = {1 / rate:g}). Transactions: {n_rows['thinned']:,} rows as shipped, "
            f"{n_rows['full']:,} rows in the full stream. `daily_aggregates` asserted identical between the two runs, "
            "so the sample rate is the only difference."
        ),
        "",
        (
            "**How the true value was obtained.** The same population was regenerated with "
            "`output.pos_sales_transaction_sample_rate` = 1.0. Thinning uses its own RNG stream `[seed, business_id, 3]`, "
            "so every other draw is unchanged and the full stream is exactly the one the shipped file was sampled from. "
            "The engine's own `transaction_features` was then run on it."
        ),
        "",
        (
            "| # | Feature | Role | Median true | Median today (no weights) | Median weighted | Median abs. error today "
            "| Median abs. error weighted | Median ratio today ÷ true | Median ratio weighted ÷ true | Businesses with true ≠ 0 |"
        ),
        "|---|---|---|---|---|---|---|---|---|---|---|",
    ]
    for r in summary.to_dict("records"):
        md.append(
            f"| {r['id']} | `{r['feature']}` | {r['role']} | {fmt(r['median true'])} | {fmt(r[f'median {t}'])} | {fmt(r[f'median {w}'])} "
            f"| {fmt(r[f'median abs error {t}'])} | {fmt(r[f'median abs error {w}'])} | {fmt(r[f'median ratio to true {t}'])} "
            f"| {fmt(r[f'median ratio to true {w}'])} | {n_ratio[r['id']]} of {len(ids)} |"
        )

    def ratio(f: int, v: str) -> float:
        return srow.loc[f, f"median ratio to true {v}"]

    md += [
        "",
        "## Reading the table (generated from the numbers above)",
        "",
        (
            f"- **21 `{fe.F[21]}`:** today's value is {ratio(21, t):.2f}× the true value; weighting brings it to {ratio(21, w):.2f}×. "
            "It pools inflow and outflow value per counterparty, so down-weighted POS inflows inflate the outflow side. Weighting fixes it."
        ),
        (
            f"- **22 `{fe.F[22]}`:** the true median is {true22.median():.4f} ({int((true22 == 0).sum())} of {len(ids)} businesses have a true value of 0). "
            f"Today's median is {srow.loc[22, f'median {t}']:.4f}; weighted, {srow.loc[22, f'median {w}']:.4f}. "
            "Thinning removes a customer's earlier receipts, so a customer the business already knew looks new in the last 30 days. "
            "Weighting multiplies exactly those false-new receipts by the weight, so it makes the bias worse. Weighting does not fix it."
        ),
        (
            f"- **20 `{fe.F[20]}`:** today's value is {ratio(20, t):.2f}× the true value; weighting cannot change it ({ratio(20, w):.2f}×). "
            "A weight scales the amount of a row that was kept; it cannot bring back a customer none of whose receipts were kept. "
            f"In the thinned file a median of **{unseen.median():.1%}** of each business's true customers never appear at all "
            f"(5th–95th percentile {unseen.quantile(0.05):.1%}–{unseen.quantile(0.95):.1%}). The count depends on the sample rate, not on the business."
        ),
        (
            f"- **Controls.** 10 is unaffected ({ratio(10, t):.2f}×: it reads outflows, which are never thinned). "
            f"5 is {ratio(5, t):.2f}× and 45 is {ratio(45, t):.2f}×, and weighting changes neither: "
            "the likely causes are that the largest customer's share is noisier in a 10% sample, and that persistence loses prior-window "
            f"customers that were thinned away. 46 has a non-zero true value for {n_ratio[46]} of {len(ids)} businesses, so it cannot show a bias here."
        ),
        "",
        (
            "Chart: `thinning_bias.png` (median of computed ÷ true, log scale; 1 = unbiased; n/a where every true value is 0; "
            "the median ratio is taken over businesses whose true value is not 0). "
            "Per-business values: `thinning_bias_per_business.csv`; this table: `thinning_bias_summary.csv`."
        ),
        "",
        "Nothing is changed by this finding. The engine is untouched; the fix is proposed in DECISIONS entry 30.",
    ]
    out.write_text("\n".join(md) + "\n", encoding="utf-8")
    print("\n".join(md))
    print(f"\n→ {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
