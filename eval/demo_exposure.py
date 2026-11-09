"""What a judge sees across the whole serving population — a read-only count, nothing tuned.

    python -m eval.demo_exposure          # → eval/out/demo_exposure.md (needs data/serving.duckdb)

DECISIONS entry 29 reported, on one business, that declines come from the affordability gate and
that the anomaly lens returns its cap. Entry 43 reported that feature 3 acts as a sector-level
offset in the credit model. This harness counts the same three things on every serving business,
through the shipped code path (`pipeline.week8.decision_object` over the API serving store), so
the numbers said in the demo have a population and a source.

It measures the shipped lenses as they are. It changes no parameter and chooses nothing.
"""

from __future__ import annotations

import collections
import sys
from pathlib import Path

import duckdb

from api.store import DEFAULT_STORE, ServingStore
from pipeline.week8 import decision_object, make_context, prepare

OUT = Path("eval/out/demo_exposure.md")
CHUNK = 50
REGULARITY = 3  # inflow_regularity_score; 55 is its sector-relative z-score


def collect(store_path: str = DEFAULT_STORE) -> list[dict]:
    con = duckdb.connect(store_path, read_only=True)
    con.execute("SET threads TO 1")
    ids = [int(r[0]) for r in con.execute("SELECT business_id FROM businesses ORDER BY business_id").fetchall()]
    con.close()
    store, ctx, rows = ServingStore(store_path), make_context("eval.demo_exposure"), []
    for i in range(0, len(ids), CHUNK):
        chunk = ids[i : i + CHUNK]
        p = prepare(ctx, store.load(chunk))
        for b in chunk:
            o = decision_object(ctx, p, b)
            public = (o.get("credit_explanation") or {}).get("public_tier") or []
            rows.append({
                "sector": o["sector"],
                "status": o["status"],
                "decision": (o.get("credit") or {}).get("decision"),
                "reason": (o.get("credit_decision_detail") or {}).get("decline_reason"),
                "top": public[0] if public else None,
                "top3": [e["feature_id"] for e in public],
                "flags": len((o.get("anomaly") or {}).get("flags") or []),
                "max_flags": ctx.lc["anomaly"]["max_flags"],
            })
    return rows


def render(rows: list[dict]) -> str:
    decided = [r for r in rows if r["status"] != "insufficient_data"]
    n, cap = len(decided), rows[0]["max_flags"]
    top_reg = [r for r in decided if r["top"] and r["top"]["feature_id"] == REGULARITY]
    in_top3 = sum(REGULARITY in r["top3"] or 55 in r["top3"] for r in decided)
    declined = [r for r in decided if r["decision"] == "declined"]
    reasons = collections.Counter(r["reason"] for r in declined)
    afford = sum(v for k, v in reasons.items() if str(k).startswith("affordability"))
    flags = collections.Counter(r["flags"] for r in decided)
    md = [
        "# What the serving population shows in a demo (DECISIONS entries 29, 43, 47)",
        "",
        (f"Data source: synthetic. Serving population, {len(rows):,} businesses; {n} scored or partial_profile, "
         f"{len(rows) - n} `insufficient_data`. Every object comes from `pipeline.week8.decision_object` over the serving store, "
         "the code path the API and the Week 8 CLI use. Counts only: nothing is fitted or chosen here."),
        "",
        "## 1. The first sentence of the customer explanation",
        "",
        (f"**Feature 3 (`inflow_regularity_score`) is the first public reason for {len(top_reg)} of {n} businesses**, "
         f"and feature 3 or its z-score 55 is among the three public reasons for {in_top3} of {n}."),
        "",
        "| sector | businesses | feature 3 is the first reason | of those: counted against | of those: counted in favour |",
        "|---|---|---|---|---|",
    ]
    for s in sorted({r["sector"] for r in decided}):
        sec = [r for r in decided if r["sector"] == s]
        reg = [r for r in sec if r["top"] and r["top"]["feature_id"] == REGULARITY]
        against = sum(r["top"]["direction"] == "against" for r in reg)
        md.append(f"| {s} | {len(sec)} | {len(reg)} | {against} | {len(reg) - against} |")
    md += [
        "",
        ("Read with entry 43: within a sector the direction does not vary, so the sentence describes the business's sector, "
         "not the business."),
        "",
        "## 2. Why businesses are declined",
        "",
        (f"**{len(declined)} of {n} are declined; {afford} of those {len(declined)} by the §31 affordability gate** "
         f"and {reasons.get('risk_model', 0)} by the risk model."),
        "",
        "| decline reason | businesses |",
        "|---|---|",
        *[f"| `{k}` | {v} |" for k, v in sorted(reasons.items(), key=lambda kv: -kv[1])],
        "",
        "## 3. How many anomaly flags a business gets",
        "",
        (f"**{flags.get(cap, 0)} of {n} businesses return the cap of {cap} flags; the fewest any business returns is {min(flags)}.** "
         "No business comes back with none, so a flag is a place in a review queue, not an alarm."),
        "",
        "| flags returned | businesses |",
        "|---|---|",
        *[f"| {k} | {v} |" for k, v in sorted(flags.items())],
    ]
    return "\n".join(md) + "\n"


def main() -> int:
    text = render(collect())
    OUT.write_text(text, encoding="utf-8")
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    print(text)
    print(f"→ {OUT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
