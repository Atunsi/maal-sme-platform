"""DECISIONS entry 30: counterparty features of thinned businesses equal the full-stream truth.

The truth is the same population regenerated with the sample rate at 1.0: thinning draws from its own
RNG stream, so that is exactly the stream the shipped file was sampled from. No data needed.
"""

from __future__ import annotations

import contextlib
import copy
import io

import numpy as np
import pandas as pd
import pytest

from generator import schemas
from generator.generate import generate, load_config
from profile_engine import features as fe

COUNTERPARTY_FEATURES = [fe.F[i] for i in (5, 10, 20, 21, 22, 45, 46)] + ["cp_coverage_share"]


def tables(rate: float) -> dict[str, pd.DataFrame]:
    cfg = load_config()
    cfg["populations"] = {"research": {**cfg["populations"]["research"], "id_range": [1, 25]}}
    cfg["demo_businesses"] = []
    cfg = copy.deepcopy(cfg)
    cfg["output"]["pos_sales_transaction_sample_rate"] = rate
    with contextlib.redirect_stdout(io.StringIO()):
        t = generate(cfg)
    t = schemas.validate_engine_tables({k: v for k, v in t.items() if k in schemas.ENGINE_FACING})
    tx = t["transactions"]
    tx["counterparty_id"] = tx["counterparty_id"].astype(object).where(tx["counterparty_id"].notna(), None)
    return t


@pytest.fixture(scope="module")
def thin():
    return tables(0.1)


@pytest.fixture(scope="module")
def full():
    return tables(1.0)


def features(t, windows=True):
    w = t["counterparty_windows"] if windows else None
    return fe.transaction_features(t["transactions"], t["businesses"], w)[0].set_index("business_id")


def test_population_contains_thinned_and_unthinned_businesses(thin):
    thinned = set(thin["transactions"].loc[thin["transactions"]["sample_weight"] > 1, "business_id"])
    assert thinned == set(thin["counterparty_windows"]["business_id"])
    assert 0 < len(thinned) < 25


@pytest.mark.parametrize("name", COUNTERPARTY_FEATURES)
def test_feature_equals_the_full_stream_truth(thin, full, name):
    got, true = features(thin)[name].astype(float), features(full, windows=False)[name].astype(float)
    np.testing.assert_allclose(got.to_numpy(), true.to_numpy(), rtol=1e-6, atol=1e-6)


def test_without_the_table_a_thinned_business_is_refused(thin):
    with pytest.raises(ValueError, match="counterparty_windows"):
        features(thin, windows=False)


def test_sampled_rows_alone_are_biased_so_this_test_can_fail(thin, full):
    tx = thin["transactions"].assign(sample_weight=1.0)  # the engine as it ran before entry 30
    biased = fe.transaction_features(tx, thin["businesses"])[0].set_index("business_id")
    ids = sorted(set(thin["counterparty_windows"]["business_id"]))
    true = features(full, windows=False)
    assert (biased.loc[ids, fe.F[20]].astype(float) < true.loc[ids, fe.F[20]].astype(float)).mean() > 0.5
    assert (biased.loc[ids, fe.F[21]].astype(float) > 2 * true.loc[ids, fe.F[21]].astype(float)).mean() > 0.5


def test_the_summary_changes_nothing_else_in_the_generator(thin, full):
    pd.testing.assert_frame_equal(thin["daily_aggregates"], full["daily_aggregates"])
    core = ["business_id", "date", "hour", "amount", "counterparty_id", "category"]  # sub-fields are drawn per row, so they differ
    pd.testing.assert_frame_equal(
        thin["transactions"].query("direction == 'out'")[core].reset_index(drop=True),
        full["transactions"].query("direction == 'out'")[core].reset_index(drop=True),
    )
