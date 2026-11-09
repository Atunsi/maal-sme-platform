
"""GoldAPI adapter for dated 24K gold quotations in SAR."""

from __future__ import annotations

import hashlib
import json
import os
from copy import deepcopy
from datetime import datetime
from decimal import Decimal, InvalidOperation
from pathlib import Path
from urllib.request import Request, urlopen

GOLD_API_URL = "https://www.goldapi.io/api/price/XAU/SAR"


def fetch_gold_price() -> dict:
    """Fetch and validate a dated gold price from GoldAPI."""
    api_key = os.environ.get("GOLDAPI_KEY")
    if not api_key:
        raise ValueError("GOLDAPI_KEY environment variable is missing")

    request = Request(
        GOLD_API_URL,
        headers={"x-access-token": api_key},
    )

    with urlopen(request, timeout=15) as response:
        data = json.load(response)

    if data.get("metal") != "XAU" or data.get("currency") != "SAR":
        raise ValueError("Unexpected metal or currency")

    try:
        price = Decimal(str(data["melt_price_per_gram"]["24k"]))
        timestamp = datetime.fromisoformat(
            data["datetime"].replace("Z", "+00:00")
        )
    except (KeyError, TypeError, ValueError, InvalidOperation) as exc:
        raise ValueError("Invalid GoldAPI response") from exc

    if not price.is_finite() or price <= 0:
        raise ValueError("Invalid gold price")

    if timestamp.utcoffset() is None:
        raise ValueError("Gold price timestamp must include timezone")

    return {
        "provider": "GoldAPI.io",
        "metal": "XAU",
        "currency": "SAR",
        "purity": "24k",
        "price_sar_per_gram": str(price),
        "quoted_at": timestamp.isoformat(),
        "nisab_85g_sar": str(
            (price * Decimal(85)).quantize(Decimal("0.01"))
        ),
        "verification_status": "pending_sharia_advisor_review",
    }


def save_gold_price(
    quote: dict,
    path: str = "data/gold_price_latest.json",
) -> None:
    """Save a validated gold quotation for reproducible Zakat calculations."""
    output = Path(path)
    output.parent.mkdir(parents=True, exist_ok=True)

    output.write_text(
        json.dumps(quote, indent=2) + "\n",
        encoding="utf-8",
    )

    
def load_gold_price(
    path: str = "data/gold_price_latest.json",
) -> dict:
    """Load a saved gold quotation without making an API request."""
    with Path(path).open(encoding="utf-8") as file:
        quote = json.load(file)

    required = (
        "provider",
        "metal",
        "currency",
        "purity",
        "price_sar_per_gram",
        "quoted_at",
    )

    if not all(field in quote for field in required):
        raise ValueError("Saved gold quotation is incomplete")

    if quote["metal"] != "XAU" or quote["currency"] != "SAR":
        raise ValueError("Unexpected metal or currency")

    if quote["purity"] != "24k":
        raise ValueError("Unexpected gold purity")

    try:
        price = Decimal(str(quote["price_sar_per_gram"]))
    except (InvalidOperation, TypeError, ValueError) as exc:
        raise ValueError("Invalid saved gold price") from exc

    if not price.is_finite() or price <= 0:
        raise ValueError("Invalid saved gold price")

    try:
        quoted_at = datetime.fromisoformat(
            quote["quoted_at"].replace("Z", "+00:00")
        )
    except (TypeError, ValueError) as exc:
        raise ValueError("Invalid quotation timestamp") from exc

    if quoted_at.utcoffset() is None:
        raise ValueError("Quotation timestamp must include timezone")

    return quote


def zakat_config_from_quote(zcfg: dict, quote: dict) -> dict:
    """Return a Zakat config using a saved, validated gold quotation."""
    updated = deepcopy(zcfg)

    if quote.get("metal") != "XAU":
        raise ValueError("Expected gold quotation")

    if quote.get("currency") != "SAR" or quote.get("purity") != "24k":
        raise ValueError("Expected 24K gold quotation in SAR")

    try:
        price = Decimal(str(quote["price_sar_per_gram"]))
    except (KeyError, TypeError, InvalidOperation) as exc:
        raise ValueError("Invalid quotation price") from exc

    if not price.is_finite() or price <= 0:
        raise ValueError("Invalid quotation price")

    if updated["nisab"]["basis"] != "gold":
        raise ValueError("Zakat configuration must use gold Nisab")

    updated["nisab"]["price_sar_per_gram"] = float(price)
    updated["nisab"]["source_status"] = (
        "goldapi_quote_pending_sharia_advisor_review"
    )

    return updated


def gold_quote_sha256(quote: dict) -> str:
    """Return a deterministic SHA-256 fingerprint of quotation data."""
    canonical = json.dumps(
        quote,
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
    ).encode("utf-8")

    return hashlib.sha256(canonical).hexdigest()
