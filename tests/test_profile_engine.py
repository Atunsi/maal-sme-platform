"""Unit tests for the profile engine (§15 states, §16 rules, determinism, registry, entry 13).

No generated data needed — every test builds its own tiny tables, so they run anywhere in seconds.
"""

from __future__ import annotations

import ast
import inspect

import numpy as np
import pandas as pd
import pytest

from generator import schemas
from profile_engine import features as fe
from profile_engine import registry
from profile_engine.registry import (
    FEATURE_NAMES,
    NULL_REASONS,
    PROFILE_FEATURE_IDS,
    ZAKAT_PROFILE_FEATURE_IDS,
)

AS_OF = pd.Timestamp("2026-06-30")
F = FEATURE_NAMES


def make_tables(days, inflow=3_000.0, outflow=2_000.0, start_balance=50_000.0, active=None, source="synthetic", b_id=1, tx=None):
    """One business with `days` calendar days of history ending at AS_OF.

    inflow / outflow: a constant, or a function of the day index (0 = oldest day).
    active: optional function of the day index; an inactive day has no flows at all.
    """
    dates = pd.date_range(end=AS_OF, periods=days, freq="D")
    rows, bal = [], start_balance
    for i, d in enumerate(dates):
        on = active(i) if active else True
        fin = (inflow(i) if callable(inflow) else inflow) if on else 0.0
        fout = (outflow(i) if callable(outflow) else outflow) if on else 0.0
        bal += fin - fout
        rows.append({
            "business_id": b_id, "date": d, "inflow_total": fin, "outflow_total": fout,
            "inflow_count": 3 if fin > 0 else 0, "outflow_count": 2 if fout > 0 else 0,
            "recurring_outflow_total": 0.5 * fout, "net_flow": fin - fout, "eod_balance": bal,
        })
    daily = pd.DataFrame(rows)
    if tx is None:  # one customer receipt and one supplier payment every 10th day
        tx = pd.DataFrame([
            {"business_id": b_id, "date": d, "direction": dr, "counterparty_type": ct, "category": cat,
             "subfamily": "OTHR", "counterparty_id": cp, "amount": 1_000.0, "sample_weight": 1.0}
            for d in dates[::10]
            for dr, ct, cat, cp in (("in", "customer", "sales", "C1"), ("out", "supplier", "inventory", "S1"))
        ])
    biz = pd.DataFrame([{
        "business_id": b_id, "window_end": AS_OF, "operating_start_date": dates[0], "data_source": source,
        "declared_mcc_code": 5411, "sector": "retail_trade", "population": "research",
    }])
    return {"daily_aggregates": daily, "transactions": tx, "businesses": biz}


def run(tables, coverage_min_by_source=None):
    return fe.compute_profiles(tables, None, None, hazard_seed=0, reference_stats=None, coverage_min_by_source=coverage_min_by_source)


def value(out, fid, b_id=1):
    return out["features"].set_index("business_id").loc[b_id, F[fid]]


def reason(out, fid, b_id=1):
    n = out["nulls"]
    r = n[(n["business_id"] == b_id) & (n["feature_id"] == str(fid))]["reason"]
    return r.iloc[0] if len(r) else None


def status(out, b_id=1):
    return out["status"].set_index("business_id").loc[b_id, "status"]


# --- §15 states -------------------------------------------------------------------------------


def test_insufficient_data_nulls_everything_but_coverage():
    """§15: under 60 active days in the trailing 90 → insufficient_data; only feature 32 is set."""
    out = run(make_tables(200, active=lambda i: i % 2 == 0))  # ~45 active days of the last 90
    assert status(out) == "insufficient_data"
    assert value(out, 32) < 60
    for fid in FEATURE_NAMES:
        if fid == 32:
            continue
        assert pd.isna(value(out, fid)), fid
        assert reason(out, fid) == "insufficient_data", fid


def test_real_source_threshold_is_ten_days():
    """§15, DECISIONS entry 9: an external_real business needs only 10 active days of 90."""
    tables = make_tables(200, active=lambda i: i % 7 == 0, source="external_real")  # ~13 active days of 90
    thresholds = {"synthetic": 60, "external_real": 10}
    assert status(run(tables, thresholds)) != "insufficient_data"
    assert status(run(tables)) == "insufficient_data"  # the default 60 still refuses it


def test_partial_profile_nulls_the_prior_window_features():
    """§15: coverage ok but under 180 days of history → partial_profile; 4, 9, 43, 45 need the prior window."""
    out = run(make_tables(120))
    assert status(out) == "partial_profile"
    for fid in (4, 9, 43, 45):
        assert pd.isna(value(out, fid)), fid
        assert reason(out, fid) == "insufficient_history", fid
    for fid in (1, 2, 6, 11, 13, 16):
        assert not pd.isna(value(out, fid)), fid


def test_scored_with_full_history():
    """§15: 180+ days of steady activity → scored."""
    assert status(run(make_tables(200))) == "scored"


# --- §16 rules --------------------------------------------------------------------------------


def test_runway_is_null_when_not_burning():
    """§16: inflow above outflow → no burn → feature 18 is null with a reason, never 0 or infinity."""
    out = run(make_tables(200, inflow=3_000.0, outflow=2_000.0))
    assert pd.isna(value(out, 18))
    assert reason(out, 18) == "not_applicable"


def test_runway_is_zero_when_already_overdrawn():
    """§16: a burning business already below zero has runway exactly 0, never negative."""
    out = run(make_tables(200, inflow=1_000.0, outflow=2_000.0, start_balance=10_000.0))
    assert value(out, 17) < 0
    assert value(out, 18) == 0.0


def test_epsilon_floor_on_monthly_denominator():
    """§16: a monthly denominator near zero is floored at SAR 500 and the result stays finite."""
    out = run(make_tables(200, inflow=3_000.0, outflow=0.0, active=None))
    f1 = value(out, 1)
    assert value(out, 6) == 0.0
    assert value(out, 12) == pytest.approx(f1 / registry.EPS_MONTHLY)
    assert np.isfinite(value(out, 12))


def test_growth_is_capped_at_300_percent():
    """§16: revenue growth is clipped to [−300%, +300%]."""
    jump = run(make_tables(200, inflow=lambda i: 1_000.0 if i < 110 else 10_000.0, outflow=500.0))
    assert value(jump, 4) == registry.GROWTH_CAP_PCT
    collapse = run(make_tables(200, inflow=lambda i: 10_000.0 if i < 110 else 1.0, outflow=500.0))
    assert -registry.GROWTH_CAP_PCT <= value(collapse, 4) < 0


def test_no_bare_nulls():
    """§15: every null in the profile has a row in the nulls output with a reason from NULL_REASONS."""
    fixtures = [
        make_tables(200, active=lambda i: i % 2 == 0),
        make_tables(120),
        make_tables(200),
        make_tables(200, inflow=1_000.0, outflow=2_000.0, start_balance=10_000.0),
        make_tables(200, outflow=0.0),
    ]
    for tables in fixtures:
        out = run(tables)
        feats = out["features"].set_index("business_id")
        nulls = out["nulls"]
        for fid, name in FEATURE_NAMES.items():
            if pd.isna(feats.loc[1, name]):
                r = nulls[(nulls["business_id"] == 1) & (nulls["feature_id"] == str(fid))]["reason"]
                assert len(r) == 1, f"feature {fid} is null without a reason"
                assert r.iloc[0] in NULL_REASONS


def test_same_input_gives_byte_identical_output():
    """SOP §2: the engine is deterministic, including the block-bootstrap hazard features 52–54."""
    a, b = run(make_tables(200)), run(make_tables(200))
    for key in ("features", "nulls", "status"):
        assert a[key].to_csv(index=False) == b[key].to_csv(index=False), key


# --- DECISIONS entry 13: thinned POS rows carry sample_weight ---------------------------------


@pytest.mark.xfail(
    reason="engine ignores transactions.sample_weight in feature 21 (it mixes inflow and outflow value); "
    "entry 13's no-bias claim is false for features 20–22, see DECISIONS entry 30",
    strict=True,
)
def test_sample_weight_counts_a_thinned_row_at_its_weight():
    """Entry 13: a thinned POS row with sample_weight = 5 stands for five receipts in value-based features."""
    tx = pd.DataFrame([
        {"business_id": 1, "date": AS_OF - pd.Timedelta(days=5), "direction": "in", "counterparty_type": "customer",
         "category": "sales", "subfamily": "OTHR", "counterparty_id": "C1", "amount": 100.0, "sample_weight": 5.0},
        {"business_id": 1, "date": AS_OF - pd.Timedelta(days=5), "direction": "out", "counterparty_type": "supplier",
         "category": "inventory", "subfamily": "OTHR", "counterparty_id": "S1", "amount": 500.0, "sample_weight": 1.0},
    ])
    out = run(make_tables(200, tx=tx))
    # weighted: C1 = 500, S1 = 500 → HHI = 0.5²+0.5² = 0.5 (unweighted would give 0.722)
    assert value(out, 21) == pytest.approx(0.5)


def test_daily_inflow_features_do_not_depend_on_transactions():
    """Entry 13: feature 1 reads daily_aggregates (the full stream), so thinning transactions cannot move it."""
    full = run(make_tables(200))
    thin = make_tables(200)
    thin["transactions"] = thin["transactions"].iloc[::2].reset_index(drop=True)
    assert value(run(thin), 1) == value(full, 1)


# --- Registry -----------------------------------------------------------------------------------


def test_registry_counts_and_membership():
    """Registry: 71 names; /profile list has 64 IDs incl. 23–26, none of the Zakat-only 27–31, 34, 35."""
    assert len(FEATURE_NAMES) == 71
    assert len(PROFILE_FEATURE_IDS) == 64
    assert len(set(PROFILE_FEATURE_IDS)) == 64
    assert not set(PROFILE_FEATURE_IDS) & set(ZAKAT_PROFILE_FEATURE_IDS)
    assert set(PROFILE_FEATURE_IDS) | set(ZAKAT_PROFILE_FEATURE_IDS) == set(FEATURE_NAMES)
    # 23–26 are in the §8 contract; the credit lens removes them itself (lens_config credit.excluded_feature_ids)
    assert {23, 24, 25, 26} <= set(PROFILE_FEATURE_IDS)


def test_explicit_profile_list_matches_the_former_range_expression():
    """SOP §8: replacing the range() expression with an explicit list changed nothing, order included."""
    former = [*range(1, 19), "18b", *range(19, 27), 32, 33, 36, *range(37, 55), *range(55, 60), 60, 61, 62, "62b", 63, 64, 65, 66, 67, 68, 69]
    assert former == PROFILE_FEATURE_IDS


def test_membership_lists_are_not_built_from_range():
    """SOP §8: membership is an explicit list in code, never a range."""
    tree = ast.parse(inspect.getsource(registry))
    for node in ast.walk(tree):
        if isinstance(node, ast.AnnAssign | ast.Assign):
            targets = [node.target] if isinstance(node, ast.AnnAssign) else node.targets
            names = {t.id for t in targets if isinstance(t, ast.Name)}
            if names & {"PROFILE_FEATURE_IDS", "ZAKAT_PROFILE_FEATURE_IDS", "COUNTERPARTY_FEATURE_IDS"}:
                calls = [n for n in ast.walk(node.value) if isinstance(n, ast.Call)]
                assert not calls, f"{names} is built from a call"


# --- Latent leak ---------------------------------------------------------------------------------


def test_no_latent_column_reaches_the_profile():
    """schemas.assert_no_latent_leak: a latent_ column on an input table never reaches any engine output."""
    tables = make_tables(200)
    tables["businesses"]["latent_risk_index"] = 0.9
    tables["daily_aggregates"]["latent_distress"] = 0.5
    out = run(tables)
    for name, df in out.items():
        assert not [c for c in df.columns if c.startswith("latent_")], name
        schemas.assert_no_latent_leak(df, name)
