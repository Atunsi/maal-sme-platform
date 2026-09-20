"""The label-side ceiling and risk spread — Schema v2.9 §14. No economics needed.

Since the SAMA calibration (DECISIONS.md entry 13) put POS receipts at the
measured average ticket, a full-scale generation takes ~45 minutes. But the
questions §14 asks about the *labels* do not depend on the economics pipeline
at all:

  * the **oracle ceiling** — AUC of the hidden latent risk index `r` against
    `default_label`. No feature set can beat it, because the rest of the label
    is idiosyncratic noise nothing observable can see;
  * whether **p_default varies enough** across businesses to support that
    ceiling, or whether the intercept is doing the work;
  * the **variance decomposition** of the logit, including the within- vs
    between-sector split of the shock term, which is what makes the §25
    fairness audit non-trivial.

All of those are functions of `sector` and the two latent draws. This script
replicates exactly those draws — the same seeded streams `generate_business`
uses, `default_rng([seed, business_id, purpose])` with purpose 0 for the
registry and purpose 1 for the latents, reading the first four values of the
purpose-1 stream (mgmt, shock, label noise, the Bernoulli draw), all of which
are taken **before** any rho-dependent draw. It therefore produces the
generator's exact latents and labels in seconds rather than an hour.

`--verify` checks that claim against a real `--quick` generator run instead of
asserting it.

Scope limit, stated rather than hidden: this covers **all** businesses, not
just the ones the profile engine will score. The scorable subset excludes §15
`insufficient_data` cases, which depend on the economics, so the ceiling here
differs slightly from the scorable-population ceiling (pre-calibration the gap
was 0.6927 vs 0.6902). Anything involving *measured* AUC still needs the full
pipeline — see eval/sweep_rho.py.

Usage (from the repo root):
    python -m eval.latent_ceiling
    python -m eval.latent_ceiling --verify data/quick     # exactness check
"""

from __future__ import annotations

import argparse
import sys

import numpy as np
import pandas as pd
from scipy.special import expit
from scipy.stats import norm
from sklearn.metrics import roc_auc_score

from generator.generate import load_config

CIRCULARITY_FLAG = 0.85


def draw_latents(cfg: dict) -> pd.DataFrame:
    """Replicate the generator's sector + latent draws exactly, without economics."""
    ssd = cfg["sector_size_distribution"]
    sectors = list(ssd)
    weights = [ssd[s]["weight"] for s in sectors]
    lm = cfg["latents"]
    mq = lm["management_quality"]
    dlm = cfg["default_label_model"]
    demo = {d["id"]: d for d in cfg.get("demo_businesses", [])}

    rows = []
    for pop_name, pop in cfg["populations"].items():
        seed, (lo, hi) = pop["seed"], pop["id_range"]
        for b_id in range(lo, hi + 1):
            sector = str(np.random.default_rng([seed, b_id, 0]).choice(sectors, p=weights))
            if b_id in demo:
                sector = demo[b_id].get("sector", sector)
            rng = np.random.default_rng([seed, b_id, 1])
            mgmt = rng.beta(mq["alpha"], mq["beta"])
            sp = lm["market_shock_sensitivity"][sector]
            shock = rng.beta(sp["alpha"], sp["beta"])
            r = dlm["shock_coef"] * (shock - 0.5) - dlm["management_coef"] * (mgmt - 0.5)
            logit = dlm["intercept"] + r + rng.normal(0.0, dlm["label_noise_sigma"])
            p = float(expit(logit))
            rows.append(
                {
                    "business_id": b_id, "population": pop_name, "sector": sector,
                    "latent_management_quality": mgmt, "latent_market_shock_sensitivity": shock,
                    "latent_risk_index": r, "logit": logit, "p_default": p,
                    "default_label": int(rng.random() < p),
                }
            )
    return pd.DataFrame(rows)


def verify(cfg: dict, d: str) -> int:
    """Check the replication against a real generator run, rather than asserting it."""
    from pathlib import Path

    real = pd.read_csv(Path(d) / "latents_hidden.csv")
    lab = pd.read_csv(Path(d) / "labels.csv")[["business_id", "default_label"]]
    real = real.merge(lab, on="business_id")
    mine = draw_latents(cfg).merge(real[["business_id"]], on="business_id")
    m = mine.set_index("business_id").sort_index()
    r = real.set_index("business_id").sort_index()
    ok = True
    for col in ("latent_management_quality", "latent_market_shock_sensitivity", "latent_risk_index", "p_default"):
        delta = float((m[col] - r[col]).abs().max())
        print(f"  {col:34s} max|delta| = {delta:.3e}  {'OK' if delta < 1e-12 else 'MISMATCH'}")
        ok &= delta < 1e-12
    same = int((m["default_label"] == r["default_label"]).sum())
    print(f"  {'default_label':34s} {same}/{len(m)} identical  {'OK' if same == len(m) else 'MISMATCH'}")
    ok &= same == len(m)
    print(f"\nreplication is {'EXACT' if ok else 'WRONG — do not trust the numbers below'} on {len(m)} businesses")
    return 0 if ok else 1


def report(df: pd.DataFrame) -> None:
    res = df[df["population"] == "research"]
    y, r = res["default_label"].to_numpy(), res["latent_risk_index"].to_numpy()
    p = res["p_default"]
    ceiling = roc_auc_score(y, r)
    sd_logit = float(res["logit"].std())
    predicted = float(norm.cdf(sd_logit / np.sqrt(2)))

    print("\n" + "=" * 88)
    print(f"Oracle ceiling and label spread — research population, N={len(res):,} (all businesses)")
    print("=" * 88)
    print(f"  base default rate                  {y.mean():.4f}  ({int(y.sum())} defaults)")
    print(f"  oracle AUC (latent risk index)     {ceiling:.4f}")
    print(f"  analytic prediction Phi(sd/sqrt2)  {predicted:.4f}   sd(logit) = {sd_logit:.4f}")
    print(f"  agreement                          {abs(ceiling - predicted):.4f} apart")

    print("\n  p_default distribution")
    qs = [0.01, 0.10, 0.25, 0.50, 0.75, 0.90, 0.99]
    print("    " + "  ".join(f"p{int(q * 100):02d}={p.quantile(q):.4f}" for q in qs))
    d1, d9 = p.quantile(0.10), p.quantile(0.90)
    print(f"    mean={p.mean():.4f} sd={p.std():.4f} min={p.min():.4f} max={p.max():.4f}")
    print(f"    p90/p10 risk ratio = {d9 / d1:.2f}x   decile odds ratio = {(d9 / (1 - d9)) / (d1 / (1 - d1)):.2f}x")

    print("\n  variance decomposition of the logit")
    shock = 2.5 * (res["latent_market_shock_sensitivity"] - 0.5)
    mgmt = -2.0 * (res["latent_management_quality"] - 0.5)
    v_s, v_m, v_n = shock.var(), mgmt.var(), 0.2**2
    tot = v_s + v_m + v_n
    for name, v in (("market shock sensitivity", v_s), ("management quality", v_m), ("label noise", v_n)):
        print(f"    {name:26s} var={v:.4f}  ({v / tot:6.1%})")
    print(f"    {'TOTAL':26s} var={tot:.4f}   sd={np.sqrt(tot):.4f}")
    w = res.groupby("sector").size() / len(res)
    bet = shock.groupby(res["sector"]).mean()
    v_between = float(((bet - (bet * w).sum()) ** 2 * w).sum())
    print(f"\n    shock term: between-sector {v_between / v_s:.1%}, within-sector {1 - v_between / v_s:.1%}")
    print("    (within-sector spread is what keeps the §25 fairness audit non-trivial)")

    print(f"\n  §14 circularity threshold ({CIRCULARITY_FLAG}):")
    if ceiling < CIRCULARITY_FLAG:
        need = float(np.sqrt(2) * norm.ppf(CIRCULARITY_FLAG))
        k = float(np.sqrt((need**2 - v_n) / (v_s + v_m)))
        print(f"    UNREACHABLE at any rho. Ceiling {ceiling:.4f} < {CIRCULARITY_FLAG}, and rho does not")
        print("    appear in Phi(sd(logit)/sqrt(2)) — it governs how much of the ceiling a model")
        print(f"    reaches, never the ceiling itself. Reaching {CIRCULARITY_FLAG} needs sd(logit) = {need:.3f}")
        print(f"    vs {sd_logit:.3f} today: latent coefficients scaled by {k:.2f}x "
              f"(shock_coef 2.5 -> {2.5 * k:.1f}, management_coef 2.0 -> {2.0 * k:.1f}).")
        for target in (0.75, 0.80):
            nd = float(np.sqrt(2) * norm.ppf(target))
            kk = float(np.sqrt((nd**2 - v_n) / (v_s + v_m)))
            print(f"    for AUC {target:.2f}: sd {nd:.3f}, k={kk:.2f} "
                  f"(shock_coef -> {2.5 * kk:.1f}, management_coef -> {2.0 * kk:.1f})")
    else:
        print(f"    REACHED: ceiling {ceiling:.4f} >= {CIRCULARITY_FLAG} — the label model is too separable.")


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--config", default="config.yaml")
    ap.add_argument("--verify", metavar="DIR", default=None, help="check replication against a real generator run")
    args = ap.parse_args(argv)
    cfg = load_config(args.config)
    if args.verify:
        print(f"verifying latent replication against {args.verify} …")
        return verify(cfg, args.verify)
    report(draw_latents(cfg))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
