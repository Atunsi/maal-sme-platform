"""§13.4 — sensitivity analysis replaces validation for class-C features.

    python -m eval.sensitivity --parameter ungrounded.credit_facilities.utilisation_by_latent_risk [--dir data]
    python -m eval.sensitivity --all

For each class-C parameter the governed features are re-synthesised at a low,
central (config) and high setting on the SAME base tables (the dimensions are
additive, so nothing else moves), and the downstream metrics are reported as a
range: univariate AUC of the feature against default_label and Spearman ρ
against the hidden latent risk index, research population. A class-C feature
reported at a single parameter value with a single performance number is the
failure mode this exists to prevent.
"""

from __future__ import annotations

import argparse
import copy
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from scipy.stats import spearmanr
from sklearn.metrics import roc_auc_score

from generator import dimensions
from generator.generate import load_config
from profile_engine import features as fe
from profile_engine.registry import FEATURE_NAMES

F = FEATURE_NAMES

# parameter path → low / high settings and the class-C features it governs. Central = config value.
SWEEPS: dict[str, dict] = {
    "ungrounded.credit_facilities.utilisation_by_latent_risk": {"low": [0.05, 0.40], "high": [0.05, 0.99], "features": [66, 69]},
    "ungrounded.credit_facilities.share_with_facility": {"low": 0.15, "high": 0.70, "features": [66, 69]},
    "ungrounded.credit_facilities.emergency_line_appears_if_utilisation_above": {"low": 0.70, "high": 0.99, "features": [69]},
    "ungrounded.direct_debits.cancellation_prob_90d_by_latent_risk": {"low": [0.02, 0.08], "high": [0.02, 0.60], "features": [64]},
    "ungrounded.direct_debits.share_of_businesses": {"low": 0.25, "high": 0.85, "features": [60, 61, 64]},
    "ungrounded.obligations.balloon_share_of_loans": {"low": 0.05, "high": 0.50, "features": [65]},
}


def set_path(cfg: dict, path: str, value) -> dict:
    c = copy.deepcopy(cfg)
    node = c
    keys = path.split(".")
    for k in keys[:-1]:
        node = node[k]
    node[keys[-1]] = value
    return c


def get_path(cfg: dict, path: str):
    node = cfg
    for k in path.split("."):
        node = node[k]
    return node


def load_base(d: Path) -> dict[str, pd.DataFrame]:
    t = {
        "daily_aggregates": pd.read_csv(d / "daily_aggregates.csv", usecols=["business_id", "date", "outflow_total", "eod_balance"], parse_dates=["date"]),
        "businesses": pd.read_csv(d / "businesses.csv", parse_dates=["start_date", "window_end", "operating_start_date"], dtype={"declared_mcc_code": "Int64"}),
        "latents_hidden": pd.read_csv(d / "latents_hidden.csv"),
        "labels": pd.read_csv(d / "labels.csv"),
    }
    parts = []
    for chunk in pd.read_csv(d / "transactions.csv", usecols=["business_id", "date", "amount", "category", "counterparty_id"], parse_dates=["date"], chunksize=2_000_000):
        parts.append(chunk[chunk["category"].isin([*dimensions.RECURRING_CATEGORY_CP, "supplier"])])
    t["transactions"] = pd.concat(parts, ignore_index=True)
    return t


def class_c_features(cfg: dict, tables: dict[str, pd.DataFrame]) -> pd.DataFrame:
    ext = dimensions.extend(cfg, tables, with_subfields=False)
    biz = tables["businesses"]
    ob = fe.obligation_features(ext["obligations"], biz).set_index("business_id")
    fac = ext["facilities"].set_index("business_id")
    out = pd.DataFrame(index=biz["business_id"])
    out[F[60]] = ob[F[60]].fillna(0.0)
    inflow = tables["daily_aggregates"].groupby("business_id")["outflow_total"].sum()  # proxy scale only for 61 in this harness
    out[F[61]] = (inflow.reindex(out.index) / 6.0) / out[F[60]].replace(0, np.nan)
    out[F[64]] = ob[F[64]].fillna(0.0)
    out[F[65]] = ob[F[65]].fillna(0.0)
    has = fac["facility_type"] != "none"
    out[F[66]] = (fac["facility_drawn"] / fac["facility_limit"].where(has)).reindex(out.index)
    out[F[69]] = fac["facility_type"].isin(["emergency", "temporary"]).astype(float).reindex(out.index)
    return out


def metrics(feat: pd.DataFrame, tables: dict[str, pd.DataFrame], fids: list) -> list[dict]:
    biz = tables["businesses"]
    research = biz.loc[biz["population"] == "research", "business_id"]
    y = tables["labels"].set_index("business_id")["default_label"].reindex(research)
    lat = tables["latents_hidden"].set_index("business_id")["latent_risk_index"].reindex(research)
    rows = []
    for fid in fids:
        x = feat[F[fid]].reindex(research)
        ok = x.notna()
        if ok.sum() < 30 or x[ok].nunique() < 2:
            rows.append({"feature": F[fid], "n": int(ok.sum()), "auc": np.nan, "rho_latent": np.nan, "nonzero_share": float((x.fillna(0) != 0).mean())})
            continue
        rows.append(
            {
                "feature": F[fid],
                "n": int(ok.sum()),
                "auc": float(roc_auc_score(y[ok], x[ok])) if y[ok].nunique() == 2 else np.nan,
                "rho_latent": float(spearmanr(x[ok], lat[ok]).statistic),
                "nonzero_share": float((x.fillna(0) != 0).mean()),
            }
        )
    return rows


def run_parameter(param: str, cfg: dict, tables: dict, out_dir: Path) -> Path:
    spec = SWEEPS[param]
    central = get_path(cfg, param)
    md = [f"# Sensitivity — `{param}` (§13.4)", "", f"Central = config value `{central}`; low `{spec['low']}`; high `{spec['high']}`. Research population; AUC vs default_label; ρ vs hidden latent risk. Class C: a RANGE, never a single number.", ""]
    md += ["| Setting | Value | Feature | n | AUC vs default | ρ vs latent | non-zero share |", "|---|---|---|---|---|---|---|"]
    table = {}
    for setting, value in (("low", spec["low"]), ("central", central), ("high", spec["high"])):
        feat = class_c_features(set_path(cfg, param, value), tables)
        for r in metrics(feat, tables, spec["features"]):
            table.setdefault(r["feature"], {})[setting] = r
            md.append(f"| {setting} | `{value}` | `{r['feature']}` | {r['n']} | {r['auc']:.3f} | {r['rho_latent']:+.3f} | {r['nonzero_share']:.2f} |")
    md += ["", "## Reading", ""]
    for feat, s in table.items():
        aucs = [s[k]["auc"] for k in ("low", "central", "high") if not np.isnan(s[k]["auc"])]
        if len(aucs) >= 2:
            spread = max(aucs) - min(aucs)
            verdict = "stable — the conclusion does not depend on the invented number" if spread < 0.03 else "moves — the feature is sensitive to an unvalidated assumption; say so"
            md.append(f"- `{feat}`: AUC range {min(aucs):.3f}–{max(aucs):.3f} (spread {spread:.3f}) → {verdict}.")
    path = out_dir / f"sensitivity_{param.replace('.', '_')}.md"
    path.write_text("\n".join(md) + "\n", encoding="utf-8")
    print("\n".join(md))
    return path


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--parameter", help="config path of a class-C parameter (see SWEEPS)")
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--dir", default="data")
    ap.add_argument("--config", default="config.yaml")
    ap.add_argument("--out-dir", default="eval/out")
    args = ap.parse_args(argv)
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    params = list(SWEEPS) if args.all else [args.parameter]
    if not params or params == [None]:
        ap.error("--parameter or --all")
    for p in params:
        assert p in SWEEPS, f"unknown parameter {p}; known: {list(SWEEPS)}"
        assert p.startswith("ungrounded."), "only class-C parameters get a sensitivity sweep (§13.4)"
    cfg = load_config(args.config)
    print(f"loading base tables from {Path(args.dir).resolve()} …", flush=True)
    tables = load_base(Path(args.dir))
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    for p in params:
        run_parameter(p, cfg, tables, out_dir)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
