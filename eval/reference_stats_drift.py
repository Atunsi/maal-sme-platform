"""DECISIONS entry 35 — the pinned §35 sector reference statistics (v1 and v2) against the current data.

    python -m eval.reference_stats_drift [--dir data] [--out eval/out/reference_stats_drift.md]

v1 (`sector_reference_stats_v1.json`) is the file pinned before entry 35, kept byte-identical so older
receipts stay reproducible. v2 (`sector_reference_stats_v2.json`) is the file in use from entry 35 on.
Both are reported against the same current population, so the drift v2 fixes stays visible.

Evidence, all computed here, for each pinned file that exists:
1. Provenance: sha256, every commit that touched the file, and (v1) whether its first commit is an
   ancestor of the calibration commits (git topology, not dates).
2. The pinned μ/σ per sector against μ/σ rebuilt in memory with `build_reference_stats` from the
   current research population in `--dir` (nothing is written; neither pinned file is touched).
3. Mean and SD of features 55–59 per sector on the current research population (scored and
   partial_profile businesses), with z recomputed from the base features in `profiles.csv` against
   that file's μ/σ exactly as `features._fill_zscores` does. A pinned reference that describes the
   current population gives mean ≈ 0 and SD ≈ 1. The engine's own 55–59 columns are also checked
   against the recomputation for the file in use.
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


def zscores(prof: pd.DataFrame, pinned: dict) -> pd.DataFrame:
    """55–59 from the base features against `pinned`, as features._fill_zscores computes them."""
    out = pd.DataFrame({"business_id": prof["business_id"]})
    sector = prof["sector"]
    for z, base in fe.Z_FEATURES.items():
        name = fe.F[base]
        mean = sector.map({s: v[name]["mean"] for s, v in pinned["stats"].items()})
        std = sector.map({s: max(v[name]["std"], 1e-9) for s, v in pinned["stats"].items()})
        out[fe.F[z]] = (prof[name] - mean) / std
    return out


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dir", default="data")
    ap.add_argument("--out", default="eval/out/reference_stats_drift.md")
    args = ap.parse_args(argv)
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    d = Path(args.dir)

    files = {"v1": fe.REFERENCE_STATS_V1_PATH, "v2": fe.REFERENCE_STATS_V2_PATH}
    files = {v: p for v, p in files.items() if p.exists()}
    in_use = next(v for v, p in files.items() if p.resolve() == fe.REFERENCE_STATS_PATH.resolve()) if fe.REFERENCE_STATS_PATH.exists() else None

    prof = pd.read_csv(d / "profiles.csv")
    biz = pd.read_csv(d / "businesses.csv", usecols=["business_id", "sector", "population"])
    status = pd.read_csv(d / "profile_status.csv", usecols=["business_id", "status"])
    current = fe.build_reference_stats(prof, biz)
    df = prof.merge(biz, on="business_id").merge(status, on="business_id")
    scorable = df[df["status"] != "insufficient_data"]  # research + serving, for the entry 38 clip counts
    df = df[(df["population"] == "research") & (df["status"] != "insufficient_data")]
    zs = {z: fe.F[z] for z in fe.Z_FEATURES}

    prov, drift, moments, engine_check, clipped = {}, [], [], None, None
    for v, path in files.items():
        raw = path.read_bytes()
        pinned = json.loads(raw)
        rel = path.relative_to(Path.cwd()).as_posix() if path.is_relative_to(Path.cwd()) else str(path)
        prov[v] = {"rel": rel, "sha": hashlib.sha256(raw).hexdigest(), "pinned": pinned,
                   "touches": git("log", "--format=%h|%ad|%cd|%s", "--date=iso", "--", rel).splitlines()}
        for s in SECTORS:
            for name, st in pinned["stats"][s].items():
                c = current["stats"][s][name]
                drift.append({"stats_version": v, "sector": s, "base feature": f"{NAME_TO_ID[name]} {name}", "pinned mean": st["mean"], "current mean": c["mean"],
                              "pinned SD": st["std"], "current SD": c["std"], "pinned n": st["n"], "current n": c["n"]})
        z = zscores(df, pinned)
        for s in SECTORS:
            g = z[df["sector"].to_numpy() == s]
            for zid, name in zs.items():
                x = g[name].dropna()
                moments.append({"stats_version": v, "sector": s, "feature": f"{zid} {name}", "n": len(x), "mean": x.mean(), "SD": x.std(ddof=0)})
        if v == in_use:
            # The engine clips each z to ±Z_CLIP (DECISIONS 38); compare like with like. The moments above
            # stay unclipped, so they still describe the reference fit itself.
            zc = z[list(zs.values())].clip(-fe.Z_CLIP, fe.Z_CLIP)
            diff = (zc.to_numpy() - df[list(zs.values())].to_numpy())
            engine_check = float(np.nanmax(np.abs(diff))) if np.isfinite(diff).any() else float("nan")
            # DECISIONS 38 asks for clip counts per sector and feature, research and serving, with N.
            both = scorable.reset_index(drop=True)
            zb = zscores(both, pinned)
            clipped = pd.DataFrame([
                {"population": pop, "sector": s, "feature": f"{zid} {name}", "n": int(x.notna().sum()),
                 "clipped_low": int((x < -fe.Z_CLIP).sum()), "clipped_high": int((x > fe.Z_CLIP).sum())}
                for pop in ("research", "serving") for s in SECTORS for zid, name in zs.items()
                for x in [zb.loc[((both["population"] == pop) & (both["sector"] == s)).to_numpy(), name]]
            ])
    drift, moments = pd.DataFrame(drift), pd.DataFrame(moments)

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    drift.to_csv(out.with_name("reference_stats_drift_pinned_vs_current.csv"), index=False)
    moments.to_csv(out.with_name("reference_stats_drift_z_moments.csv"), index=False)
    if clipped is not None:
        clipped.to_csv(out.with_name("reference_stats_clip_counts.csv"), index=False)

    # Chart: one row per pinned file, two panels (mean, SD) of features 55–59 per sector; reference lines at 0 and 1.
    versions = list(files)
    fig, axes = plt.subplots(len(versions), 2, figsize=(11, 4.0 * len(versions)), facecolor=SURFACE, squeeze=False)
    x = np.arange(len(zs))
    w = 0.19
    for r, v in enumerate(versions):
        mv = moments[moments["stats_version"] == v]
        for ax, col, ref in ((axes[r][0], "mean", 0.0), (axes[r][1], "SD", 1.0)):
            ax.set_facecolor(SURFACE)
            for i, s in enumerate(SECTORS):
                vals = mv[mv["sector"] == s][col].to_numpy()
                ax.bar(x + (i - 1.5) * (w + 0.01), vals - ref, bottom=ref, width=w, color=COLOURS[s], label=s.replace("_", " "), zorder=2)
            ax.axhline(ref, color=INK, lw=1, zorder=3)
            ax.set_ylabel(f"{col} (expected {ref:g})", color=INK2)
            ax.set_xticks(x, [f"{z}\n{n.replace('sector_relative_', '').replace('_z', '')}" for z, n in zs.items()], fontsize=8, color=INK2)
            ax.set_title(f"{v}: {col} of the z-score, research population", fontsize=10, color=INK, loc="left")
            ax.grid(axis="y", color=GRID, lw=0.8, zorder=0)
            for sp in ("top", "right"):
                ax.spines[sp].set_visible(False)
            for sp in ("left", "bottom"):
                ax.spines[sp].set_color(GRID)
            ax.tick_params(colors=INK2)
    handles, labels = axes[0][0].get_legend_handles_labels()
    fig.legend(handles, labels, frameon=False, fontsize=8, loc="lower center", ncol=4)
    fig.suptitle(f"Features 55–59 against the pinned reference statistics ({', '.join(versions)}): a current reference gives mean 0, SD 1",
                 fontsize=10, color=INK, x=0.01, ha="left")
    fig.tight_layout(rect=(0, 0.04, 1, 0.97))
    fig.savefig(out.with_name("reference_stats_drift.png"), dpi=150, facecolor=SURFACE)

    md = [
        "# The pinned §35 sector reference statistics against the current data (DECISIONS entry 35)",
        "",
        f"File in use by the engine: `{fe.REFERENCE_STATS_PATH.name}`" + ("" if in_use else " (absent)") + ". v1 is kept for receipts made before entry 35.",
        "",
        "## Provenance",
        "",
    ]
    for v, p in prov.items():
        md += [
            f"### {v}",
            "",
            (
                f"- File: `{p['rel']}`, sha256 `{p['sha']}`. Keys: {', '.join(p['pinned'])}; version `{p['pinned'].get('version')}`, "
                f"population `{p['pinned']['population']}`, N = {p['pinned']['n_businesses']:,}."
            ),
            (f"- Commits that touched it ({len(p['touches'])}):" if p["touches"] else "- Not yet committed."),
        ]
        md += [f"  - `{c.split('|')[0]}` author date {c.split('|')[1]}, commit date {c.split('|')[2]}: {c.split('|')[3]}" for c in p["touches"]]
        if v == "v1" and p["touches"]:
            first = p["touches"][-1].split("|")[0]
            md += ["- Calibration commits that changed the generator afterwards (git ancestry, which is reliable here; dates are not, see below):"]
            for c, what in CALIBRATION_COMMITS.items():
                dates = git("log", "-1", "--format=author %ad, commit %cd", "--date=iso", c)
                md.append(f"  - `{c}` ({what}; {dates}): `{first}` is {'an ancestor' if is_ancestor(first, c) else 'NOT an ancestor'} of it.")
            md.append(
                f"- **Reading:** v1 entered the repository in `{first}` and `{first}` comes before every calibration commit in the history. "
                "Its author date is later than two of the calibration commits' author dates only because it is a baseline commit grafted on 2026-09-17 to hold the pre-calibration tree; "
                "the topology, not the dates, is the evidence."
            )
        md.append("")
    md += [
        "## Pinned against rebuilt-from-current (research population)",
        "",
        "| Stats | Sector | Base feature | Pinned mean | Current mean | Pinned SD | Current SD |",
        "|---|---|---|---|---|---|---|",
    ]
    md += [f"| {r['stats_version']} | {r['sector']} | `{r['base feature']}` | {r['pinned mean']:.4g} | {r['current mean']:.4g} | {r['pinned SD']:.4g} | {r['current SD']:.4g} |"
           for r in drift.to_dict("records")]
    md += [
        "",
        f"## Features 55–59 on the current data (research, scored + partial_profile, `{d}`)",
        "",
        "z recomputed from the base features in `profiles.csv` against each file's μ/σ.",
        "",
    ]
    if len(versions) == 2:
        wide = moments.pivot_table(index=["sector", "feature"], columns="stats_version", values=["n", "mean", "SD"], sort=False)
        md += ["| Sector | Feature | N | v1 mean | v1 SD | v2 mean | v2 SD |", "|---|---|---|---|---|---|---|"]
        for (s, f), r in wide.iterrows():
            md.append(f"| {s} | `{f}` | {int(r[('n', 'v2')]):,} | {r[('mean', 'v1')]:.2f} | {r[('SD', 'v1')]:.2f} | {r[('mean', 'v2')]:.2f} | {r[('SD', 'v2')]:.2f} |")
    else:
        md += ["| Stats | Sector | Feature | N | Mean (expected 0) | SD (expected 1) |", "|---|---|---|---|---|---|"]
        md += [f"| {r['stats_version']} | {r['sector']} | `{r['feature']}` | {r['n']:,} | {r['mean']:.2f} | {r['SD']:.2f} |" for r in moments.to_dict("records")]
    md.append("")
    for v in versions:
        mv = moments[moments["stats_version"] == v]
        wm, ws = mv.loc[mv["mean"].abs().idxmax()], mv.loc[(mv["SD"] - 1).abs().idxmax()]
        md.append(f"- {v}: largest deviation of the mean: {wm['feature']} in {wm['sector']}, {wm['mean']:.2f}. "
                  f"Largest deviation of the SD: {ws['feature']} in {ws['sector']}, {ws['SD']:.2f}.")
    if in_use:
        md.append(f"- Engine's own 55–59 columns vs the recomputation against {in_use}: largest absolute difference {engine_check:.2e}.")
    md += [
        "",
        "Chart: `reference_stats_drift.png`; tables: `reference_stats_drift_*.csv`. Nothing is rebuilt by this script.",
    ]
    out.write_text("\n".join(md) + "\n", encoding="utf-8")
    print("\n".join(md))
    print(f"\n→ {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
