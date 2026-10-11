"""Train the Base Murabaha credit model and export it as auditable JSON.

    python -m profile_engine.compute --dir data     # once: writes data/profiles.csv + profile_status.csv
    python -m lenses.credit.train [--dir data]      # writes lenses/credit/model_v1.json

Protocol (reused, not reinvented — eval/README asks the credit lens not to write a third):
  * model = eval.compare_real.model(): median impute -> standardise -> logistic regression.
  * CV    = eval.compare_real.unified_cv(): repeated stratified group 5-fold x 20,
            grouped by business_id, out-of-fold pooled per repeat (DECISIONS entry 19).
            Entity-disjoint by construction; nothing is shuffled across time — the
            label is one snapshot per business, so there is no temporal axis to leak along.
  * Train on the research population only (business_id 1–10,000, §23). The serving
    population is scored once, out of sample, as a disjoint check — never trained on.
  * §15: insufficient_data businesses are excluded (the engine refuses to score them).

Inputs: the §8 /profile membership list (profile_engine.registry.PROFILE_FEATURE_IDS)
minus lens_config.credit.excluded_feature_ids. Sector is deliberately not an input
(§25). Absolute-currency features get a signed log1p — decided before training, not
after looking at a result.

Reports every AUC beside the oracle ceiling (DECISIONS entry 22, Path A — applied by
default because no decision was recorded before training).
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import sys
from datetime import UTC, datetime
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.metrics import roc_auc_score

from eval.compare_real import ABSOLUTE_CURRENCY, bootstrap_auc, model, unified_cv
from lenses import load_lens_config
from lenses.credit.model import decide, load_artifact, score
from profile_engine.registry import FEATURE_NAMES, PROFILE_FEATURE_IDS


def sha256_file(p: str | Path) -> str:
    return hashlib.sha256(Path(p).read_bytes()).hexdigest()


def to_numeric(s: pd.Series) -> pd.Series:
    if s.dtype == object:
        s = s.map(lambda v: 1.0 if v in (True, "True") else 0.0 if v in (False, "False") else v)
    return pd.to_numeric(s, errors="coerce")


def build_xy(d: Path, excluded: set) -> tuple[pd.DataFrame, pd.DataFrame, list[dict]]:
    prof = pd.read_csv(d / "profiles.csv")
    status = pd.read_csv(d / "profile_status.csv")[["business_id", "status"]]
    biz = pd.read_csv(d / "businesses.csv")[["business_id", "population"]]
    lab = pd.read_csv(d / "labels.csv")[["business_id", "default_label"]]
    df = prof.merge(status, on="business_id").merge(biz, on="business_id").merge(lab, on="business_id")
    df = df[df["status"] != "insufficient_data"].reset_index(drop=True)

    feats = []
    for fid in PROFILE_FEATURE_IDS:
        if fid in excluded:
            continue
        name = FEATURE_NAMES[fid]
        if name not in df.columns:
            continue
        col = to_numeric(df[name])
        if col.notna().sum() == 0 or col.nunique(dropna=True) < 2:
            continue  # all-null or constant: no information, and a zero scale
        log_t = fid in ABSOLUTE_CURRENCY
        df[name] = col.map(lambda v: math.copysign(math.log1p(abs(v)), v) if pd.notna(v) else v) if log_t else col
        feats.append({"id": fid, "name": name, "log_transform": log_t})
    return df, df[[f["name"] for f in feats]], feats


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dir", default="data")
    ap.add_argument("--repeats", type=int, default=20)
    args = ap.parse_args(argv)
    d = Path(args.dir)
    lc = load_lens_config()
    ccfg = lc["credit"]
    out_path = Path(ccfg["model_artifact"])

    df, X_all, feats = build_xy(d, set(ccfg["excluded_feature_ids"]))
    res = df["population"].eq("research").to_numpy()
    srv = df["population"].eq("serving").to_numpy()
    X, y = X_all[res].reset_index(drop=True), df.loc[res, "default_label"].to_numpy()
    groups = df.loc[res, "business_id"].to_numpy()
    print(f"research scorable: {len(y):,} businesses, {int(y.sum())} defaults ({y.mean():.2%}), {X.shape[1]} features")

    cv = unified_cv(X, y, groups, n_repeats=args.repeats)
    lat = pd.read_csv(d / "latents_hidden.csv")[["business_id", "latent_risk_index"]]
    lat = df.loc[res, ["business_id", "default_label"]].merge(lat, on="business_id")
    ceiling = float(roc_auc_score(lat["default_label"], lat["latent_risk_index"]))
    print(f"CV AUC median {cv['median']:.4f} [{cv['lo']:.4f}, {cv['hi']:.4f}]  |  oracle ceiling {ceiling:.4f}  "
          f"|  {cv['median'] / ceiling:.1%} of ceiling")

    m = model().fit(X, y)
    imp, sc, lr = m.named_steps["simpleimputer"], m.named_steps["standardscaler"], m.named_steps["logisticregression"]
    art = {
        "version": "v1",
        "trained": datetime.now(UTC).date().isoformat(),
        "model": "logistic regression (L2, C=1.0) on median-imputed, standardised /profile features",
        "population": "research (business_id 1-10,000, §23), insufficient_data excluded (§15)",
        "n_train": len(y),
        "defaults_train": int(y.sum()),
        "label": "default_label (synthetic, latent-driven, §14)",
        "data_source": "synthetic",
        "config_sha256": sha256_file("config.yaml"),
        # Hash only the credit section: a change to the forecast or anomaly settings must not make
        # the credit model look stale. (The decision receipt still hashes the whole lens config.)
        "lens_config_credit_sha256": hashlib.sha256(json.dumps(ccfg, sort_keys=True).encode()).hexdigest(),
        "cv": cv,
        "oracle_ceiling_auc": round(ceiling, 6),
        "pct_of_ceiling": round(cv["median"] / ceiling, 6),
        "intercept": float(lr.intercept_[0]),
        "features": [
            {**f, "median": float(imp.statistics_[i]), "mean": float(sc.mean_[i]), "scale": float(sc.scale_[i]), "coef": float(lr.coef_[0, i])}
            for i, f in enumerate(feats)
        ],
    }

    # The JSON scorer must reproduce sklearn exactly, or the artifact is not the model it claims to be.
    tmp = out_path.with_suffix(".tmp.json")
    tmp.write_text(json.dumps(art), encoding="utf-8")
    load_artifact.cache_clear()
    probe = load_artifact(str(tmp))
    raw = df.loc[res].reset_index(drop=True)
    mine = np.array([score(raw.iloc[i], {**probe, "features": [{**f, "log_transform": False} for f in probe["features"]]})[1] for i in range(len(raw))])
    ref = m.decision_function(X)
    worst = float(np.max(np.abs(mine - ref)))
    tmp.unlink()
    load_artifact.cache_clear()
    assert worst < 1e-8, f"JSON scorer disagrees with sklearn by {worst:.3e} — artifact would misrepresent the model"
    print(f"JSON scorer reproduces sklearn on all {len(raw):,} training rows (max |logit delta| = {worst:.2e})")

    # Serving population: scored once, out of sample (§23 disjoint population).
    if srv.any():
        ys = df.loc[srv, "default_label"].to_numpy()
        s_auc = bootstrap_auc(ys, m.decision_function(X_all[srv].reset_index(drop=True)), 1000)
        art["serving_check"] = {"auc": round(s_auc[0], 6), "ci95": [round(s_auc[1], 6), round(s_auc[2], 6)], "n": int(srv.sum()), "defaults": int(ys.sum())}
        print(f"serving (out of sample, never trained on): AUC {s_auc[0]:.4f} [{s_auc[1]:.4f}, {s_auc[2]:.4f}], n={srv.sum()}, defaults={int(ys.sum())}")

    body = json.dumps(art, indent=2, sort_keys=True)
    art["sha256"] = hashlib.sha256(body.encode()).hexdigest()
    out_path.write_text(json.dumps(art, indent=2, sort_keys=True), encoding="utf-8")
    print(f"wrote {out_path} (sha256 {art['sha256'][:12]}…)")

    # Tier outcome on the research population with the policy as configured — read-only report.
    load_artifact.cache_clear()
    final = load_artifact(str(out_path))
    raw_prof = pd.read_csv(d / "profiles.csv").merge(df.loc[res, ["business_id", "default_label"]], on="business_id")
    rows = []
    for _, r in raw_prof.iterrows():
        o = decide(r, ccfg, final)
        rows.append((o["internals"]["risk_tier"] or o["internals"]["decline_reason"], r["default_label"]))
    t = pd.DataFrame(rows, columns=["outcome", "default"]).groupby("outcome")["default"].agg(["size", "mean"])
    t.columns = ["businesses", "default_rate"]
    print("\npolicy outcome on research (read-only; tiers are PROPOSED, entry 23):")
    print(t.assign(share=t["businesses"] / t["businesses"].sum()).round(4).to_string())
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
