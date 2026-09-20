"""One generation per rho, every §14 measurement derived from it.

Since the SAMA calibration a full-scale generation costs ~45 minutes, so the
expensive thing must happen once per rho, not once per analysis. Running
`sweep_rho`, `signal_decomposition` and `model_baseline` separately regenerates
the same populations seven times; this runs four generations and derives all
three from each set of tables.

Emits, per rho: the sweep row (OOF AUCs, oracle, serving), the signal ladder
(latent -> optimal u_obs combination -> single draw -> measured), and, at the
config rho only, the model baseline grid. The label-side quantities that need
no economics (ceiling, p_default spread, variance decomposition) are in
eval/latent_ceiling.py and run in seconds — do not wait on this for those.

Usage (from the repo root):
    python -m eval.run_section14                       # rho in {0.6, 0.7, 0.8, 0.9}
    python -m eval.run_section14 --values 0.6 0.9      # endpoints only, half the cost
    python -m eval.run_section14 --quick               # smoke test
"""

from __future__ import annotations

import argparse
import sys
import time

import pandas as pd

from eval.model_baseline import report_baseline
from eval.signal_decomposition import ladder
from eval.sweep_rho import HONEST_COLUMNS, build_frame, evaluate, set_param
from generator.generate import generate, load_config


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--config", default="config.yaml")
    ap.add_argument("--values", type=float, nargs="+", default=[0.6, 0.7, 0.8, 0.9])
    ap.add_argument("--quick", action="store_true")
    ap.add_argument(
        "--n-research", type=int, default=None,
        help="cap the research population to keep peak memory in bounds. Businesses are keyed by "
             "id, so this is a true prefix subsample of the full run, not a different dataset.",
    )
    args = ap.parse_args(argv)
    base_rho = load_config(args.config)["latent_to_observable_correlation"]

    rows, fingerprints = [], {}
    for rho in args.values:
        cfg = load_config(args.config)
        set_param(cfg, "rho", rho)
        if args.n_research:
            cfg["populations"]["research"]["id_range"][1] = args.n_research
        t0 = time.time()
        print(f"\n{'#' * 90}\n# rho = {rho}\n{'#' * 90}", flush=True)
        tables = generate(cfg, quick=args.quick)

        # The engine is the expensive step and both analyses need the same frame:
        # run it once, then drop the transaction table (~12.5M rows with object
        # counterparty ids) before fitting, or peak memory kills the process.
        f = build_frame(tables, cfg)
        tables.pop("transactions", None)
        print(f"  profile frame: {len(f):,} scorable businesses x {f.shape[1]} columns", flush=True)

        r = evaluate(f, tables)
        fingerprints[rho] = r.pop("label_fingerprint")
        r["rho"] = rho
        rows.append(r)
        print(f"\n  sweep row: logit OOF={r['auc_logit_oof']:.4f} xgb OOF={r['auc_xgb_oof']:.4f} "
              f"serving={r.get('auc_xgb_serving', float('nan')):.4f} oracle={r['auc_oracle_latent']:.4f}", flush=True)

        print(f"\n--- signal ladder at rho = {rho} ---", flush=True)
        lad = ladder(f, tables, rho)
        prev = None
        for _, row in lad.iterrows():
            d = "" if prev is None else f"   lost {prev - row['AUC']:+.4f}"
            print(f"  {row['stage']:44s} AUC={row['AUC']:.4f}  {row['note']:<26s}{d}")
            prev = row["AUC"]
        ceil_, pre, meas = lad["AUC"].iloc[0], lad["AUC"].iloc[1], lad["AUC"].iloc[3]
        gap = ceil_ - meas
        if gap > 0:
            print(f"  rho attenuation {ceil_ - pre:.4f} ({(ceil_ - pre) / gap:.1%}) | "
                  f"economics pipeline {pre - meas:.4f} ({(pre - meas) / gap:.1%}) | total {gap:.4f}")

        if abs(rho - base_rho) < 1e-9:
            print(f"\n--- model baseline at rho = {rho} (config value) ---", flush=True)
            report_baseline(f, tables, rho)

        print(f"\n  [rho={rho} done in {time.time() - t0:.0f}s]", flush=True)
        del tables, f

    df = pd.DataFrame(rows).set_index("rho")
    show = df[["auc_xgb_oof", "auc_logit_oof", "auc_xgb_serving", "auc_xgb_insample", "auc_oracle_latent"]]
    show.columns = ["XGB OOF", "logit OOF", "XGB->serving", "XGB in-sample", "oracle (latent)"]
    print("\n" + "=" * 96)
    print("§14 — AUC as a function of rho, research population, entity-level 5-fold OOF")
    print("=" * 96)
    print(show.round(4).to_string())
    print(f"\nN research scorable = {df['n_research'].iloc[0]:,} ({df['n_defaults'].iloc[0]} defaults)")
    ident = all(fingerprints[v] == fingerprints[args.values[0]] for v in args.values)
    print(f"labels identical across all rho: {ident}")
    peak = float(show[HONEST_COLUMNS].max().max())
    print(f"\npeak out-of-sample AUC = {peak:.4f} — §14 circularity threshold 0.85 "
          f"{'NOT reached' if peak < 0.85 else 'REACHED'}")
    return 0 if ident else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
