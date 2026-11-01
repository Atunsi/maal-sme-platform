"""DECISIONS entry 1b — do features 11 and 56 carry risk signal inside construction? Re-measured on the current data.

    python -m eval.entry1b_check [--dir data] [--n-boot 1000] [--out eval/out/entry1b_check.md]

Population: research businesses (1–10,000) in construction that the engine scored
(`scored` or `partial_profile`). Spearman ρ of each feature against two targets, with a
percentile bootstrap 95% CI (resampling businesses):
  * `default_label` — the observed outcome the credit lens is trained on;
  * `latent_risk_index` — the hidden risk score entry 1 measured against (generator truth,
    read here for validation only; it never reaches an engine-facing table).
Features 11 and 56 are the claim; 13, 16–19 and 37–40 are the features entry 1b says the §25
audit should look to instead. Feature 56 is a within-sector affine transform of 11 (§35), so its
ρ equals 11's exactly when computed inside one sector; it is reported anyway so the table is complete.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from scipy.stats import spearmanr

from profile_engine.registry import FEATURE_NAMES

CLAIM = (11, 56)
ALTERNATIVES = (13, 16, 17, 18, 19, 37, 38, 39, 40)
TARGETS = (("default_label", "observed default"), ("latent_risk_index", "hidden risk score"))


def rho_ci(x: np.ndarray, y: np.ndarray, n_boot: int, rng: np.random.Generator) -> tuple[float, float, float]:
    rho = float(spearmanr(x, y).statistic)
    vals = []
    for _ in range(n_boot):
        i = rng.integers(0, len(x), len(x))
        if np.ptp(y[i]) > 0 and np.ptp(x[i]) > 0:
            vals.append(spearmanr(x[i], y[i]).statistic)
    lo, hi = np.percentile(vals, [2.5, 97.5])
    return rho, float(lo), float(hi)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dir", default="data")
    ap.add_argument("--n-boot", type=int, default=1000)
    ap.add_argument("--seed", type=int, default=0)
    ap.add_argument("--sector", default="construction")
    ap.add_argument("--out", default="eval/out/entry1b_check.md")
    args = ap.parse_args(argv)
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    d = Path(args.dir)
    feats = [FEATURE_NAMES[f] for f in (*CLAIM, *ALTERNATIVES)]
    df = (
        pd.read_csv(d / "profiles.csv", usecols=["business_id", *feats])
        .merge(pd.read_csv(d / "profile_status.csv", usecols=["business_id", "status"]), on="business_id")
        .merge(pd.read_csv(d / "businesses.csv", usecols=["business_id", "sector", "population"]), on="business_id")
        .merge(pd.read_csv(d / "labels.csv", usecols=["business_id", "default_label"]), on="business_id")
        .merge(pd.read_csv(d / "latents_hidden.csv", usecols=["business_id", "latent_risk_index"]), on="business_id")
    )
    df = df[(df["population"] == "research") & (df["sector"] == args.sector) & (df["status"] != "insufficient_data")]
    rng = np.random.default_rng(args.seed)

    rows = []
    for f in (*CLAIM, *ALTERNATIVES):
        name = FEATURE_NAMES[f]
        rec = {"id": f, "feature": name, "role": "claim (1b)" if f in CLAIM else "alternative named in 1b"}
        for col, _ in TARGETS:
            sub = df[[name, col]].dropna()
            rho, lo, hi = rho_ci(sub[name].to_numpy(float), sub[col].to_numpy(float), args.n_boot, rng)
            rec |= {f"{col} N": len(sub), f"{col} defaults": int(df.loc[sub.index, "default_label"].sum()), f"{col} rho": rho, f"{col} lo": lo, f"{col} hi": hi}
        rows.append(rec)
    res = pd.DataFrame(rows)
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    res.to_csv(out.with_suffix(".csv"), index=False)

    md = [
        f"# Entry 1b re-measured: features 11 and 56 inside {args.sector}",
        "",
        (
            f"Data: `{d}`, research population, sector `{args.sector}`, engine status scored or partial_profile: "
            f"**N = {len(df):,} businesses, {int(df['default_label'].sum())} defaults** ({df['default_label'].mean():.2%}). "
            f"Spearman ρ with a percentile bootstrap 95% CI, {args.n_boot:,} resamples of businesses, seed {args.seed}."
        ),
        "",
        "| # | Feature | Role | N | ρ vs observed default [95% CI] | ρ vs hidden risk score [95% CI] |",
        "|---|---|---|---|---|---|",
    ]
    for r in res.to_dict("records"):
        md.append(
            f"| {r['id']} | `{r['feature']}` | {r['role']} | {r['default_label N']:,} "
            f"| {r['default_label rho']:+.3f} [{r['default_label lo']:+.3f}, {r['default_label hi']:+.3f}] "
            f"| {r['latent_risk_index rho']:+.3f} [{r['latent_risk_index lo']:+.3f}, {r['latent_risk_index hi']:+.3f}] |"
        )
    c11 = res.set_index("id").loc[11]
    alt = res[res["id"].isin(ALTERNATIVES)]
    strong = alt[(alt["default_label lo"] > 0) | (alt["default_label hi"] < 0)]
    md += [
        "",
        "## Reading the table (generated from the numbers above)",
        "",
        (
            f"- Feature 11 against the observed default: ρ = {c11['default_label rho']:+.3f} [{c11['default_label lo']:+.3f}, {c11['default_label hi']:+.3f}]; "
            f"against the hidden risk score: {c11['latent_risk_index rho']:+.3f} [{c11['latent_risk_index lo']:+.3f}, {c11['latent_risk_index hi']:+.3f}]. "
            f"The CI against default {'contains' if c11['default_label lo'] <= 0 <= c11['default_label hi'] else 'excludes'} 0."
        ),
        "- Feature 56 is 11 standardised with one sector's mean and SD, a monotone transform inside a sector, so its ρ is identical by construction; its CI differs slightly only because it uses different bootstrap draws.",
        (
            f"- Of the {len(alt)} alternatives entry 1b names, {len(strong)} have a CI against observed default that excludes 0: "
            + (", ".join(f"{int(r['id'])} ({r['default_label rho']:+.3f})" for r in strong.to_dict("records")) or "none")
            + "."
        ),
        "- Against the observed default the correlations are small for every feature, partly because the label is a rare binary event; the hidden risk score is the cleaner comparison and is what entry 1 measured.",
        "",
        "Table as CSV: `entry1b_check.csv`. Nothing is changed by this check.",
    ]
    out.write_text("\n".join(md) + "\n", encoding="utf-8")
    print("\n".join(md))
    print(f"\n→ {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
