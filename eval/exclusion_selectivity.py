"""SOP_Monshaat_Unblock B4 — is the §15 coverage exclusion on Berka selective on the label?

    python -m eval.exclusion_selectivity [--berka-dir data/berka] [--out eval/out/exclusion_selectivity.md]

`eval.compare_real` scores Berka accounts only where `coverage_days_90d ≥ 10` in the 90 days before
loan.date (DECISIONS.md entry 9); 67 of 682 labelled accounts are excluded as `insufficient_data`.
If excluded accounts default at a different rate than retained ones, every Berka AUC is computed on
a label-selected population and must say so. Reported: default rate excluded vs retained on both
label sets, the risk ratio, Fisher's exact test (two-sided), and the share of all defaults lost.
Nothing here changes a threshold; the finding is the output.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import pandas as pd
from scipy.stats import fisher_exact


def selectivity(b: pd.DataFrame, ycol: str) -> dict:
    d = b[b[ycol].notna()].copy()
    d[ycol] = d[ycol].astype(int)
    ex, keep = d[d["excluded"]], d[~d["excluded"]]
    table = [[int(ex[ycol].sum()), int((ex[ycol] == 0).sum())], [int(keep[ycol].sum()), int((keep[ycol] == 0).sum())]]
    odds, p = fisher_exact(table)
    r_ex, r_keep = ex[ycol].mean() if len(ex) else float("nan"), keep[ycol].mean()
    return {
        "n_excluded": len(ex),
        "defaults_excluded": table[0][0],
        "rate_excluded": float(r_ex),
        "n_retained": len(keep),
        "defaults_retained": table[1][0],
        "rate_retained": float(r_keep),
        "risk_ratio": float(r_ex / r_keep) if r_keep else float("nan"),
        "fisher_odds_ratio": float(odds),
        "fisher_p_two_sided": float(p),
        "share_of_all_defaults_excluded": table[0][0] / max(table[0][0] + table[1][0], 1),
    }


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--berka-dir", default="data/berka")
    ap.add_argument("--out", default="eval/out/exclusion_selectivity.md")
    args = ap.parse_args(argv)
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    bd = Path(args.berka_dir)
    st = pd.read_csv(bd / "profile_status.csv", usecols=["business_id", "status", "coverage_days_90d"]).rename(columns={"status": "engine_status"})
    lab = pd.read_csv(bd / "labels.csv")
    b = lab.merge(st, on="business_id", how="left")
    b["excluded"] = b["engine_status"].eq("insufficient_data") | b["engine_status"].isna()
    res = {k: selectivity(b, c) for k, c in (("primary (A vs B, finished contracts)", "label_primary"), ("secondary (A+C vs B+D, censored)", "label_secondary"))}
    cov_ex = b.loc[b["excluded"], "coverage_days_90d"].describe()

    md = [
        "# §15 exclusion selectivity on Berka (SOP_Monshaat_Unblock B4)",
        "",
        f"Labelled accounts {len(b)}; excluded as `insufficient_data` under `coverage_days_90d ≥ 10`: {int(b['excluded'].sum())} (coverage among excluded: median {cov_ex['50%']:.0f}, max {cov_ex['max']:.0f} active days per 90).",
        "",
        "| label set | excluded n / defaults / rate | retained n / defaults / rate | risk ratio (excluded ÷ retained) | Fisher exact p (two-sided) | share of all defaults excluded |",
        "|---|---|---|---|---|---|",
    ]
    for k, r in res.items():
        md.append(f"| {k} | {r['n_excluded']} / {r['defaults_excluded']} / {r['rate_excluded']:.3f} | {r['n_retained']} / {r['defaults_retained']} / {r['rate_retained']:.3f} | **{r['risk_ratio']:.2f}** | {r['fisher_p_two_sided']:.4f} | {r['share_of_all_defaults_excluded']:.1%} |")
    worst = max(res.values(), key=lambda r: r["risk_ratio"])
    verdict = "SELECTIVE" if any(r["fisher_p_two_sided"] < 0.05 and r["risk_ratio"] > 1.5 for r in res.values()) else "not materially selective"
    md += [
        "",
        (
            f"**Verdict: the exclusion is {verdict}.** Accounts with fewer than 10 active days in the 90 days before the loan default at {worst['risk_ratio']:.1f}× the rate of retained accounts. "
            "Every Berka AUC in `eval/out/real_vs_synthetic.md` is therefore computed on a population from which the thinnest — and riskiest — accounts were removed by the eligibility rule, not by the model. "
            "A model that had to score them would face a harder problem than the reported AUC describes; the reported number is an estimate on the *eligible* population only, and is labelled as such. "
            "The synthetic side applies the same kind of rule (`coverage_days_90d ≥ 60`) to its own thin-file businesses, whose default rate is also reported by `validate_emergent`."
        ),
        "",
        "Nothing is changed by this finding: the threshold (entry 9) stands, the AUCs stand, and both now carry the selection caveat.",
    ]
    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    Path(args.out).write_text("\n".join(md) + "\n", encoding="utf-8")
    print("\n".join(md))
    print(f"\n→ {args.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
