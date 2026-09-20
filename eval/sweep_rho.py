"""Latent-to-observable correlation (rho) sensitivity sweep — Schema v2.9 §14.

§14 requires AUC to be reported **as a function of
`latent_to_observable_correlation`** (alongside label-noise level), so the team
can show model performance is not an artifact of an accidentally-too-clean
generator. This is that report.

Protocol
--------
* Regenerate the full research + serving populations at each rho, in-process —
  no CSVs are written, so the committed `data/` is never disturbed.
* **Labels are held fixed.** In `generate_business`, the label is drawn from
  the per-business RNG stream *before* any rho-dependent draw, and changing rho
  alters arithmetic only, never the number of draws. The label vector is
  therefore identical at every rho; the sweep isolates observable cleanliness
  against fixed ground truth. Asserted at runtime, not assumed.
* Features come from the **real profile engine** (`profile_engine.features.
  compute_profiles`, 71 features per §8), run in-memory on the generated
  tables — the same code path `python -m profile_engine.compute` uses. §35
  z-features score against the pinned reference stats, never recomputed per ρ.
  Businesses the engine puts in `insufficient_data` (§15) are dropped.
* **Entity-level CV** (§13): each business contributes exactly one row, so
  5-fold folds are entity-disjoint by construction. Out-of-fold predictions
  are pooled into a single AUC.
* Plus **train-on-research -> test-on-serving**, the §23 disjoint populations —
  the same out-of-sample structure the live demo uses.
* **Oracle ceiling**: AUC of the hidden latent risk index `r` itself. No
  feature set can beat this, because the residual in the label is
  idiosyncratic noise nothing observable can see. At rho = 1 every observable
  becomes a deterministic function of `r`, so the ceiling is what AUC
  converges to.

Scope note: this measurement is **cross-sectional** — one snapshot per
business at its last month-end — so §13's expanding-window temporal split does
not apply to it. The credit lens's own training will need both that and the
entity-level split used here.

Usage (from the repo root):
    python -m eval.sweep_rho                          # rho in {0.6, 0.7, 0.8, 0.9}
    python -m eval.sweep_rho --values 0.5 0.6 0.7 0.8 0.9 0.95
    python -m eval.sweep_rho --param noise            # the §14 companion axis
    python -m eval.sweep_rho --quick                  # smoke test, AUCs not meaningful
"""

from __future__ import annotations

import argparse
import re
import sys
import time

import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score
from sklearn.model_selection import StratifiedKFold
from sklearn.preprocessing import StandardScaler
from xgboost import XGBClassifier

from generator.generate import generate, load_config
from profile_engine import features as fe
from profile_engine.registry import FEATURE_NAMES

CIRCULARITY_FLAG = 0.85  # §14: "The resulting AUC >= 0.85 would be circular"

PARAM_KEY = {
    "rho": ("latent_to_observable_correlation", None),
    "noise": ("label_noise_sigma", "default_label_model"),
}

HONEST_COLUMNS = ["XGB OOF", "logit OOF", "XGB->serving"]  # out-of-sample only

CATEGORICALS = ["sector", "size_tier", "age_tier"]

def numeric_features(df: pd.DataFrame) -> list[str]:
    """Every registry feature present and numeric. Non-numeric ones (e.g. the
    sharia enum, dates) are excluded rather than silently encoded.

    NOTE `FEATURE_NAMES` is {feature_id: name}, so iterate .values() — iterating
    the dict yields the integer ids, which match no column and silently leave
    the model with nothing but the categorical dummies.
    """
    cols = [c for c in FEATURE_NAMES.values() if c in df.columns and pd.api.types.is_numeric_dtype(df[c])]
    cols += [c for c in FEATURE_NAMES.values() if c in df.columns and c not in cols and _is_bool_like(df[c])]
    if len(cols) < 20:  # fail loudly rather than quietly measuring almost nothing
        raise RuntimeError(
            f"only {len(cols)} numeric engine features found in the profile frame "
            f"({len(FEATURE_NAMES)} in the registry). Refusing to report an AUC on that."
        )
    return cols


def _is_bool_like(s: pd.Series) -> bool:
    """Nullable booleans (e.g. feature 36 `ramadan_adjusted`) arrive as object dtype
    because of the None. They are real features — coerce them, don't drop them."""
    u = set(pd.unique(s.dropna()))
    return bool(u) and u <= {True, False}


def feature_block(df: pd.DataFrame) -> pd.DataFrame:
    """Registry features as floats, bool-likes coerced, nulls preserved as NaN."""
    block = df[numeric_features(df)].copy()
    for c in block.columns:
        if not pd.api.types.is_numeric_dtype(block[c]):
            block[c] = block[c].map({True: 1.0, False: 0.0}).astype(float)
    return block.astype(float)


def set_param(cfg: dict, param: str, value: float) -> None:
    key, parent = PARAM_KEY[param]
    (cfg[parent] if parent else cfg)[key] = float(value)


def build_frame(tables: dict[str, pd.DataFrame], cfg: dict) -> pd.DataFrame:
    """Run the real profile engine (§8, 71 features) in-memory over generated tables.

    Uses `profile_engine.features.compute_profiles` — the same code path
    `python -m profile_engine.compute` runs — so the sweep measures what the
    lenses will actually read, not a stand-in. §35 z-features are scored
    against the **pinned** `sector_reference_stats_v1.json`, never recomputed
    per ρ, which is the §35 rule.

    Businesses in the §15 `insufficient_data` state are dropped: the engine
    refuses to score them, so they cannot appear in a model's training set.
    """
    wins, years = [], set()
    for e in cfg["ramadan_calendar"]:
        wins.append((pd.Timestamp(e["ramadan_start"]), pd.Timestamp(e["eid_end"])))
        years.update({pd.Timestamp(e["ramadan_start"]).year, pd.Timestamp(e["eid_end"]).year})
    stats, _ = fe.load_reference_stats()
    pe = cfg.get("profile_engine", {})
    out = fe.compute_profiles(
        tables, wins, years, reference_stats=stats,
        hazard_seed=int(pe.get("hazard_seed", 0)),
        coverage_min_by_source=pe.get("coverage_min_days_by_source"),
    )
    f = out["features"].merge(out["status"][["business_id", "status"]], on="business_id")
    f = f[f["status"] != "insufficient_data"]  # §15
    f = f.merge(tables["businesses"][["business_id", "population", "sector", "size_tier", "age_tier"]], on="business_id")
    return f.merge(tables["labels"][["business_id", "default_label"]], on="business_id").reset_index(drop=True)


def design_matrix(df: pd.DataFrame, columns: list[str] | None = None) -> tuple[pd.DataFrame, list[str]]:
    dummies = pd.get_dummies(df[CATEGORICALS], dtype=float)
    # XGBoost rejects feature names containing [, ] or < — age tiers are "<1yr", "7yr+".
    dummies.columns = [re.sub(r"[\[\]<>+]", "_", c) for c in dummies.columns]
    X = pd.concat([feature_block(df), dummies], axis=1)
    if columns is not None:
        X = X.reindex(columns=columns, fill_value=0.0)
    return X, list(X.columns)


def new_xgb() -> XGBClassifier:
    return XGBClassifier(
        n_estimators=400, max_depth=4, learning_rate=0.05,
        subsample=0.8, colsample_bytree=0.8, min_child_weight=5,
        reg_lambda=1.0, eval_metric="logloss", tree_method="hist",
        random_state=0, n_jobs=4,
    )


def oof_auc(X: pd.DataFrame, y: np.ndarray, kind: str, folds: int = 5) -> float:
    """Pooled out-of-fold AUC. One row per business, so folds are entity-disjoint."""
    oof = np.zeros(len(y))
    for tr, te in StratifiedKFold(folds, shuffle=True, random_state=0).split(X, y):
        if kind == "xgb":
            m = new_xgb().fit(X.iloc[tr], y[tr])  # XGBoost handles NaN natively
            oof[te] = m.predict_proba(X.iloc[te])[:, 1]
        else:
            # The engine returns null for genuinely unavailable features (§15/§16);
            # impute from the TRAINING fold only, so no test-fold information leaks.
            # Median from the TRAINING fold only. Features the engine never populates
            # (24-26, 34-35 are not_implemented) are all-null, so their median is NaN
            # too — the 0.0 backstop turns those into a constant column, which carries
            # no information and no leakage.
            med = X.iloc[tr].median()
            tr_X = X.iloc[tr].fillna(med).fillna(0.0)
            te_X = X.iloc[te].fillna(med).fillna(0.0)
            sc = StandardScaler().fit(tr_X)
            m = LogisticRegression(max_iter=5000).fit(sc.transform(tr_X), y[tr])
            oof[te] = m.decision_function(sc.transform(te_X))
    return roc_auc_score(y, oof)


def evaluate(f: pd.DataFrame, tables: dict[str, pd.DataFrame]) -> dict:
    """`f` is a prebuilt profile frame — the engine is expensive, run it once per rho."""
    res = f[f["population"] == "research"].reset_index(drop=True)
    srv = f[f["population"] == "serving"].reset_index(drop=True)
    Xr, cols = design_matrix(res)
    yr = res["default_label"].to_numpy()

    row = {
        "n_research": len(res),
        "n_defaults": int(yr.sum()),
        "auc_xgb_oof": oof_auc(Xr, yr, "xgb"),
        "auc_logit_oof": oof_auc(Xr, yr, "logit"),
        "auc_xgb_insample": roc_auc_score(yr, new_xgb().fit(Xr, yr).predict_proba(Xr)[:, 1]),
    }

    if len(srv) and srv["default_label"].nunique() > 1:
        Xs, _ = design_matrix(srv, cols)
        ys = srv["default_label"].to_numpy()
        row["auc_xgb_serving"] = roc_auc_score(ys, new_xgb().fit(Xr, yr).predict_proba(Xs)[:, 1])
        row["n_serving"] = len(srv)
        row["n_serving_defaults"] = int(ys.sum())

    # Research-only, to match the population every other column in this row is computed on.
    lat = tables["latents_hidden"].merge(res[["business_id"]], on="business_id")
    lab = tables["labels"].set_index("business_id")["default_label"]
    row["auc_oracle_latent"] = roc_auc_score(
        lab.loc[lat["business_id"]].to_numpy(), lat["latent_risk_index"].to_numpy()
    )
    row["label_fingerprint"] = tuple(tables["labels"].sort_values("business_id")["default_label"].to_numpy())
    return row


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--config", default="config.yaml")
    ap.add_argument("--param", choices=list(PARAM_KEY), default="rho")
    ap.add_argument("--values", type=float, nargs="+", default=None)
    ap.add_argument("--quick", action="store_true", help="smoke test only — AUCs are not meaningful at this N")
    args = ap.parse_args(argv)
    values = args.values or ([0.6, 0.7, 0.8, 0.9] if args.param == "rho" else [0.1, 0.2, 0.3])

    label = "rho" if args.param == "rho" else "sigma_noise"
    print(f"§14 sensitivity sweep — {label} in {values}")
    scale = "QUICK (not meaningful)" if args.quick else "full scale"
    print(f"config: {args.config} | populations: research + serving | {scale}\n")

    rows, fingerprints = [], {}
    for v in values:
        cfg = load_config(args.config)
        set_param(cfg, args.param, v)
        t0 = time.time()
        tables = generate(cfg, quick=args.quick)
        r = evaluate(build_frame(tables, cfg), tables)
        fingerprints[v] = r.pop("label_fingerprint")
        r[label] = v
        r["secs"] = time.time() - t0
        rows.append(r)
        serving = r.get("auc_xgb_serving", float("nan"))
        print(
            f"  {label}={v}: OOF AUC xgb={r['auc_xgb_oof']:.4f} logit={r['auc_logit_oof']:.4f} "
            f"| serving={serving:.4f} | oracle={r['auc_oracle_latent']:.4f} ({r['secs']:.0f}s)\n",
            flush=True,
        )
        del tables

    df = pd.DataFrame(rows).set_index(label)
    print("=" * 96)
    print(f"AUC as a function of {label} — research population, entity-level 5-fold OOF")
    print("=" * 96)
    show = df[["auc_xgb_oof", "auc_logit_oof", "auc_xgb_serving", "auc_xgb_insample", "auc_oracle_latent"]]
    show.columns = ["XGB OOF", "logit OOF", "XGB->serving", "XGB in-sample", "oracle (latent)"]
    print(show.round(4).to_string())
    print(
        f"\nN research scorable = {df['n_research'].iloc[0]:,} ({df['n_defaults'].iloc[0]} defaults)"
        f" | N serving scorable = {int(df['n_serving'].iloc[0]):,}"
        f" ({int(df['n_serving_defaults'].iloc[0])} defaults)"
    )

    if args.param == "rho":
        ident = all(fingerprints[v] == fingerprints[values[0]] for v in values)
        note = "(sweep isolates observable cleanliness — §14)" if ident else "<- BROKEN: labels moved, sweep is confounded"
        print(f"\nlabels identical across all {label} values: {ident}  {note}")
        if not ident:
            return 1

    # Overfitting diagnostic, printed before the flag so the two are never conflated.
    gap = float((show["XGB in-sample"] - show["XGB OOF"]).max())
    if gap > 0.15:
        print(f"\nNOTE: XGB in-sample exceeds its own OOF by up to {gap:.3f} "
              f"({df['n_defaults'].iloc[0]} defaults / {df['n_research'].iloc[0]:,} rows).")
        print("  The model memorises at this event rate. In-sample AUC is an OVERFITTING")
        print("  diagnostic, NOT a circularity signal. The flag below is evaluated on the")
        print("  out-of-sample columns only — the only honest estimates of recoverable signal.")

    honest = show[HONEST_COLUMNS]
    hits = honest[(honest >= CIRCULARITY_FLAG).any(axis=1)]
    print(f"\n§14 circularity flag (out-of-sample AUC >= {CIRCULARITY_FLAG}):")
    if hits.empty:
        peak = float(honest.max().max())
        ceiling = float(df["auc_oracle_latent"].max())
        print(f"  NOT REACHED at any {label} in {values}. Peak out-of-sample AUC = {peak:.4f}.")
        print(f"  Oracle ceiling = {ceiling:.4f} — no feature set can exceed this, at any {label},")
        print("  because the rest of the label is idiosyncratic noise nothing observable can see.")
        if ceiling < CIRCULARITY_FLAG:
            print(f"  The ceiling itself is below {CIRCULARITY_FLAG}: an AUC at or above it on this data would be")
            print("  evidence of leakage, not of skill. Treat it as a tripwire.")
    else:
        print(hits.round(4).to_string())
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
