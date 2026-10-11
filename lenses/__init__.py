"""Analytical lenses + governance modules (schema §8). Parameters: lenses/lens_config.yaml."""

from __future__ import annotations

from pathlib import Path

import yaml

LENS_CONFIG_PATH = Path(__file__).with_name("lens_config.yaml")


def load_lens_config(path: str | Path = LENS_CONFIG_PATH) -> dict:
    with open(path, encoding="utf-8") as f:
        return yaml.safe_load(f)
