"""DECISIONS entry 35 — are the pinned §35 sector reference statistics still those of the current data?

    python -m eval.reference_stats_drift [--dir data] [--out eval/out/reference_stats_drift.md]

Three pieces of evidence, all computed here:
1. Provenance: sha256 of profile_engine/sector_reference_stats_v1.json, every commit that touched
   it, and whether that commit is an ancestor of the calibration commits (git topology, not dates).
2. The pinned μ/σ per sector against μ/σ rebuilt in memory with `build_reference_stats` from the
   current research population in `--dir` (nothing is written; the pinned file is untouched).
3. Mean and SD of features 55–59 per sector on the current research population (scored and
   partial_profile businesses). A correctly pinned reference gives mean ≈ 0 and SD ≈ 1.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
import sys
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

from profile_engine import features as fe
from profile_engine.registry import NAME_TO_ID

CALIBRATION_COMMITS = {
    "a4a7f40": "SAMA inputs, POS receipts at the measured ticket, thinning",
    "01b5ebd": "full-scale re-run after the Saudi calibration",
    "fa21be6": "Monsha'at sector mix and financing share",
}
SECTORS = ("retail_trade", "food_beverage", "construction", "professional_services")
COLOURS = dict(zip(SECTORS, ("#2a78d6", "#eb6834", "#1baf7a", "#eda100"), strict=True))
SURFACE, INK, INK2, GRID = "#fcfcfb", "#0b0b0b", "#52514e", "#e4e3df"


def git(*a: str) -> str:
    return subprocess.run(["git", *a], capture_output=True, text=True, check=False).stdout.strip()


def is_ancestor(a: str, b: str) -> bool:
    return subprocess.run(["git", "merge-base", "--is-ancestor", a, b], check=False).returncode == 0


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dir", default="data")
    ap.add_argument("--out", default="eval/out/reference_stats_drift.md")
    args = ap.parse_args(argv)
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    d = Path(args.dir)

    path = fe.REFERENCE_STATS_PATH
    sha = hashlib.sha256(path.read_bytes()).hexdigest()
    pinned = json.loads(path.read_bytes())
    rel = path.relative_to(Path.cwd()).as_posix() if path.is_relative_to(Path.cwd()) else str(path)
    touches = git("log", "--format=%h|%ad|%cd|%s", "--date=iso", "--", rel).splitlines()

    prof = pd.read_csv(d / "profiles.csv")
    biz = pd.read_csv(d / "businesses.csv", usecols=["business_id", "sector", "population"])
    status = pd.read_csv(d / "profile_status.csv", usecols=["business_id", "status"])
    current = fe.build_reference_stats(prof, biz)

    drift = []
    for s in SECTORS:
        for name, v in pinned["stats"][s].items():
            c = current["stats"][s][name]
            drift.append({"sector": s, "base feature": f"{NAME_TO_ID[name]} {name}", "pinned mean": v["mean"], "current mean": c["mean"],
                          "pinned SD": v["std"], "current SD": c["std"], "pinned n": v["n"], "current n": c["n"]})
    drift = pd.DataFrame(drift)

    df = prof.merge(biz, on="business_id").merge(status, on="business_id")
    df = df[(df["population"] == "research") & (df["status"] != "insufficient_data")]
    zs = {z: fe.F[z] for z in fe.Z_FEATURES}
    moments = []
    for s in SECTORS:
        g = df[df["sector"] == s]
        for z, name in zs.items():
            x = g[name].dropna()
            moments.append({"sector": s, "feature": f"{z} {name}", "n": len(x), "mean": x.mean(), "SD": x.std(ddof=0)})
    moments = pd.DataFrame(moments)

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    drift.to_csv(out.with_name("reference_stats_drift_pinned_vs_current.csv"), index=False)
    moments.to_csv(out.with_name("reference_stats_drift_z_moments.csv"), index=False)

    # Chart: two panels (mean, SD) of features 55–59 per sector; reference lines at 0 and 1.
    fig, axes = plt.subplots(1, 2, figsize=(11, 4.2), facecolor=SURFACE)
    x = np.arange(len(zs))
    w = 0.19
    for ax, col, ref in ((axes[0], "mean", 0.0), (axes[1], "SD", 1.0)):
        ax.set_facecolor(SURFACE)
        for i, s in enumerate(SECTORS):
            v = moments[moments["sector"] == s][col].to_numpy()
            ax.bar(x + (i - 1.5) * (w + 0.01), v - ref, bottom=ref, width=w, color=COLOURS[s], label=s.replace("_", " "), zorder=2)
        ax.axhline(ref, color=INK, lw=1, zorder=3)
        ax.set_ylabel(f"{col} (expected {ref:g})", color=INK2)
        ax.set_xticks(x, [f"{z}\n{n.replace('sector_relative_', '').replace('_z', '')}" for z, n in zs.items()], fontsize=8, color=INK2)
        ax.set_title(f"{col} of the z-score, research population", fontsize=10, color=INK, loc="left")
        ax.grid(axis="y", color=GRID, lw=0.8, zorder=0)
        for sp in ("top", "right"):
            ax.spines[sp].set_visible(False)
        for sp in ("left", "bottom"):
            ax.spines[sp].set_color(GRID)
        ax.tick_params(colors=INK2)
    handles, labels = axes[0].get_legend_handles_labels()
    fig.legend(handles, labels, frameon=False, fontsize=8, loc="lower center", ncol=4)
    fig.suptitle("Features 55–59 against the pinned v1 reference statistics: a current reference would give mean 0, SD 1", fontsize=10, color=INK, x=0.01, ha="left")
    fig.tight_layout(rect=(0, 0.06, 1, 1))
    fig.savefig(out.with_name("reference_stats_drift.png"), dpi=150, facecolor=SURFACE)

    md = [
        "# The pinned §35 sector reference statistics against the current data (DECISIONS entry 35)",
        "",
        "## Provenance",
        "",
        f"- File: `{rel}`, sha256 `{sha}`. The JSON carries no build date (keys: {', '.join(pinned)}); population `{pinned['population']}`, N = {pinned['n_businesses']:,}.",
        f"- Commits that touched it ({len(touches)}):",
    ]
    md += [f"  - `{c.split('|')[0]}` author date {c.split('|')[1]}, commit date {c.split('|')[2]}: {c.split('|')[3]}" for c in touches]
    first = touches[-1].split("|")[0]
    md += ["- Calibration commits that changed the generator afterwards (git ancestry, which is reliable here; dates are not, see below):"]
    for c, what in CALIBRATION_COMMITS.items():
        dates = git("log", "-1", "--format=author %ad, commit %cd", "--date=iso", c)
        md.append(f"  - `{c}` ({what}; {dates}): `{first}` is {'an ancestor' if is_ancestor(first, c) else 'NOT an ancestor'} of it.")
    md += [
        (
            f"- **Reading:** the file entered the repository in `{first}` and was never changed afterwards, and `{first}` comes before every calibration commit in the history. "
            "Its author date is later than two of the calibration commits' author dates only because it is a baseline commit grafted on 2026-09-17 to hold the pre-calibration tree; "
            "the topology, not the dates, is the evidence."
        ),
        "",
        "## Pinned against rebuilt-from-current (research population)",
        "",
        "| Sector | Base feature | Pinned mean | Current mean | Pinned SD | Current SD |",
        "|---|---|---|---|---|---|",
    ]
    md += [f"| {r['sector']} | `{r['base feature']}` | {r['pinned mean']:.4g} | {r['current mean']:.4g} | {r['pinned SD']:.4g} | {r['current SD']:.4g} |" for r in drift.to_dict("records")]
    md += [
        "",
        f"## Features 55–59 on the current data (research, scored + partial_profile, `{d}`)",
        "",
        "| Sector | Feature | N | Mean (expected 0) | SD (expected 1) |",
        "|---|---|---|---|---|",
    ]
    md += [f"| {r['sector']} | `{r['feature']}` | {r['n']:,} | {r['mean']:.2f} | {r['SD']:.2f} |" for r in moments.to_dict("records")]
    worst_mean = moments.loc[moments["mean"].abs().idxmax()]
    worst_sd = moments.loc[(moments["SD"] - 1).abs().idxmax()]
    md += [
        "",
        (
            f"Largest deviation of the mean: {worst_mean['feature']} in {worst_mean['sector']}, {worst_mean['mean']:.2f}. "
            f"Largest deviation of the SD: {worst_sd['feature']} in {worst_sd['sector']}, {worst_sd['SD']:.2f}. "
            "Chart: `reference_stats_drift.png`; tables: `reference_stats_drift_*.csv`."
        ),
        "",
        "Nothing is rebuilt by this script. The rebuild is proposed in DECISIONS entry 35, after entry 30.",
    ]
    out.write_text("\n".join(md) + "\n", encoding="utf-8")
    print("\n".join(md))
    print(f"\n→ {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
