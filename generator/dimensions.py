"""Phase 5 dimensions — obligations, credit facilities, transaction sub-fields, MCC coverage.

SOP_Data_Grounding §9–§12. Everything here is ADDITIVE over the base tables:
new tables (obligations, facilities) and new columns (value_date, status,
charge_amount), plus the one deliberate value change §12.3 asks for
(declared_mcc_code nulled where a real acquirer would not have assigned one).
No base column is otherwise touched, and every draw uses its own RNG stream
`[population seed, business_id, 2, purpose]`, so the Week 3 gate numbers are
byte-identical before and after (DECISIONS.md entry 11).

Parameters come from two config blocks and are stamped on every row:
  grounded_from_berka  measured on the Berka corpus, labels held out  → evidence_class B
  ungrounded           author judgement with a basis string           → evidence_class C

`extend(cfg, tables)` is called by generator.generate at the end of a run and by
eval.sensitivity on tables loaded from disk with one parameter overridden.
"""

from __future__ import annotations

import itertools

import numpy as np
import pandas as pd

from generator import schemas

RECURRING_CATEGORY_CP = {"rent": "landlord", "payroll": "payroll", "loan_repayment": "financial_institution"}
PURPOSE_OBLIGATIONS, PURPOSE_FACILITIES, PURPOSE_SUBFIELDS, PURPOSE_MCC = 0, 1, 2, 3


def _rng(seed: int, b_id: int, purpose: int) -> np.random.Generator:
    return np.random.default_rng([int(seed), int(b_id), 2, purpose])


def latent_rank(latents: pd.DataFrame) -> pd.Series:
    """Percentile rank of the hidden latent risk index (0 = safest, 1 = riskiest) — generator-internal, never emitted."""
    r = latents.set_index("business_id")["latent_risk_index"]
    return r.rank(pct=True)


def population_seed(cfg: dict, biz: pd.DataFrame) -> pd.Series:
    return biz["population"].map({k: v["seed"] for k, v in cfg["populations"].items()})


def recurring_summary_from_tx(tx: pd.DataFrame) -> pd.DataFrame:
    """Per (business, recurring category): counterparty, median amount, last date, count. Plus median supplier payment."""
    rec = tx[tx["category"].isin(RECURRING_CATEGORY_CP)]
    g = rec.groupby(["business_id", "category"], observed=True)
    s = g.agg(counterparty_id=("counterparty_id", "first"), amount=("amount", "median"), last_date=("date", "max"), n=("amount", "size")).reset_index()
    sup = tx[tx["category"] == "supplier"].groupby("business_id")["amount"].median().rename("supplier_median")
    return s, sup


def window_summary(daily: pd.DataFrame, biz: pd.DataFrame) -> pd.DataFrame:
    d = daily.merge(biz[["business_id", "window_end"]], on="business_id")
    d = d[d["date"] <= d["window_end"]]
    g = d.groupby("business_id")
    out = pd.DataFrame({"monthly_outflow": g["outflow_total"].sum() / (g.size() / 30.0)})
    out["eod_end"] = d.sort_values("date").groupby("business_id")["eod_balance"].last()
    return out


def _weighted_choice(rng, table: dict):
    keys = list(table)
    return keys[rng.choice(len(keys), p=np.asarray(list(table.values()), float) / sum(table.values()))]


# --------------------------------------------------------------------------- #
# Obligations (§9.3 generator side, §10 ungrounded half)
# --------------------------------------------------------------------------- #


def build_obligations(cfg: dict, rec_summary: pd.DataFrame, supplier_median: pd.Series, wsum: pd.DataFrame, biz: pd.DataFrame, u: pd.Series, seeds: pd.Series) -> pd.DataFrame:
    gb = cfg["grounded_from_berka"]
    ug = cfg["ungrounded"]
    dd, sc, ob = ug["direct_debits"], ug["scheduled_payments"], ug["obligations"]
    dur_tbl, count_tbl = gb["loan_duration_months"], gb[dd["count_weights_from"]]
    ln = gb["order_amount_share_of_monthly_outflow_lognormal"]
    rec_by_biz = {b: g for b, g in rec_summary.groupby("business_id")}
    src = cfg["output"]["data_source"]
    rows = []
    oid = 0
    for b in biz.itertuples(index=False):
        b_id = int(b.business_id)
        rng = _rng(seeds[b_id], b_id, PURPOSE_OBLIGATIONS)
        end = pd.Timestamp(b.window_end)
        mo = float(wsum.loc[b_id, "monthly_outflow"]) if b_id in wsum.index else 0.0
        ub = float(u.get(b_id, 0.5))

        # (a) standing orders = the business's own recurring flows; loan terminations grounded in Berka loan.duration (B)
        for r in rec_by_biz.get(b_id, pd.DataFrame()).itertuples(index=False):
            oid += 1
            final_date, final_amount, cls = pd.NaT, np.nan, "B"
            if r.category == "loan_repayment":
                duration = int(_weighted_choice(rng, dur_tbl))
                remaining = int(rng.integers(1, duration + 1))
                final_date = end + pd.Timedelta(days=30 * remaining)
                if rng.random() < ob["balloon_share_of_loans"]:
                    lo, hi = ob["balloon_final_amount_multiple"]
                    final_amount, cls = float(r.amount * rng.uniform(lo, hi)), "C"
            rows.append((b_id, oid, "standing_order", r.counterparty_id, float(r.amount), "monthly", r.last_date + pd.Timedelta(days=30), final_date, final_amount, "active", pd.NaT, cls))

        # (b) direct debits: count and magnitude from Berka (B); existence, cancellation coupling (C)
        if mo > 0 and rng.random() < dd["share_of_businesses"]:
            k = int(_weighted_choice(rng, count_tbl))
            p_lo, p_hi = dd["cancellation_prob_90d_by_latent_risk"]
            p_cancel = p_lo + ub * (p_hi - p_lo)
            for j in range(k):
                oid += 1
                amount = float(min(mo * np.exp(rng.normal(ln["mu"], ln["sigma"])), 0.8 * mo))
                cancelled = rng.random() < p_cancel
                status = "inactive" if cancelled else "active"
                change = end - pd.Timedelta(days=int(rng.integers(0, 90))) if cancelled else pd.NaT
                nxt = pd.NaT if cancelled else end + pd.Timedelta(days=int(rng.integers(1, 31)))
                rows.append((b_id, oid, "direct_debit", f"DD-{b_id}-{j}", max(amount, 1.0), "monthly", nxt, pd.NaT, np.nan, status, change, "C"))

        # (c) scheduled one-off payments in the forward window (C)
        med = float(supplier_median.get(b_id, np.nan))
        if np.isfinite(med) and med > 0 and rng.random() < sc["share_of_businesses"]:
            for j in range(int(rng.integers(sc["count"][0], sc["count"][1] + 1))):
                oid += 1
                amount = float(med * rng.uniform(*sc["amount_multiple_of_median_supplier_payment"]))
                when = end + pd.Timedelta(days=int(rng.integers(sc["days_ahead"][0], sc["days_ahead"][1] + 1)))
                rows.append((b_id, oid, "scheduled", f"SCHED-{b_id}-{j}", amount, "one_off", when, when, amount, "active", pd.NaT, "C"))

    cols = ["business_id", "obligation_id", "type", "counterparty_id", "amount", "frequency", "next_date", "final_date", "final_amount", "status", "status_change_date", "evidence_class"]
    df = pd.DataFrame(rows, columns=cols)
    df["amount"] = df["amount"].round(2)
    df["final_amount"] = df["final_amount"].round(2)
    df["data_source"] = src
    return df[[*cols[:-1], "data_source", "evidence_class"]]


# --------------------------------------------------------------------------- #
# Credit facilities (§12.1)
# --------------------------------------------------------------------------- #


def build_facilities(cfg: dict, wsum: pd.DataFrame, biz: pd.DataFrame, u: pd.Series, seeds: pd.Series) -> pd.DataFrame:
    cf = cfg["ungrounded"]["credit_facilities"]
    src = cfg["output"]["data_source"]
    rows = []
    for b in biz.itertuples(index=False):
        b_id = int(b.business_id)
        rng = _rng(seeds[b_id], b_id, PURPOSE_FACILITIES)
        end = pd.Timestamp(b.window_end)
        mo = float(wsum.loc[b_id, "monthly_outflow"]) if b_id in wsum.index else 0.0
        eod = float(wsum.loc[b_id, "eod_end"]) if b_id in wsum.index else 0.0
        if mo <= 0 or rng.random() >= cf["share_with_facility"]:
            rows.append((b_id, "none", 0.0, 0.0, bool(cf["included_in_balance"]), eod, 0.0, pd.NaT))
            continue
        ftype = _weighted_choice(rng, cf["type_mix"])
        limit = mo * rng.uniform(*cf["limit_months_of_outflow"])
        lo, hi = cf["utilisation_by_latent_risk"]
        util = float(np.clip(lo + float(u.get(b_id, 0.5)) * (hi - lo) + rng.normal(0.0, cf["utilisation_noise_sd"]), 0.0, 1.0))
        drawn = util * limit
        since = pd.NaT
        if util > cf["emergency_line_appears_if_utilisation_above"] and ftype == "pre_agreed":
            ftype = "emergency"  # the incumbent bank acting on distress it observed
        if ftype in ("emergency", "temporary"):
            since = end - pd.Timedelta(days=int(rng.integers(0, 60)))
        own = eod - drawn if cf["included_in_balance"] else eod
        rows.append((b_id, ftype, round(limit, 2), round(drawn, 2), bool(cf["included_in_balance"]), round(own, 2), round(limit - drawn, 2), since))
    df = pd.DataFrame(rows, columns=["business_id", "facility_type", "facility_limit", "facility_drawn", "included_in_balance", "own_funds", "headroom", "emergency_line_since"])
    df["data_source"] = src
    df["evidence_class"] = "C"
    return df


# --------------------------------------------------------------------------- #
# Transaction sub-fields (§12.2) and MCC coverage (§12.3)
# --------------------------------------------------------------------------- #


def add_transaction_subfields(cfg: dict, tx: pd.DataFrame, biz: pd.DataFrame, seeds: pd.Series) -> pd.DataFrame:
    ts = cfg["ungrounded"]["transaction_subfields"]
    gb = cfg["grounded_from_berka"]
    lag_tbl = {int(k): float(v) for k, v in ts["transfer_value_date_lag_days"].items()}
    lag_keys = np.array(list(lag_tbl))
    lag_p = np.array(list(lag_tbl.values())) / sum(lag_tbl.values())
    tier_keys = list(gb["bank_fee_tier_mix"])
    tier_p = np.array([gb["bank_fee_tier_mix"][k] for k in tier_keys]) / sum(gb["bank_fee_tier_mix"].values())
    tier_mult = np.array([gb["bank_fee_tier_multipliers"][k] for k in tier_keys])

    tx = tx.sort_values(["business_id", "transaction_id"], kind="stable").reset_index(drop=True)
    is_transfer = tx["subfamily"].isin(["RCDT", "DMCT"]).to_numpy()
    lag = np.zeros(len(tx), dtype=np.int64)
    charge = np.full(len(tx), np.nan)
    window_end = biz.set_index("business_id")["window_end"]
    bounds = np.flatnonzero(np.diff(tx["business_id"].to_numpy(), prepend=-1))
    bounds = np.append(bounds, len(tx))
    for s, e in itertools.pairwise(bounds):
        b_id = int(tx["business_id"].iat[s])
        rng = _rng(seeds[b_id], b_id, PURPOSE_SUBFIELDS)
        m = is_transfer[s:e]
        n = int(m.sum())
        if n == 0:
            continue
        lag[s:e][m] = rng.choice(lag_keys, size=n, p=lag_p)
        charged = rng.random(n) < ts["charge_probability_on_transfers"]
        fees = ts["base_fee_sar"] * tier_mult[rng.choice(len(tier_keys), size=n, p=tier_p)]
        c = charge[s:e]
        c[np.flatnonzero(m)[charged]] = fees[charged]
        charge[s:e] = c
    tx["value_date"] = tx["date"] + pd.to_timedelta(lag, unit="D")
    tx["status"] = np.where(tx["value_date"] > tx["business_id"].map(window_end), "pending", "booked")
    tx["charge_amount"] = np.round(charge, 2)
    cols = [c for c in schemas.transactions_schema.columns]
    return tx[cols]


def apply_mcc_coverage(cfg: dict, biz: pd.DataFrame, seeds: pd.Series) -> pd.DataFrame:
    share = cfg["ungrounded"]["mcc_coverage_share"]
    biz = biz.copy()
    mcc = biz["declared_mcc_code"].astype("Int64")
    for i, b in enumerate(biz.itertuples(index=False)):
        rng = _rng(seeds[int(b.business_id)], int(b.business_id), PURPOSE_MCC)
        if rng.random() >= share[b.sector]:
            mcc.iat[i] = pd.NA
    biz["declared_mcc_code"] = mcc
    return biz


# --------------------------------------------------------------------------- #
# Entry point
# --------------------------------------------------------------------------- #


def extend(cfg: dict, tables: dict[str, pd.DataFrame], with_subfields: bool = True) -> dict[str, pd.DataFrame]:
    biz = tables["businesses"]
    seeds = population_seed(cfg, biz)
    seeds.index = biz["business_id"].to_numpy()
    u = latent_rank(tables["latents_hidden"])
    wsum = window_summary(tables["daily_aggregates"], biz)
    rec, sup = recurring_summary_from_tx(tables["transactions"])
    out = dict(tables)
    out["obligations"] = build_obligations(cfg, rec, sup, wsum, biz, u, seeds)
    out["facilities"] = build_facilities(cfg, wsum, biz, u, seeds)
    out["businesses"] = apply_mcc_coverage(cfg, biz, seeds)
    if with_subfields:
        out["transactions"] = add_transaction_subfields(cfg, tables["transactions"], biz, seeds)
    return out
