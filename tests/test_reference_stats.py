"""§35 pinned sector reference statistics (DECISIONS entry 35): v2 is built once, v1 is never touched."""

from __future__ import annotations

import hashlib
import json

import pandas as pd
import pytest

from profile_engine import compute
from profile_engine import features as fe

# Full canonical (LF) sha256 of the committed v1 file — the hash of the git blob, the same on every OS
# (DECISIONS 35, correction 2026-11-05; the CRLF hash 14026c00…6fae4 recorded earlier was Windows-only).
V1_SHA256 = "7816e2ce3d7afa3612fe34f5c5fac71b2e39106ff4ddd7a6b8632d6199b27a7f"


def tiny_population() -> tuple[pd.DataFrame, pd.DataFrame]:
    rows, biz = [], []
    for i, sector in enumerate(["retail_trade", "retail_trade", "construction", "construction", "retail_trade"], start=1):
        rows.append({"business_id": i, **{fe.F[b]: float(i * 10 + b) for b in fe.Z_FEATURES.values()}})
        biz.append({"business_id": i, "sector": sector, "population": "serving" if i == 5 else "research"})
    return pd.DataFrame(rows), pd.DataFrame(biz)


@pytest.fixture
def stats_dir(tmp_path, monkeypatch):
    """Point every reference-stats path at a temp directory holding a copy of the real v1."""
    v1, v2 = tmp_path / "sector_reference_stats_v1.json", tmp_path / "sector_reference_stats_v2.json"
    v1.write_bytes(fe.REFERENCE_STATS_V1_PATH.read_bytes())
    monkeypatch.setattr(fe, "REFERENCE_STATS_V1_PATH", v1)
    monkeypatch.setattr(fe, "REFERENCE_STATS_V2_PATH", v2)
    monkeypatch.setattr(fe, "REFERENCE_STATS_PATH", v2)
    return v1, v2


def test_build_writes_version_v2_by_default_and_honours_an_explicit_version():
    feats, biz = tiny_population()
    ref = fe.build_reference_stats(feats, biz)
    assert ref["version"] == "v2" == fe.REFERENCE_STATS_VERSION
    assert ref["population"] == "research"
    assert ref["n_businesses"] == 4  # the serving business is excluded
    assert fe.build_reference_stats(feats, biz, version="v9")["version"] == "v9"


def test_build_writes_v2_and_leaves_v1_bytes_unchanged(stats_dir):
    v1, v2 = stats_dir
    before = v1.read_bytes()
    feats, biz = tiny_population()
    compute.write_reference_stats(fe.build_reference_stats(feats, biz), fe.REFERENCE_STATS_PATH)
    assert v2.exists()
    assert json.loads(v2.read_bytes())["version"] == "v2"
    assert v1.read_bytes() == before
    stats, sha = fe.load_reference_stats()  # resolves REFERENCE_STATS_PATH at call time
    assert stats["version"] == "v2"
    assert sha == hashlib.sha256(v2.read_bytes().replace(b"\r\n", b"\n")).hexdigest()  # canonical LF


def test_guard_refuses_v1_and_refuses_to_overwrite_v2_without_the_flag(stats_dir):
    v1, v2 = stats_dir
    feats, biz = tiny_population()
    ref = fe.build_reference_stats(feats, biz)
    before = v1.read_bytes()
    with pytest.raises(SystemExit, match="v1"):
        compute.write_reference_stats(ref, v1)
    with pytest.raises(SystemExit, match="v1"):
        compute.write_reference_stats(ref, v1, overwrite=True)  # the flag never unlocks v1
    assert v1.read_bytes() == before

    compute.write_reference_stats(ref, v2)
    first = v2.read_bytes()
    with pytest.raises(SystemExit, match="overwrite"):
        compute.write_reference_stats(fe.build_reference_stats(feats, biz, version="v2-other"), v2)
    assert v2.read_bytes() == first
    compute.write_reference_stats(fe.build_reference_stats(feats, biz, version="v2-other"), v2, overwrite=True)
    assert json.loads(v2.read_bytes())["version"] == "v2-other"


def test_cli_refuses_an_existing_v2_before_loading_any_data(stats_dir, tmp_path):
    _, v2 = stats_dir
    v2.write_text("{}", encoding="utf-8")
    with pytest.raises(SystemExit, match="overwrite"):
        compute.main(["--dir", str(tmp_path / "no_such_dir"), "--build-reference-stats"])
    assert v2.read_text(encoding="utf-8") == "{}"


def test_engine_reads_v2_and_v1_is_not_the_file_in_use():
    assert fe.REFERENCE_STATS_PATH == fe.REFERENCE_STATS_V2_PATH
    assert fe.REFERENCE_STATS_PATH.name == "sector_reference_stats_v2.json"
    assert fe.REFERENCE_STATS_V1_PATH.name == "sector_reference_stats_v1.json"


def test_committed_v1_file_is_byte_identical():
    """v1 stays reproducible for receipts made before entry 35 (canonical LF hash, the same on every OS)."""
    assert fe.load_reference_stats(fe.REFERENCE_STATS_V1_PATH)[1] == V1_SHA256


def test_lf_and_crlf_copies_hash_the_same(tmp_path):
    """A Windows CRLF checkout and an LF checkout of the same file give the same reference-stats hash."""
    lf = fe.REFERENCE_STATS_V1_PATH.read_bytes().replace(b"\r\n", b"\n")
    crlf = lf.replace(b"\n", b"\r\n")
    assert lf != crlf
    (tmp_path / "lf.json").write_bytes(lf)
    (tmp_path / "crlf.json").write_bytes(crlf)
    (s_lf, h_lf), (s_crlf, h_crlf) = fe.load_reference_stats(tmp_path / "lf.json"), fe.load_reference_stats(tmp_path / "crlf.json")
    assert h_lf == h_crlf == V1_SHA256 == hashlib.sha256(lf).hexdigest()
    assert s_lf == s_crlf
