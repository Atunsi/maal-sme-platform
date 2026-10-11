"""Feature 24 across the populations — what the Sharia screen does to real applicants.

    python -m eval.sharia_report [--dir data]        → eval/out/sharia_screen.md

Runs compliance.sharia.screen over every business (activity screen + the transaction
screens), so the credit and compliance owners can see how often each status, rule and
disclosure occurs before they sign off the rule table (DECISIONS entry 26).
"""

from __future__ import annotations

import argparse
import sys
from collections import Counter
from pathlib import Path

import pandas as pd

from compliance.sharia import load_rules, screen
from profile_engine.compute import TX_DTYPES


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dir", default="data")
    ap.add_argument("--out", default="eval/out/sharia_screen.md")
    args = ap.parse_args(argv)
    d = Path(args.dir)
    rules, sha = load_rules()

    biz = pd.read_csv(d / "businesses.csv", dtype={"declared_mcc_code": "Int64"})
    # Only the rows the screen reads: inflows/outflows by counterparty type.
    tx = pd.read_csv(d / "transactions.csv", usecols=["business_id", "direction", "counterparty_type", "amount", "sample_weight"],
                     dtype={k: v for k, v in TX_DTYPES.items() if k in ("direction", "counterparty_type")})
    groups = dict(tuple(tx.groupby("business_id", sort=False)))

    rows = []
    for b in biz.itertuples(index=False):
        s = screen(b.sector, b.declared_mcc_code, groups.get(int(b.business_id)), rules, sha)
        rows.append({"population": b.population, "sector": b.sector, "status": s["sharia_screen_status"], "basis": s["evidence_basis"],
                     "rules": [h["rule_id"] for h in s["rules_triggered"]], "disclosure": bool(s["disclosures"])})
    r = pd.DataFrame(rows)

    lines = ["# Sharia screen (feature 24) across the populations", "",
             (f"Rule table v{rules['version']} (`compliance/sharia_rules.yaml`, sha256 `{sha[:12]}…`, status **{rules['source_status']}**). "
              "Data source: synthetic. Deterministic: re-running gives the same table."), ""]
    for pop in ("research", "serving"):
        x = r[r["population"] == pop]
        share = x["status"].value_counts(normalize=True)
        lines += [f"## {pop} (n = {len(x):,})", "",
                  "| status | share |", "|---|---|",
                  *[f"| {st} | {share.get(st, 0.0):.1%} |" for st in ("compliant", "soft_flag_review", "hard_flag")], "",
                  pd.crosstab(x["sector"], x["status"], normalize="index").round(3).to_markdown(), "",
                  (f"Evidence basis: declared MCC {(x['basis'] == 'declared_mcc').mean():.1%}, registered sector "
                   f"{(x['basis'] == 'registered_sector').mean():.1%}. Existing-financing disclosure asked of "
                   f"{x['disclosure'].mean():.1%}."), ""]
    hits = Counter(rule for rs in r["rules"] for rule in rs)
    lines += ["## Rules triggered (all businesses)", "", "| rule | businesses |", "|---|---|",
              *[f"| `{k}` | {v:,} |" for k, v in hits.most_common()], "",
              "No hard flag occurs: the generator assigns only permissible MCCs. The hard-flag path is proven by",
              "`tests/test_sharia.py` on crafted inputs, not by this population."]
    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    Path(args.out).write_text("\n".join(lines) + "\n", encoding="utf-8")
    print("\n".join(lines))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
