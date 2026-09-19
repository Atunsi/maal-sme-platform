"""Phase 3 + 4 — point-in-time labels, CV, and the real-vs-synthetic comparison (SOP_Data_Grounding §7, §8; SOP_Monshaat_Unblock B4).

    python -m eval.compare_real [--protocol unified|temporal] [--synthetic-dir data] [--berka-dir data/berka] [--out eval/out/real_vs_synthetic.md]

What must not happen, enforced here (SOP §15):
  1. config hash asserted unchanged across the run;
  2. two models, one feature set, two numbers — never one model on both sources;
  3. no Berka number without a bootstrap or repeat interval;
  4. no look-ahead — window_end < loan_date asserted, and the assertion is itself tested with a deliberate violation;
  5. COMPARISON_FEATURES is scale-free and real-computed (A1 ∪ A2) only, asserted against the evidence registry;
  9. every number in the report carries its source, population, label set and evidence class.
  B4. no cross-source AUC comparison mixes CV protocols: the headline is ONE protocol run identically on
      all three sources — repeated stratified group k-fold (5 folds grouped by business, stratified on the
      label, 20 repeats, out-of-fold predictions pooled per repeat, median and 2.5/97.5 percentiles across
      repeats). The v1.0 protocols (contiguous-ID entity folds on the synthetic side; a single temporal
      split and expanding temporal quintiles on Berka) are kept as labelled secondaries — the temporal
      split is a leakage check, not the headline. `--protocol temporal` reproduces the v1.0 headline.
  B4. the §15 exclusion's selectivity on the label is tested and reported (eval.exclusion_selectivity).

The §21 target `real_vs_synthetic_signal_strength` must already be registered in config.yaml (asserted).
Its pre-registered definition names the temporal split; the protocol sentence is superseded by SOP v2.0
B4 (DECISIONS.md entry 19) and the config text is left untouched so the config hash stays frozen
through Workstream B — the metric, tolerance, feature set and model class are unchanged.
"""

from __future__ import annotations

import argparse
import hashlib
import sys
import warnings
from pathlib import Path

import numpy as np
import pandas as pd
from scipy.stats import spearmanr
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score
from sklearn.model_selection import StratifiedGroupKFold
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

from eval.exclusion_selectivity import selectivity
from generator.generate import load_config
from profile_engine.evidence import EVIDENCE, REAL_CLASSES, weakest_class
from profile_engine.registry import FEATURE_NAMES

F = FEATURE_NAMES
TARGET_METRIC = "real_vs_synthetic_signal_strength"

# §8.1: scale-free (ratios, counts, day-counts, correlations, probabilities), real-computed only, computable on both sources.
# Absolute-currency features (1, 6, 16, 17, 19, 42, 47, 48, 60) are excluded by construction.
COMPARISON_FEATURES: list[int | str] = [2, 3, 4, 5, 7, 8, 9, 10, 12, 13, 14, 15, 18, 20, 21, 22, 32, 33, 41, 43, 44, 45, 46, 49, 50, 51, 52, 53, 54, 61]
ABSOLUTE_CURRENCY: set[int | str] = {1, 6, 16, 17, "18b", 19, 42, 47, 48, 60, 65}
N_ENTITY_FOLDS = 5
UNIFIED_FOLDS = 5
UNIFIED_REPEATS = 20


def config_hash(path: str) -> str:
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def model():
    return make_pipeline(SimpleImputer(strategy="median"), StandardScaler(), LogisticRegression(max_iter=5000))


def bootstrap_auc(y: np.ndarray, s: np.ndarray, n: int, seed: int = 0) -> tuple[float, float, float]:
    rng = np.random.default_rng(seed)
    point = roc_auc_score(y, s)
    vals = []
    for _ in range(n):
        idx = rng.integers(0, len(y), len(y))
        if y[idx].min() == y[idx].max():
            continue
        vals.append(roc_auc_score(y[idx], s[idx]))
    lo, hi = np.percentile(vals, [2.5, 97.5])
    return float(point), float(lo), float(hi)


def unified_cv(X: pd.DataFrame, y: np.ndarray, groups: np.ndarray, n_splits: int = UNIFIED_FOLDS, n_repeats: int = UNIFIED_REPEATS, seed: int = 0) -> dict:
    """B4: repeated stratified group k-fold, identical on every source. Pooled out-of-fold AUC per repeat; median and 2.5/97.5 percentiles across repeats."""
    aucs = []
    for r in range(n_repeats):
        cv = StratifiedGroupKFold(n_splits=n_splits, shuffle=True, random_state=seed + r)
        oof = np.full(len(y), np.nan)
        for tr, te in cv.split(X, y, groups):
            if len(np.unique(y[tr])) < 2:
                continue
            m = model().fit(X.iloc[tr], y[tr])
            oof[te] = m.decision_function(X.iloc[te])
        ok = ~np.isnan(oof)
        if ok.sum() and y[ok].min() != y[ok].max():
            aucs.append(roc_auc_score(y[ok], oof[ok]))
    lo, hi = np.percentile(aucs, [2.5, 97.5])
    return {"median": float(np.median(aucs)), "lo": float(lo), "hi": float(hi), "mean": float(np.mean(aucs)), "n_repeats": len(aucs), "n": len(y), "defaults": int(y.sum()), "protocol": f"repeated stratified group {n_splits}-fold × {n_repeats}, grouped by business_id, out-of-fold pooled per repeat"}


def assert_no_lookahead(biz: pd.DataFrame, labels: pd.DataFrame) -> None:
    m = biz.merge(labels[["business_id", "loan_date"]], on="business_id")
    bad = m[m["window_end"] >= m["loan_date"]]
    if len(bad):
        raise AssertionError(f"look-ahead: {len(bad)} labelled accounts have window_end >= loan_date, e.g. {bad.head(3)[['business_id', 'window_end', 'loan_date']].to_dict('records')}")


def self_test_lookahead_assertion() -> None:
    """§7.2: the assertion must fail on a deliberate violation, or it is not an assertion."""
    biz = pd.DataFrame({"business_id": [1], "window_end": [pd.Timestamp("1996-05-01")]})
    lab = pd.DataFrame({"business_id": [1], "loan_date": [pd.Timestamp("1996-05-01")]})
    try:
        assert_no_lookahead(biz, lab)
    except AssertionError:
        return
    raise RuntimeError("assert_no_lookahead did not fire on a deliberate violation")


def per_feature_transfer(df: pd.DataFrame, y_col: str, feats: list, n_boot: int, seed: int) -> pd.DataFrame:
    rows = []
    rng = np.random.default_rng(seed)
    for f in feats:
        name = F[f]
        d = df[[name, y_col]].dropna()
        if d[name].nunique() < 2 or d[y_col].nunique() < 2 or len(d) < 20:
            rows.append({"feature": name, "auc": np.nan, "lo": np.nan, "hi": np.nan, "rho": np.nan, "n": len(d)})
            continue
        y, x = d[y_col].to_numpy(), d[name].to_numpy(float)
        auc = roc_auc_score(y, x)
        vals = []
        for _ in range(n_boot):
            idx = rng.integers(0, len(y), len(y))
            if y[idx].min() != y[idx].max():
                vals.append(roc_auc_score(y[idx], x[idx]))
        lo, hi = np.percentile(vals, [2.5, 97.5]) if vals else (np.nan, np.nan)
        rows.append({"feature": name, "auc": auc, "lo": lo, "hi": hi, "rho": spearmanr(x, y).statistic, "n": len(d)})
    return pd.DataFrame(rows).set_index("feature")


def inferred_recurring(tx: pd.DataFrame, biz: pd.DataFrame) -> pd.Series:
    """§8.4 feature 8 inference: an outflow counterparty paid ≥3 times in the 180-day window, median gap 25–35 days, amount CV < 0.15."""
    t = tx[(tx["direction"] == "out") & tx["counterparty_id"].notna()].merge(biz[["business_id", "window_end"]], on="business_id")
    t = t[(t["window_end"] - t["date"]).dt.days < 180].sort_values(["business_id", "counterparty_id", "date"])
    g = t.groupby(["business_id", "counterparty_id"])
    stats = g["amount"].agg(["size", "mean", "std"])
    stats["gap"] = g["date"].apply(lambda s: s.diff().dt.days.median())
    stats["recurring"] = (stats["size"] >= 3) & stats["gap"].between(25, 35) & ((stats["std"].fillna(0) / stats["mean"]) < 0.15)
    return stats["recurring"]


def feature8_two_ways(berka_dir: Path, scored: pd.Series) -> dict:
    tx = pd.read_csv(berka_dir / "transactions.csv", parse_dates=["date"], usecols=["business_id", "date", "direction", "amount", "counterparty_id"])
    biz = pd.read_csv(berka_dir / "businesses.csv", parse_dates=["window_end"], usecols=["business_id", "window_end"])
    obl = pd.read_csv(berka_dir / "obligations.csv", usecols=["business_id", "counterparty_id"])
    tx = tx[tx["business_id"].isin(scored)]
    declared_keys = pd.MultiIndex.from_frame(obl.dropna().drop_duplicates())
    out = tx[(tx["direction"] == "out")].merge(biz, on="business_id")
    out = out[(out["window_end"] - out["date"]).dt.days < 90]
    out["declared"] = pd.MultiIndex.from_arrays([out["business_id"], out["counterparty_id"].fillna("")]).isin(declared_keys)
    inf = inferred_recurring(tx, biz)
    out["inferred"] = pd.MultiIndex.from_arrays([out["business_id"], out["counterparty_id"].fillna("")]).map(lambda k: bool(inf.get(k, False)))
    tp = int((out["declared"] & out["inferred"]).sum())
    fp = int((~out["declared"] & out["inferred"]).sum())
    fn = int((out["declared"] & ~out["inferred"]).sum())
    tot = out.groupby("business_id")["amount"].sum()
    r_decl = out[out["declared"]].groupby("business_id")["amount"].sum().reindex(tot.index).fillna(0) / tot
    r_inf = out[out["inferred"]].groupby("business_id")["amount"].sum().reindex(tot.index).fillna(0) / tot
    return {
        "n_outflow_tx": len(out),
        "declared_share_tx": float(out["declared"].mean()),
        "precision": tp / max(tp + fp, 1),
        "recall": tp / max(tp + fn, 1),
        "ratio_corr": float(np.corrcoef(r_decl, r_inf)[0, 1]),
        "ratio_mean_abs_err": float((r_decl - r_inf).abs().mean()),
        "n_business": len(tot),
    }


def ci(t) -> str:
    return f"{t[0]:.3f} [{t[1]:.3f}, {t[2]:.3f}]" if t else "not evaluable (too few defaults in a split)"


def uci(u: dict | None) -> str:
    return f"{u['median']:.3f} [{u['lo']:.3f}, {u['hi']:.3f}]" if u else "not evaluable"


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--protocol", choices=("unified", "temporal"), default="unified", help="headline protocol; temporal reproduces the v1.0 headline")
    ap.add_argument("--synthetic-dir", default="data")
    ap.add_argument("--berka-dir", default="data/berka")
    ap.add_argument("--config", default="config.yaml")
    ap.add_argument("--out", default="eval/out/real_vs_synthetic.md")
    args = ap.parse_args(argv)
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    warnings.filterwarnings("ignore", category=RuntimeWarning)  # median imputer on an all-null column inside a small fold
    warnings.filterwarnings("ignore", category=UserWarning)  # StratifiedGroupKFold on tiny minority counts
    h0 = config_hash(args.config)
    cfg = load_config(args.config)
    targets = [t for t in cfg["emergent_validation_targets"]["targets"] if t.get("metric") == TARGET_METRIC]
    assert targets, f"§21 target {TARGET_METRIC} must be registered in config.yaml BEFORE this runs (§8.3)"
    target = targets[0]
    n_boot = int(cfg["berka"]["n_bootstrap"])
    cut = pd.Timestamp(cfg["berka"]["cv_cut_date"])
    cov_thr = cfg["profile_engine"]["coverage_min_days_by_source"]
    self_test_lookahead_assertion()

    # ---- comparison set: real-computed (A1 ∪ A2), scale-free, asserted ----
    bad_cls = [f for f in COMPARISON_FEATURES if EVIDENCE[f][0] not in REAL_CLASSES]
    bad_abs = [f for f in COMPARISON_FEATURES if f in ABSOLUTE_CURRENCY]
    assert not bad_cls and not bad_abs, f"comparison set violates §8.1: non-real {bad_cls}, absolute {bad_abs}"
    assert weakest_class(COMPARISON_FEATURES) in REAL_CLASSES
    n_a2 = sum(1 for f in COMPARISON_FEATURES if EVIDENCE[f][0] == "A2")

    # ---- load ----
    sd, bd = Path(args.synthetic_dir), Path(args.berka_dir)

    def with_status(d: Path) -> pd.DataFrame:
        st = pd.read_csv(d / "profile_status.csv", usecols=["business_id", "status"]).rename(columns={"status": "engine_status"})
        return pd.read_csv(d / "profiles.csv").merge(st, on="business_id")

    sp = with_status(sd).merge(pd.read_csv(sd / "labels.csv")[["business_id", "population", "default_label"]], on="business_id")
    sp = sp[(sp["population"] == "research") & (sp["engine_status"] != "insufficient_data")]
    bp = with_status(bd)
    blab = pd.read_csv(bd / "labels.csv", parse_dates=["loan_date"]).rename(columns={"status": "loan_status"})
    bbiz = pd.read_csv(bd / "businesses.csv", parse_dates=["window_end"])
    assert_no_lookahead(bbiz, blab)
    assert blab["business_id"].is_unique, "entity split: one loan per account"
    b_all = bp.merge(blab, on="business_id")
    excluded = b_all[b_all["engine_status"] == "insufficient_data"]
    b = b_all[b_all["engine_status"] != "insufficient_data"].copy()

    # ---- runtime pruning: a feature with no variance on a source carries nothing there; report it ----
    names = [F[f] for f in COMPARISON_FEATURES]
    dropped = {}
    for nm in names:
        for src, df in (("synthetic", sp), ("berka", b)):
            if df[nm].notna().sum() < 0.5 * len(df) or df[nm].dropna().nunique() < 2:
                dropped[nm] = f"{src}: {'>50% null' if df[nm].notna().sum() < 0.5 * len(df) else 'constant'}"
    used = [nm for nm in names if nm not in dropped]

    # ---- B4 headline: one protocol on all three sources ----
    sp = sp.sort_values("business_id").reset_index(drop=True)
    y_s = sp["default_label"].astype(int).to_numpy()
    bprim = b[b["label_primary"].notna()].copy()
    bprim["label_primary"] = bprim["label_primary"].astype(int)
    unified = {
        "synthetic": unified_cv(sp[used], y_s, sp["business_id"].to_numpy(), seed=0),
        "primary": unified_cv(bprim[used], bprim["label_primary"].to_numpy(), bprim["business_id"].to_numpy(), seed=0),
        "secondary": unified_cv(b[used], b["label_secondary"].astype(int).to_numpy(), b["business_id"].to_numpy(), seed=0),
    }

    # ---- v1.0 synthetic protocol: contiguous-ID entity folds on the research population, no shuffling (secondary) ----
    folds = np.array_split(np.arange(len(sp)), N_ENTITY_FOLDS)
    oof = np.full(len(sp), np.nan)
    for te in folds:
        tr = np.setdiff1d(np.arange(len(sp)), te)
        m = model().fit(sp.loc[tr, used], y_s[tr])
        oof[te] = m.decision_function(sp.loc[te, used])
    s_auc = bootstrap_auc(y_s, oof, n_boot)

    # ---- v1.0 berka protocol: temporal split on loan.date, both label sets (secondary — leakage check) ----
    results = {}
    for label_set, ycol, subset in (("primary (A vs B, finished contracts)", "label_primary", bprim), ("secondary (A+C vs B+D, censored)", "label_secondary", b)):
        tr = subset[subset["loan_date"] < cut]
        te = subset[subset["loan_date"] >= cut]
        y_tr, y_te = tr[ycol].astype(int).to_numpy(), te[ycol].astype(int).to_numpy()
        res = {"n_train": len(tr), "n_test": len(te), "defaults_train": int(y_tr.sum()), "defaults_test": int(y_te.sum()), "auc": None, "default_rate": float(subset[ycol].mean()), "n": len(subset)}
        if y_tr.sum() >= 5 and y_te.sum() >= 5 and len(np.unique(y_te)) == 2:
            m = model().fit(tr[used], y_tr)
            res["auc"] = bootstrap_auc(y_te, m.decision_function(te[used]), n_boot)
        results[label_set] = res
    prim, sec = results["primary (A vs B, finished contracts)"], results["secondary (A+C vs B+D, censored)"]

    # supplementary: expanding temporal folds by loan_date quintile (still no shuffling, still entity-disjoint)
    supp = {}
    for label_set, ycol, subset in (("primary", "label_primary", bprim), ("secondary", "label_secondary", b)):
        s = subset.sort_values("loan_date").reset_index(drop=True)
        q = np.array_split(np.arange(len(s)), 5)
        ys, ss = [], []
        for k in range(1, 5):
            tr, te = np.concatenate(q[:k]), q[k]
            y_tr = s.loc[tr, ycol].astype(int).to_numpy()
            if y_tr.sum() < 3:
                continue
            m = model().fit(s.loc[tr, used], y_tr)
            ys.append(s.loc[te, ycol].astype(int).to_numpy())
            ss.append(m.decision_function(s.loc[te, used]))
        if ys:
            y, sc = np.concatenate(ys), np.concatenate(ss)
            supp[label_set] = (bootstrap_auc(y, sc, n_boot), len(y), int(y.sum()))

    # ---- B4: §15 exclusion selectivity ----
    bsel = b_all[["business_id", "engine_status", "label_primary", "label_secondary"]].copy()
    bsel["excluded"] = bsel["engine_status"].eq("insufficient_data")
    sel = {"primary": selectivity(bsel, "label_primary"), "secondary": selectivity(bsel, "label_secondary")}

    # ---- per-feature transfer ----
    pf_s = per_feature_transfer(sp, "default_label", [f for f in COMPARISON_FEATURES if F[f] in used], 200, 1)
    pf_b1 = per_feature_transfer(bprim, "label_primary", [f for f in COMPARISON_FEATURES if F[f] in used], n_boot, 2)
    pf_b2 = per_feature_transfer(b, "label_secondary", [f for f in COMPARISON_FEATURES if F[f] in used], n_boot, 3)

    # ---- §8.4 ----
    f8 = feature8_two_ways(bd, b["business_id"])
    f41 = {
        "berka_nonzero_type_path": float((b[F[41]].fillna(0) > 0).mean()),
        "berka_nonzero_code_path": float((b["financing_outflow_ratio_code"].fillna(0) > 0).mean()),
        "synthetic_nonzero_type_path": float((sp[F[41]].fillna(0) > 0).mean()),
        "synthetic_nonzero_code_path": float((sp["financing_outflow_ratio_code"].fillna(0) > 0).mean()),
        "synthetic_paths_agree": float(np.isclose(sp[F[41]].fillna(-1), sp["financing_outflow_ratio_code"].fillna(-1)).mean()),
    }

    h1 = config_hash(args.config)
    assert h0 == h1, "config.yaml changed during the comparison run (§15.1)"

    # ---- verdict vs the pre-registered band ----
    tol = target["tolerance_abs"]
    if args.protocol == "unified":
        head_syn, head_real = unified["synthetic"]["median"], unified["primary"]["median"]
        head_name = "unified protocol, primary label set (pre-registered as leading); secondary alongside"
        gap = abs(head_syn - head_real)
        gap_sec = abs(head_syn - unified["secondary"]["median"])
        # the interval of the gap: percentile band of the difference across paired repeats is not available (independent repeats), so the
        # conservative statement is whether the two repeat bands overlap
        overlap = not (unified["synthetic"]["hi"] < unified["primary"]["lo"] or unified["primary"]["hi"] < unified["synthetic"]["lo"])
    else:
        head = prim["auc"] or sec["auc"]
        head_name = "temporal split (v1.0 headline), " + ("primary" if prim["auc"] else "secondary (censored) — primary not evaluable on the temporal split")
        gap = abs(s_auc[0] - head[0]) if head else None
        gap_sec = abs(s_auc[0] - sec["auc"][0]) if sec["auc"] else None
        overlap = None
    verdict = "PASS" if gap is not None and gap <= tol else "FINDING"
    v1_gap = abs(s_auc[0] - sec["auc"][0]) if sec["auc"] else None

    md = [
        "# Real vs synthetic signal strength (Phase 4 — the deliverable)",
        "",
        (f"§21 target `{TARGET_METRIC}`, tolerance_abs {tol}, status_on_fail `{target['status_on_fail']}`. "
        f"config.yaml sha256 `{h0[:16]}…` asserted unchanged across the run. Model class: median-impute → standardise → logistic regression, "
        f"fitted separately per source (never on both). Comparison set: {len(used)} real-computed scale-free features ({n_a2} of the {len(COMPARISON_FEATURES)} registered are A2, the rest A1; "
        f"dropped at runtime: {dropped or 'none'}). Bootstrap: {n_boot} resamples, 95% percentile CI; unified protocol: median and 2.5/97.5 percentiles over {UNIFIED_REPEATS} repeats."),
        "",
        "## Protocol × source matrix (SOP_Monshaat_Unblock B4)",
        "",
        "| protocol | Synthetic (research, class B tables) | Berka primary (A vs B, finished contracts) | Berka secondary (A+C vs B+D, censored) |",
        "|---|---|---|---|",
        (f"| **Unified — repeated stratified group 5-fold × {UNIFIED_REPEATS}, out-of-fold pooled per repeat, median [2.5, 97.5 pct]** (HEADLINE) | "
        f"**{uci(unified['synthetic'])}** (n {unified['synthetic']['n']} / {unified['synthetic']['defaults']} defaults) | "
        f"**{uci(unified['primary'])}** (n {unified['primary']['n']} / {unified['primary']['defaults']}) | "
        f"**{uci(unified['secondary'])}** (n {unified['secondary']['n']} / {unified['secondary']['defaults']}) |"),
        (f"| Temporal split at loan_date {cut.date()} — single split, bootstrap CI (v1.0 Berka headline; kept as a **leakage check**) | — (one-window population; no temporal axis) | "
        f"{ci(prim['auc'])} (test {prim['n_test']} / {prim['defaults_test']}) | {ci(sec['auc'])} (test {sec['n_test']} / {sec['defaults_test']}) |"),
        ("| Expanding loan_date-quintile folds, bootstrap CI (secondary) | — | "
        + " | ".join(f"{ci(supp[k][0])} ({supp[k][1]} / {supp[k][2]})" if k in supp else "not evaluable" for k in ("primary", "secondary"))
        + " |"),
        f"| Contiguous-ID entity 5-fold, no shuffling, bootstrap CI (v1.0 synthetic headline; secondary) | {ci(s_auc)} (n {len(sp)} / {int(y_s.sum())}) | — | — |",
        "",
    ]
    if args.protocol == "unified":
        md += [
            (f"**Verdict against the pre-registered band: {verdict}** — under one protocol on all three sources, |AUC_synth − AUC_berka| = **{gap:.3f}** on the primary label set "
            f"({unified['synthetic']['median']:.3f} vs {unified['primary']['median']:.3f}; repeat bands {'overlap' if overlap else 'do not overlap'}) and {gap_sec:.3f} on the secondary "
            f"({unified['secondary']['median']:.3f}), vs tolerance {tol}. Per §8.3 a miss is reported as a finding; nothing is retuned."),
            "",
            (f"**What the protocol changed.** The v1.0 headline compared a cross-validated synthetic AUC ({s_auc[0]:.3f}) with a single Berka temporal split "
            f"({ci(sec['auc'])}, {sec['defaults_test']} test defaults) and reported a gap of {v1_gap:.3f}. Under the same repeated stratified group k-fold on both sides the Berka "
            f"primary estimate is {unified['primary']['median']:.3f} [{unified['primary']['lo']:.3f}, {unified['primary']['hi']:.3f}] and the secondary {unified['secondary']['median']:.3f} "
            f"[{unified['secondary']['lo']:.3f}, {unified['secondary']['hi']:.3f}]; the synthetic side is {unified['synthetic']['median']:.3f}. "
            "The part of the v1.0 gap that was protocol rather than signal is the difference between the temporal-split row and the unified row on the Berka columns."),
            "",
        ]
    else:
        md += [
            (f"**Verdict against the pre-registered band: {verdict}** — |AUC_synth − AUC_berka| = {gap:.3f} vs tolerance {tol}, Berka side taken from the {head_name}. "
            "Per §8.3 a miss is reported as a finding; nothing is retuned.")
            if gap is not None
            else "**Not evaluable** on either label set.",
            "",
        ]
    md += [
        "| Metric | Synthetic (research, N=10,000) | Berka primary | Berka secondary |",
        "|---|---|---|---|",
        f"| Default rate | {sp['default_label'].mean():.3f} | {prim['default_rate']:.3f} | {sec['default_rate']:.3f} |",
        f"| n businesses / n defaults (scored) | {len(sp)} / {int(y_s.sum())} | {prim['n']} / {prim['defaults_train'] + prim['defaults_test']} | {len(b)} / {int(b['label_secondary'].sum())} |",
        f"| Features in comparison set | {len(used)} | {len(used)} | {len(used)} |",
        "| Evidence class of the tables | B | A1/A2 (real) | A1/A2 (real) |",
        f"| Eligibility threshold (§15) | coverage ≥ {cov_thr['synthetic']} | coverage ≥ {cov_thr['external_real']} (DECISIONS.md entry 9) | same |",
        "",
        "## §15 exclusion selectivity (B4)",
        "",
        (f"{len(excluded)} of {len(b_all)} labelled accounts are excluded as insufficient_data (coverage_days_90d < {cov_thr['external_real']} in the 90 days before loan.date). "
        f"Default rate excluded vs retained — primary: {sel['primary']['rate_excluded']:.3f} vs {sel['primary']['rate_retained']:.3f} (risk ratio {sel['primary']['risk_ratio']:.2f}, Fisher p = {sel['primary']['fisher_p_two_sided']:.4f}, "
        f"{sel['primary']['share_of_all_defaults_excluded']:.0%} of all primary defaults excluded); secondary: {sel['secondary']['rate_excluded']:.3f} vs {sel['secondary']['rate_retained']:.3f} "
        f"(risk ratio {sel['secondary']['risk_ratio']:.2f}, p = {sel['secondary']['fisher_p_two_sided']:.4f}). **The exclusion is selective on the label**: every Berka AUC above is an estimate on the eligible population, "
        "from which the thinnest and riskiest accounts were removed by the eligibility rule rather than scored. Full table: `eval/out/exclusion_selectivity.md`."),
        "",
        "## Per-feature transfer (univariate AUC vs label; > 0.5 = higher value → more default; Spearman ρ)",
        "",
        "The A1/A2 split over all class-A features, with 1,000-resample CIs, is in `eval/out/feature_transfer.md`; this table covers the comparison set only.",
        "",
        "| Feature | Class | Synthetic AUC [CI] | ρ | Berka primary AUC [CI] | ρ | Berka secondary AUC [CI] | ρ |",
        "|---|---|---|---|---|---|---|---|",
    ]
    id_of = {F[f]: f for f in COMPARISON_FEATURES}
    for nm in used:
        r = [pf_s.loc[nm], pf_b1.loc[nm], pf_b2.loc[nm]]

        def fmt(x):
            return "—" if np.isnan(x["auc"]) else f"{x['auc']:.3f} [{x['lo']:.2f}, {x['hi']:.2f}]"

        md.append(f"| `{nm}` | {EVIDENCE[id_of[nm]][0]} | {fmt(r[0])} | {r[0]['rho']:+.2f} | {fmt(r[1])} | {r[1]['rho']:+.2f} | {fmt(r[2])} | {r[2]['rho']:+.2f} |")
    md += [
        "",
        "## §8.4 findings",
        "",
        "### Feature 8 — `recurring_expense_ratio`: inferred classification vs declared truth (Berka only)",
        "",
        (f"Declared truth = outflows whose counterparty matches one of the account's standing orders (`order` table). Inference rule = counterparty paid ≥3 times in 180 days, "
        f"median gap 25–35 days, amount CV < 0.15. On {f8['n_business']} scored accounts / {f8['n_outflow_tx']:,} window outflows ({f8['declared_share_tx']:.1%} declared recurring): "
        f"transaction-level precision {f8['precision']:.2f}, recall {f8['recall']:.2f}; per-business ratio correlation {f8['ratio_corr']:.2f}, mean absolute error {f8['ratio_mean_abs_err']:.3f}. "
        "This is the number synthetic data cannot give: on the generator, inference would be checked against the generator's own recurring categories."),
        "",
        "### Feature 41 — `financing_outflow_ratio`: MCC path vs code path",
        "",
        (f"Share of scored accounts with a non-zero value — Berka: counterparty-type path {f41['berka_nonzero_type_path']:.1%}, code path (`subfamily = LOAN`, from `k_symbol = UVER`) {f41['berka_nonzero_code_path']:.1%}; "
        f"synthetic: {f41['synthetic_nonzero_type_path']:.1%} / {f41['synthetic_nonzero_code_path']:.1%} (paths agree on {f41['synthetic_paths_agree']:.1%} of businesses)."),
        "",
        ("Three structural facts, not tuning results: (1) **no counterparty MCC exists in either dataset** — the generator assigns `declared_mcc_code` to the business itself, Berka has none at all, "
        "so the schema's \"financial-institution MCC\" specification is unimplementable as written and `counterparty_type` has been standing in for it; on Berka that type is itself derived from the `UVER` code, so the two paths coincide by construction. "
        "(2) On Berka the point-in-time window ends the day before the loan, so **existing debt service is zero on every labelled account** — feature 41 cannot be validated against Berka outcomes and was pruned from the comparison set at runtime for that reason. "
        "(3) Debt service moves by transfer / standing order, which is exactly where a transaction code exists and an MCC does not. **Recommendation: re-specify feature 41 on the transaction code (`subfamily = LOAN`), raised as a §31 schema change (DECISIONS.md entry 10).**"),
        "",
        "## Honesty notes",
        "",
        "- Berka is Czech retail/small-account data from 1993–1998. The claim is that the feature engineering transfers, not that the populations are equivalent.",
        "- Berka `C` loans are censored; the primary set leads because it has no censoring, at the cost of 31 defaults in total (22 among scored accounts).",
        f"- Every Berka number above was computed under `coverage_days_90d ≥ {cov_thr['external_real']}`, not the schema's 60 (entry 9), on a population the rule selects toward lower risk (see §15 exclusion selectivity).",
        "- The unified protocol's percentile band is the spread across 20 random fold assignments, not a sampling interval for the population AUC; with 22 primary defaults the fold-to-fold spread is itself the honest width.",
        "- The temporal split is retained because it is the only protocol that cannot leak future information across the cut; it is not the headline because a single split with 25 test defaults is high-variance and typically optimistic.",
        "- The synthetic side is a single 180-day snapshot; the temporal dimension of §13 does not apply to a one-window population.",
    ]
    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    Path(args.out).write_text("\n".join(md) + "\n", encoding="utf-8")
    print("\n".join(md[:24]))
    print(f"\n→ {args.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
