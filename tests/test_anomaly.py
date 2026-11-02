"""Anomaly lens rules (lenses/anomaly/anomaly.py): the entry-36 seasonal gate and repeat-payment rule,
and the §29 output guarantees. Synthetic frames only; no data needed."""

from __future__ import annotations

import numpy as np
import pandas as pd

from lenses import load_lens_config
from lenses.anomaly.anomaly import detect, transaction_features

ACFG = load_lens_config()["anomaly"]
SEASON = [(pd.Timestamp("2026-02-18"), pd.Timestamp("2026-03-22"))]


def ledger(n_days: int = 120, start: str = "2026-01-01", seed: int = 0) -> pd.DataFrame:
    """Daily small sales plus varied supplier payments to a few suppliers, ordinary hours."""
    rng = np.random.default_rng(seed)
    rows, tid = [], 1
    for d in pd.date_range(start, periods=n_days, freq="D"):
        for _ in range(5):
            rows.append({"transaction_id": tid, "date": d, "hour": int(rng.integers(10, 20)), "direction": "in",
                         "amount": round(float(rng.lognormal(4, 0.3)), 2), "counterparty_id": f"C{tid}",
                         "counterparty_type": "customer", "category": "sales"})
            tid += 1
        if d.dayofweek < 5:
            rows.append({"transaction_id": tid, "date": d, "hour": int(rng.integers(9, 17)), "direction": "out",
                         "amount": round(float(rng.lognormal(7, 0.6)), 2), "counterparty_id": f"S{int(rng.integers(0, 4))}",
                         "counterparty_type": "supplier", "category": "supplier"})
            tid += 1
    return pd.DataFrame(rows)


def with_repeat(tx: pd.DataFrame, gap_days: int, factor: float) -> tuple[pd.DataFrame, int]:
    orig = tx[tx["category"] == "supplier"].iloc[40]
    rep = orig.copy()
    rep["transaction_id"] = int(tx["transaction_id"].max()) + 1
    rep["date"] = orig["date"] + pd.Timedelta(days=gap_days)
    rep["amount"] = round(float(orig["amount"]) * factor, 2)
    return pd.concat([tx, rep.to_frame().T], ignore_index=True).astype(tx.dtypes.to_dict()), int(rep["transaction_id"])


def repeat_flag(tx: pd.DataFrame, tid: int, **over) -> bool:
    t = transaction_features(tx, {**ACFG, "repeat_payment_mode": "window", **over})
    return bool(t.loc[t["transaction_id"] == tid, "repeat_payment"].iloc[0])


def test_repeat_rule_flags_a_close_same_amount_repeat():
    tx, tid = with_repeat(ledger(), gap_days=2, factor=1.0)
    assert repeat_flag(tx, tid)


def test_repeat_rule_respects_gap_and_tolerance():
    tx, tid = with_repeat(ledger(), gap_days=ACFG["repeat_max_gap_days"] + 2, factor=1.0)
    assert not repeat_flag(tx, tid)
    tx, tid = with_repeat(ledger(), gap_days=1, factor=1.05)
    assert not repeat_flag(tx, tid)


def test_repeat_rule_is_off_unless_switched_on():
    tx, _ = with_repeat(ledger(), gap_days=0, factor=1.0)
    t = transaction_features(tx, {**ACFG, "repeat_payment_mode": "off"})
    assert not t["repeat_payment"].any()


def test_recurring_series_is_not_a_repeat():
    tx = ledger()
    rent = [{"transaction_id": 10**6 + k, "date": pd.Timestamp("2026-01-05") + pd.Timedelta(days=2 * k), "hour": 10,
             "direction": "out", "amount": 5000.0, "counterparty_id": "LANDLORD", "counterparty_type": "landlord",
             "category": "rent"} for k in range(4)]
    tx = pd.concat([tx, pd.DataFrame(rent)], ignore_index=True)
    t = transaction_features(tx, {**ACFG, "repeat_payment_mode": "window"})
    assert not t.loc[t["counterparty_id"] == "LANDLORD", "repeat_payment"].any()


def test_seasonal_gate_compares_ramadan_baskets_with_ramadan():
    tx = ledger(start="2026-01-01", n_days=120)
    season = (tx["date"] >= SEASON[0][0]) & (tx["date"] <= SEASON[0][1]) & (tx["category"] == "sales")
    tx.loc[season, "amount"] = (tx.loc[season, "amount"] * 3).round(2)   # fewer, larger baskets
    off = transaction_features(tx, {**ACFG, "seasonal_gate": False}, SEASON)
    on = transaction_features(tx, {**ACFG, "seasonal_gate": True}, SEASON)
    hit_off = ((off["amount_z"] >= ACFG["amount_z"]) & off["in_season"]).sum()
    hit_on = ((on["amount_z"] >= ACFG["amount_z"]) & on["in_season"]).sum()
    assert hit_on < hit_off


def test_seasonal_gate_without_windows_changes_nothing():
    tx = ledger()
    a = transaction_features(tx, {**ACFG, "seasonal_gate": True}, None)
    b = transaction_features(tx, {**ACFG, "seasonal_gate": False}, None)
    assert np.allclose(a["amount_z"], b["amount_z"])


def test_output_carries_reasons_only_never_scores():
    tx, _ = with_repeat(ledger(), gap_days=1, factor=1.0)
    out = detect(tx, tx["date"].max(), {**ACFG, "repeat_payment_mode": "window", "seasonal_gate": True}, SEASON)
    assert out["status"] == "computed" and len(out["flags"]) <= ACFG["max_flags"]
    allowed = {"repeat_payment", "amount_outlier", "new_counterparty_large_amount", "counterparty_both_directions",
               "unusual_hour", "rare_category", "multivariate_outlier"}
    for f in out["flags"]:
        assert f["flag_reason"] in allowed
        assert not {"score", "threshold", "fraud_reason", "anomaly_score"} & set(f)


def test_exact_mode_needs_the_same_amount_on_the_same_day():
    tx, tid = with_repeat(ledger(), gap_days=0, factor=1.0)
    assert repeat_flag(tx, tid, repeat_payment_mode="exact")
    tx, tid = with_repeat(ledger(), gap_days=1, factor=1.0)
    assert not repeat_flag(tx, tid, repeat_payment_mode="exact")
    tx, tid = with_repeat(ledger(), gap_days=0, factor=1.001)
    assert not repeat_flag(tx, tid, repeat_payment_mode="exact")


def _pairs_frame(amounts):
    n = len(amounts)
    return pd.DataFrame({"direction_in": np.zeros(n), "counterparty_id": ["S"] * n, "recurring": [False] * n,
                         "amount": np.asarray(amounts, float)})


def test_close_match_rate_is_high_for_clustered_amounts_and_low_for_dispersed_ones():
    from lenses.anomaly.anomaly import _close_match_rate

    clustered = _close_match_rate(_pairs_frame([500, 502, 504, 2000, 2010, 2015] * 5), 0.01).iloc[0]
    dispersed = _close_match_rate(_pairs_frame(np.geomspace(100, 100_000, 40)), 0.01).iloc[0]
    assert clustered > 0.01 > dispersed


def test_rarity_mode_keeps_a_close_match_for_a_widely_varying_supplier():
    tx = ledger()
    sup = tx.index[tx["category"] == "supplier"]
    tx.loc[sup, "amount"] = np.round(np.geomspace(50, 500_000, len(sup)), 2)   # no two amounts within 1%
    tx.loc[sup, "counterparty_id"] = "S0"
    tx, tid = with_repeat(tx, gap_days=1, factor=1.0)
    assert repeat_flag(tx, tid, repeat_payment_mode="rarity")


def test_forest_feature_mode_is_not_a_hard_rule():
    from lenses.anomaly.anomaly import rule_hits

    tx, tid = with_repeat(ledger(), gap_days=0, factor=1.0)
    cfg = {**ACFG, "repeat_payment_mode": "forest_feature"}
    t = transaction_features(tx, cfg)
    assert t.loc[t["transaction_id"] == tid, "repeat_payment"].iloc[0]
    assert not rule_hits(t, cfg)[t.index[t["transaction_id"] == tid][0]] or t.loc[t["transaction_id"] == tid, "amount_z"].iloc[0] >= ACFG["amount_z"]


def test_unknown_mode_is_refused():
    import pytest

    with pytest.raises(ValueError):
        transaction_features(ledger(), {**ACFG, "repeat_payment_mode": "fuzzy"})
