"""DECISIONS entry 31 — feature 24 carries a value and a null reason at the same time.

    python -m eval.feature24_seam [--dir data/quick] [--out eval/out/feature24_seam.md]

The engine nulls every feature except 32 with reason `insufficient_data` when §15 refuses a
business. `pipeline.week8.prepare` then writes a Sharia status into feature 24 for every business
and removes only the null rows whose reason is `not_implemented`. This script shows, for the
`insufficient_data` businesses in `--dir`: the engine's own rows (profiles.csv, profile_nulls.csv),
the rows after `prepare`, and the lines of pipeline/week8.py that do it. If the serving store
exists, it also calls GET /profile for the serving businesses refused under §15 and counts how
many responses carry both. Nothing is changed; the finding is the output.
"""

from __future__ import annotations

import argparse
import inspect
import os
import sys
from pathlib import Path

import pandas as pd

from pipeline import week8
from pipeline.data import load_tables
from pipeline.week8 import make_context, prepare

FEATURE = "sharia_screen_status"
STORE = Path("data/serving.duckdb")
SHOW = (15, 87, 91)


def week8_lines() -> list[str]:
    src, start = inspect.getsourcelines(week8.prepare)
    return [f"{start + i:4d}  {line.rstrip()}" for i, line in enumerate(src)]


def api_check(ids: list[int]) -> dict:
    os.environ.setdefault("MAAL_API_KEY", "evidence-local-only")
    from fastapi.testclient import TestClient

    from api.app import app

    both, rows = 0, []
    with TestClient(app) as c:
        for b in ids:
            r = c.get(f"/profile/{b}", headers={"X-API-Key": os.environ["MAAL_API_KEY"]}).json()
            v, why = r["features"].get(FEATURE), r["null_reasons"].get(FEATURE)
            both += v is not None and why is not None
            rows.append({"business_id": b, "status": r.get("status"), FEATURE: v, "null_reason": why})
    return {"n": len(ids), "both": both, "rows": rows}


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dir", default="data/quick")
    ap.add_argument("--out", default="eval/out/feature24_seam.md")
    args = ap.parse_args(argv)
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    d = Path(args.dir)
    status = pd.read_csv(d / "profile_status.csv")
    refused = status.loc[status["status"] == "insufficient_data", "business_id"].astype(int).tolist()
    prof = pd.read_csv(d / "profiles.csv", usecols=["business_id", "coverage_days_90d", FEATURE])
    nulls = pd.read_csv(d / "profile_nulls.csv")
    nulls = nulls[nulls["feature"] == FEATURE]

    p = prepare(make_context("eval.feature24_seam"), load_tables(d, refused))
    after_val = p.feats[FEATURE]
    after_null = p.nulls[p.nulls["feature"] == FEATURE].set_index("business_id")["reason"]
    rows = []
    for b in refused:
        rows.append({
            "business_id": b,
            "engine value (profiles.csv)": prof.set_index("business_id").loc[b, FEATURE],
            "engine null reason (profile_nulls.csv)": nulls.set_index("business_id")["reason"].get(b),
            "value after prepare()": after_val.get(b),
            "null reason after prepare()": after_null.get(b),
        })
    tab = pd.DataFrame(rows)
    contradictory = tab[tab["value after prepare()"].notna() & tab["null reason after prepare()"].notna()]
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    tab.to_csv(out.with_name("feature24_seam.csv"), index=False)

    def md_table(df: pd.DataFrame) -> list[str]:
        cols = list(df.columns)
        return ["| " + " | ".join(cols) + " |", "|" + "---|" * len(cols)] + [
            "| " + " | ".join("—" if pd.isna(v) else str(v) for v in r) + " |" for r in df.itertuples(index=False)
        ]

    md = [
        "# Feature 24: a value and a null reason at the same time (DECISIONS entry 31)",
        "",
        (
            f"Data: `{d}`. Businesses refused under §15 (`insufficient_data`): **{len(refused)}**. "
            f"After `pipeline.week8.prepare`, **{len(contradictory)} of {len(refused)}** carry a feature 24 value *and* a feature 24 null row."
        ),
        "",
        "## The three businesses named in entry 31",
        "",
        *md_table(tab[tab["business_id"].isin(SHOW)]),
        "",
        (
            "Engine columns are read from the files `profile_engine.compute` wrote; the `after prepare()` columns are what the API and the Week 8 object are built from. "
            "Every refused business: `feature24_seam.csv`."
        ),
        "",
        "## The code (`pipeline/week8.py`, `prepare`)",
        "",
        "```",
        *week8_lines(),
        "```",
        "",
        "The value is written for every business; the filter on the last null-handling line keeps every row whose reason is not `not_implemented`, so the `insufficient_data` row survives.",
    ]
    if STORE.exists():
        ser = pd.read_csv("data/profile_status.csv")
        ser = ser[(ser["business_id"] > 10000) & (ser["status"] == "insufficient_data")]["business_id"].astype(int).tolist()
        api = api_check(ser)
        md += [
            "",
            "## Through the API (GET /profile, serving store)",
            "",
            f"Serving businesses refused under §15: **{api['n']}**. Responses with both a `{FEATURE}` value and a `{FEATURE}` null reason: **{api['both']} of {api['n']}**.",
            "",
            *md_table(pd.DataFrame(api["rows"][:3])),
        ]
        pd.DataFrame(api["rows"]).to_csv(out.with_name("feature24_seam_api.csv"), index=False)
    else:
        md += ["", "Serving store absent: the API check was not run."]
    md += ["", "Nothing is changed by this finding; the options are in DECISIONS entries 31 and 32."]
    out.write_text("\n".join(md) + "\n", encoding="utf-8")
    print("\n".join(md))
    print(f"\n→ {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
