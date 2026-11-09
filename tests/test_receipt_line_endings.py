"""DECISIONS entry 40: receipt hashes depend on the machine's line endings.

Each `xfail(strict=True)` test below states the property entry 40 asks for: the same committed
content gets the same receipt hash on Windows and on Linux or Mac. They fail today, which
reproduces the finding. They are strict, so the day the team adopts a fix (entry 40, not decided)
they pass, pytest reports XPASS as a failure, and the marker has to be removed on purpose.

The last test is the control: the reference-stats hash was already made canonical (entry 35,
correction 2026-11-05), so it passes without a marker.
"""

from __future__ import annotations

import os
from pathlib import Path

import pandas as pd
import pytest

from compliance.sharia import RULES_PATH, load_rules
from pipeline.week8 import _sha, data_sha256
from profile_engine.features import reference_stats_sha256
from scenarios.run import LIBRARY, load_library

ENTRY_40 = "entry 40, not decided: receipt hashes are taken from bytes whose line endings depend on the checkout"


def _both(tmp_path: Path, source: Path, name: str) -> tuple[Path, Path]:
    """The same committed text written once with LF and once with CRLF, as two checkouts would."""
    text = source.read_bytes().replace(b"\r\n", b"\n")
    lf, crlf = tmp_path / f"lf_{name}", tmp_path / f"crlf_{name}"
    lf.write_bytes(text)
    crlf.write_bytes(text.replace(b"\n", b"\r\n"))
    return lf, crlf


@pytest.mark.xfail(reason=ENTRY_40, strict=True)
def test_lens_config_hash_is_the_same_on_every_os(tmp_path):
    """`lens_config_sha256` goes through pipeline.week8._sha (raw bytes)."""
    lf, crlf = _both(tmp_path, Path("lenses/lens_config.yaml"), "lens_config.yaml")
    assert _sha(lf) == _sha(crlf)


@pytest.mark.xfail(reason=ENTRY_40, strict=True)
def test_sharia_rules_hash_is_the_same_on_every_os(tmp_path):
    """`sharia_rules_sha256` comes from compliance.sharia.load_rules, which does not use _sha."""
    lf, crlf = _both(tmp_path, RULES_PATH, "sharia_rules.yaml")
    assert load_rules(str(lf))[1] == load_rules(str(crlf))[1]


@pytest.mark.xfail(reason=ENTRY_40, strict=True)
def test_scenario_library_hash_is_the_same_on_every_os(tmp_path):
    """`scenario_library_sha256` comes from scenarios.run.load_library."""
    lf, crlf = _both(tmp_path, LIBRARY, "library.yaml")
    assert load_library(lf)[1] == load_library(crlf)[1]


@pytest.mark.xfail(reason=ENTRY_40, strict=True)
def test_data_hash_is_the_same_on_every_os(monkeypatch):
    """`data_sha256` hashes DataFrame.to_csv(), whose line terminator is os.linesep, so
    .gitattributes cannot fix it (entry 40, item 2)."""
    tables = {"businesses": pd.DataFrame({"business_id": [1, 1, 2], "x": [1.0, 2.0, 3.0]})}
    monkeypatch.setattr(os, "linesep", "\n")
    posix = data_sha256(tables, 1)
    monkeypatch.setattr(os, "linesep", "\r\n")
    windows = data_sha256(tables, 1)
    assert posix == windows


def test_reference_stats_hash_is_already_canonical(tmp_path):
    """Control: the one hash entry 35 already fixed. It must stay passing."""
    lf, crlf = _both(tmp_path, Path("profile_engine/sector_reference_stats_v2.json"), "stats.json")
    assert reference_stats_sha256(lf.read_bytes()) == reference_stats_sha256(crlf.read_bytes())
