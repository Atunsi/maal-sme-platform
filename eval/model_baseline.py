"""What the feature set actually supports at this sample size — Schema v2.9 §13, §14.

The rho sweep (eval/sweep_rho.py) uses one deliberately untuned XGBoost config
so the sweep measures the *data*, not a tuning effort. That config overfits
badly at this event rate (in-sample ~0.96 vs OOF ~0.58) and loses to plain
logistic regression. This script measures what a properly-regularised model
reaches, so the credit lens (Week 5) starts from a number rather than an
assumption.

Honest-measurement rules followed here:

* **One evaluation protocol for every model.** The same entity-level 5-fold
  split (each business is one row, so folds are entity-disjoint), the same
  pooled out-of-fold AUC. §13's temporal split does not apply — this
  measurement is cross-sectional, one snapshot per business.
* **Early stopping uses an inner split**, never the outer test fold, so the
  tree count is chosen without seeing the data it is scored on.
* **Every config is reported, not just the winner.** Taking the max over a
  grid scored on the same folds is mildly optimistic; showing the spread makes
  that visible instead of hiding it behind one number.
* **Parity is a result.** If a tuned model only matches logistic regression,
  that is a finding about what 27 features and ~360 events support — not a
  failure to be tuned away.

Usage (from the repo root):
    python -m eval.model_baseline                 # rho from config.yaml
    python -m eval.model_baseline --rho 0.6
"""

from __future__ import annotations

import argparse
import sys

import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score
from sklearn.model_selection import StratifiedKFold, train_test_split
from sklearn.preprocessing import StandardScaler
from xgboost import XGBClassifier

from eval.sweep_rho import build_frame, design_matrix, new_xgb, set_param
from generator.generate import generate, load_config

FOLDS = 5

# Deliberately small and pre-declared, so this is a documented comparison and
# not an open-ended search for the best-looking number.
XGB_GRID = [
    {"max_depth": 2, "min_child_weight": 20, "reg_lambda": 5.0},
    {"max_depth": 3, "min_child_weight": 20, "reg_lambda": 5.0},
    {"max_depth": 3, "min_child_weight": 50, "reg_lambda": 10.0},
    {"max_depth": 4, "min_child_weight": 50, "reg_lambda": 10.0},
]


def oof_logit(X: pd.DataFrame, y: np.ndarray, C: float = 1.0) -> float:
    oof = np.zeros(len(y))
    for tr, te in StratifiedKFold(FOLDS, shuffle=True, random_state=0).split(X, y):
        sc = StandardScaler().fit(X.iloc[tr])
        m = LogisticRegression(max_iter=5000, C=C).fit(sc.transform(X.iloc[tr]), y[tr])
        oof[te] = m.decision_function(sc.transform(X.iloc[te]))
    return roc_auc_score(y, oof)


def oof_xgb_tuned(X: pd.DataFrame, y: np.ndarray, params: dict) -> tuple[float, float]:
    """Pooled OOF AUC with early stopping on an inner split. Returns (auc, mean_best_iter)."""
    oof, iters = np.zeros(len(y)), []
    for tr, te in StratifiedKFold(FOLDS, shuffle=True, random_state=0).split(X, y):
        Xtr, Xva, ytr, yva = train_test_split(
            X.iloc[tr], y[tr], test_size=0.2, stratify=y[tr], random_state=0
        )
        m = XGBClassifier(
            n_estimators=2000, learning_rate=0.03, subsample=0.8, colsample_bytree=0.8,
            eval_metric="auc", tree_method="hist", early_stopping_rounds=50,
            random_state=0, n_jobs=4, **params,
        )
        m.fit(Xtr, ytr, eval_set=[(Xva, yva)], verbose=False)
        iters.append(m.best_iteration)
        oof[te] = m.predict_proba(X.iloc[te])[:, 1]
    return roc_auc_score(y, oof), float(np.mean(iters))


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--config", default="config.yaml")
    ap.add_argument("--rho", type=float, default=None)
    ap.add_argument("--quick", action="store_true")
    args = ap.parse_args(argv)

    cfg = load_config(args.config)
    rho = args.rho if args.rho is not None else cfg["latent_to_observable_correlation"]
    set_param(cfg, "rho", rho)
    tables = generate(cfg, quick=args.quick)

    f = build_frame(tables)
    res = f[f["population"] == "research"].reset_index(drop=True)
    X, _ = design_matrix(res)
    y = res["default_label"].to_numpy()

    lat = tables["latents_hidden"].merge(res[["business_id"]], on="business_id")
    ceiling = roc_auc_score(
        tables["labels"].set_index("business_id")["default_label"].loc[lat["business_id"]].to_numpy(),
        lat["latent_risk_index"].to_numpy(),
    )

    print("\n" + "=" * 86)
    print(f"Model baseline at rho = {rho} — entity-level {FOLDS}-fold OOF, research population")
    print("=" * 86)
    print(f"N = {len(res):,} businesses, {int(y.sum())} defaults ({y.mean():.2%}), {X.shape[1]} features\n")

    rows = [("oracle: latent risk index (ceiling)", ceiling, "")]
    for C in (0.1, 1.0):
        rows.append((f"logistic regression (L2, C={C})", oof_logit(X, y, C), ""))

    untuned = new_xgb()
    ut = XGBClassifier(**{**untuned.get_params(), "n_jobs": 4})
    oof = np.zeros(len(y))
    for tr, te in StratifiedKFold(FOLDS, shuffle=True, random_state=0).split(X, y):
        oof[te] = ut.fit(X.iloc[tr], y[tr]).predict_proba(X.iloc[te])[:, 1]
    rows.append(("XGBoost, untuned (as used by sweep_rho)", roc_auc_score(y, oof), "400 trees, no early stop"))

    for params in XGB_GRID:
        auc, it = oof_xgb_tuned(X, y, params)
        desc = f"depth={params['max_depth']} mcw={params['min_child_weight']} L2={params['reg_lambda']}"
        rows.append((f"XGBoost, early-stopped ({desc})", auc, f"mean best_iter={it:.0f}"))

    width = max(len(r[0]) for r in rows)
    best_logit = max(r[1] for r in rows if r[0].startswith("logistic"))
    for name, auc, note in rows:
        pct = f"{auc / ceiling:5.1%} of ceiling" if not name.startswith("oracle") else ""
        print(f"  {name:<{width}s}  AUC={auc:.4f}  {pct:<17s} {note}")

    tuned = [r[1] for r in rows if "early-stopped" in r[0]]
    best_tuned = max(tuned)
    print(f"\n  best logistic = {best_logit:.4f} | best early-stopped XGB = {best_tuned:.4f} "
          f"| delta = {best_tuned - best_logit:+.4f}")
    if best_tuned <= best_logit + 0.005:
        print("  => PARITY (or worse). At this event rate and feature count, gradient boosting")
        print("     buys nothing over logistic regression. That is a measurement about what the")
        print("     feature set supports, not a tuning failure — record it, do not chase it.")
    else:
        print(f"  => tuned XGBoost gains {best_tuned - best_logit:+.4f} over logistic.")
    print(f"  Grid spread across early-stopped configs: {min(tuned):.4f} - {max(tuned):.4f}")
    print("  (max over a grid scored on the same folds is mildly optimistic — spread shown so that is visible)")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
