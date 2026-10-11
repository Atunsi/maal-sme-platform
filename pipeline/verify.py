"""Verify a saved Week 8 decision — the reproducibility receipt's "verify this decision" button.

    python -m pipeline.week8 --demo --out decisions.json
    python -m pipeline.verify decisions.json [--dir data]

For every object in the file this checks three things, in order:

  1. integrity   the stored object still hashes to its own receipt.output_sha256
                 (nothing was edited after it was produced);
  2. inputs      each receipt hash — config, lens config, credit model, §35 reference
                 stats, this business's input data, code commit — against the current
                 state, so a mismatch is diagnosed, not just detected;
  3. reproduction  the pipeline is re-run and the fresh object compared byte for byte.

Exit code 0 = every decision reproduced exactly; 1 = at least one did not.

Scope (stated on every receipt): the deterministic core only. Generated advisory
text, if it is ever added (§36), is outside the receipt and cannot affect a decision.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from pipeline.week8 import build_objects, output_sha256

INPUT_KEYS = (
    "config_sha256", "lens_config_sha256", "credit_model_sha256",
    "reference_stats_sha256", "sharia_rules_sha256", "data_sha256", "code_commit",
)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("file", help="JSON written by pipeline.week8 (one object or a list)")
    ap.add_argument("--dir", default="data")
    args = ap.parse_args(argv)

    saved = json.loads(Path(args.file).read_text(encoding="utf-8"))
    saved = saved if isinstance(saved, list) else [saved]
    fresh = {o["business_id"]: o for o in build_objects(args.dir, [o["business_id"] for o in saved])}

    all_ok = True
    for old in saved:
        b = old["business_id"]
        rec = old.get("receipt", {})
        new = fresh[b]
        intact = output_sha256(old) == rec.get("output_sha256")
        reproduced = json.dumps({k: v for k, v in old.items() if k != "receipt"}, sort_keys=True, default=str) == \
            json.dumps({k: v for k, v in new.items() if k != "receipt"}, sort_keys=True, default=str)
        changed = [k for k in INPUT_KEYS if rec.get(k) != new["receipt"].get(k)]
        ok = intact and reproduced
        all_ok &= ok
        print(f"business {b}: {'REPRODUCED byte-identical' if ok else 'NOT REPRODUCED'}")
        print(f"    integrity  : {'stored object matches its output_sha256' if intact else 'EDITED after it was produced — stored hash does not match'}")
        if changed:
            print(f"    inputs     : changed since the decision was made: {', '.join(changed)}")
        else:
            print("    inputs     : config, lens config, model, reference stats, Sharia rules, data and code all unchanged")
        if intact and not reproduced and not changed:
            print("    note       : inputs unchanged but output differs — a source of nondeterminism; investigate")
    print("\nALL DECISIONS VERIFIED" if all_ok else "\nVERIFICATION FAILED")
    return 0 if all_ok else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
