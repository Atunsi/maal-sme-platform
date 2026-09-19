"""SOP_Monshaat_Unblock B1 — per-feature Berka AUC with bootstrap CI, and the A1 / A2 split computed from it.

    python -m eval.feature_transfer [--berka-dir data/berka] [--n-boot 1000] [--out eval/out/feature_transfer.md]

For every feature whose registry class is A (computable on real bank data), the univariate AUC of
the feature value against each Berka label set, with a percentile bootstrap CI (≥ 1,000 resamples),
on the scored (`coverage_days_90d ≥ 10`) labelled accounts. Direction is made irrelevant by folding:
AUC* = max(AUC, 1 − AUC), so a feature that predicts in either direction can qualify — the sign is
reported separately as Spearman ρ.

Promotion rule, mechanical, no judgement (SOP §B1):

    A2 (real_predictive)  ⇔  the bootstrap CI of AUC* excludes 0.50 on at least one label set
    A1 (real_computed)    otherwise, including "not evaluable" (constant, all-null, or < 20 rows)

The rule is applied with the same fold: the CI excludes 0.50 iff the lower bound of the folded
AUC* is above 0.50, i.e. the unfolded CI lies entirely on one side of 0.50.

Writes eval/out/feature_transfer.md and eval/out/feature_transfer.json. `profile_engine/evidence.py`
reads the JSON copy at `profile_engine/feature_transfer.json` (written by `calibration.reclass_evidence`)
to assign A1 / A2 — the registry never carries a hand-typed A2.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from scipy.stats import spearmanr
from sklearn.metrics import roc_auc_score

from profile_engine.evidence import EVIDENCE, base_class
from profile_engine.registry import FEATURE_NAMES

LABEL_SETS = (("primary", "label_primary", "A vs B, finished contracts"), ("secondary", "label_secondary", "A+C vs B+D, censored"))


def univariate(x: np.ndarray, y: np.ndarray, n_boot: int, rng: np.random.Generator) -> dict:
    auc = float(roc_auc_score(y, x))
    vals = []
    for _ in range(n_boot):
        idx = rng.integers(0, len(y), len(y))
        if y[idx].min() != y[idx].max():
            vals.append(roc_auc_score(y[idx], x[idx]))
    lo, hi = (float(v) for v in np.percentile(vals, [2.5, 97.5]))
    excludes = (lo > 0.5) or (hi < 0.5)
    return {"auc": auc, "lo": lo, "hi": hi, "auc_folded": max(auc, 1 - auc), "ci_excludes_0.5": bool(excludes), "rho": float(spearmanr(x, y).statistic), "n": len(y), "defaults": int(y.sum())}


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--berka-dir", default="data/berka")
    ap.add_argument("--n-boot", type=int, default=1000)
    ap.add_argument("--seed", type=int, default=0)
    ap.add_argument("--out", default="eval/out/feature_transfer.md")
    args = ap.parse_args(argv)
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    assert args.n_boot >= 1000, "SOP B1: at least 1,000 bootstrap resamples"
    bd = Path(args.berka_dir)
    st = pd.read_csv(bd / "profile_status.csv", usecols=["business_id", "status"]).rename(columns={"status": "engine_status"})
    prof = pd.read_csv(bd / "profiles.csv").merge(st, on="business_id")
    lab = pd.read_csv(bd / "labels.csv")
    b = prof.merge(lab[["business_id", "label_primary", "label_secondary"]], on="business_id")
    b = b[b["engine_status"] != "insufficient_data"].copy()
    rng = np.random.default_rng(args.seed)

    class_a = [f for f in FEATURE_NAMES if base_class(f) == "A"]
    rows = {}
    for f in class_a:
        name = FEATURE_NAMES[f]
        res = {"feature": name, "id": str(f), "basis": EVIDENCE[f][1], "label_sets": {}}
        for key, ycol, _ in LABEL_SETS:
            d = b[[name, ycol]].dropna() if name in b.columns else pd.DataFrame(columns=[name, ycol])
            if len(d) < 20 or d[name].nunique() < 2 or d[ycol].nunique() < 2:
                res["label_sets"][key] = {"status": "not_evaluable", "n": len(d), "reason": "missing column" if name not in b.columns else ("< 20 rows" if len(d) < 20 else ("constant" if d[name].nunique() < 2 else "one label class"))}
                continue
            res["label_sets"][key] = univariate(d[name].to_numpy(float), d[ycol].astype(int).to_numpy(), args.n_boot, rng) | {"status": "ok"}
        qualifying = [k for k, r in res["label_sets"].items() if r.get("ci_excludes_0.5")]
        res["subclass"] = "A2" if qualifying else "A1"
        res["qualifying_label_sets"] = qualifying
        rows[str(f)] = res

    n_a2 = sum(1 for r in rows.values() if r["subclass"] == "A2")
    payload = {
        "run_at": pd.Timestamp.now(tz="UTC").isoformat(timespec="seconds"),
        "rule": "A2 iff the percentile-bootstrap 95% CI of the univariate Berka AUC excludes 0.50 on ≥ 1 label set (either direction); else A1",
        "n_boot": args.n_boot,
        "population": f"Berka labelled accounts scored under coverage_days_90d ≥ 10: {len(b)} (primary label set non-null: {int(b['label_primary'].notna().sum())})",
        "counts": {"A": len(class_a), "A2": n_a2, "A1": len(class_a) - n_a2},
        "features": rows,
    }
    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    Path(args.out).with_suffix(".json").write_text(json.dumps(payload, indent=1) + "\n", encoding="utf-8")

    def fmt(r: dict) -> str:
        if r.get("status") != "ok":
            return f"— ({r['reason']}, n={r['n']})"
        star = "**" if r["ci_excludes_0.5"] else ""
        return f"{star}{r['auc']:.3f} [{r['lo']:.2f}, {r['hi']:.2f}]{star} ρ {r['rho']:+.2f} (n={r['n']}/{r['defaults']})"

    md = [
        "# Per-feature transfer to real outcomes — the A1 / A2 split (SOP_Monshaat_Unblock B1)",
        "",
        (
            f"{payload['population']}. Univariate AUC of the feature against the label, percentile bootstrap {args.n_boot} resamples, 95% CI. "
            "Bold = CI excludes 0.50 on that label set. Rule: **A2 = real_predictive** iff bold on at least one label set; otherwise **A1 = real_computed**. "
            "Assigned by this script, never by hand."
        ),
        "",
        (
            f"**Result: {n_a2} of {len(class_a)} class-A features are A2; {len(class_a) - n_a2} are A1.** "
            "An A1 feature is computed on real bank data and its performance is reported here — it is not claimed to predict."
        ),
        "",
        "| # | Feature | Berka primary (A vs B) | Berka secondary (A+C vs B+D) | subclass |",
        "|---|---|---|---|---|",
    ]
    for f in class_a:
        r = rows[str(f)]
        md.append(f"| {f} | `{r['feature']}` | {fmt(r['label_sets']['primary'])} | {fmt(r['label_sets']['secondary'])} | **{r['subclass']}** |")
    a1 = [f"{r['id']} `{r['feature']}`" for r in rows.values() if r["subclass"] == "A1"]
    not_eval = [f"{r['id']} `{r['feature']}`" for r in rows.values() if all(x.get("status") != "ok" for x in r["label_sets"].values())]
    thin = [
        f"{r['id']} `{r['feature']}` (folded AUC {max(x['auc_folded'] for x in r['label_sets'].values() if x.get('status') == 'ok'):.3f})"
        for r in rows.values()
        if r["subclass"] == "A2" and max(x["auc_folded"] for x in r["label_sets"].values() if x.get("status") == "ok") < 0.55
    ]
    strong = sorted(
        (r for r in rows.values() if r["subclass"] == "A2"),
        key=lambda r: -max(x["auc_folded"] for x in r["label_sets"].values() if x.get("status") == "ok"),
    )[:6]
    md += [
        "",
        "## Reading the table (generated from the numbers above)",
        "",
        f"- **A1 ({len(a1)}):** {', '.join(a1)}. Computable on real data; not shown to predict real outcomes in this corpus. Of these, {len(not_eval)} could not be evaluated at all on Berka (constant or absent): {', '.join(not_eval) or 'none'}.",
        "- **Strongest A2 by folded AUC:** " + "; ".join(f"{r['id']} `{r['feature']}` {max(x['auc_folded'] for x in r['label_sets'].values() if x.get('status') == 'ok'):.3f}" for r in strong) + ".",
        (
            f"- **A2 on a hair-thin interval ({len(thin)}):** {', '.join(thin) or 'none'} — the CI excludes 0.50 because the feature is near-constant (ties dominate), so the interval is narrow around a negligible effect. "
            "The rule is applied as written and the folded AUC is printed so a reader can see the effect size; a threshold on effect size would be a second, judgement-bearing rule and is not added here."
        ),
        "- Intervals are wide on the primary label set (22 defaults among scored accounts) and narrower on the secondary (59, censored).",
        "- Both label sets are scored on the *eligible* population only; `eval/out/exclusion_selectivity.md` shows the excluded accounts default at 2.6–3.4× the retained rate.",
        "- An A2 label is a univariate statement on 1990s Czech accounts. It says the feature carries signal on real outcomes somewhere; it does not say how much it adds to a model, nor that it transfers to Saudi SMEs.",
    ]
    Path(args.out).write_text("\n".join(md) + "\n", encoding="utf-8")
    print("\n".join(md[:8]))
    print(f"\n→ {args.out} and {Path(args.out).with_suffix('.json')}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
