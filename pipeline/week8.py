"""Week 8 demoable (schema §9): ingest the tables, run the shared profile engine,
output ONE JSON object per business with every lens's result.

    python -m pipeline.week8 --demo                          # demo businesses 10001-10003
    python -m pipeline.week8 --business-id 10001 10002       # any businesses
    python -m pipeline.week8 --demo --out week8_demo.json

Each object contains (§9):
  * credit decision         §11 contract — base_markup_pct present, adjusted_markup_pct null
  * cash-flow forecast + crunch alert
  * anomaly flags           flag_reason only, never scores (§29)
  * Zakat liability         deterministic, nisab/hawl-aware (§17)
  * status                  scored | partial_profile | insufficient_data — a distinct state,
                            never a silent null (§15). On insufficient_data no lens runs.

Lenses run independently off the same profile; none reads another's output (§8).
Everything is deterministic, so a re-run reproduces the JSON byte for byte; the
`receipt` block carries the hashes needed to check that.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path

import pandas as pd

from compliance.sharia import compliance_explanation, load_rules, screen
from generator.generate import load_config
from lenses import LENS_CONFIG_PATH, load_lens_config
from lenses.anomaly.anomaly import detect
from lenses.credit.model import apply_sharia_gate, decide, load_artifact
from lenses.forecast.forecast import forecast
from lenses.zakat.zakat import compute_zakat
from pipeline.data import load_tables, run_profiles
from profile_engine import features as fe

DEMO_IDS = [10001, 10002, 10003]


INPUT_TABLES = ("businesses", "daily_aggregates", "balances_monthly", "transactions", "obligations", "facilities")


def _sha(path: str | Path) -> str:
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def output_sha256(obj: dict) -> str:
    """Hash of a decision object excluding its receipt — what 'byte-identical' is checked on."""
    body = {k: v for k, v in obj.items() if k != "receipt"}
    return hashlib.sha256(json.dumps(body, sort_keys=True, default=str).encode()).hexdigest()


def data_sha256(tables: dict, b_id: int) -> str:
    """Hash of exactly the input rows this business's decision was computed from, in file order."""
    h = hashlib.sha256()
    for name in INPUT_TABLES:
        t = tables.get(name)
        if t is None:
            continue
        h.update(name.encode())
        h.update(t[t["business_id"] == b_id].to_csv(index=False, date_format="%Y-%m-%d").encode())
    return h.hexdigest()


def code_commit() -> str | None:
    """Git commit of the code that produced the decision; '+dirty' if uncommitted changes were present."""
    try:
        head = subprocess.run(["git", "rev-parse", "HEAD"], capture_output=True, text=True, check=True).stdout.strip()
        dirty = subprocess.run(["git", "status", "--porcelain", "--untracked-files=no"], capture_output=True, text=True, check=True).stdout.strip()
        return head + ("+dirty" if dirty else "")
    except (OSError, subprocess.CalledProcessError):
        return None


RECEIPT_SCOPE = (
    "Covers the deterministic core only: re-running with these inputs reproduces this object "
    "byte for byte (verify: python -m pipeline.verify <file>). Any generated advisory text is "
    "outside its scope and cannot affect the decision (§36)."
)


@dataclass
class Context:
    """Everything loaded once per process: config, lens config, model, §35 reference-stats hash."""

    cfg: dict
    lc: dict
    art: dict
    ref_hash: str | None
    demo: dict
    receipt_base: dict


def make_context(generated_by: str = "pipeline.week8") -> Context:
    cfg = load_config()
    lc = load_lens_config()
    art = load_artifact(str(lc["credit"]["model_artifact"]))
    _, ref_hash = fe.load_reference_stats()
    receipt_base = {
        "schema_version": cfg.get("schema_version"),
        "config_sha256": _sha("config.yaml"),
        "lens_config_sha256": _sha(LENS_CONFIG_PATH),
        "credit_model_version": art["version"],
        "credit_model_sha256": art.get("sha256"),
        "credit_model_cv_auc": round(art["cv"]["median"], 4),
        "credit_model_oracle_ceiling_auc": round(art["oracle_ceiling_auc"], 4),
        "reference_stats_sha256": ref_hash,  # §35 pinned sector table — never recomputed at serving
        "sharia_rules_sha256": load_rules()[1],  # feature 24 rule table (compliance/sharia_rules.yaml)
        "code_commit": code_commit(),
        "generated_by": generated_by,
    }
    return Context(cfg, lc, art, ref_hash, {x["id"]: x for x in cfg.get("demo_businesses", [])}, receipt_base)


@dataclass
class Prepared:
    """One load + one profile-engine run, covering any number of businesses."""

    tables: dict
    feats: pd.DataFrame
    status: pd.DataFrame
    nulls: pd.DataFrame
    data_hash: dict[int, str]
    screens: dict[int, dict]

    def biz(self, b_id: int):
        b = self.tables["businesses"]
        return next(b[b["business_id"] == b_id].itertuples(index=False))

    def rows(self, name: str, b_id: int) -> pd.DataFrame:
        t = self.tables[name]
        return t[t["business_id"] == b_id]


def prepare(ctx: Context, tables: dict) -> Prepared:
    data_hash = {int(b): data_sha256(tables, int(b)) for b in tables["businesses"]["business_id"]}  # before the engine touches anything
    prof = run_profiles(tables, ctx.cfg)
    feats, nulls = prof["features"].set_index("business_id"), prof["nulls"]

    # Feature 24 — Sharia screening (compliance/sharia.py). Computed for every business,
    # including insufficient_data ones: it screens activity and income, not coverage.
    # Written into the shared profile so the credit lens reads it like any other feature (§8).
    rules, rules_sha = load_rules()
    tx = tables["transactions"]
    screens = {}
    for b in tables["businesses"].itertuples(index=False):
        b_id = int(b.business_id)
        screens[b_id] = screen(b.sector, b.declared_mcc_code, tx[tx["business_id"] == b_id], rules, rules_sha)
    feats = feats.astype({"sharia_screen_status": object})
    for b_id, scr in screens.items():
        feats.loc[b_id, "sharia_screen_status"] = scr["sharia_screen_status"]
    nulls = nulls[~((nulls["feature"] == "sharia_screen_status") & (nulls["reason"] == "not_implemented"))].reset_index(drop=True)
    return Prepared(tables, feats, prof["status"].set_index("business_id"), nulls, data_hash, screens)


def header(p: Prepared, b_id: int) -> dict:
    b, st = p.biz(b_id), p.status.loc[b_id]
    out = {
        "business_id": b_id,
        "population": b.population,
        "data_source": b.data_source,
        "sector": b.sector,
        "as_of": pd.Timestamp(b.window_end).date().isoformat(),
        "status": st["status"],
        "coverage_days_90d": int(st["coverage_days_90d"]),
    }
    if st["status"] == "partial_profile":
        n = p.nulls
        out["partial_profile_unavailable_features"] = n[(n["business_id"] == b_id) & (n["reason"] == "insufficient_history")]["feature"].tolist()
    return out


def scorable(p: Prepared, b_id: int) -> bool:
    return p.status.loc[b_id, "status"] != "insufficient_data"  # §15: no lens runs otherwise


def sharia_section(p: Prepared, b_id: int) -> dict:
    scr = p.screens[b_id]
    return {**scr, "compliance_explanation": compliance_explanation(scr)}


def credit_section(ctx: Context, p: Prepared, b_id: int) -> dict:
    scr = p.screens[b_id]
    c = apply_sharia_gate(decide(p.feats.loc[b_id], ctx.lc["credit"], ctx.art), scr, compliance_explanation(scr))
    return {"credit": c["credit"], "credit_explanation": c["explanation"], "credit_decision_detail": c["internals"]}


def forecast_section(ctx: Context, p: Prepared, b_id: int) -> dict:
    return forecast(p.rows("daily_aggregates", b_id), pd.Timestamp(p.biz(b_id).window_end), p.feats.loc[b_id], ctx.lc["forecast"])


def anomaly_section(ctx: Context, p: Prepared, b_id: int) -> dict:
    return detect(p.rows("transactions", b_id), pd.Timestamp(p.biz(b_id).window_end), ctx.lc["anomaly"])


def zakat_section(ctx: Context, p: Prepared, b_id: int) -> dict:
    b = p.biz(b_id)
    seed = ctx.demo.get(b_id, {}).get("zakat_seed")
    return compute_zakat(
        p.rows("balances_monthly", b_id), pd.Timestamp(b.window_end), ctx.lc["zakat"],
        pd.Timestamp(seed["hawl_start_date"]) if seed else None,
        float(seed["opening_net_assets_sar"]) if seed else None,
        pd.Timestamp(b.operating_start_date),
    )


def receipt(ctx: Context, p: Prepared, b_id: int, obj: dict) -> dict:
    return {**ctx.receipt_base, "data_sha256": p.data_hash[b_id], "output_sha256": output_sha256(obj), "scope": RECEIPT_SCOPE}


def decision_object(ctx: Context, p: Prepared, b_id: int) -> dict:
    """The full Week 8 object for one business (§9)."""
    obj = header(p, b_id)
    if not scorable(p, b_id):
        obj.update({
            "lenses_not_run_reason": "insufficient_data",
            "credit": None, "credit_explanation": None, "credit_decision_detail": None,
            "forecast": None, "anomaly": None, "zakat": None,
        })
    else:
        obj.update(credit_section(ctx, p, b_id))
        obj["forecast"] = forecast_section(ctx, p, b_id)
        obj["anomaly"] = anomaly_section(ctx, p, b_id)
        obj["zakat"] = zakat_section(ctx, p, b_id)
    obj["governance"] = {"sharia_screen": sharia_section(p, b_id)}  # feature 24, deterministic (compliance/sharia.py)
    obj["receipt"] = receipt(ctx, p, b_id, obj)
    return obj


def build_objects(d: str | Path, business_ids: list[int]) -> list[dict]:
    ctx = make_context()
    p = prepare(ctx, load_tables(d, business_ids))
    return [decision_object(ctx, p, int(b)) for b in sorted(p.tables["businesses"]["business_id"])]


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dir", default="data")
    ap.add_argument("--business-id", type=int, nargs="+", default=None)
    ap.add_argument("--demo", action="store_true", help=f"the demo businesses {DEMO_IDS}")
    ap.add_argument("--out", default=None, help="write JSON here instead of stdout")
    args = ap.parse_args(argv)
    ids = args.business_id or (DEMO_IDS if args.demo else None)
    if not ids:
        ap.error("give --business-id ... or --demo")
    objs = build_objects(args.dir, ids)
    text = json.dumps(objs[0] if len(objs) == 1 else objs, indent=2, ensure_ascii=False, default=str)
    if args.out:
        Path(args.out).write_text(text, encoding="utf-8")
        print(f"wrote {len(objs)} object(s) -> {args.out}", file=sys.stderr)
    else:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        print(text)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
