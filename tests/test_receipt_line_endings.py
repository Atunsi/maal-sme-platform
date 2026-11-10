"""DECISIONS entry 40: receipt hashes must not depend on the machine's line endings.

Each test writes the same committed text once with LF and once with CRLF, as a Linux and a Windows
checkout would, and asserts that the hash the receipt records is the same. Until entry 40 was
implemented these four failed (they were strict xfails reproducing the finding); they now pass, and
any change that brings raw-byte hashing back fails here.

The last test is the control from entry 35: the reference-stats hash was already canonical.
"""

from __future__ import annotations

import os
from pathlib import Path

import pandas as pd

from compliance.sharia import RULES_PATH, load_rules
from pipeline.week8 import _sha, data_sha256
from profile_engine.features import reference_stats_sha256
from scenarios.run import LIBRARY, load_library


def _both(tmp_path: Path, source: Path, name: str) -> tuple[Path, Path]:
    """The same committed text written once with LF and once with CRLF, as two checkouts would."""
    text = source.read_bytes().replace(b"\r\n", b"\n")
    lf, crlf = tmp_path / f"lf_{name}", tmp_path / f"crlf_{name}"
    lf.write_bytes(text)
    crlf.write_bytes(text.replace(b"\n", b"\r\n"))
    return lf, crlf


def test_lens_config_hash_is_the_same_on_every_os(tmp_path):
    """`lens_config_sha256` (and `config_sha256`) go through pipeline.week8._sha."""
    lf, crlf = _both(tmp_path, Path("lenses/lens_config.yaml"), "lens_config.yaml")
    assert _sha(lf) == _sha(crlf)


def test_sharia_rules_hash_is_the_same_on_every_os(tmp_path):
    """`sharia_rules_sha256` comes from compliance.sharia.load_rules, which does not use _sha."""
    lf, crlf = _both(tmp_path, RULES_PATH, "sharia_rules.yaml")
    assert load_rules(str(lf))[1] == load_rules(str(crlf))[1]


def test_scenario_library_hash_is_the_same_on_every_os(tmp_path):
    """`scenario_library_sha256` comes from scenarios.run.load_library."""
    lf, crlf = _both(tmp_path, LIBRARY, "library.yaml")
    assert load_library(lf)[1] == load_library(crlf)[1]


def test_data_hash_is_the_same_on_every_os(monkeypatch):
    """`data_sha256` hashes DataFrame.to_csv(); its line terminator is fixed to "\\n", so os.linesep
    (which .gitattributes cannot change) no longer matters."""
    tables = {"businesses": pd.DataFrame({"business_id": [1, 1, 2], "x": [1.0, 2.0, 3.0]})}
    monkeypatch.setattr(os, "linesep", "\n")
    posix = data_sha256(tables, 1)
    monkeypatch.setattr(os, "linesep", "\r\n")
    windows = data_sha256(tables, 1)
    assert posix == windows


def test_reference_stats_hash_is_already_canonical(tmp_path):
    """Control: the hash entry 35 made canonical first."""
    lf, crlf = _both(tmp_path, Path("profile_engine/sector_reference_stats_v2.json"), "stats.json")
    assert reference_stats_sha256(lf.read_bytes()) == reference_stats_sha256(crlf.read_bytes())
