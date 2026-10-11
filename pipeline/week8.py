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
from pathlib import Path

import pandas as pd

from generator.generate import load_config
from lenses import LENS_CONFIG_PATH, load_lens_config
from lenses.anomaly.anomaly import detect
from lenses.credit.model import decide, load_artifact
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


def build_objects(d: str | Path, business_ids: list[int]) -> list[dict]:
    cfg = load_config()
    lc = load_lens_config()
    art = load_artifact(str(lc["credit"]["model_artifact"]))
    tables = load_tables(d, business_ids)
    data_hash = {int(b): data_sha256(tables, int(b)) for b in tables["businesses"]["business_id"]}  # before the engine touches anything
    prof = run_profiles(tables, cfg)
    _, ref_hash = fe.load_reference_stats()

    feats = prof["features"].set_index("business_id")
    status = prof["status"].set_index("business_id")
    nulls = prof["nulls"]
    demo = {x["id"]: x for x in cfg.get("demo_businesses", [])}
    receipt_base = {
        "schema_version": cfg.get("schema_version"),
        "config_sha256": _sha("config.yaml"),
        "lens_config_sha256": _sha(LENS_CONFIG_PATH),
        "credit_model_version": art["version"],
        "credit_model_sha256": art.get("sha256"),
        "credit_model_cv_auc": round(art["cv"]["median"], 4),
        "credit_model_oracle_ceiling_auc": round(art["oracle_ceiling_auc"], 4),
        "reference_stats_sha256": ref_hash,  # §35 pinned sector table — never recomputed at serving
        "code_commit": code_commit(),
        "generated_by": "pipeline.week8",
    }

    objects = []
    for b in tables["businesses"].sort_values("business_id").itertuples(index=False):
        b_id = int(b.business_id)
        as_of = pd.Timestamp(b.window_end)
        st = status.loc[b_id]
        row = feats.loc[b_id]
        obj = {
            "business_id": b_id,
            "population": b.population,
            "data_source": b.data_source,
            "sector": b.sector,
            "as_of": as_of.date().isoformat(),
            "status": st["status"],
            "coverage_days_90d": int(st["coverage_days_90d"]),
        }

        if st["status"] == "insufficient_data":
            # §15: an explicit refusal to score, before any lens runs.
            obj.update({
                "lenses_not_run_reason": "insufficient_data",
                "credit": None, "credit_explanation": None, "credit_decision_detail": None,
                "forecast": None, "anomaly": None, "zakat": None,
            })
        else:
            if st["status"] == "partial_profile":
                miss = nulls[(nulls["business_id"] == b_id) & (nulls["reason"] == "insufficient_history")]["feature"].tolist()
                obj["partial_profile_unavailable_features"] = miss

            c = decide(row, lc["credit"], art)
            obj["credit"] = c["credit"]
            obj["credit_explanation"] = c["explanation"]
            obj["credit_decision_detail"] = c["internals"]

            daily_b = tables["daily_aggregates"][tables["daily_aggregates"]["business_id"] == b_id]
            obj["forecast"] = forecast(daily_b, as_of, row, lc["forecast"])

            tx_b = tables["transactions"][tables["transactions"]["business_id"] == b_id]
            obj["anomaly"] = detect(tx_b, as_of, lc["anomaly"])

            seed = demo.get(b_id, {}).get("zakat_seed")
            bal_b = tables["balances_monthly"][tables["balances_monthly"]["business_id"] == b_id]
            obj["zakat"] = compute_zakat(
                bal_b, as_of, lc["zakat"],
                pd.Timestamp(seed["hawl_start_date"]) if seed else None,
                float(seed["opening_net_assets_sar"]) if seed else None,
                pd.Timestamp(b.operating_start_date),
            )

        obj["governance"] = {
            "sharia_screen_status": None,
            "sharia_screen_reason": "not_implemented",  # compliance module not built yet (feature 24)
        }
        obj["receipt"] = {
            **receipt_base,
            "data_sha256": data_hash[b_id],
            "output_sha256": output_sha256(obj),
            "scope": (
                "Covers the deterministic core only: re-running with these inputs reproduces this object "
                "byte for byte (verify: python -m pipeline.verify <file>). Any generated advisory text is "
                "outside its scope and cannot affect the decision (§36)."
            ),
        }
        objects.append(obj)
    return objects


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
