"""Synthetic SME data generator — Behavioral Profile Feature Schema v2.9.

Outputs the three tables the schema requires (§7) plus the registry / label
files the eval harness needs:

  transactions.csv        raw dated inflows/outflows with counterparties
  daily_aggregates.csv    per-business daily summaries — what GET /profile reads
  balances_monthly.csv    end-of-month cash / inventory / AR / AP / STL (features 27–31)
  businesses.csv          registry: sector, size, age tier, start date, MCC
  labels.csv              default_label per business (training target)
  latents_hidden.csv      §14 latent variables + p_default — EVAL ONLY, never engine input
  injected_anomalies.csv  ground truth for the *injected* anomaly types (§12)

Design points that map straight to the schema:
  §12  every generative parameter comes from config.yaml; nothing is hard-coded here
  §14  default labels are a function of two hidden latents + noise. Observables
       are ρ-correlated reflections of the latent risk index, each with its own
       independent noise. Sector-conditional Beta(α_s, β_s) is preserved through
       to the label (the previous version standardised it away).
  §20  sector → size | sector → age | sector × size
  §23  per-population seed; per-business RNG keyed on (seed, business_id) so a
       business is reproducible regardless of what else is generated
  §24  balance sheets derive from the business's own realised cash flows
  §29  data_source stamped on every row at generation

Run (from the repo root):
      python -m generator.generate            (full: N=10,000 research + N=1,000 serving)
      python -m generator.generate --quick    (first quick_mode_n_per_population of each)
"""

from __future__ import annotations

import argparse
import itertools
import math
import sys
import time
from pathlib import Path

import numpy as np
import pandas as pd
import yaml
from scipy.special import expit
from scipy.stats import norm

from generator import schemas

# --------------------------------------------------------------------------- #
# Config + calendar helpers (also imported by eval/gate_week3.py)
# --------------------------------------------------------------------------- #

CP_TYPES = np.array(schemas.COUNTERPARTY_TYPES)
CATEGORIES = np.array(schemas.CATEGORIES)
CP_CUSTOMER, CP_SUPPLIER, CP_LANDLORD, CP_PAYROLL, CP_FI, CP_OTHER = range(6)
CAT_SALES, CAT_SUPPLIER, CAT_RENT, CAT_PAYROLL, CAT_LOAN, CAT_TRANSFER = range(6)
RECURRING_CATS = (CAT_RENT, CAT_PAYROLL, CAT_LOAN)


def load_config(path: str | Path = "config.yaml") -> dict:
    with open(path, encoding="utf-8") as f:
        cfg = yaml.safe_load(f)
    _check_config(cfg)
    return cfg


def _check_config(cfg: dict) -> None:
    """Fail fast on the §20 / §23 invariants instead of generating garbage."""
    ssd = cfg["sector_size_distribution"]
    w = sum(v["weight"] for v in ssd.values())
    assert abs(w - 1.0) < 1e-6, f"sector weights sum to {w}, not 1.0 (§20)"
    for s, v in ssd.items():
        t = sum(v["size_tiers"].values())
        assert abs(t - 1.0) < 1e-6, f"{s} size_tiers sum to {t}, not 1.0 (§20)"
        for size, ages in cfg["age_tier_distribution"][s].items():
            a = sum(ages.values())
            assert abs(a - 1.0) < 1e-6, f"age tiers for {s}/{size} sum to {a} (§20)"
    pops = cfg["populations"]
    seeds = [p["seed"] for p in pops.values()]
    assert len(set(seeds)) == len(seeds), "population seeds must differ (§23)"
    ranges = sorted((p["id_range"][0], p["id_range"][1]) for p in pops.values())
    for (_, hi), (lo, _) in itertools.pairwise(ranges):
        assert hi < lo, "population ID ranges must be disjoint (§23)"
    for d in cfg.get("demo_businesses", []):
        assert any(p["id_range"][0] <= d["id"] <= p["id_range"][1] for p in pops.values()), (
            f"demo business {d['id']} is outside every population range"
        )


def calendar_masks(cfg: dict, dates: pd.DatetimeIndex) -> dict[str, np.ndarray]:
    """Boolean masks over `dates` for the Hijri seasonal windows in config (§22)."""
    n = len(dates)
    m = {k: np.zeros(n, dtype=bool) for k in ("pre_ramadan_10d", "ramadan", "eid", "post_eid_7d")}
    for e in cfg["ramadan_calendar"]:
        rs, re_ = pd.Timestamp(e["ramadan_start"]), pd.Timestamp(e["ramadan_end"])
        es, ee = pd.Timestamp(e["eid_start"]), pd.Timestamp(e["eid_end"])
        m["ramadan"] |= (dates >= rs) & (dates <= re_)
        m["eid"] |= (dates >= es) & (dates <= ee)
        m["pre_ramadan_10d"] |= (dates >= rs - pd.Timedelta(days=10)) & (dates < rs)
        m["post_eid_7d"] |= (dates > ee) & (dates <= ee + pd.Timedelta(days=7))
    return m


def seasonal_multiplier(cfg: dict, sector: str, dates: pd.DatetimeIndex) -> np.ndarray:
    masks = calendar_masks(cfg, dates)
    mult = np.ones(len(dates))
    sm = cfg["seasonality_multipliers"][sector]
    for key in ("pre_ramadan_10d", "ramadan", "eid", "post_eid_7d"):
        mult[masks[key]] = sm[key]
    return mult


def activity_level(dates: pd.DatetimeIndex, econ: dict) -> np.ndarray:
    """Relative activity per calendar day: 1.0 on operating days, `weekend_activity` otherwise.

    Saudi weekend is Fri/Sat (pandas dayofweek: Mon=0 … Sun=6). This is what
    makes feature 33 (`data_gap_ratio`, operating-day denominator) differ from
    feature 32 (`coverage_days_90d`, calendar-day denominator) — §15.
    """
    mode = econ["operating_days"]
    if mode == "all_week":
        return np.ones(len(dates))
    if mode == "sun_thu":
        return np.where(np.isin(dates.dayofweek, [4, 5]), float(econ["weekend_activity"]), 1.0)
    raise ValueError(f"unknown operating_days mode: {mode}")


def trailing_monthly_mean(daily_values: np.ndarray, end_idx: int, days: int = 90) -> tuple[float, int]:
    """Mean per-30-days total over the trailing `days` ending at end_idx (inclusive).

    Shared with the gate harness so generator and evaluator agree on the
    definition of avg_monthly_inflow / avg_monthly_outflow (features 1, 6).
    """
    lo = max(0, end_idx - days + 1)
    n = end_idx - lo + 1
    return float(daily_values[lo : end_idx + 1].sum() / (n / 30.0)), n


def latent_index_stats(cfg: dict) -> dict[str, float]:
    """Analytic mean/sd of the latent risk index r over the sector mixture.

    r = a·(shock − 0.5) − b·(mgmt − 0.5). Computed from config alone so that a
    business's observables never depend on which other businesses were drawn.
    """
    dlm = cfg["default_label_model"]
    a, b = dlm["shock_coef"], dlm["management_coef"]

    def beta_mv(p):
        al, be = p["alpha"], p["beta"]
        mean = al / (al + be)
        var = al * be / ((al + be) ** 2 * (al + be + 1))
        return mean, var

    mgmt_mean, mgmt_var = beta_mv(cfg["latents"]["management_quality"])
    mu, second = 0.0, 0.0
    for sector, spec in cfg["sector_size_distribution"].items():
        w = spec["weight"]
        s_mean, s_var = beta_mv(cfg["latents"]["market_shock_sensitivity"][sector])
        comp_mean = a * (s_mean - 0.5)
        mu += w * comp_mean
        second += w * (a * a * s_var + comp_mean**2)
    shock_var_total = second - mu**2
    mu -= b * (mgmt_mean - 0.5)
    sd = math.sqrt(shock_var_total + b * b * mgmt_var)
    return {"mu": mu, "sd": sd}


# --------------------------------------------------------------------------- #
# Sampling the registry row (§20 three-stage, §12 demo overrides)
# --------------------------------------------------------------------------- #


def sample_registry(cfg: dict, pop_name: str, pop: dict, b_id: int, demo: dict | None) -> dict:
    rng = np.random.default_rng([pop["seed"], b_id, 0])
    ssd = cfg["sector_size_distribution"]
    sectors = list(ssd)
    sector = rng.choice(sectors, p=[ssd[s]["weight"] for s in sectors])
    tiers = ssd[sector]["size_tiers"]
    size = rng.choice(list(tiers), p=list(tiers.values()))
    ages = cfg["age_tier_distribution"][sector][size]
    age = rng.choice(list(ages), p=list(ages.values()))
    start = pd.Timestamp(cfg["start_date"])
    op_start = start
    if age == "<1yr":
        lo, hi = cfg["thin_file"]["under_1yr_operating_start_offset_days"]
        op_start = start + pd.Timedelta(days=int(rng.integers(lo, hi + 1)))

    row = {
        "business_id": b_id,
        "population": pop_name,
        "seed": pop["seed"],
        "sector": str(sector),
        "size_tier": str(size),
        "age_tier": str(age),
        "start_date": start,
        "operating_start_date": op_start,
        "zakat_seed": None,
        "inject_cash_crunch": None,
        "inject_anomalies": [],
        "name": None,
    }
    if demo:  # fully specified in config so the contrast is reproducible on demand (§12)
        row["sector"] = demo.get("sector", row["sector"])
        row["size_tier"] = demo.get("size_tier", row["size_tier"])
        row["age_tier"] = demo.get("age_tier", row["age_tier"])
        row["start_date"] = pd.Timestamp(demo.get("start_date", cfg["start_date"]))
        row["operating_start_date"] = pd.Timestamp(demo.get("operating_start_date", row["start_date"]))
        row["zakat_seed"] = demo.get("zakat_seed")
        row["inject_cash_crunch"] = demo.get("inject_cash_crunch")
        row["inject_anomalies"] = demo.get("inject_anomalies", [])
        row["name"] = demo.get("name")
    row["window_end"] = row["start_date"] + pd.Timedelta(days=cfg["window_days"] - 1)
    mccs = cfg["sector_economics"][row["sector"]]["mcc_codes"]
    row["declared_mcc_code"] = int(rng.choice(mccs))
    return row


# --------------------------------------------------------------------------- #
# One business → transactions, daily aggregates, monthly balances, label
# --------------------------------------------------------------------------- #


def _lognormal_unit_mean(rng, sigma, size):
    return rng.lognormal(-0.5 * sigma * sigma, sigma, size)


def generate_business(cfg: dict, biz: dict, stats: dict) -> dict:
    rng = np.random.default_rng([biz["seed"], biz["business_id"], 1])
    sec = biz["sector"]
    econ = cfg["sector_economics"][sec]
    arch = cfg["balance_sheet_archetypes"][sec]
    om = cfg["observable_mapping"]
    T = cfg["window_days"]
    dates = pd.date_range(biz["start_date"], periods=T, freq="D")
    b_id = biz["business_id"]

    # ---- §14 latents → label -------------------------------------------------
    lm = cfg["latents"]
    mgmt = rng.beta(lm["management_quality"]["alpha"], lm["management_quality"]["beta"])
    sp = lm["market_shock_sensitivity"][sec]
    shock = rng.beta(sp["alpha"], sp["beta"])
    dlm = cfg["default_label_model"]
    r = dlm["shock_coef"] * (shock - 0.5) - dlm["management_coef"] * (mgmt - 0.5)
    logit = dlm["intercept"] + r + rng.normal(0.0, dlm["label_noise_sigma"])
    p_default = float(expit(logit))
    default_label = int(rng.random() < p_default)

    # ---- §14 observables: ρ-correlated, independently-noised ranks -------------
    z_l = (r - stats["mu"]) / stats["sd"]
    rho = cfg["latent_to_observable_correlation"]
    tail = math.sqrt(1.0 - rho * rho)

    def u_obs() -> float:  # each call = fresh independent noise
        return float(norm.cdf(rho * z_l + tail * rng.normal()))

    u_vol, u_buf, u_cost, u_dso, u_dio, u_dpo, u_trend, u_conc, u_stl = (u_obs() for _ in range(9))

    def band(lo_hi, u):
        return lo_hi[0] + u * (lo_hi[1] - lo_hi[0])

    # ---- economics ------------------------------------------------------------
    scale = cfg["size_tier_scale"][biz["size_tier"]]
    monthly_inflow = econ["base_monthly_inflow_sar"] * scale * rng.lognormal(0.0, om["idiosyncratic_scale_sigma"])
    activity = activity_level(dates, econ)
    op_frac = activity.mean()
    active = np.asarray(dates >= biz["operating_start_date"])
    season = seasonal_multiplier(cfg, sec, dates)
    growth = (0.5 - u_trend) * om["window_growth_range"]
    trend = 1.0 + growth * np.arange(T) / (T - 1)
    crunch = np.ones(T)
    if biz["inject_cash_crunch"]:
        wk = biz["inject_cash_crunch"]["week"]
        crunch[np.arange(T) // 7 + 1 >= wk] = 1.0 - biz["inject_cash_crunch"]["severity_pct"] / 100.0
    demand = trend * season * crunch * activity * active  # shape (T,)
    tx_rate = activity * active  # transaction counts scale with activity, not with seasonal amount

    # inflows: persistent AR(1) log-rate shock on arrivals (lumpiness ↑ with latent risk),
    # Poisson count given that rate, per-transaction amount so E[day total] = expected.
    tx_scale = cfg["size_tier_tx_scale"][biz["size_tier"]]
    lam_in = econ["inflow_tx_per_day"] * tx_scale
    expected_in = monthly_inflow / (30.0 * op_frac) * demand
    disp = band(om["inflow_dispersion_sigma"], u_vol)
    phi = om["inflow_dispersion_persistence"]
    x = np.empty(T)
    x[0] = rng.normal(0.0, disp)
    innov = rng.normal(0.0, disp * math.sqrt(1.0 - phi * phi), T)
    for t in range(1, T):
        x[t] = phi * x[t - 1] + innov[t]
    day_shock = np.exp(x - 0.5 * disp * disp)  # stationary mean 1
    n_in_day = rng.poisson(lam_in * tx_rate * day_shock)
    day_in = np.repeat(np.arange(T), n_in_day)
    sigma_in = float(np.clip(econ["daily_cv"] * band(om["amount_dispersion_multiplier"], u_vol), 0.1, 1.5))
    per_tx_in = expected_in / np.maximum(lam_in * tx_rate, 1e-9)  # E[day total] = λ·activity·E[shock] · per-tx mean
    amt_in = per_tx_in[day_in] * _lognormal_unit_mean(rng, sigma_in, len(day_in))
    hrs = econ["business_hours"]
    hour_in = rng.integers(hrs[0], hrs[1], len(day_in)) % 24

    # counterparties (features 5, 20–22, 45): Dirichlet weights, concentration ↑ with risk
    n_cust = int(rng.integers(econ["customer_pool"][0], econ["customer_pool"][1] + 1))
    alpha = band(om["counterparty_dirichlet_alpha"], u_conc)
    cust_w = rng.dirichlet(np.full(n_cust, alpha))
    cust_idx = rng.choice(n_cust, len(day_in), p=cust_w)

    # outflows
    cost_ratio = econ["cost_ratio"] * band(om["cost_ratio_multiplier"], u_cost)
    monthly_outflow = monthly_inflow * cost_ratio
    rec_monthly = monthly_outflow * econ["recurring_share"]
    rent = rec_monthly * econ["rent_share_of_recurring"]
    payroll = rec_monthly - rent
    has_fin = rng.random() < cfg["financing"]["share_of_businesses"]
    loan = monthly_outflow * cfg["financing"]["monthly_outflow_share"] if has_fin else 0.0

    dom = dates.day.to_numpy()
    rec_day, rec_amt, rec_cat, rec_cp = [], [], [], []
    for day_of_month, amount, cat, cp in ((1, rent, CAT_RENT, CP_LANDLORD), (27, payroll, CAT_PAYROLL, CP_PAYROLL), (5, loan, CAT_LOAN, CP_FI)):
        if amount <= 0:
            continue
        idx = np.where((dom == day_of_month) & active)[0]
        rec_day.append(idx)
        rec_amt.append(np.full(len(idx), amount) * _lognormal_unit_mean(rng, 0.02, len(idx)))
        rec_cat.append(np.full(len(idx), cat))
        rec_cp.append(np.full(len(idx), cp))

    lam_out = econ["outflow_tx_per_day"] * tx_scale
    expected_var = monthly_outflow * (1 - econ["recurring_share"]) / (30.0 * op_frac) * demand
    n_out_day = rng.poisson(lam_out * tx_rate)
    day_var = np.repeat(np.arange(T), n_out_day)
    per_tx_out = expected_var / np.maximum(lam_out * tx_rate, 1e-9)
    amt_var = per_tx_out[day_var] * _lognormal_unit_mean(rng, 0.5, len(day_var))
    n_sup = int(rng.integers(econ["supplier_pool"][0], econ["supplier_pool"][1] + 1))
    sup_idx = rng.choice(n_sup, len(day_var), p=rng.dirichlet(np.full(n_sup, 2.0)))

    day_out = np.concatenate([day_var] + rec_day) if rec_day else day_var
    amt_out = np.concatenate([amt_var] + rec_amt) if rec_amt else amt_var
    cat_out = np.concatenate([np.full(len(day_var), CAT_SUPPLIER)] + rec_cat) if rec_cat else np.full(len(day_var), CAT_SUPPLIER)
    cptype_out = np.concatenate([np.full(len(day_var), CP_SUPPLIER)] + rec_cp) if rec_cp else np.full(len(day_var), CP_SUPPLIER)
    cpid_out = np.empty(len(day_out), dtype=object)
    cpid_out[: len(day_var)] = [f"SUP-{b_id}-{k}" for k in sup_idx]
    cpid_out[len(day_var) :] = [
        {CP_LANDLORD: f"LANDLORD-{b_id}", CP_PAYROLL: f"PAYROLL-{b_id}", CP_FI: f"FI-{b_id % 7}"}[int(t)]
        for t in cptype_out[len(day_var) :]
    ]
    hour_out = rng.integers(9, 17, len(day_out))

    # ---- assemble transactions -------------------------------------------------
    day = np.concatenate([day_in, day_out])
    hour = np.concatenate([hour_in, hour_out])
    direction = np.concatenate([np.ones(len(day_in), dtype=np.int8), np.zeros(len(day_out), dtype=np.int8)])
    amount = np.concatenate([amt_in, amt_out])
    cptype = np.concatenate([np.full(len(day_in), CP_CUSTOMER), cptype_out]).astype(np.int8)
    category = np.concatenate([np.full(len(day_in), CAT_SALES), cat_out]).astype(np.int8)
    cpid = np.concatenate([np.array([f"CUST-{b_id}-{k}" for k in cust_idx], dtype=object), cpid_out])

    # ---- §12 injected anomalies (known types only; held-out types live in the harness) --
    anomalies = []
    for spec in biz["inject_anomalies"]:
        wk = spec["week"]
        cands = np.where((np.arange(T) // 7 + 1 == wk) & (demand > 0))[0]
        if len(cands) == 0:
            continue
        d = int(cands[0])
        if spec["type"] == "large_transfer":
            row = (d, 14, 0, 8.0 * monthly_outflow / 30.0, CP_OTHER, CAT_TRANSFER, f"XFER-{b_id}-UNSEEN")
        elif spec["type"] == "odd_hours_transaction":
            row = (d, 3, 1, float(per_tx_in[d]), CP_CUSTOMER, CAT_SALES, f"CUST-{b_id}-{cust_idx[0] if len(cust_idx) else 0}")
        else:
            raise ValueError(f"unknown injected anomaly type {spec['type']} — held-out types must not be in config (§12)")
        day = np.append(day, row[0])
        hour = np.append(hour, row[1])
        direction = np.append(direction, np.int8(row[2]))
        amount = np.append(amount, row[3])
        cptype = np.append(cptype, np.int8(row[4]))
        category = np.append(category, np.int8(row[5]))
        cpid = np.append(cpid, row[6])
        anomalies.append((len(day) - 1, spec["type"]))

    order = np.lexsort((hour, day))
    inv = np.empty_like(order)
    inv[order] = np.arange(len(order))
    anomalies = [(int(inv[i]), t) for i, t in anomalies]

    # ---- daily aggregates (computed FROM the transactions so the tables agree) ---
    is_in = direction == 1
    inflow_total = np.bincount(day[is_in], weights=amount[is_in], minlength=T)
    inflow_count = np.bincount(day[is_in], minlength=T)
    outflow_total = np.bincount(day[~is_in], weights=amount[~is_in], minlength=T)
    outflow_count = np.bincount(day[~is_in], minlength=T)
    rec_mask = (~is_in) & np.isin(category, RECURRING_CATS)
    recurring_total = np.bincount(day[rec_mask], weights=amount[rec_mask], minlength=T)
    net = inflow_total - outflow_total
    if biz["zakat_seed"]:
        opening = float(biz["zakat_seed"]["opening_net_assets_sar"])
    else:
        opening = monthly_outflow * band(om["opening_balance_months_of_outflow"], u_buf)
    eod = opening + np.cumsum(net)

    # ---- §24 monthly balance sheet from realised flows ----------------------------
    dso = band(arch["dso_days"], u_dso)
    dio = band(arch["dio_days"], u_dio)
    dpo = band(arch["dpo_days"], u_dpo)
    stl_m = band(arch["stl_months_of_outflow"], u_stl)
    bs_sd = cfg["balance_sheet_noise_sd"]
    monthly_rows = []
    for idx in np.where(dates.is_month_end)[0]:
        avg_in, _ = trailing_monthly_mean(inflow_total, int(idx))
        avg_out, _ = trailing_monthly_mean(outflow_total, int(idx))
        noise = 1.0 + rng.normal(0.0, bs_sd, 4)
        cash = max(float(eod[idx]), 0.0)
        overdraft = max(-float(eod[idx]), 0.0)
        monthly_rows.append(
            {
                "business_id": b_id,
                "month_end": dates[idx],
                "cash_and_equivalents_eom": cash,
                "inventory_value_eom": dio / 30.0 * avg_out * noise[0],
                "accounts_receivable_eom": dso / 30.0 * avg_in * noise[1],
                "accounts_payable_eom": dpo / 30.0 * avg_out * noise[2],
                "short_term_liabilities_eom": stl_m * monthly_outflow * noise[3] + overdraft,
            }
        )

    return {
        "tx": {
            "day": day[order],
            "hour": hour[order].astype(np.int16),
            "direction": direction[order],
            "amount": amount[order],
            "cptype": cptype[order],
            "category": category[order],
            "cpid": cpid[order],
            "dates": dates,
        },
        "daily": {
            "inflow_total": inflow_total,
            "inflow_count": inflow_count,
            "outflow_total": outflow_total,
            "outflow_count": outflow_count,
            "recurring_outflow_total": recurring_total,
            "net_flow": net,
            "eod_balance": eod,
            "dates": dates,
        },
        "monthly": monthly_rows,
        "label": default_label,
        "latents": {
            "latent_management_quality": mgmt,
            "latent_market_shock_sensitivity": shock,
            "latent_risk_index": r,
            "p_default": p_default,
        },
        "anomalies": anomalies,
    }


# --------------------------------------------------------------------------- #
# Population loop + table assembly
# --------------------------------------------------------------------------- #


def generate(cfg: dict, quick: bool = False) -> dict[str, pd.DataFrame]:
    stats = latent_index_stats(cfg)
    demo_by_id = {d["id"]: d for d in cfg.get("demo_businesses", [])}
    src = cfg["output"]["data_source"]
    agg_days = cfg["output"].get("daily_aggregates_trailing_days")

    registry, labels, latents, anomalies, monthly = [], [], [], [], []
    tx_parts, daily_parts = [], []
    tx_offset = 0
    t0 = time.time()

    for pop_name, pop in cfg["populations"].items():
        lo, hi = pop["id_range"]
        ids = list(range(lo, hi + 1))
        if quick:
            keep = set(ids[: cfg["quick_mode_n_per_population"]]) | {i for i in demo_by_id if lo <= i <= hi}
            ids = [i for i in ids if i in keep]
        print(f"[{pop_name}] seed={pop['seed']} ids {lo}..{hi} → generating {len(ids)} businesses", flush=True)

        for n, b_id in enumerate(ids, 1):
            biz = sample_registry(cfg, pop_name, pop, b_id, demo_by_id.get(b_id))
            out = generate_business(cfg, biz, stats)

            registry.append(
                {
                    "business_id": b_id,
                    "population": pop_name,
                    "sector": biz["sector"],
                    "size_tier": biz["size_tier"],
                    "age_tier": biz["age_tier"],
                    "start_date": biz["start_date"],
                    "window_end": biz["window_end"],
                    "operating_start_date": biz["operating_start_date"],
                    "declared_mcc_code": biz["declared_mcc_code"],
                    "has_zakat_seed": biz["zakat_seed"] is not None,
                    "data_source": src,
                }
            )
            labels.append({"business_id": b_id, "population": pop_name, "default_label": out["label"], "data_source": src})
            latents.append({"business_id": b_id, "population": pop_name, **out["latents"]})
            monthly.extend(out["monthly"])
            for local_idx, a_type in out["anomalies"]:
                anomalies.append({"business_id": b_id, "transaction_id": tx_offset + local_idx + 1, "anomaly_type": a_type})

            tx = out["tx"]
            n_tx = len(tx["day"])
            tx_parts.append(
                {
                    "transaction_id": np.arange(tx_offset + 1, tx_offset + n_tx + 1),
                    "business_id": np.full(n_tx, b_id),
                    "date": tx["dates"].to_numpy()[tx["day"]],
                    "hour": tx["hour"],
                    "direction": tx["direction"],
                    "amount": tx["amount"],
                    "cpid": tx["cpid"],
                    "cptype": tx["cptype"],
                    "category": tx["category"],
                }
            )
            tx_offset += n_tx

            d = out["daily"]
            T = len(d["dates"])
            sl = slice(max(0, T - agg_days), T) if agg_days else slice(0, T)
            daily_parts.append(
                {
                    "business_id": np.full(sl.stop - sl.start, b_id),
                    "date": d["dates"].to_numpy()[sl],
                    **{k: d[k][sl] for k in ("inflow_total", "inflow_count", "outflow_total", "outflow_count", "recurring_outflow_total", "net_flow", "eod_balance")},
                }
            )
            if n % 1000 == 0:
                print(f"  {n}/{len(ids)}  ({time.time() - t0:.0f}s)", flush=True)

    def stack(parts, key):
        return np.concatenate([p[key] for p in parts])

    transactions = pd.DataFrame(
        {
            "transaction_id": stack(tx_parts, "transaction_id"),
            "business_id": stack(tx_parts, "business_id"),
            "date": stack(tx_parts, "date"),
            "hour": stack(tx_parts, "hour").astype(int),
            "direction": np.where(stack(tx_parts, "direction") == 1, "in", "out"),
            "amount": np.round(stack(tx_parts, "amount"), 2),
            "counterparty_id": stack(tx_parts, "cpid"),
            "counterparty_type": CP_TYPES[stack(tx_parts, "cptype")],
            "category": CATEGORIES[stack(tx_parts, "category")],
            "data_source": src,
        }
    )
    daily = pd.DataFrame({k: stack(daily_parts, k) for k in daily_parts[0]})
    for c in ("inflow_total", "outflow_total", "recurring_outflow_total", "net_flow", "eod_balance"):
        daily[c] = np.round(daily[c], 2)
    daily["inflow_count"] = daily["inflow_count"].astype(int)
    daily["outflow_count"] = daily["outflow_count"].astype(int)
    daily["data_source"] = src

    balances = pd.DataFrame(monthly)
    for c in balances.columns:
        if c.endswith("_eom"):
            balances[c] = np.round(balances[c], 2)
    balances["data_source"] = src

    tables = {
        "transactions": transactions,
        "daily_aggregates": daily,
        "balances_monthly": balances,
        "businesses": pd.DataFrame(registry),
        "labels": pd.DataFrame(labels),
        "latents_hidden": pd.DataFrame(latents),
        "injected_anomalies": pd.DataFrame(anomalies, columns=["business_id", "transaction_id", "anomaly_type"]),
    }
    print(f"generated {len(registry)} businesses, {len(transactions):,} transactions in {time.time() - t0:.0f}s", flush=True)
    return tables


def validate_and_write(tables: dict[str, pd.DataFrame], out_dir: Path) -> None:
    """§37.1: validate at the point of generation, then write."""
    print("validating with Pandera …", flush=True)
    validated = schemas.validate_engine_tables(tables)
    schemas.labels_schema.validate(tables["labels"], lazy=True)
    out_dir.mkdir(parents=True, exist_ok=True)
    for name, df in {**tables, **validated}.items():
        path = out_dir / f"{name}.csv"
        df.to_csv(path, index=False, date_format="%Y-%m-%d")
        print(f"  wrote {path.name:24s} {len(df):>10,} rows", flush=True)


def main(argv: list[str] | None = None) -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--config", default="config.yaml")
    ap.add_argument("--out-dir", default=None, help="defaults to output.dir in config (output.quick_dir with --quick)")
    ap.add_argument("--quick", action="store_true", help="generate only quick_mode_n_per_population per population")
    args = ap.parse_args(argv)

    cfg = load_config(args.config)
    out_dir = Path(args.out_dir or (cfg["output"]["quick_dir"] if args.quick else cfg["output"]["dir"]))
    tables = generate(cfg, quick=args.quick)
    validate_and_write(tables, out_dir)
    print(f"done → {out_dir.resolve()}")


if __name__ == "__main__":
    main(sys.argv[1:])
