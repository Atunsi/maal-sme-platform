"""Week 3 "Generator Accepted" gate — Schema v2.9 §19 / §30, SOP §5.

Runs against the generated tables ONLY (never against the generator's internal
parameters), so every assertion here can actually fail:

  Structural  §23 population disjointness, §29 data_source, §14 no latent leak,
              §37.1 Pandera on all tables.
  Criterion 1 §30 implied_dso_days / implied_dio_days recomputed from
              daily_aggregates + balances_monthly with the schema formula.
              Construction ∈ [60, 120]; professional < 5.
  Criterion 2 §14 labels are not a function of observables:
              (a) nearest cross-label pair in the largest sector×size cell is
                  at least as close as a typical nearest neighbour,
              (b) in-sample logistic AUC on engine-computable observables is
                  strictly between 0.55 and 0.95 — signal exists, but labels are
                  not recoverable from the features,
              (c) ground-truth sector differential: construction default rate
                  ≥ 1.5 × professional services (research population).
  Criterion 3 §22 Ramadan/Eid plot for the demo businesses, plus the population-level
              recovery of the configured (SAMA-measured) value and count multipliers per
              sector via the §22 window decomposition fitted to the generated data.

Usage (from the repo root):
        python -m eval.gate_week3 [--dir data] [--config config.yaml]
Exit code 0 = PASS, 1 = FAIL.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import matplotlib
import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import pairwise_distances, roc_auc_score
from sklearn.preprocessing import StandardScaler

from eval import seasonal_recovery as sr
from generator import schemas
from generator.generate import calendar_masks, load_config

matplotlib.use("Agg")
from matplotlib import pyplot as plt  # backend must be set before pyplot import

EPS_SAR = 500.0  # §30 / §16 epsilon floor on monthly denominators
MIN_COVERAGE = 60  # §15 hard eligibility rule
TRAILING_DAYS = 90
MIN_CELL_BUSINESSES, MIN_CELL_DEFAULTS = 30, 10  # §23 minimum-cell rule

FAILURES: list[str] = []
SKIPPED: list[str] = []


def check(cond: bool, msg: str) -> None:
    print(("  PASS  " if cond else "  FAIL  ") + msg)
    if not cond:
        FAILURES.append(msg)


def skip(msg: str) -> None:
    """§23: a thin cell reports insufficient_sample — loudly, never as a silent pass."""
    print("  SKIP  " + msg)
    SKIPPED.append(msg)


# --------------------------------------------------------------------------- #
# Engine-side feature computation (from the tables, schema formulas)
# --------------------------------------------------------------------------- #


def profile_features(daily: pd.DataFrame, balances: pd.DataFrame, businesses: pd.DataFrame) -> pd.DataFrame:
    """One row per business at its LAST month-end: features 1, 6, 11, 13, 16, 32, 37, 38."""
    daily = daily.sort_values(["business_id", "date"])
    last_me = balances.groupby("business_id")["month_end"].max().rename("month_end")
    rows = []
    for b_id, g in daily.groupby("business_id", sort=False):
        if b_id not in last_me.index:
            continue
        me = last_me[b_id]
        w = g[(g["date"] <= me) & (g["date"] > me - pd.Timedelta(days=TRAILING_DAYS))]
        n = len(w)
        if n == 0:
            continue
        per_month = n / 30.0
        rows.append(
            {
                "business_id": b_id,
                "month_end": me,
                "avg_monthly_inflow": w["inflow_total"].sum() / per_month,
                "avg_monthly_outflow": w["outflow_total"].sum() / per_month,
                "cash_flow_volatility": w["net_flow"].std(ddof=0),
                "days_negative_balance_90d": int((w["eod_balance"] < 0).sum()),
                "avg_daily_balance": w["eod_balance"].mean(),
                "coverage_days_90d": int(((w["inflow_count"] + w["outflow_count"]) > 0).sum()),
            }
        )
    f = pd.DataFrame(rows).merge(balances, on=["business_id", "month_end"]).merge(businesses, on="business_id")
    f["implied_dso_days"] = f["accounts_receivable_eom"] / np.maximum(f["avg_monthly_inflow"], EPS_SAR) * 30.0
    f["implied_dio_days"] = f["inventory_value_eom"] / np.maximum(f["avg_monthly_outflow"], EPS_SAR) * 30.0
    f["balance_months_of_outflow"] = f["avg_daily_balance"] / np.maximum(f["avg_monthly_outflow"], EPS_SAR)
    return f


# --------------------------------------------------------------------------- #
# Gate sections
# --------------------------------------------------------------------------- #


def structural_checks(cfg: dict, t: dict[str, pd.DataFrame]) -> None:
    print("\n== Structural (§14, §23, §29, §37.1) ==")
    try:
        schemas.validate_engine_tables(t)
        schemas.labels_schema.validate(t["labels"], lazy=True)
        check(True, "Pandera: all tables validate")
    except Exception as e:  # noqa: BLE001
        check(False, f"Pandera validation failed: {str(e)[:400]}")

    biz = t["businesses"]
    pops = cfg["populations"]
    for name, p in pops.items():
        ids = biz.loc[biz["population"] == name, "business_id"]
        check(ids.between(*p["id_range"]).all(), f"{name}: all IDs inside configured range {p['id_range']}")
    r_ids = set(biz.loc[biz["population"] == "research", "business_id"])
    s_ids = set(biz.loc[biz["population"] == "serving", "business_id"])
    check(r_ids.isdisjoint(s_ids), f"research ∩ serving = ∅  (research n={len(r_ids)}, serving n={len(s_ids)})")
    check(pops["research"]["seed"] != pops["serving"]["seed"], "populations use different seeds")

    for name in ("transactions", "daily_aggregates", "balances_monthly", "businesses"):
        check((t[name]["data_source"] == "synthetic").all(), f"{name}: every row tagged data_source=synthetic")
        cols = [c for c in t[name].columns if c.startswith("latent_") or c in ("p_default", "default_label")]
        check(not cols, f"{name}: no latent/label columns (found {cols})")

    # daily aggregates must agree with transactions (one coherent story, §24). POS `sales` rows are an
    # unbiased thinning carrying sample_weight = 1/rate (SOP_Saudi_Calibration §6.1), so the inflow side
    # is checked exactly where nothing was thinned and in weighted expectation where it was.
    tx = t["transactions"]
    weighted = tx["amount"] * tx["sample_weight"]
    agg = tx.assign(w=weighted).groupby(["business_id", "date", "direction"])["w"].sum().unstack(fill_value=0.0)
    d = t["daily_aggregates"].set_index(["business_id", "date"])
    joined = d.join(agg, how="left").fillna(0.0)
    check(np.allclose(joined["outflow_total"], joined.get("out", 0.0), atol=0.05), "daily_aggregates.outflow_total == Σ transactions[out] (outflows are never thinned)")
    thinned_biz = set(tx.loc[tx["sample_weight"] > 1.0, "business_id"])
    full = joined[~joined.index.get_level_values("business_id").isin(thinned_biz)]
    check(np.allclose(full["inflow_total"], full.get("in", 0.0), atol=0.05), f"daily_aggregates.inflow_total == Σ transactions[in] exactly on the {full.index.get_level_values('business_id').nunique()} businesses with no thinned rows")
    thin = joined[joined.index.get_level_values("business_id").isin(thinned_biz)]
    if len(thin):
        ratio = float(thin.get("in", 0.0).sum() / thin["inflow_total"].sum())
        check(abs(ratio - 1.0) <= 0.02, f"Σ amount×sample_weight [in] / Σ inflow_total = {ratio:.4f} on the {len(thinned_biz)} thinned (POS-sector) businesses — within ±2% (unbiased thinning)")
        per_biz = thin.groupby(level="business_id").sum()
        r_biz = per_biz.get("in", 0.0) / per_biz["inflow_total"]
        check(r_biz.between(0.8, 1.2).mean() > 0.95, f"per-business weighted inflow within ±20% of inflow_total for {r_biz.between(0.8, 1.2).mean():.1%} of thinned businesses (> 95%)")


def criterion_1(f: pd.DataFrame) -> None:
    print("\n== Criterion 1: sector-consistent balance sheets (§24, §30) ==")
    scorable = f[f["coverage_days_90d"] >= MIN_COVERAGE]
    thin = len(f) - len(scorable)
    print(f"  {len(scorable)} scorable businesses; {thin} excluded as insufficient_data (§15, coverage < {MIN_COVERAGE})")

    con = scorable[scorable["sector"] == "construction"]
    pro = scorable[scorable["sector"] == "professional_services"]
    print(
        f"  construction  implied_dso_days: min {con['implied_dso_days'].min():.1f}  "
        f"median {con['implied_dso_days'].median():.1f}  max {con['implied_dso_days'].max():.1f}  (n={len(con)})"
    )
    print(
        f"  professional  implied_dio_days: min {pro['implied_dio_days'].min():.2f}  "
        f"median {pro['implied_dio_days'].median():.2f}  max {pro['implied_dio_days'].max():.2f}  (n={len(pro)})"
    )
    check(len(con) > 0 and con["implied_dso_days"].between(60, 120).all(), "ALL construction implied_dso_days ∈ [60, 120]")
    check(len(pro) > 0 and (pro["implied_dio_days"] < 5).all(), "ALL professional_services implied_dio_days < 5")

    # §24 archetype ordering — cheap sanity on the whole story, not only the two named limits
    med = scorable.groupby("sector")[["implied_dso_days", "implied_dio_days"]].median()
    check(med.loc["construction", "implied_dso_days"] > med.loc["retail_trade", "implied_dso_days"], "construction DSO > retail DSO (medians)")
    check(med.loc["retail_trade", "implied_dio_days"] > med.loc["construction", "implied_dio_days"], "retail DIO > construction DIO (medians)")


OBSERVABLES = [
    "avg_monthly_inflow",
    "cash_flow_volatility",
    "days_negative_balance_90d",
    "balance_months_of_outflow",
    "implied_dso_days",
    "implied_dio_days",
]


def criterion_2(f: pd.DataFrame, labels: pd.DataFrame) -> None:
    print("\n== Criterion 2: labels are not a function of observables (§14) ==")
    df = f.merge(labels[["business_id", "default_label"]], on="business_id")
    df = df[(df["coverage_days_90d"] >= MIN_COVERAGE) & (df["population"] == "research")].copy()

    # (c) ground-truth sector differential — the shortcut §25 must later show the model does NOT take
    rates = df.groupby("sector")["default_label"].agg(["mean", "size", "sum"])
    print("  ground-truth default rate by sector (research):")
    for s, row in rates.iterrows():
        print(f"    {s:22s} {row['mean']:.3%}  (n={int(row['size'])}, defaults={int(row['sum'])})")
    thin = [
        s
        for s in ("construction", "professional_services")
        if rates.loc[s, "size"] < MIN_CELL_BUSINESSES or rates.loc[s, "sum"] < MIN_CELL_DEFAULTS
    ]
    ratio = rates.loc["construction", "mean"] / max(rates.loc["professional_services", "mean"], 1e-9)
    if thin:
        skip(f"sector differential: insufficient_sample in {thin} (<{MIN_CELL_BUSINESSES} businesses or <{MIN_CELL_DEFAULTS} defaults) — run at full scale")
    else:
        check(ratio >= 1.5, f"construction default rate ≥ 1.5 × professional_services (ratio = {ratio:.2f})")

    # (b) not recoverable from observables — in-sample AUC is an UPPER bound on recoverability
    X = df[OBSERVABLES].to_numpy()
    X = np.column_stack([X, pd.get_dummies(df["sector"]).to_numpy(dtype=float)])
    X = StandardScaler().fit_transform(X)
    y = df["default_label"].to_numpy()
    auc = roc_auc_score(y, LogisticRegression(max_iter=2000).fit(X, y).decision_function(X))
    check(0.55 < auc < 0.95, f"in-sample logistic AUC on observables strictly in (0.55, 0.95): {auc:.3f}")

    # (a) near-identical observable profiles with different labels, inside one sector×size cell
    cell_key = df.groupby(["sector", "size_tier"]).size().idxmax()
    cell = df[(df["sector"] == cell_key[0]) & (df["size_tier"] == cell_key[1])]
    Z = StandardScaler().fit_transform(cell[OBSERVABLES].to_numpy())
    y_c = cell["default_label"].to_numpy()
    D = pairwise_distances(Z)
    np.fill_diagonal(D, np.inf)
    typical_nn = float(np.median(D.min(axis=1)))
    cross = D[np.ix_(y_c == 0, y_c == 1)]
    i, j = np.unravel_index(np.argmin(cross), cross.shape)
    b0 = cell[y_c == 0].iloc[i]
    b1 = cell[y_c == 1].iloc[j]
    print(f"  cell {cell_key}: n={len(cell)}, defaults={int(y_c.sum())}, typical NN distance={typical_nn:.3f}")
    print(f"  closest cross-label pair: ID {int(b0['business_id'])} (label 0) vs ID {int(b1['business_id'])} (label 1), distance={cross.min():.3f}")
    for col in OBSERVABLES:
        print(f"    {col:26s} {b0[col]:>12.2f}  vs  {b1[col]:>12.2f}")
    check(cross.min() <= typical_nn, "closest cross-label pair is at least as close as a typical nearest neighbour")


def criterion_3(cfg: dict, t: dict[str, pd.DataFrame], out_png: Path) -> None:
    print("\n== Criterion 3: POS/inflow tracks Ramadan/Eid (§22) ==")
    demos = {d["id"]: d for d in cfg["demo_businesses"]}
    daily = t["daily_aggregates"]
    biz = t["businesses"].set_index("business_id")

    fig, axes = plt.subplots(len(demos), 1, figsize=(13, 3.4 * len(demos)), sharex=False)
    for ax, (d_id, d) in zip(np.atleast_1d(axes), demos.items()):
        g = daily[daily["business_id"] == d_id].sort_values("date")
        dates = pd.DatetimeIndex(g["date"])
        masks = calendar_masks(cfg, dates)
        sector = biz.loc[d_id, "sector"]
        ax.plot(dates, g["inflow_total"], lw=0.9, color="#1f5fa8")
        for key, color, label in (("ramadan", "orange", "Ramadan"), ("eid", "red", "Eid al-Fitr")):
            if masks[key].any():
                ax.axvspan(dates[masks[key]].min(), dates[masks[key]].max() + pd.Timedelta(days=1), color=color, alpha=0.25, label=label)
        ax.set_title(f"ID {d_id} — {d['name']}  [{sector}, window {dates.min().date()} → {dates.max().date()}]", fontsize=10)
        ax.set_ylabel("daily inflow (SAR)")
        if masks["ramadan"].any():
            ax.legend(loc="upper right", fontsize=8)

        in_window = masks["ramadan"].any()
        if "Ramadan-overlap" in d["name"]:
            check(in_window, f"ID {d_id}: window overlaps Ramadan")
            base = g.loc[~masks["ramadan"] & ~masks["eid"] & ~masks["pre_ramadan_10d"] & ~masks["post_eid_7d"], "inflow_total"]
            base = base[base > 0]
            r_ratio = g.loc[masks["ramadan"], "inflow_total"].mean() / base.mean()
            e_ratio = g.loc[masks["eid"], "inflow_total"].mean() / base.mean()
            print(f"  ID {d_id} ({sector}): Ramadan/base = {r_ratio:.2f}, Eid/base = {e_ratio:.2f}  (one business — plotted, not gated)")
        elif "Non-overlap" in d["name"]:
            check(not in_window, f"ID {d_id}: window contains no Ramadan days")

    # The quantitative test is population-level (SOP_Saudi_Calibration §9 step 3, DECISIONS.md entry 13):
    # fit the §22 window decomposition to the generated research population per sector and require it to
    # recover the configured multipliers, value AND count, within the pre-registered tolerance — for the
    # sectors whose multipliers are measured (class B). Class-C sectors are reported, not gated. This
    # replaces the placeholder "Ramadan > 1.15, Eid > Ramadan" thresholds (DECISIONS.md entry 3), which
    # encoded the direction the measurement contradicted for food service.
    tol = next(x for x in cfg["emergent_validation_targets"]["targets"] if x["metric"] == "ramadan_amplitude_recovered")["tolerance_abs"]
    rec = sr.recover(daily, t["businesses"], cfg)
    rows = sr.compare(rec, cfg, tol)
    # measured sectors carry a per-window evidence_class map (B / B-weak, SOP_Monshaat_Unblock B2); judgement sectors a scalar C.
    # The recovery test is a wiring test on the CONFIGURED values, so B-weak windows are gated exactly like B ones.
    measured = {s for s, v in cfg.get("seasonality_value_multiplier", {}).items() if isinstance(v.get("evidence_class"), dict) or v.get("evidence_class") == "B"}
    for s in rec:
        for kind in ("value", "count"):
            cells = {r["window"]: r for r in rows if r["sector"] == s and r["kind"] == kind}
            txt = "  ".join(f"{w} {cells[w]['recovered']:.2f}/{cells[w]['configured']:.2f}" for w in sr.WINDOWS)
            ok = all(cells[w]["ok"] for w in ("ramadan", "eid"))
            if s in measured:
                check(ok, f"{s} {kind}: recovered/configured  {txt}  — ramadan & eid within ±{tol} (class B, n={rec[s]['n_businesses']})")
            else:
                print(f"  INFO  {s} {kind}: recovered/configured  {txt}  (class C, reported only)")
    if measured:
        conf = sr.configured_multipliers(cfg)
        for s in sorted(measured):
            want_down = conf[s]["value"]["ramadan"] < 1.0
            got_down = rec[s]["value"]["ramadan"] < 1.0
            check(want_down == got_down, f"{s}: Ramadan VALUE direction {'down' if got_down else 'up'} matches the measured direction ({'down' if want_down else 'up'})")
    fig.tight_layout()
    try:
        fig.savefig(out_png, dpi=110)
    except PermissionError:  # file open in a viewer / OneDrive lock — don't let the plot kill the gate
        out_png = out_png.with_name(out_png.stem + "_new" + out_png.suffix)
        fig.savefig(out_png, dpi=110)
        print(f"  WARNING: {out_png.stem.replace('_new', '')}.png was locked; wrote {out_png.name} instead")
    print(f"  plot → {out_png}")


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dir", default="data", help="directory holding the generated tables")
    ap.add_argument("--config", default="config.yaml")
    args = ap.parse_args(argv)
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")  # Windows consoles default to a legacy code page
    d = Path(args.dir)
    cfg = load_config(args.config)

    print(f"loading tables from {d.resolve()} …")
    t = {
        "transactions": pd.read_csv(d / "transactions.csv", parse_dates=["date"]),
        "daily_aggregates": pd.read_csv(d / "daily_aggregates.csv", parse_dates=["date"]),
        "balances_monthly": pd.read_csv(d / "balances_monthly.csv", parse_dates=["month_end"]),
        "businesses": pd.read_csv(d / "businesses.csv", parse_dates=["start_date", "window_end", "operating_start_date"]),
        "labels": pd.read_csv(d / "labels.csv"),
    }

    structural_checks(cfg, t)
    f = profile_features(t["daily_aggregates"], t["balances_monthly"], t["businesses"])
    criterion_1(f)
    criterion_2(f, t["labels"])
    criterion_3(cfg, t, d / "ramadan_pos_check.png")

    print()
    if SKIPPED:
        print(f"{len(SKIPPED)} check(s) SKIPPED as insufficient_sample — the gate is not fully evaluated until these run:")
        for m in SKIPPED:
            print("  - " + m)
    print("GATE PASSED" if not FAILURES else f"GATE FAILED — {len(FAILURES)} assertion(s):")
    for m in FAILURES:
        print("  - " + m)
    return 0 if not FAILURES else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
