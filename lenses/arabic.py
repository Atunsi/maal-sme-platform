"""Shared helpers for the lenses' Arabic template tables (DECISIONS 57).

Each lens keeps its Arabic templates in its own templates_ar.yaml, beside the code that formats the English
ones. These tables are fixed text, never generated, and fill only the additive `_ar` fields.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

import yaml

PLURAL_CATEGORIES = ("zero", "one", "two", "few", "many", "other")


@lru_cache(maxsize=8)
def load_templates(path: str) -> dict:
    return yaml.safe_load(Path(path).read_bytes().decode("utf-8"))


def ar_plural(n: int) -> str:
    """CLDR plural category of an integer in Arabic, as Intl.PluralRules("ar") returns it."""
    if n == 0:
        return "zero"
    if n == 1:
        return "one"
    if n == 2:
        return "two"
    if 3 <= n % 100 <= 10:
        return "few"
    if 11 <= n % 100 <= 99:
        return "many"
    return "other"


def plural(n: int, forms: dict) -> str:
    """The form for n, with {n} filled. Every table that counts something carries all six categories."""
    return forms[ar_plural(n)].format(n=n)
