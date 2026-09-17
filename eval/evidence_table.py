"""§13.5 — the three-column evidence table, generated from the registry, never typed by hand.

    python -m eval.evidence_table [--out eval/out/evidence_table.md]
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from profile_engine.evidence import CLASS_CLAIM, CLASS_LABELS, EVIDENCE
from profile_engine.registry import FEATURE_NAMES


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="eval/out/evidence_table.md")
    args = ap.parse_args(argv)
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    by_class = {c: [f for f in FEATURE_NAMES if EVIDENCE[f][0] == c] for c in "ABC"}
    md = [
        "# Evidence table (SOP_Data_Grounding §13.5)",
        "",
        "Generated from `profile_engine/evidence.py`. A class-C feature never carries a performance claim; it carries a functional",
        "demonstration and a sensitivity range (`eval/out/sensitivity_*.md`). A metric over mixed inputs reports the weakest class present.",
        "",
        "| Class | n | Features | Claim made |",
        "|---|---|---|---|",
    ]
    for c in "ABC":
        feats = ", ".join(f"{f} `{FEATURE_NAMES[f]}`" for f in by_class[c])
        md.append(f"| **{c} — {CLASS_LABELS[c]}** | {len(by_class[c])} | {feats} | {CLASS_CLAIM[c]} |")
    md += ["", "## Basis per feature", "", "| # | Feature | Class | Basis |", "|---|---|---|---|"]
    md += [f"| {f} | `{FEATURE_NAMES[f]}` | {EVIDENCE[f][0]} | {EVIDENCE[f][1]} |" for f in FEATURE_NAMES]
    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    Path(args.out).write_text("\n".join(md) + "\n", encoding="utf-8")
    print("\n".join(md[:12]))
    print(f"\n→ {args.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
