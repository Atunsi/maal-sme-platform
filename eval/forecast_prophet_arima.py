"""Prophet and ARIMA against the shipped forecast candidates (DECISIONS entries 49 and 56).

    python -m eval.forecast_prophet_arima generate-holdout   → data/forecast_holdout/ (seed 44, IDs 20001–21000)
    python -m profile_engine.compute --dir data/forecast_holdout
    python -m eval.forecast_prophet_arima validate           → data/forecast_eval/validation_rows.csv
    python -m eval.forecast_prophet_arima test               → data/forecast_eval/test_rows.csv
    python -m eval.forecast_prophet_arima report             → eval/out/forecast_prophet_arima.md

The protocol is entry 56 and was committed before `prophet` or `statsmodels` was installed. This
harness adds nothing to it: scoring is eval/forecast_selection.py's own `evaluate` and `summarise`,
the windows are entry 27's, and the two new candidates are lenses/forecast/methods.py's.

    validate  research population, origin day 120, target days 121–150, eight candidates. The six
              entry-27 candidates are scored first and must reproduce eval/out/forecast_selection.md
              section 1 exactly, or the run stops before Prophet or ARIMA is fitted (56.6.5).
    test      the fresh population, origin day 150, target days 151–180, scored ONCE: the method
              validation chose, naive90, naive30, and arima and prophet for information (56.6.6).

`validate` and `test` refuse to run when their output already exists: a result is never a reason
to re-run (56.6.8). Businesses are independent and are split across worker processes by
business_id; seconds per business are measured inside the candidate's function, under that load.

Needs `pip install statsmodels prophet` — not in requirements.txt unless one of them is chosen (56.5).
"""

from __future__ import annotations

import argparse
import json
import os
import platform
import sys
import time
from concurrent.futures import ProcessPoolExecutor, as_completed
from importlib import metadata
from pathlib import Path

import numpy as np
import pandas as pd

from eval.forecast_selection import H, evaluate, summarise, table
from lenses.forecast import methods as fm

HOLDOUT = {"name": "forecast_holdout", "seed": 44, "id_range": [20001, 21000]}
HOLDOUT_DIR = Path("data/forecast_holdout")
OUT_DIR = Path("data/forecast_eval")
SELECTION_MD = Path("eval/out/forecast_selection.md")
REPORT_MD = Path("eval/out/forecast_prophet_arima.md")
EIGHT = {**fm.METHODS, **fm.EXTRA_METHODS}
TEST_ALWAYS = ["naive90", "naive30", "arima", "prophet"]
CHUNK = 40                                    # businesses per task handed to a worker


# --------------------------------------------------------------------------- #
# Scoring (the metric itself is eval/forecast_selection.evaluate — this only times it)
# --------------------------------------------------------------------------- #

def score(daily: pd.DataFrame, origin_from_end: int, names: list[str]) -> pd.DataFrame:
    """`evaluate` on `names`, with seconds per call and whether the call fell back to naive90."""
    seconds: dict[str, list[float]] = {n: [] for n in names}
    fell: dict[str, list[bool]] = {n: [] for n in names}

    def timed(name):
        fn = EIGHT[name]

        def run(hist, horizon, **kw):
            before = fm.FALLBACKS.get(name, 0)
            t0 = time.perf_counter()
            out = fn(hist, horizon, **kw)
            seconds[name].append(time.perf_counter() - t0)
            fell[name].append(fm.FALLBACKS.get(name, 0) > before)
            return out
        return run

    r = evaluate(daily, origin_from_end, methods={n: timed(n) for n in names})
    r["seconds"], r["fallback"] = np.nan, False
    for n in names:                            # evaluate() emits rows business by business, in order
        mask = (r["method"] == n).to_numpy()
        r.loc[mask, "seconds"] = seconds[n]
        r.loc[mask, "fallback"] = fell[n]
    return r


def _score_task(task) -> pd.DataFrame:
    daily, origin_from_end, names = task
    return score(daily, origin_from_end, names)


def score_parallel(daily: pd.DataFrame, origin_from_end: int, names: list[str], workers: int) -> pd.DataFrame:
    ids = daily["business_id"].drop_duplicates().to_numpy()
    groups = dict(tuple(daily.groupby("business_id", sort=False)))
    tasks = [(pd.concat([groups[i] for i in ids[k:k + CHUNK]]), origin_from_end, names) for k in range(0, len(ids), CHUNK)]
    parts, done, t0 = [], 0, time.time()
    with ProcessPoolExecutor(max_workers=workers) as pool:
        futures = [pool.submit(_score_task, t) for t in tasks]
        for f in as_completed(futures):
            parts.append(f.result())
            done += 1
            if done % 10 == 0 or done == len(tasks):
                print(f"  {names}: {done}/{len(tasks)} chunks, {time.time() - t0:.0f}s", flush=True)
    return pd.concat(parts, ignore_index=True)


def load_daily(d: Path) -> pd.DataFrame:
    """Scorable businesses' daily table — the same filter as eval/forecast_selection.main."""
    status = pd.read_csv(d / "profile_status.csv")
    biz = pd.read_csv(d / "businesses.csv")[["business_id", "population"]].merge(status, on="business_id")
    biz = biz[biz["status"] != "insufficient_data"]
    daily = pd.read_csv(d / "daily_aggregates.csv", parse_dates=["date"],
                        usecols=["business_id", "date", "net_flow", "outflow_total", "recurring_outflow_total", "eod_balance"])
    return daily.merge(biz[["business_id", "population"]], on="business_id").sort_values(["business_id", "date"])


def select(val: pd.DataFrame) -> str:
    """Entry 27's rule: lowest median error; the baseline if nothing beats it."""
    chosen = val.iloc[0]["method"]
    med = val.set_index("method")["median_err"]
    return fm.BASELINE if med[chosen] >= med[fm.BASELINE] else chosen


def environment(workers: int) -> dict:
    return {"python": platform.python_version(), "platform": platform.platform(), "cpu_count": os.cpu_count(), "workers": workers,
            **{p: metadata.version(p) for p in ("prophet", "cmdstanpy", "statsmodels", "numpy", "pandas", "scipy")}}


def _refuse_if_exists(path: Path) -> None:
    if path.exists():
        sys.exit(f"{path} already exists. Entry 56.6.8: the run is made once; a result is never a reason to re-run. "
                 "Delete it only to recover from a crash, and say so in the entry.")


def _single_thread_blas() -> None:
    for k in ("OMP_NUM_THREADS", "OPENBLAS_NUM_THREADS", "MKL_NUM_THREADS"):   # inherited by the workers
        os.environ[k] = "1"


# --------------------------------------------------------------------------- #
# Stages
# --------------------------------------------------------------------------- #

def generate_holdout() -> int:
    from generator.generate import generate, load_config, validate_and_write

    if (HOLDOUT_DIR / "businesses.csv").exists():
        sys.exit(f"{HOLDOUT_DIR} already holds a population; it is generated once (entry 56.3).")
    cfg = load_config("config.yaml")
    cfg["populations"] = {HOLDOUT["name"]: {"seed": HOLDOUT["seed"], "id_range": HOLDOUT["id_range"]}}
    cfg["demo_businesses"] = []
    tables = generate(cfg, quick=False)
    validate_and_write(tables, HOLDOUT_DIR)
    print(f"done → {HOLDOUT_DIR.resolve()}")
    return 0


def validate(args) -> int:
    rows_path = OUT_DIR / "validation_rows.csv"
    _refuse_if_exists(rows_path)
    _single_thread_blas()
    daily = load_daily(Path(args.dir))
    research = daily[daily["population"] == "research"]
    n = int(research["business_id"].nunique())

    t0 = time.time()
    six = score(research, 2 * H, list(fm.METHODS))
    six_table = table(summarise(six))
    recorded = SELECTION_MD.read_text(encoding="utf-8")
    if six_table not in recorded or f"N = {n:,}" not in recorded:
        print(six_table)
        sys.exit(f"STOP (entry 56.6.5): the six existing candidates do not reproduce {SELECTION_MD} section 1 (N here = {n:,}). "
                 "Nothing was fitted with Prophet or ARIMA.")
    print(f"six existing candidates reproduce {SELECTION_MD} section 1 exactly (N = {n:,}); fitting arima and prophet …", flush=True)

    extra = score_parallel(research, 2 * H, list(fm.EXTRA_METHODS), args.workers)
    rows = pd.concat([six, extra], ignore_index=True)
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    rows.to_csv(rows_path, index=False)
    val = summarise(rows)
    meta = {"stage": "validation", "n": n, "chosen": select(val), "wall_seconds": time.time() - t0,
            "finished": time.strftime("%Y-%m-%d %H:%M:%S"), **environment(args.workers)}
    (OUT_DIR / "validation_meta.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")
    print(table(val))
    print(f"validation selected: {meta['chosen']}")
    return 0


def test(args) -> int:
    rows_path = OUT_DIR / "test_rows.csv"
    _refuse_if_exists(rows_path)
    _single_thread_blas()
    chosen = json.loads((OUT_DIR / "validation_meta.json").read_text(encoding="utf-8"))["chosen"]
    names = list(dict.fromkeys([chosen, *TEST_ALWAYS]))
    daily = load_daily(HOLDOUT_DIR)
    ids = daily["business_id"]
    assert set(daily["population"]) == {HOLDOUT["name"]} and ids.min() >= HOLDOUT["id_range"][0] and ids.max() <= HOLDOUT["id_range"][1]
    n = int(ids.nunique())

    t0 = time.time()
    cheap = [m for m in names if m not in fm.EXTRA_METHODS]
    rows = pd.concat([score(daily, H, cheap), score_parallel(daily, H, [m for m in names if m in fm.EXTRA_METHODS], args.workers)],
                     ignore_index=True)
    rows.to_csv(rows_path, index=False)
    meta = {"stage": "test", "n": n, "chosen": chosen, "methods": names, "wall_seconds": time.time() - t0,
            "finished": time.strftime("%Y-%m-%d %H:%M:%S"), **environment(args.workers)}
    (OUT_DIR / "test_meta.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")
    print(table(summarise(rows)))
    return 0


def cost_table(rows: pd.DataFrame) -> str:
    lines = ["| method | businesses | fell back to naive90 | median seconds per business | mean seconds per business |", "|---|---|---|---|---|"]
    for m, g in rows.groupby("method", sort=False):
        fb = f"{int(g['fallback'].sum()):,} ({g['fallback'].mean():.1%})" if m in fm.EXTRA_METHODS else "—"
        lines.append(f"| {m} | {len(g):,} | {fb} | {g['seconds'].median():.4f} | {g['seconds'].mean():.4f} |")
    return "\n".join(lines)


def report(args) -> int:
    val_rows = pd.read_csv(OUT_DIR / "validation_rows.csv")
    vm = json.loads((OUT_DIR / "validation_meta.json").read_text(encoding="utf-8"))
    chosen = vm["chosen"]
    lines = [
        "# Forecast lens — Prophet and ARIMA against the shipped candidates (DECISIONS 49, 56)",
        "",
        "Data source: synthetic. Scorable businesses (§15). Horizon 30 days. Error = |projected − actual end balance| / avg monthly outflow.",
        "Protocol fixed and committed before either package was installed (DECISIONS entry 56). Scoring is",
        "`eval/forecast_selection.py`'s own `evaluate` and `summarise`.",
        "",
        f"## 1. Validation — days 121–150, research (N = {vm['n']:,}) — the method is chosen here",
        "",
        table(summarise(val_rows)),
        "",
        f"**Selected: `{chosen}`** (lowest median error{'; no candidate beat naive30, so the baseline is kept' if chosen == fm.BASELINE and summarise(val_rows).iloc[0]['method'] != fm.BASELINE else ''}).",
        "The six existing rows reproduce `eval/out/forecast_selection.md` section 1 exactly (checked by the harness before anything was fitted).",
        "",
        f"Cost on validation ({vm['workers']} worker processes for arima and prophet; the six others in one process):",
        "",
        cost_table(val_rows),
        "",
    ]
    if (OUT_DIR / "test_rows.csv").exists():
        test_rows = pd.read_csv(OUT_DIR / "test_rows.csv")
        tm = json.loads((OUT_DIR / "test_meta.json").read_text(encoding="utf-8"))
        info = [m for m in tm["methods"] if m in fm.EXTRA_METHODS and m != chosen]
        lines += [
            f"## 2. Test — fresh population (seed {HOLDOUT['seed']}, IDs {HOLDOUT['id_range'][0]}–{HOLDOUT['id_range'][1]}), days 151–180, N = {tm['n']:,} — scored once",
            "",
            table(summarise(test_rows)),
            "",
            f"Chosen on validation: `{chosen}`. " + (f"`{'` and `'.join(info)}` are shown for information only (entry 56.6.6); they could not change the choice." if info else ""),
            "",
            f"Cost on test ({tm['workers']} worker processes for arima and prophet):",
            "",
            cost_table(test_rows),
            "",
            "## 3. Environment",
            "",
(f"Python {tm['python']}, {tm['platform']}, {tm['cpu_count']} logical CPUs. prophet {tm['prophet']}, cmdstanpy {tm['cmdstanpy']}, "
            f"statsmodels {tm['statsmodels']}, numpy {tm['numpy']}, pandas {tm['pandas']}, scipy {tm['scipy']}."),
            f"Wall time: validation {vm['wall_seconds'] / 60:.0f} min (finished {vm['finished']}), test {tm['wall_seconds'] / 60:.0f} min (finished {tm['finished']}).",
            "",
        ]
    else:
        lines += ["## 2. Test — not run yet", ""]
    REPORT_MD.parent.mkdir(parents=True, exist_ok=True)
    REPORT_MD.write_bytes(("\n".join(lines) + "\n").encode("utf-8"))
    print("\n".join(lines))
    return 0


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("stage", choices=["generate-holdout", "validate", "test", "report"])
    ap.add_argument("--dir", default="data", help="research data directory (validate)")
    ap.add_argument("--workers", type=int, default=max(1, (os.cpu_count() or 2) - 2))
    args = ap.parse_args(argv)
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    if args.stage == "generate-holdout":
        return generate_holdout()
    return {"validate": validate, "test": test, "report": report}[args.stage](args)


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
