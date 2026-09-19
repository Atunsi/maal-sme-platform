"""Drift check — every measured value in config.yaml must equal what calibration/out/*.json measured.

    python -m calibration.check_config

Exit 1 on any mismatch. This is the structural guard SOP_Saudi_Calibration §12.1 asks for: a
calibrated parameter that is edited by hand later stops matching its source edition, and this
script says so. Parameters whose phase is blocked (sector mix, financing index) are reported as
"judgement — unchanged", not checked against a number.
"""

from __future__ import annotations

import hashlib
import json
import sys

from calibration import hijri
from calibration import sources as S
from generator.generate import load_config

WINDOWS = ("pre_ramadan_10d", "ramadan", "eid", "post_eid_7d")


METADATA_KEYS = {"evidence_class", "ci95"}
NON_GENERATOR_BLOCKS = ("emergent_validation_targets", "berka")


def _strip(obj):
    if isinstance(obj, dict):
        return {k: _strip(v) for k, v in obj.items() if k not in METADATA_KEYS}
    if isinstance(obj, list):
        return [_strip(v) for v in obj]
    return obj


def generator_param_hash(cfg: dict) -> str:
    """sha256 of the generator-facing parameters only: evidence labels, CIs and the §21 / Berka blocks removed.
    Workstream B of SOP_Monshaat_Unblock may change labels; it may never change this hash."""
    core = {k: _strip(v) for k, v in cfg.items() if k not in NON_GENERATOR_BLOCKS}
    return hashlib.sha256(json.dumps(core, sort_keys=True, default=str).encode("utf-8")).hexdigest()[:16]


def config_sha256() -> str:
    return hashlib.sha256((S.REPO / "config.yaml").read_bytes()).hexdigest()[:16]


def main(argv: list[str] | None = None) -> int:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    cfg = load_config("config.yaml")
    bad = []

    seas = S.read_out("phase2_seasonality")["generator"]
    for sector in ("retail_trade", "food_beverage"):
        pc = seas[sector]["proposed_config"]
        for block, key in (("seasonality_value_multiplier", "seasonality_value_multiplier"), ("seasonality_count_multiplier", "seasonality_count_multiplier")):
            for w in WINDOWS:
                have, want = float(cfg[block][sector][w]), float(pc[key][w])
                if abs(have - want) > 1e-9:
                    bad.append(f"{block}.{sector}.{w}: config {have} vs measured {want}")
            ec, cis = cfg[block][sector].get("evidence_class"), cfg[block][sector].get("ci95")
            ci_key = "ci95_value" if block == "seasonality_value_multiplier" else "ci95_count"
            if not isinstance(ec, dict) or not isinstance(cis, dict):
                bad.append(f"{block}.{sector}: measured block must carry per-window evidence_class and ci95 maps (SOP_Monshaat_Unblock B2)")
                continue
            for w in WINDOWS:
                lo, hi = pc[ci_key][w]
                rule = "B" if (lo > 1.0 or hi < 1.0) else "B-weak"
                if ec.get(w) != rule:
                    bad.append(f"{block}.{sector}.{w}: evidence_class {ec.get(w)} but the CI [{lo:.2f}, {hi:.2f}] {'contains' if rule == 'B-weak' else 'excludes'} 1.0 → must be {rule}")
                if any(abs(float(cis[w][i]) - round(float(pc[ci_key][w][i]), 2)) > 1e-9 for i in (0, 1)):
                    bad.append(f"{block}.{sector}.{w}: ci95 {cis[w]} differs from the measured {pc[ci_key][w]}")
    for sector in ("construction", "professional_services"):
        for block in ("seasonality_value_multiplier", "seasonality_count_multiplier"):
            if cfg[block][sector].get("evidence_class") != "C":
                bad.append(f"{block}.{sector}: unmeasured sector must carry evidence_class C")

    tick = S.read_out("phase3_ticket_size")["proposed_config"]["avg_inflow_ticket_sar"]
    for sector, want in tick.items():
        have = cfg["sector_economics"][sector].get("avg_inflow_ticket_sar")
        if have is None or abs(float(have) - float(want)) > 1e-9:
            bad.append(f"sector_economics.{sector}.avg_inflow_ticket_sar: config {have} vs measured {want}")
    for sector in ("construction", "professional_services"):
        if "avg_inflow_ticket_sar" in cfg["sector_economics"][sector]:
            bad.append(f"sector_economics.{sector}: POS ticket must NOT be applied to a non-POS sector (§6.1)")

    try:
        hijri.assert_matches_config(cfg)
    except AssertionError as e:
        bad.append(str(e))

    mix = S.read_out("phase1_sector_mix")
    if mix.get("status") == "ok":
        want = mix["proposed_config"]["sector_size_distribution"]
        for sector, v in want.items():
            have = cfg["sector_size_distribution"][sector]
            if abs(have["weight"] - v["weight"]) > 1e-9 or any(abs(have["size_tiers"][t] - v["size_tiers"][t]) > 1e-9 for t in v["size_tiers"]):
                bad.append(f"sector_size_distribution.{sector}: config {have} vs Monsha'at {v}")
        print("sector_size_distribution: checked against Monsha'at", mix["edition"])
    else:
        print("sector_size_distribution: Phase 1 blocked — author judgement, unchanged (not checked)")

    cred = S.read_out("phase4_credit_intensity")
    if "proposed_config" in cred:
        want = cred["proposed_config"]["financing.share_of_businesses"]
        have = cfg["financing"]["share_of_businesses"]
        if not isinstance(have, dict) or any(abs(have[s] - want[s]) > 1e-9 for s in want):
            bad.append(f"financing.share_of_businesses: config {have} vs credit index {want}")
    else:
        print("financing.share_of_businesses: Phase 4 index withheld (no SME denominator) — uniform judgement, unchanged")

    rate = cfg["output"].get("pos_sales_transaction_sample_rate", 1.0)
    if not 0 < float(rate) <= 1.0:
        bad.append(f"output.pos_sales_transaction_sample_rate must be in (0, 1]: {rate}")

    print(f"config.yaml sha256 {config_sha256()}  |  generator-parameter hash {generator_param_hash(cfg)}  (labels, CIs and the §21 block excluded)")
    for b in bad:
        print("  MISMATCH  " + b)
    print("config.yaml matches every measured value" if not bad else f"{len(bad)} mismatch(es)")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
