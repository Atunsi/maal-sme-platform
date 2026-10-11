"""Keep docs/NUMBERS.md honest — recompute each headline number from its source artifact.

    python -m eval.check_numbers          # exit 0 = every number present and current, 1 = drift

The register is only worth trusting if it cannot silently go stale. For every
number this script can recompute, it reads the value from the artifact that owns
it (model JSON, eval/out reports, the seeded latent replication), formats it the
way the register quotes it, and asserts that exact string appears in
docs/NUMBERS.md. Retraining the model or re-running an evaluation without updating
the register therefore fails here.

Needs no generated data: every source is committed or derived from config.yaml.
Numbers it cannot recompute (e.g. the Zakat nisab placeholder) are not listed;
those rows cite their source and are maintained by hand.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

import numpy as np
from scipy.stats import norm
from sklearn.metrics import roc_auc_score

from eval.latent_ceiling import draw_latents
from generator.generate import load_config

REGISTER = Path("docs/NUMBERS.md")
CI = r"([0-9.]+ \[[0-9.]+, [0-9.]+\])"


def _read(path: str) -> str:
    p = Path(path)
    if not p.exists():
        raise FileNotFoundError(f"source artifact missing: {path}")
    return p.read_text(encoding="utf-8")


def credit_model() -> list[tuple[str, str]]:
    a = json.loads(_read("lenses/credit/model_v1.json"))
    cv, s = a["cv"], a["serving_check"]
    return [
        ("A1 credit CV AUC", f"{cv['median']:.4f} [{cv['lo']:.4f}, {cv['hi']:.4f}]"),
        ("A1 N", f"{cv['n']:,} / {cv['defaults']}"),
        ("oracle ceiling (scorable)", f"{a['oracle_ceiling_auc']:.4f}"),
        ("credit share of ceiling", f"{a['pct_of_ceiling']:.1%}"),
        ("A5 serving AUC", f"{s['auc']:.3f} [{s['ci95'][0]:.3f}, {s['ci95'][1]:.3f}]"),
        ("A5 serving N", f"{s['n']} / {s['defaults']}"),
    ]


def real_vs_synthetic() -> list[tuple[str, str]]:
    t = _read("eval/out/real_vs_synthetic.md")
    row = next(ln for ln in t.splitlines() if ln.startswith("| **Unified"))
    syn, prim, sec = re.findall(r"\*\*" + CI + r"\*\*", row)[:3]
    temporal = re.search(r"Temporal split.*?\| " + CI, t).group(1)
    contiguous = re.search(r"Contiguous-ID.*?\| " + CI, t).group(1)
    return [("A2 synthetic (unified)", syn), ("A3 Berka primary", prim), ("A4 Berka secondary", sec),
            ("A8 Berka temporal (leakage check)", temporal), ("A7 contiguous-ID", contiguous)]


def table_rows(text: str) -> dict[str, list[str]]:
    rows = {}
    for ln in text.splitlines():
        if ln.startswith("|") and not ln.startswith("|:") and not ln.startswith("|-"):
            cells = [c.strip() for c in ln.strip("|").split("|")]
            rows[cells[0]] = cells
    return rows


def anomaly() -> list[tuple[str, str]]:
    r = table_rows(_read("eval/out/anomaly_eval.md"))
    rt, dp = r["round_trip_transfer"], r["duplicate_payment"]
    return [("held-out round-trip recall", rt[3]), ("held-out round-trip precision", rt[4]),
            ("held-out round-trip precision ceiling", rt[5]), ("held-out duplicate recall", dp[3])]


def forecast() -> list[tuple[str, str]]:
    t = _read("eval/out/forecast_backtest.md")
    m = re.search(r"\| model — [^|]*\| ([0-9.]+) \|", t).group(1)
    n = re.search(r"\| naive \(trailing[^|]*\| ([0-9.]+) \|", t).group(1)
    mape = re.search(r"model ([0-9.]+%), naive ([0-9.]+%)", t)
    return [("forecast model median error", m), ("forecast naive median error", n),
            ("forecast MAPE model", mape.group(1)), ("forecast MAPE naive", mape.group(2))]


def latents() -> list[tuple[str, str]]:
    df = draw_latents(load_config())
    res = df[df["population"] == "research"]
    y = res["default_label"].to_numpy()
    shock = 2.5 * (res["latent_market_shock_sensitivity"] - 0.5)
    w = res.groupby("sector").size() / len(res)
    bet = shock.groupby(res["sector"]).mean()
    between = float(((bet - (bet * w).sum()) ** 2 * w).sum()) / float(shock.var())
    p = res["p_default"]
    return [
        ("oracle ceiling (all research)", f"{roc_auc_score(y, res['latent_risk_index']):.4f}"),
        ("analytic approximation", f"{norm.cdf(float(res['logit'].std()) / np.sqrt(2)):.4f}"),
        ("within-sector share", f"{1 - between:.1%}"),
        ("decile risk ratio", f"{p.quantile(0.9) / p.quantile(0.1):.2f}×"),
        ("base default rate (all research)", f"{y.mean():.2%} ({int(y.sum())} / {len(y):,})"),
    ]


def section14() -> list[tuple[str, str]]:
    t = _read("eval/out/section14_rho_sweep.md")
    out = []
    for ln in t.splitlines():
        m = re.match(r"\|\s*(0\.[6-9])\s*\|\s*[0-9.]+\s*\|\s*([0-9.]+)\s*\|", ln)
        if m:
            out.append((f"§14 logit OOF rho={m.group(1)}", f"{float(m.group(2)):.4f}"))
    for label, pat in (("§14 baseline logistic C=1.0", r"logistic regression \(L2, C=1\.0\)\s+AUC=([0-9.]+)"),
                       ("§14 baseline untuned XGB", r"XGBoost, untuned.*?AUC=([0-9.]+)")):
        m = re.search(pat, t)
        if m:
            out.append((label, m.group(1)))
    tuned = [float(x) for x in re.findall(r"XGBoost, early-stopped.*?AUC=([0-9.]+)", t)]
    if tuned:
        out.append(("§14 baseline best tuned XGB", f"{max(tuned):.4f}"))
    return out


def gate() -> list[tuple[str, str]]:
    t = _read("eval/out/gate_week3_after_monshaat.txt")
    d = re.search(r"construction\s+implied_dso_days: min ([0-9.]+)\s+median ([0-9.]+)\s+max ([0-9.]+)\s+\(n=(\d+)\)", t)
    auc = re.search(r"in-sample logistic AUC on observables.*?: ([0-9.]+)", t).group(1)
    return [("gate construction DSO", f"{d.group(1)} / {d.group(2)} / {d.group(3)}"), ("gate construction n", f"{int(d.group(4)):,}"),
            ("A9 gate in-sample AUC", auc)]


def selectivity() -> list[tuple[str, str]]:
    t = _read("eval/out/exclusion_selectivity.md")
    return [(f"selectivity risk ratio {i}", v) for i, v in enumerate(re.findall(r"\*\*([0-9.]+)\*\*", t)[:2])]


def latency() -> list[tuple[str, str]]:
    t = _read("eval/out/latency_week7.md")
    def row(prefix: str, decimals: int = 0) -> str:
        ln = next(x for x in t.splitlines() if x.startswith(prefix))
        cells = [c.strip() for c in ln.strip("|").split("|")]
        p50, p95, _, mx = (float(c) for c in cells[2:6])
        return f"{p50:.{decimals}f} / {p95:.{decimals}f} / {mx:.{decimals}f} ms"
    return [("latency credit (all 1,000)", row("| `/lenses/credit` |")),
            ("latency credit over HTTP", row("| `/lenses/credit` over")),
            ("latency anomaly", row("| `/lenses/anomaly` |")),
            ("latency SHAP", row("| SHAP generation", 3))]


def sharia() -> list[tuple[str, str]]:
    t = _read("eval/out/sharia_screen.md")
    sec = t.split("## research")[1].split("## serving")[0]
    share = dict(re.findall(r"\| (compliant|soft_flag_review|hard_flag) \| ([0-9.]+%) \|", sec))
    basis = re.search(r"declared MCC ([0-9.]+%), registered sector ([0-9.]+%)\. Existing-financing disclosure asked of ([0-9.]+%)", sec)
    return [("sharia research distribution", f"{share['compliant']} compliant / {share['soft_flag_review']} soft_flag_review / {share['hard_flag']} hard_flag"),
            ("sharia evidence basis", f"declared MCC {basis.group(1)} · registered sector {basis.group(2)} · disclosure asked of {basis.group(3)}")]


def forecast_selection() -> list[tuple[str, str]]:
    t = _read("eval/out/forecast_selection.md")
    chosen = re.search(r"\*\*Selected: `([a-z0-9_]+)`\*\*", t).group(1)
    serving = t.split("### serving")[1]
    rows = {r.split("|")[1].strip(): r.split("|")[2].strip() for r in serving.splitlines() if r.startswith("| naive")}
    return [("forecast selected method", f"`{chosen}`"),
            ("forecast serving test errors", f"{rows[chosen]} vs {rows['naive30']} serving")]


def main() -> int:
    reg = REGISTER.read_text(encoding="utf-8")
    checks, missing_sources = [], []
    for fn in (credit_model, real_vs_synthetic, anomaly, forecast, latents, section14, gate, selectivity, latency, sharia, forecast_selection):
        try:
            checks += fn()
        except (FileNotFoundError, AttributeError, KeyError, StopIteration, ValueError) as e:
            missing_sources.append(f"{fn.__name__}: {e}")
    drift = [(label, val) for label, val in checks if val not in reg]
    print(f"checked {len(checks)} numbers against their source artifacts")
    for label, val in checks:
        print(f"  {'ok   ' if (label, val) not in drift else 'DRIFT'} {label:42s} {val}")
    for m in missing_sources:
        print(f"  SOURCE PROBLEM  {m}")
    if drift or missing_sources:
        print(f"\nNUMBERS REGISTER OUT OF DATE — {len(drift)} value(s) not in docs/NUMBERS.md, {len(missing_sources)} source problem(s)")
        return 1
    print("\nNUMBERS REGISTER CURRENT")
    return 0


if __name__ == "__main__":
    sys.exit(main())
