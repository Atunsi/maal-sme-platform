"""Drift check — every measured value in config.yaml must equal what calibration/out/*.json measured.

    python -m calibration.check_config

Exit 1 on any mismatch. This is the structural guard SOP_Saudi_Calibration §12.1 asks for: a
calibrated parameter that is edited by hand later stops matching its source edition, and this
script says so. Parameters whose phase is blocked (sector mix, financing index) are reported as
"judgement — unchanged", not checked against a number.
"""

from __future__ import annotations

import sys

from calibration import hijri
from calibration import sources as S
from generator.generate import load_config

WINDOWS = ("pre_ramadan_10d", "ramadan", "eid", "post_eid_7d")


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
            if cfg[block][sector].get("evidence_class") != "B":
                bad.append(f"{block}.{sector}: measured value must carry evidence_class B")
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

    for b in bad:
        print("  MISMATCH  " + b)
    print("config.yaml matches every measured value" if not bad else f"{len(bad)} mismatch(es)")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
