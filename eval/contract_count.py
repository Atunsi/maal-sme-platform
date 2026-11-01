"""How many features does the contract hold, and how many does the credit model use? (64 vs 58)

    python -m eval.contract_count [--dir data] [--out eval/out/contract_count.md]

Three lists, each from the code that defines it, never typed by hand:
  * the §8 contract: `profile_engine.registry.PROFILE_FEATURE_IDS`;
  * the credit lens's own exclusions: `lenses/lens_config.yaml` credit.excluded_feature_ids;
  * the features the credit lens keeps, by calling `lenses.credit.train.build_xy` on `--dir`
    (its runtime rule drops all-null and constant columns), compared with the 58 stored in
    `lenses/credit/model_v1.json`.
The difference is reported with the reason for each dropped feature and the code line that drops it.
"""

from __future__ import annotations

import argparse
import inspect
import json
import sys
from pathlib import Path

import pandas as pd

from lenses import load_lens_config
from lenses.credit import train
from profile_engine.registry import FEATURE_NAMES, PROFILE_FEATURE_IDS, ZAKAT_PROFILE_FEATURE_IDS

MODEL = Path("lenses/credit/model_v1.json")


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dir", default="data")
    ap.add_argument("--out", default="eval/out/contract_count.md")
    args = ap.parse_args(argv)
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    excluded = list(load_lens_config()["credit"]["excluded_feature_ids"])
    model = json.loads(MODEL.read_text(encoding="utf-8"))
    in_model = [f["id"] for f in model["features"]]
    df, _, kept = train.build_xy(Path(args.dir), set(excluded))
    kept_now = [f["id"] for f in kept]
    candidates = [f for f in PROFILE_FEATURE_IDS if f not in excluded]
    dropped = [f for f in candidates if f not in in_model]

    src, start = inspect.getsourcelines(train.build_xy)
    drop_line = next(start + i for i, line in enumerate(src) if "nunique(dropna=True) < 2" in line)
    code = [f"{start + i:4d}  {line.rstrip()}" for i, line in enumerate(src) if start + i in range(drop_line - 5, drop_line + 2)]

    why = []
    for f in dropped:
        col = pd.to_numeric(df[FEATURE_NAMES[f]], errors="coerce") if FEATURE_NAMES[f] in df else pd.Series(dtype=float)
        why.append({"id": f, "name": FEATURE_NAMES[f], "non-null": int(col.notna().sum()), "distinct values": int(col.nunique(dropna=True)),
                    "values": ", ".join(str(v) for v in sorted(col.dropna().unique())[:3])})

    md = [
        "# The feature contract (64) against the credit model's inputs (58)",
        "",
        f"- **§8 contract** (`PROFILE_FEATURE_IDS`, what GET /profile returns): **{len(PROFILE_FEATURE_IDS)}** IDs: {', '.join(map(str, PROFILE_FEATURE_IDS))}.",
        f"- Not in the contract (the Zakat-only profile, `ZAKAT_PROFILE_FEATURE_IDS`): {', '.join(map(str, ZAKAT_PROFILE_FEATURE_IDS))}. Contract + Zakat-only = {len(PROFILE_FEATURE_IDS) + len(ZAKAT_PROFILE_FEATURE_IDS)} = all registry features ({len(FEATURE_NAMES)}).",
        f"- **Excluded by the credit lens** (`lenses/lens_config.yaml` credit.excluded_feature_ids): {', '.join(map(str, excluded))} → {len(candidates)} candidates.",
        f"- **In the trained model** (`{MODEL.as_posix()}`, trained {model['trained']}): **{len(in_model)}** features.",
        f"- **Kept today by `build_xy` on `{args.dir}`**: {len(kept_now)} features; identical to the model's list: **{kept_now == in_model}**.",
        "",
        f"## The {len(dropped)} candidates the model does not use",
        "",
        "| # | Feature | Non-null rows | Distinct values | Values |",
        "|---|---|---|---|---|",
    ]
    md += [f"| {r['id']} | `{r['name']}` | {r['non-null']:,} | {r['distinct values']} | {r['values'] or '—'} |" for r in why]
    md += [
        "",
        f"Rows: every business in `{args.dir}` the engine did not refuse ({len(df):,}), as `build_xy` reads them. A column with no non-null value or fewer than 2 distinct values is dropped at run time:",
        "",
        "```",
        f"lenses/credit/train.py (build_xy), the drop is line {drop_line}:",
        *code,
        "```",
        "",
        f"So {len(PROFILE_FEATURE_IDS)} − {len(excluded)} excluded − {len(dropped)} constant = {len(PROFILE_FEATURE_IDS) - len(excluded) - len(dropped)} model inputs.",
    ]
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text("\n".join(md) + "\n", encoding="utf-8")
    print("\n".join(md))
    print(f"\n→ {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
