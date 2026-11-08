
"""Tests for the GoldAPI quotation adapter."""

import io
import json
from unittest.mock import patch

import pytest

from lenses.zakat.gold_price import fetch_gold_price


def mock_response(data):
    """Simulate a GoldAPI JSON response."""
    return io.BytesIO(json.dumps(data).encode("utf-8"))


def sample_quote():
    return {
        "metal": "XAU",
        "currency": "SAR",
        "datetime": "2026-11-08T19:45:19Z",
        "melt_price_per_gram": {"24k": 491.3341},
    }


def test_gold_price_and_nisab():
    with (
        patch.dict("os.environ", {"GOLDAPI_KEY": "test-key"}),
        patch(
            "lenses.zakat.gold_price.urlopen",
            return_value=mock_response(sample_quote()),
        ),
    ):
        result = fetch_gold_price()

    assert result["price_sar_per_gram"] == "491.3341"
    assert result["nisab_85g_sar"] == "41763.40"
    assert result["currency"] == "SAR"
    assert result["metal"] == "XAU"


def test_rejects_wrong_currency():
    quote = sample_quote()
    quote["currency"] = "USD"

    with (
        patch.dict("os.environ", {"GOLDAPI_KEY": "test-key"}),
        patch(
            "lenses.zakat.gold_price.urlopen",
            return_value=mock_response(quote),
        ),
        pytest.raises(ValueError, match="Unexpected metal or currency"),
    ):
        fetch_gold_price()


def test_rejects_invalid_price():
    quote = sample_quote()
    quote["melt_price_per_gram"]["24k"] = -100

    with (
        patch.dict("os.environ", {"GOLDAPI_KEY": "test-key"}),
        patch(
            "lenses.zakat.gold_price.urlopen",
            return_value=mock_response(quote),
        ),
        pytest.raises(ValueError, match="Invalid gold price"),
    ):
        fetch_gold_price()


def test_requires_api_key():
    with (
        patch.dict("os.environ", {}, clear=True),
        pytest.raises(ValueError, match="GOLDAPI_KEY"),
    ):
        fetch_gold_price()


def test_saved_quote_updates_zakat_config():
    """A saved quote updates a config copy, not the original."""
    from lenses.zakat.gold_price import zakat_config_from_quote

    original = {
        "rate_lunar_year": 0.025,
        "lunar_year_days": 354,
        "hawl_rule": "nisab_at_start_and_end",
        "nisab": {
            "basis": "gold",
            "grams": 85,
            "price_sar_per_gram": 400.0,
            "source_status": "placeholder_unverified",
        },
    }

    quote = {
        "metal": "XAU",
        "currency": "SAR",
        "purity": "24k",
        "price_sar_per_gram": "490.9021",
    }

    updated = zakat_config_from_quote(original, quote)

    assert updated["nisab"]["price_sar_per_gram"] == 490.9021
    assert updated["nisab"]["source_status"] == (
        "goldapi_quote_pending_sharia_advisor_review"
    )
    assert original["nisab"]["price_sar_per_gram"] == 400.0


def test_gold_quote_receipt_metadata(tmp_path):
    """A saved quotation is recorded in the pipeline receipt."""
    from pipeline.week8 import make_context

    quote = {
        "provider": "GoldAPI.io",
        "metal": "XAU",
        "currency": "SAR",
        "purity": "24k",
        "price_sar_per_gram": "490.9021",
        "quoted_at": "2026-11-08T19:57:54+00:00",
    }

    path = tmp_path / "gold_quote.json"
    path.write_text(json.dumps(quote), encoding="utf-8")

    ctx = make_context(gold_quote_path=str(path))

    assert ctx.lc["zakat"]["nisab"]["price_sar_per_gram"] == 490.9021
    assert ctx.receipt_base["gold_quote"]["provider"] == "GoldAPI.io"
    assert ctx.receipt_base["gold_quote"]["quoted_at"] == quote["quoted_at"]
    assert ctx.receipt_base["gold_quote"]["price_sar_per_gram"] == "490.9021"
    from lenses.zakat.gold_price import gold_quote_sha256

    assert ctx.receipt_base["gold_quote"]["quote_sha256"] == (
    gold_quote_sha256(quote)
)



def test_rejects_future_gold_quote(tmp_path, monkeypatch):
    """Reject future-dated gold quotations without generated data."""
    from types import SimpleNamespace

    from pipeline.week8 import make_context, zakat_section

    quote = {
        "provider": "GoldAPI.io",
        "metal": "XAU",
        "currency": "SAR",
        "purity": "24k",
        "price_sar_per_gram": "490.9021",
        "quoted_at": "2026-11-08T19:57:54+00:00",
    }

    path = tmp_path / "future_gold_quote.json"
    path.write_text(json.dumps(quote), encoding="utf-8")

    ctx = make_context(gold_quote_path=str(path))

    business = SimpleNamespace(
        window_end="2026-06-30",
    )

    prepared = SimpleNamespace(
        biz=lambda business_id: business,
    )

    with pytest.raises(
        ValueError,
        match="Gold quotation is newer than the Zakat calculation date",
    ):
        zakat_section(ctx, prepared, 10001)


def test_gold_quote_sha256_is_deterministic():
    """Equivalent quotations produce identical fingerprints."""
    from lenses.zakat.gold_price import gold_quote_sha256

    quote_a = {
        "provider": "GoldAPI.io",
        "currency": "SAR",
        "price_sar_per_gram": "490.9021",
    }

    quote_b = {
        "price_sar_per_gram": "490.9021",
        "currency": "SAR",
        "provider": "GoldAPI.io",
    }

    assert gold_quote_sha256(quote_a) == gold_quote_sha256(quote_b)

    quote_b["price_sar_per_gram"] = "491.0000"

    assert gold_quote_sha256(quote_a) != gold_quote_sha256(quote_b)


def test_refresh_reuses_existing_quote(tmp_path, monkeypatch):
    """Repeated API quotations preserve the existing archive."""
    from lenses.zakat import refresh_gold_price as refresh

    quote = {
        "provider": "GoldAPI.io",
        "metal": "XAU",
        "currency": "SAR",
        "purity": "24k",
        "price_sar_per_gram": "490.9021",
        "quoted_at": "2026-11-08T20:38:18+00:00",
    }

    monkeypatch.setattr(refresh, "HISTORY_DIR", tmp_path / "history")
    monkeypatch.setattr(refresh, "LATEST_PATH", tmp_path / "latest.json")
    monkeypatch.setattr(refresh, "fetch_gold_price", lambda: quote)

    first = refresh.refresh_gold_price()
    second = refresh.refresh_gold_price()

    assert first["archive"] == second["archive"]
    assert len(list((tmp_path / "history").glob("*.json"))) == 1
    assert refresh.LATEST_PATH.exists()
