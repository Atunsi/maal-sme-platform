"""Generator determinism (CLAUDE.md: RNG keyed on (population seed, business_id, purpose)). No data needed.

The reproducibility receipt and every cross-run comparison (the rho sweep, latent_ceiling --verify)
rest on one business generating the same rows no matter when, or next to what, it is generated.
"""

from __future__ import annotations

from itertools import pairwise

import numpy as np
import pandas as pd
import pytest

from generator.generate import generate_business, latent_index_stats, load_config, sample_registry


@pytest.fixture(scope="module")
def cfg():
    return load_config()


def make(cfg, b_id, rho=None):
    if rho is not None:
        cfg = {**cfg, "latent_to_observable_correlation": rho}
    pop_name, pop = next((n, p) for n, p in cfg["populations"].items() if p["id_range"][0] <= b_id <= p["id_range"][1])
    demo = {d["id"]: d for d in cfg.get("demo_businesses", [])}.get(b_id)
    biz = sample_registry(cfg, pop_name, pop, b_id, demo)
    return biz, generate_business(cfg, biz, latent_index_stats(cfg))


def same(a, b) -> bool:
    if isinstance(a, dict):
        return a.keys() == b.keys() and all(same(a[k], b[k]) for k in a)
    if isinstance(a, (list, tuple)):
        return len(a) == len(b) and all(same(x, y) for x, y in zip(a, b, strict=True))
    if isinstance(a, (np.ndarray, pd.Series, pd.Index)):
        return np.array_equal(np.asarray(a), np.asarray(b), equal_nan=np.asarray(a).dtype.kind == "f")
    if isinstance(a, pd.DataFrame):
        return a.equals(b)
    if isinstance(a, float) and np.isnan(a):
        return isinstance(b, float) and np.isnan(b)
    return a == b


@pytest.mark.parametrize("b_id", [7, 10_001])  # one research, one serving (demo) business
def test_same_business_generates_identical_rows_twice(cfg, b_id):
    assert same(make(cfg, b_id), make(cfg, b_id))


def test_business_does_not_depend_on_what_was_generated_before(cfg):
    alone = make(cfg, 7)
    for other in (1, 2, 10_002):
        make(cfg, other)
    assert same(alone, make(cfg, 7))


def test_populations_are_disjoint(cfg):
    pops = list(cfg["populations"].values())
    assert len({p["seed"] for p in pops}) == len(pops)
    ranges = sorted(p["id_range"] for p in pops)
    assert all(a[1] < b[0] for a, b in pairwise(ranges))


def test_label_and_latents_do_not_move_with_rho(cfg):
    # Purpose 1's first draws precede anything rho-dependent, so the rho sweep isolates observables (§14).
    _, a = make(cfg, 7, rho=0.6)
    _, b = make(cfg, 7, rho=0.9)
    assert a["label"] == b["label"]
    for k in ("latent_management_quality", "latent_market_shock_sensitivity", "p_default"):
        assert a["latents"][k] == b["latents"][k]
