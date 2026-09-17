"""Phase 1 adapter — raw Berka → the repo's table contract in data/berka/.

SOP_Data_Grounding §5. Output validates against the SAME Pandera schemas the
generator uses (generator/schemas.py); no adapter-only relaxations.

    python -m berka_adapter.build [--raw-dir data/berka_raw] [--out-dir data/berka] [--quick]

Emits (all rows tagged data_source=external_real, evidence_class=A):
  transactions.csv       signed at ingestion, partner key → counterparty_id, k_symbol/operation → category + subfamily
  daily_aggregates.csv   one row per calendar day of a 180-day window ending at the observation date
  balances_daily.csv     closing balance from the verified running-balance chain
  obligations.csv        Phase 5a — the real `order` table (frequency MEASURED from executions, never guessed)
  businesses.csv         registry; sector / size / age = not_available_in_source
  labels.csv             berka-only: two label sets, censoring named (§7.1)
  accounts.csv           berka-only metadata (district = geography, NEVER a sector proxy — §15.8)
  build_summary.json     completeness-gate pass rate, exclusions, counts

Point-in-time (§7.2): a labelled account's window ends the day BEFORE loan.date,
so the emitted tables physically contain nothing at or after the loan — the
no-look-ahead rule is encoded in structure and asserted here as well. Unlabelled
accounts are observed at their last transaction date.
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

import numpy as np
import pandas as pd

from berka_adapter.io import load_all
from generator import schemas
from generator.generate import load_config

SOURCE = "external_real"
EVIDENCE = "A"
POPULATION = "berka"
HOUR_CONST = 12  # Berka has no time-of-day; a constant cannot carry signal (DECISIONS.md entry 7)
# Per-day chain tolerance. Residuals are exactly 0.0 on 94.3% of account-days and 0.1 or 0.2 CZK on the
# rest — all month-end days, i.e. interest-posting rounding (measured 2026-09-15, DECISIONS.md entry 8).
CHAIN_TOL = 0.21

# Appendix B value mappings. k_symbol wins over operation; direction breaks the tie.
K_CATEGORY = {
    "UROK": "bank_interest",
    "SANKC. UROK": "bank_interest",
    "SLUZBY": "bank_fee",
    "UVER": "loan_repayment",
    "SIPO": "household",
    "POJISTNE": "insurance",
    "DUCHOD": "pension",
}
K_SUBFAMILY = {
    "UROK": "INTR",
    "SANKC. UROK": "SANC",
    "SLUZBY": "CHRG",
    "UVER": "LOAN",
    "SIPO": "HOUS",
    "POJISTNE": "INSU",
    "DUCHOD": "PENS",
}
OP_CATEGORY = {
    "VKLAD": "cash_deposit",
    "VYBER": "cash_withdrawal",
    "VYBER KARTOU": "cash_withdrawal",
    "PREVOD Z UCTU": "sales",
    "PREVOD NA UCET": "supplier",
}
OP_SUBFAMILY = {
    "VKLAD": "CDPT",
    "VYBER": "CWDL",
    "VYBER KARTOU": "CCRD",
    "PREVOD Z UCTU": "RCDT",
    "PREVOD NA UCET": "DMCT",
}
# counterparty_type: only a loan repayment is a financial-institution debt-service counterparty.
# Bank fees / interest are the bank itself and are deliberately `other` — see §8.4 write-up.
K_CPTYPE = {"UVER": "financial_institution"}
OP_CPTYPE = {"PREVOD Z UCTU": "customer", "PREVOD NA UCET": "supplier"}


def partner_key(bank: pd.Series, account: pd.Series) -> pd.Series:
    b = bank.astype("string").str.strip()
    a = account.astype("string").str.strip()
    ok = b.notna() & a.notna() & (b != "") & (a != "")
    return (b + ":" + a).where(ok, other=pd.NA)


# --------------------------------------------------------------------------- #
# §5.5 completeness gate on the FULL history, before any windowing
# --------------------------------------------------------------------------- #


def balance_chain_check(trans: pd.DataFrame) -> tuple[pd.Series, pd.Series, dict]:
    """Day-level chain: close[d] == close[d-1] + Σ signed amounts on day d, for every transaction day.

    Two Berka properties make a row-level cumulative check wrong and this one right:
    intra-day trans_id order is not chronological (month-end interest is posted
    before the fee but carries a later id), and interest postings carry a 0.1 CZK
    rounding that a running cumsum accumulates into drift. So each day is checked
    against the ACTUAL previous close, order-independently: a day passes if any of
    its balances equals any previous-day balance plus the day's signed sum, within
    CHAIN_TOL. Returns (account → passes_all_days, matched close per (account, date), summary).
    """
    day = trans.groupby(["account_id", "date"]).agg(day_sum=("signed_amount", "sum")).reset_index()
    day["prev_date"] = day.groupby("account_id")["date"].shift(1)
    bal = trans[["account_id", "date", "balance"]]
    cur = day.merge(bal, on=["account_id", "date"])
    prev = bal.rename(columns={"date": "prev_date", "balance": "prev_balance"})
    pairs = cur.merge(prev, on=["account_id", "prev_date"], how="left")
    pairs["prev_balance"] = pairs["prev_balance"].fillna(0.0)  # first transaction day opens at zero
    pairs["resid"] = (pairs["balance"] - pairs["prev_balance"] - pairs["day_sum"]).abs()
    best = pairs.sort_values("resid").groupby(["account_id", "date"], sort=True).first()
    day_ok = best["resid"] <= CHAIN_TOL
    acct_ok = day_ok.groupby(level=0).all()
    day_close = best.loc[day_ok, "balance"]
    summary = {
        "tolerance_czk": CHAIN_TOL,
        "accounts_total": len(acct_ok),
        "accounts_pass": int(acct_ok.sum()),
        "account_pass_rate": float(acct_ok.mean()),
        "days_total": len(day_ok),
        "days_pass": int(day_ok.sum()),
        "day_pass_rate": float(day_ok.mean()),
        "days_exact_to_0_01": int((best["resid"] <= 0.011).sum()),
        "days_needing_interest_rounding_tolerance": int(((best["resid"] > 0.011) & day_ok).sum()),
        "max_residual_czk": float(best["resid"].max()),
    }
    return acct_ok, day_close, summary


# --------------------------------------------------------------------------- #
# Observation dates and windows (§7.2)
# --------------------------------------------------------------------------- #


def observation_dates(trans: pd.DataFrame, loan: pd.DataFrame, window_days: int) -> pd.DataFrame:
    last_tx = trans.groupby("account_id")["date"].max().rename("last_tx_date")
    obs = last_tx.to_frame()
    obs["loan_date"] = loan.set_index("account_id")["date"]
    obs["window_end"] = obs["loan_date"].sub(pd.Timedelta(days=1)).fillna(obs["last_tx_date"])
    obs["start_date"] = obs["window_end"] - pd.Timedelta(days=window_days - 1)
    return obs


# --------------------------------------------------------------------------- #
# Table builders
# --------------------------------------------------------------------------- #


def build_transactions(t: pd.DataFrame, order_keys: pd.DataFrame) -> pd.DataFrame:
    k = t["k_symbol"]
    op = t["operation"]
    inflow = t["signed_amount"] > 0

    category = k.map(K_CATEGORY)
    category = category.fillna(op.map(OP_CATEGORY))
    category = category.fillna(pd.Series(np.where(inflow, "sales", "transfer"), index=t.index))
    subfamily = k.map(K_SUBFAMILY).fillna(op.map(OP_SUBFAMILY))
    subfamily = subfamily.fillna(pd.Series(np.where(inflow, "RCDT", "DMCT"), index=t.index))
    cptype = k.map(K_CPTYPE).fillna(op.map(OP_CPTYPE)).fillna("other")

    # Declared recurring: an outflow whose partner key matches one of the account's standing orders.
    key = t["partner_key"]
    declared = pd.MultiIndex.from_frame(order_keys[["account_id", "partner_key"]].drop_duplicates())
    is_declared = pd.MultiIndex.from_arrays([t["account_id"], key.fillna("")]).isin(declared) & ~inflow

    out = pd.DataFrame(
        {
            "transaction_id": t["trans_id"].astype(int),
            "business_id": t["account_id"].astype(int),
            "date": t["date"],
            "hour": HOUR_CONST,
            "direction": np.where(inflow, "in", "out"),
            "amount": t["amount"].astype(float),
            "counterparty_id": key.astype(object).where(key.notna(), None),
            "counterparty_type": cptype.astype(str),
            "category": category.astype(str),
            "subfamily": subfamily.astype(str),
            "own_transfer_flag": False,
            "value_date": pd.NaT,  # Berka has no value date (§12.2) — null, never a guessed lag
            "status": "booked",
            "charge_amount": np.nan,  # fees are separate SLUZBY rows in Berka, not a sub-field
            "data_source": SOURCE,
            "evidence_class": EVIDENCE,
        }
    )
    out["_declared_recurring"] = np.asarray(is_declared)
    return out


def build_daily(tx: pd.DataFrame, obs: pd.DataFrame, opening: pd.Series, day_close: pd.Series, window_days: int) -> pd.DataFrame:
    ids = obs.index.to_numpy()
    starts = obs["start_date"].to_numpy()
    grid_dates = np.concatenate([pd.date_range(s, periods=window_days, freq="D").to_numpy() for s in starts])
    idx = pd.MultiIndex.from_arrays([np.repeat(ids, window_days), grid_dates], names=["business_id", "date"])

    is_in = tx["direction"] == "in"
    g = tx.assign(
        inflow_total=tx["amount"].where(is_in, 0.0),
        inflow_count=is_in.astype(int),
        outflow_total=tx["amount"].where(~is_in, 0.0),
        outflow_count=(~is_in).astype(int),
        recurring_outflow_total=tx["amount"].where(tx["_declared_recurring"], 0.0),
    ).groupby(["business_id", "date"])[["inflow_total", "inflow_count", "outflow_total", "outflow_count", "recurring_outflow_total"]].sum()
    daily = g.reindex(idx, fill_value=0).reset_index()
    daily["net_flow"] = daily["inflow_total"] - daily["outflow_total"]
    # Closing balance is the bank's own verified day close, forward-filled over non-transaction days
    # (SOP §5.5) — not a re-derived cumsum, which would re-introduce the interest-rounding drift.
    close = day_close.rename_axis(["business_id", "date"]).reindex(idx)
    close = close.groupby(level=0).ffill()
    first = daily["business_id"].map(opening).fillna(0.0)
    daily["eod_balance"] = close.to_numpy()
    daily["eod_balance"] = daily["eod_balance"].fillna(first)
    for c in ("inflow_total", "outflow_total", "recurring_outflow_total", "net_flow", "eod_balance"):
        daily[c] = np.round(daily[c], 2)
    daily["inflow_count"] = daily["inflow_count"].astype(int)
    daily["outflow_count"] = daily["outflow_count"].astype(int)
    daily["data_source"] = SOURCE
    daily["evidence_class"] = EVIDENCE
    return daily


def build_obligations(order: pd.DataFrame, tx_hist: pd.DataFrame, obs: pd.DataFrame) -> pd.DataFrame:
    """Real declared standing orders. Frequency is measured from executions ≤ observation date."""
    o = order.copy()
    o["partner_key"] = partner_key(o["bank_to"], o["account_to"])
    execs = tx_hist[(tx_hist["signed_amount"] < 0) & tx_hist["partner_key"].notna()][["account_id", "partner_key", "date"]]
    execs = execs.join(obs["window_end"], on="account_id")
    execs = execs[execs["date"] <= execs["window_end"]]  # never measure from after the observation date
    execs = execs.sort_values(["account_id", "partner_key", "date"])
    execs["gap"] = execs.groupby(["account_id", "partner_key"])["date"].diff().dt.days
    stats = execs.groupby(["account_id", "partner_key"]).agg(n_exec=("date", "size"), last_exec=("date", "max"), med_gap=("gap", "median"))
    o = o.join(stats, on=["account_id", "partner_key"])

    gap = o["med_gap"]
    freq = pd.Series("unknown", index=o.index)
    freq[(o["n_exec"] >= 2) & gap.between(25, 35)] = "monthly"
    freq[(o["n_exec"] >= 2) & gap.between(5, 9)] = "weekly"
    freq[(o["n_exec"] >= 2) & gap.between(80, 100)] = "quarterly"
    next_date = o["last_exec"] + pd.to_timedelta(gap, unit="D")
    next_date = next_date.where(freq != "unknown")

    return pd.DataFrame(
        {
            "business_id": o["account_id"].astype(int),
            "obligation_id": o["order_id"].astype(int),
            "type": "standing_order",
            "counterparty_id": o["partner_key"].astype(object).where(o["partner_key"].notna(), None),
            "amount": o["amount"].astype(float),
            "frequency": freq,
            "next_date": next_date,
            "final_date": pd.NaT,  # Berka has no termination field — null is correct, not a defect (§9.1)
            "final_amount": np.nan,
            "status": "active",  # no status history in the source
            "status_change_date": pd.NaT,
            "data_source": SOURCE,
            "evidence_class": EVIDENCE,
        }
    )


def build_labels(loan: pd.DataFrame) -> pd.DataFrame:
    s = loan["status"]
    primary = pd.Series(pd.NA, index=loan.index, dtype="Int64")
    primary[s == "A"] = 0
    primary[s == "B"] = 1
    return pd.DataFrame(
        {
            "business_id": loan["account_id"].astype(int),
            "loan_id": loan["loan_id"].astype(int),
            "loan_date": loan["date"],
            "loan_amount": loan["amount"].astype(float),
            "duration_months": loan["duration"].astype(int),
            "monthly_payment": loan["payments"].astype(float),
            "status": s,
            "label_primary": primary,
            "label_secondary": s.isin(["B", "D"]).astype(int),
            "censored": s.isin(["C", "D"]),
            "data_source": SOURCE,
            "evidence_class": EVIDENCE,
        }
    )


# --------------------------------------------------------------------------- #
# Main
# --------------------------------------------------------------------------- #


def build(raw_dir: Path, out_dir: Path, quick: bool, window_days: int) -> dict:
    t0 = time.time()
    print(f"loading raw Berka from {raw_dir.resolve()} …", flush=True)
    raw = load_all(raw_dir)
    trans, loan, order, account, disp, district = (raw[k] for k in ("trans", "loan", "order", "account", "disp", "district"))
    summary: dict = {"quick": quick, "window_days": window_days}

    if quick:
        keep = np.sort(account["account_id"].unique())[:300]
        trans = trans[trans["account_id"].isin(keep)]
        loan = loan[loan["account_id"].isin(keep)]
        order = order[order["account_id"].isin(keep)]
        account = account[account["account_id"].isin(keep)]
        print(f"  --quick: first {len(keep)} accounts", flush=True)

    # ---- sign normalisation at the adapter boundary (§5.2) ----
    assert set(trans["type"].unique()) <= {"PRIJEM", "VYDAJ", "VYBER"}, trans["type"].unique()
    trans = trans.copy()
    trans["signed_amount"] = np.where(trans["type"] == "PRIJEM", 1.0, -1.0) * trans["amount"].astype(float)
    trans["partner_key"] = partner_key(trans["bank"], trans["account"])
    zero = trans["amount"] <= 0
    summary["zero_amount_rows_dropped_from_transactions"] = int(zero.sum())

    # ---- §5.5 completeness gate (full history) ----
    acct_ok, day_close, chain = balance_chain_check(trans)
    summary["balance_chain"] = chain
    print(
        f"  balance chain: {chain['accounts_pass']}/{chain['accounts_total']} accounts pass "
        f"({chain['account_pass_rate']:.1%}); {chain['day_pass_rate']:.3%} of account-days",
        flush=True,
    )
    scorable = acct_ok[acct_ok].index
    excluded = acct_ok[~acct_ok].index
    summary["accounts_excluded_chain_failure"] = [int(a) for a in excluded]
    trans = trans[trans["account_id"].isin(scorable)]
    loan = loan[loan["account_id"].isin(scorable)]
    order = order[order["account_id"].isin(scorable)]
    account = account[account["account_id"].isin(scorable)]

    # ---- entity resolution (Probe 4: one account per client) ----
    assert loan["account_id"].is_unique, "more than one loan on an account — §7.3 entity split assumption broken"
    summary["entity_resolution"] = "business_id = account_id (DECISIONS.md entry 7); own_transfer_flag=False on every row"
    summary["own_transfers_netted"] = {"count": 0, "value": 0.0}

    # ---- observation windows ----
    obs = observation_dates(trans, loan, window_days)
    dc = day_close.reset_index()
    dc = dc[dc["date"] < dc["account_id"].map(obs["start_date"])]
    opening = dc.sort_values("date").groupby("account_id")["balance"].last()  # last verified close before the window
    in_window = (trans["date"] >= trans["account_id"].map(obs["start_date"])) & (trans["date"] <= trans["account_id"].map(obs["window_end"]))
    tw = trans[in_window & (trans["amount"] > 0)]

    # §7.2 no look-ahead, asserted: nothing at or after loan.date for a labelled account.
    ld = tw["account_id"].map(obs["loan_date"])
    assert not (ld.notna() & (tw["date"] >= ld)).any(), "look-ahead: transaction on/after loan.date in the feature window"

    order_keys = order.assign(partner_key=partner_key(order["bank_to"], order["account_to"]))
    transactions = build_transactions(tw, order_keys)
    daily = build_daily(transactions, obs, opening, day_close, window_days)
    transactions = transactions.drop(columns=["_declared_recurring"]).sort_values(["business_id", "date", "transaction_id"]).reset_index(drop=True)
    balances_daily = daily[["business_id", "date", "eod_balance"]].rename(columns={"eod_balance": "closing_balance"}).copy()
    balances_daily["data_source"], balances_daily["evidence_class"] = SOURCE, EVIDENCE

    acc = account.set_index("account_id")
    businesses = pd.DataFrame(
        {
            "business_id": obs.index.astype(int),
            "population": POPULATION,
            "sector": schemas.NA_SENTINEL,
            "size_tier": schemas.NA_SENTINEL,
            "age_tier": schemas.NA_SENTINEL,
            "start_date": obs["start_date"].to_numpy(),
            "window_end": obs["window_end"].to_numpy(),
            "operating_start_date": np.maximum(obs["start_date"].to_numpy(), acc.loc[obs.index, "date"].to_numpy()),
            "declared_mcc_code": pd.array([pd.NA] * len(obs), dtype="Int64"),
            "has_zakat_seed": False,
            "data_source": SOURCE,
            "evidence_class": EVIDENCE,
        }
    )
    labels = build_labels(loan)
    obligations = build_obligations(order, trans, obs)

    owner = disp[disp["type"] == "OWNER"].set_index("account_id")["client_id"]
    dist = district.set_index("district_id")
    accounts = pd.DataFrame(
        {
            "account_id": acc.index.astype(int),
            "client_id": owner.reindex(acc.index).to_numpy(),
            "district_id": acc["district_id"].to_numpy(),
            "region": dist["region"].reindex(acc["district_id"]).to_numpy(),
            "open_date": acc["date"].to_numpy(),
            "statement_frequency": acc["frequency"].to_numpy(),
            "has_loan": acc.index.isin(loan["account_id"]),
            "data_source": SOURCE,
            "evidence_class": EVIDENCE,
        }
    )

    tables = {
        "transactions": transactions,
        "daily_aggregates": daily,
        "balances_daily": balances_daily,
        "obligations": obligations,
        "businesses": businesses,
    }
    print("validating with the generator's Pandera schemas …", flush=True)
    validated = schemas.validate_engine_tables(tables)
    schemas.berka_labels_schema.validate(labels, lazy=True)

    out_dir.mkdir(parents=True, exist_ok=True)
    for name, df in {**validated, "labels": labels, "accounts": accounts}.items():
        df.to_csv(out_dir / f"{name}.csv", index=False, date_format="%Y-%m-%d")
        print(f"  wrote {name + '.csv':24s} {len(df):>10,} rows", flush=True)

    summary.update(
        {
            "businesses": len(businesses),
            "labelled": len(labels),
            "defaults_primary": int(labels["label_primary"].fillna(0).sum()),
            "n_primary": int(labels["label_primary"].notna().sum()),
            "defaults_secondary": int(labels["label_secondary"].sum()),
            "transactions_in_window": len(transactions),
            "counterparty_id_non_null_share": float(transactions["counterparty_id"].notna().mean()),
            "declared_recurring_outflow_share": float(daily["recurring_outflow_total"].sum() / max(daily["outflow_total"].sum(), 1e-9)),
            "obligations": len(obligations),
            "obligation_frequency_counts": obligations["frequency"].value_counts().to_dict(),
            "seconds": round(time.time() - t0, 1),
        }
    )
    with open(out_dir / "build_summary.json", "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2)
    print(json.dumps({k: v for k, v in summary.items() if k != "accounts_excluded_chain_failure"}, indent=2))
    print(f"done → {out_dir.resolve()}  ({summary['seconds']}s)")
    return summary


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--raw-dir", default="data/berka_raw")
    ap.add_argument("--out-dir", default="data/berka")
    ap.add_argument("--config", default="config.yaml", help="window_days is read from here so both sources share one window contract")
    ap.add_argument("--quick", action="store_true", help="first 300 accounts only")
    args = ap.parse_args(argv)
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    cfg = load_config(args.config)
    build(Path(args.raw_dir), Path(args.out_dir), args.quick, int(cfg["window_days"]))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
