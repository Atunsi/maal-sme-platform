"""SOP_Monshaat_Unblock B1 + B2 — apply the two mechanical reclassification rules. No judgement, no values changed.

    python -m calibration.reclass_evidence [--check]

B1  Reads eval/out/feature_transfer.json (per-feature Berka AUC + bootstrap CI, both label sets) and
    writes profile_engine/feature_transfer.json: the A1 / A2 subclass per class-A feature.
        A2 ⇔ the 95% CI of the univariate AUC excludes 0.50 on ≥ 1 label set; else A1.
    `profile_engine/evidence.py` reads that file at import; the registry never carries a hand-typed A2.

B2  Reads calibration/out/phase2_seasonality.json (the ≤2023 fits with leave-one-year-out CIs) and
    rewrites the `seasonality_value_multiplier` / `seasonality_count_multiplier` blocks of config.yaml
    for the two measured sectors — SAME VALUES (asserted equal to the measured ones first), with a
    per-window label and the CI carried as data, not only as a comment:
        B      ⇔ the CI excludes 1.0
        B-weak ⇔ the CI contains 1.0 (measured, applied, not claimed as grounded)
    Construction and professional services keep `evidence_class: C`.

--check verifies both without writing (exit 1 on any label that the rule would set differently).

Generator parameters are untouched: `calibration.check_config` prints a generator-parameter hash
(config with `evidence_class`, `ci95` and the §21 block removed) that must be identical before and
after this script runs.
"""

from __future__ import annotations

import argparse
import json
import re
import sys

from calibration import sources as S
from generator.generate import load_config

WINDOWS = ("pre_ramadan_10d", "ramadan", "eid", "post_eid_7d")
MEASURED = ("retail_trade", "food_beverage")
UNMEASURED = ("construction", "professional_services")
BLOCKS = (("seasonality_value_multiplier", "ci95_value"), ("seasonality_count_multiplier", "ci95_count"))
TRANSFER_SRC = S.REPO / "eval" / "out" / "feature_transfer.json"
TRANSFER_DST = S.REPO / "profile_engine" / "feature_transfer.json"
CONFIG = S.REPO / "config.yaml"


def window_class(ci: list[float]) -> str:
    lo, hi = float(ci[0]), float(ci[1])
    return "B" if (lo > 1.0 or hi < 1.0) else "B-weak"


def _pick(label_sets: dict, k: str) -> dict | None:
    x = label_sets.get(k)
    return None if not x or x.get("status") != "ok" else {"auc": round(x["auc"], 3), "ci95": [round(x["lo"], 3), round(x["hi"], 3)], "excludes_0.5": x["ci_excludes_0.5"]}


def b1_payload() -> dict:
    src = json.loads(TRANSFER_SRC.read_text(encoding="utf-8"))
    feats = {}
    for fid, r in src["features"].items():
        ls = r["label_sets"]
        feats[fid] = {"feature": r["feature"], "subclass": r["subclass"], "qualifying_label_sets": r["qualifying_label_sets"], "primary": _pick(ls, "primary"), "secondary": _pick(ls, "secondary")}
    return {"run_at": src["run_at"], "rule": src["rule"], "n_boot": src["n_boot"], "population": src["population"], "counts": src["counts"], "features": feats}


def b2_block(cfg: dict, seas: dict, block: str, ci_key: str) -> tuple[str, list[str]]:
    """Render one seasonality block in YAML block style from the measured JSON; returns (text, labels-as-set)."""
    lines = [f"{block}:"]
    labels = []
    for sector in MEASURED:
        pc = seas[sector]["proposed_config"]
        vals, cis = pc[block], pc[ci_key]
        for w in WINDOWS:
            assert abs(float(cfg[block][sector][w]) - float(vals[w])) < 1e-9, f"{block}.{sector}.{w}: config {cfg[block][sector][w]} != measured {vals[w]} — values are never changed here"
        cls = {w: window_class(cis[w]) for w in WINDOWS}
        labels += [f"{block}.{sector}.{w}={cls[w]}" for w in WINDOWS]
        lines.append(f"  {sector}:")
        for w in WINDOWS:
            lo, hi = cis[w]
            lines.append(f"    {w + ':':17s}{vals[w]:.2f}   # CI [{lo:.2f}, {hi:.2f}] {'contains 1.0 → B-weak' if cls[w] == 'B-weak' else 'excludes 1.0 → B'}")
        lines.append("    evidence_class: { " + ", ".join(f"{w}: {cls[w]}" for w in WINDOWS) + " }")
        lines.append("    ci95: { " + ", ".join(f"{w}: [{cis[w][0]:.2f}, {cis[w][1]:.2f}]" for w in WINDOWS) + " }")
    for sector in UNMEASURED:
        v = cfg[block][sector]
        note = "unchanged judgement; POS does not measure contractor revenue" if sector == "construction" else "unchanged judgement; no POS line"
        if block == "seasonality_count_multiplier":
            note = "count seasonality of B2B receipts unmeasured"
        lines.append(f"  {sector + ':':23s}{{ " + ", ".join(f"{w}: {float(v[w]):.2f}" for w in WINDOWS) + ", evidence_class: C }  # " + note)
    return "\n".join(lines) + "\n", labels


def current_labels(cfg: dict) -> list[str]:
    out = []
    for block, _ in BLOCKS:
        for sector in MEASURED:
            ec = cfg[block][sector].get("evidence_class")
            for w in WINDOWS:
                out.append(f"{block}.{sector}.{w}={ec[w] if isinstance(ec, dict) else ec}")
    return out


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--check", action="store_true")
    args = ap.parse_args(argv)
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    bad = 0

    # ---- B1 ----
    if TRANSFER_SRC.exists():
        payload = b1_payload()
        if args.check:
            have = json.loads(TRANSFER_DST.read_text(encoding="utf-8"))["features"] if TRANSFER_DST.exists() else {}
            diff = [k for k, v in payload["features"].items() if have.get(k, {}).get("subclass") != v["subclass"]]
            print(f"B1: {payload['counts']} — {'registry file matches' if not diff else 'MISMATCH on ' + str(diff)}")
            bad += bool(diff)
        else:
            TRANSFER_DST.write_text(json.dumps(payload, indent=1) + "\n", encoding="utf-8")
            print(f"B1: wrote {TRANSFER_DST.relative_to(S.REPO)} — A2 {payload['counts']['A2']}, A1 {payload['counts']['A1']} of {payload['counts']['A']} class-A features (rule: {payload['rule']})")
    else:
        print("B1: eval/out/feature_transfer.json missing — run `python -m eval.feature_transfer` first")
        bad += 1

    # ---- B2 ----
    cfg = load_config(str(CONFIG))
    seas = S.read_out("phase2_seasonality")["generator"]
    text = CONFIG.read_text(encoding="utf-8")
    new_text, wanted = text, []
    for block, ci_key in BLOCKS:
        rendered, labels = b2_block(cfg, seas, block, ci_key)
        wanted += labels
        pat = re.compile(rf"^{block}:\n(?:  .*\n|\n(?=  ))*", re.MULTILINE)
        m = pat.search(new_text)
        assert m, f"{block} block not found in config.yaml"
        new_text = new_text[: m.start()] + rendered + new_text[m.end() :]
    have = current_labels(cfg)
    n_weak = sum(1 for x in wanted if x.endswith("=B-weak"))
    if args.check:
        diff = sorted(set(wanted) - set(have))
        print(f"B2: {n_weak} of {len(wanted)} measured parameters are B-weak by the CI rule — {'config labels match' if not diff else 'MISMATCH: ' + str(diff)}")
        bad += bool(diff)
    else:
        CONFIG.write_text(new_text, encoding="utf-8")
        print(f"B2: rewrote the two seasonality blocks in config.yaml — {n_weak} of {len(wanted)} measured parameters labelled B-weak (CI contains 1.0), {len(wanted) - n_weak} B; values unchanged, CI carried as `ci95`")
        for x in wanted:
            print("   ", x)
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
