"""Where the signal goes, and whether the ceiling is real — Schema v2.9 §14.

Two questions the rho sweep (eval/sweep_rho.py) raises but cannot answer:

A. **Attribution of the loss.** The oracle ceiling (AUC of the hidden latent
   risk index) sits well above the AUC measured on realized features. This
   walks the ladder stage by stage to say *where* the loss happens:

       latent risk index r                       <- the ceiling
       optimal combination of the 9 u_obs draws  <- best possible before economics
       a single u_obs draw                       <- one noisy reflection
       measured AUC on realized features         <- after the economics pipeline

   The gap between rungs 2 and 4 is the **economics-pipeline loss**: everything
   lost turning a rank into Poisson arrivals, lognormal amounts, balance-sheet
   noise, and 90-day aggregation. If most of the loss is there it is a fixable
   engineering loss. If it is spread thin, the measured AUC is already near the
   practical ceiling and there is nothing to chase.

   Note rung 2 is NOT the same as rung 3. The nine draws share z_l and have
   independent noise, so averaging them recovers the latent far better than any
   single draw: rho_eff = rho / sqrt(rho^2 + (1 - rho^2)/k) for k draws. At
   rho = 0.6, k = 9 that is 0.914, not 0.6.

B. **Is the ceiling driven by the latents or by the intercept?** An oracle AUC
   is only meaningful if p_default actually varies across businesses. A tight
   distribution around the base rate would mean the intercept sets the level
   and the latents contribute little spread — in which case the ceiling is an
   artifact of the link function, not evidence of a real risk gradient.
   Reports the p_default distribution, the decile odds ratio, and a variance
   decomposition of the logit into shock / management / label-noise, with the
   shock term further split between-sector vs within-sector (which is what the
   §25 fairness audit depends on).

Usage (from the repo root):
    python -m eval.signal_decomposition                    # rho = config value
    python -m eval.signal_decomposition --rho 0.6 0.9
"""

from __future__ import annotations

import argparse
import sys

import numpy as np
import pandas as pd
from scipy.stats import norm
from sklearn.metrics import roc_auc_score

from eval.sweep_rho import build_frame, design_matrix, oof_auc, set_param
from generator.generate import generate, load_config

U_COLS = [
    "latent_u_vol", "latent_u_buf", "latent_u_cost", "latent_u_dso", "latent_u_dio",
    "latent_u_dpo", "latent_u_trend", "latent_u_conc", "latent_u_stl",
]


def rho_effective(rho: float, k: int) -> float:
    """Correlation between the mean of k probit-transformed u_obs draws and z_l."""
    return rho / np.sqrt(rho**2 + (1.0 - rho**2) / k)


def ladder(f: pd.DataFrame, tables: dict[str, pd.DataFrame], rho: float) -> pd.DataFrame:
    """Part A — AUC at each rung. `f` is a prebuilt profile frame (the engine is expensive)."""
    res = f[f["population"] == "research"].reset_index(drop=True)
    lat = tables["latents_hidden"].merge(res[["business_id"]], on="business_id")
    y = tables["labels"].set_index("business_id")["default_label"].loc[lat["business_id"]].to_numpy()

    z = norm.ppf(np.clip(lat[U_COLS].to_numpy(), 1e-9, 1 - 1e-9))  # back to the pre-transform scale
    singles = [roc_auc_score(y, z[:, i]) for i in range(z.shape[1])]

    X, _ = design_matrix(res)
    yr = res["default_label"].to_numpy()

    rows = [
        ("1. latent risk index r (oracle ceiling)", roc_auc_score(y, lat["latent_risk_index"].to_numpy()), "-"),
        ("2. optimal combination of 9 u_obs draws", roc_auc_score(y, z.mean(axis=1)), f"rho_eff={rho_effective(rho, 9):.3f}"),
        ("3. single u_obs draw (median of the 9)", float(np.median(singles)), f"range {min(singles):.3f}-{max(singles):.3f}"),
        ("4. measured: logistic OOF on features", oof_auc(X, yr, "logit"), f"{X.shape[1]} features"),
        ("5. measured: XGBoost OOF on features", oof_auc(X, yr, "xgb"), "untuned, overfits"),
    ]
    return pd.DataFrame(rows, columns=["stage", "AUC", "note"])


def distribution(tables: dict[str, pd.DataFrame]) -> None:
    """Part B — does p_default vary enough to support the ceiling?"""
    lat = tables["latents_hidden"]
    biz = tables["businesses"][["business_id", "sector"]]
    lat = lat.merge(biz, on="business_id")
    res = lat[lat["population"] == "research"]
    p = res["p_default"]

    print(f"\np_default distribution (research population, N={len(res):,})")
    qs = [0.01, 0.05, 0.10, 0.25, 0.50, 0.75, 0.90, 0.95, 0.99]
    line = "  " + "  ".join(f"p{int(q * 100):02d}={p.quantile(q):.4f}" for q in qs)
    print(line)
    print(f"  mean={p.mean():.4f}  sd={p.sd if hasattr(p, 'sd') else p.std():.4f}  "
          f"min={p.min():.4f}  max={p.max():.4f}")
    d1, d9 = p.quantile(0.10), p.quantile(0.90)
    odds = (d9 / (1 - d9)) / (d1 / (1 - d1))
    print(f"  p90/p10 risk ratio = {d9 / d1:.2f}x   |   decile odds ratio = {odds:.2f}x")
    print(f"  max/min risk ratio = {p.max() / p.min():.1f}x")

    print("\nvariance decomposition of the logit (what creates the spread)")
    cfg_shock = 2.5 * (res["latent_market_shock_sensitivity"] - 0.5)
    cfg_mgmt = -2.0 * (res["latent_management_quality"] - 0.5)
    v_shock, v_mgmt, v_noise = cfg_shock.var(), cfg_mgmt.var(), 0.2**2
    total = v_shock + v_mgmt + v_noise
    for name, v in (("market shock sensitivity", v_shock), ("management quality", v_mgmt), ("label noise", v_noise)):
        print(f"  {name:28s} var={v:.4f}  ({v / total:6.1%} of logit variance)")
    print(f"  {'TOTAL':28s} var={total:.4f}   sd={np.sqrt(total):.4f}")

    bet = cfg_shock.groupby(res["sector"]).mean()
    w = res.groupby("sector").size() / len(res)
    v_between = float(((bet - (bet * w).sum()) ** 2 * w).sum())
    v_within = float(v_shock - v_between)
    print(f"\n  of the shock term: between-sector var={v_between:.4f} ({v_between / v_shock:.1%}), "
          f"within-sector var={v_within:.4f} ({v_within / v_shock:.1%})")
    print("  (within-sector spread is what the §25 fairness audit needs to exist — a model")
    print("   that only learned the sector code would leave the within-sector share unused)")


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--config", default="config.yaml")
    ap.add_argument("--rho", type=float, nargs="+", default=None)
    ap.add_argument("--quick", action="store_true")
    args = ap.parse_args(argv)
    base = load_config(args.config)
    rhos = args.rho or [base["latent_to_observable_correlation"]]

    first = True
    for rho in rhos:
        cfg = load_config(args.config)
        set_param(cfg, "rho", rho)
        tables = generate(cfg, quick=args.quick)
        if U_COLS[0] not in tables["latents_hidden"].columns:
            print("ERROR: latents_hidden lacks the u_obs columns — regenerate with the current generator.")
            return 1

        print("\n" + "=" * 90)
        print(f"PART A — signal ladder at rho = {rho}")
        print("=" * 90)
        lad = ladder(build_frame(tables, cfg), tables, rho)
        prev = None
        for _, r in lad.iterrows():
            drop = "" if prev is None else f"   lost {prev - r['AUC']:+.4f} vs rung above"
            print(f"  {r['stage']:44s} AUC={r['AUC']:.4f}  {r['note']:<26s}{drop}")
            prev = r["AUC"]
        ceiling, best_pre, measured = lad["AUC"].iloc[0], lad["AUC"].iloc[1], lad["AUC"].iloc[3]
        total_gap = ceiling - measured
        att, econ = ceiling - best_pre, best_pre - measured
        print(f"\n  AUC lost to rho attenuation   (rung 1 -> 2): {att:.4f}  ({att / total_gap:5.1%} of the gap)")
        print(f"  AUC lost in economics pipeline (rung 2 -> 4): {econ:.4f}  ({econ / total_gap:5.1%} of the gap)")
        print(f"  total gap, oracle -> measured  (rung 1 -> 4): {total_gap:.4f}")

        if first:
            print("\n" + "=" * 90)
            print("PART B — does p_default vary enough to support the ceiling?")
            print("  (independent of rho: labels and latents are identical at every rho)")
            print("=" * 90)
            distribution(tables)
            first = False
        del tables
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
