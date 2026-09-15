"""Held-out anomaly types — Schema v2.9 §12.

These anomaly types are defined HERE and nowhere else. They must never appear
in config.yaml, generator.py, or injected_anomalies.csv; `assert_held_out`
enforces that. Precision-at-K is reported separately for injected vs. held-out
types, so the detector is scored on something the generator never saw.

Types:
  round_trip_transfer   an outflow to a fresh counterparty followed 1–3 days
                        later by an inflow of ~the same amount from the same
                        counterparty — the round-tripping signal behind
                        feature 46 (§33), which no injected type exercises.
  duplicate_payment     an existing supplier payment repeated on the same day
                        with the same amount (a double-charge / double-pay).

Usage (eval harness only):
    tx, truth = inject_held_out(transactions, businesses, seed=7, n_businesses=50)
"""

from __future__ import annotations

import re
from pathlib import Path

import numpy as np
import pandas as pd

HELD_OUT_TYPES = ("round_trip_transfer", "duplicate_payment")


def assert_held_out(project_dir: str | Path = ".") -> None:
    """Fail if any held-out type name leaks into the generator's inputs or outputs."""
    d = Path(project_dir)
    pattern = re.compile("|".join(HELD_OUT_TYPES))
    for name in ("config.yaml", "generator.py"):
        text = (d / name).read_text(encoding="utf-8")
        hits = pattern.findall(text)
        if hits:
            raise AssertionError(f"{name} mentions held-out anomaly type(s) {sorted(set(hits))} — §12 violation")
    inj = d / "injected_anomalies.csv"
    if inj.exists():
        types = set(pd.read_csv(inj)["anomaly_type"])
        leaked = types & set(HELD_OUT_TYPES)
        if leaked:
            raise AssertionError(f"injected_anomalies.csv contains held-out type(s) {leaked} — §12 violation")


def inject_held_out(
    transactions: pd.DataFrame,
    businesses: pd.DataFrame,
    seed: int,
    n_businesses: int = 50,
) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Return (transactions with held-out anomalies appended, ground-truth table).

    Deterministic in `seed`; picks `n_businesses` scorable-looking businesses per
    type from the serving population (the demo slice, §23), one anomaly each.
    """
    rng = np.random.default_rng(seed)
    tx = transactions.copy()
    tx["date"] = pd.to_datetime(tx["date"])
    next_id = int(tx["transaction_id"].max()) + 1
    serving = businesses.loc[businesses["population"] == "serving", "business_id"].to_numpy()
    src = tx["data_source"].iloc[0]

    new_rows: list[dict] = []
    truth: list[dict] = []

    def add(row: dict, a_type: str) -> None:
        nonlocal next_id
        row["transaction_id"] = next_id
        row["data_source"] = src
        new_rows.append(row)
        truth.append({"business_id": row["business_id"], "transaction_id": next_id, "anomaly_type": a_type})
        next_id += 1

    # --- round_trip_transfer -------------------------------------------------
    for b_id in rng.choice(serving, size=min(n_businesses, len(serving)), replace=False):
        g = tx[(tx["business_id"] == b_id) & (tx["direction"] == "out")]
        if g.empty:
            continue
        anchor = g.sample(1, random_state=int(rng.integers(0, 2**31 - 1))).iloc[0]
        amount = float(g["amount"].median() * rng.uniform(6, 12))
        cp = f"RT-{b_id}-HELDOUT"
        d0 = anchor["date"]
        add({"business_id": b_id, "date": d0, "hour": 11, "direction": "out", "amount": round(amount, 2),
             "counterparty_id": cp, "counterparty_type": "other", "category": "transfer"}, "round_trip_transfer")
        add({"business_id": b_id, "date": d0 + pd.Timedelta(days=int(rng.integers(1, 4))), "hour": 15, "direction": "in",
             "amount": round(amount * rng.uniform(0.97, 1.0), 2), "counterparty_id": cp, "counterparty_type": "other",
             "category": "transfer"}, "round_trip_transfer")

    # --- duplicate_payment ---------------------------------------------------
    for b_id in rng.choice(serving, size=min(n_businesses, len(serving)), replace=False):
        g = tx[(tx["business_id"] == b_id) & (tx["category"] == "supplier")]
        if g.empty:
            continue
        orig = g.sample(1, random_state=int(rng.integers(0, 2**31 - 1))).iloc[0]
        dup = {k: orig[k] for k in ("business_id", "date", "direction", "amount", "counterparty_id", "counterparty_type", "category")}
        dup["hour"] = int(min(23, orig["hour"] + 1))
        add(dup, "duplicate_payment")

    out = pd.concat([tx, pd.DataFrame(new_rows)[tx.columns]], ignore_index=True)
    out = out.sort_values(["business_id", "date", "hour"]).reset_index(drop=True)
    return out, pd.DataFrame(truth, columns=["business_id", "transaction_id", "anomaly_type"])


if __name__ == "__main__":  # self-test against the generated tables
    assert_held_out(".")
    tx = pd.read_csv("transactions.csv")
    biz = pd.read_csv("businesses.csv")
    tx2, truth = inject_held_out(tx, biz, seed=7, n_businesses=50)
    import schemas

    schemas.transactions_schema.validate(tx2, lazy=True)
    print("held-out types never appear in config/generator/injected_anomalies: OK")
    print(f"injected {len(truth)} held-out rows across {truth['business_id'].nunique()} businesses:")
    print(truth["anomaly_type"].value_counts().to_string())
