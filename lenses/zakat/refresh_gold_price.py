
"""Refresh the saved GoldAPI quotation without running Zakat."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

from lenses.zakat.gold_price import (
    fetch_gold_price,
    gold_quote_sha256,
    load_gold_price,
)

LATEST_PATH = Path("data/gold_price_latest.json")
HISTORY_DIR = Path("data/gold_quotes")


def refresh_gold_price() -> dict:
    """Fetch and archive a quotation, then update the latest pointer."""
    quote = fetch_gold_price()

    HISTORY_DIR.mkdir(parents=True, exist_ok=True)

    timestamp = datetime.fromisoformat(
        quote["quoted_at"].replace("Z", "+00:00")
    ).astimezone(timezone.utc)

    fingerprint = gold_quote_sha256(quote)
    filename = f"{timestamp:%Y%m%dT%H%M%SZ}_{fingerprint[:12]}.json"
    history_path = HISTORY_DIR / filename

    content = json.dumps(quote, indent=2, sort_keys=True) + "\n"

    # Preserve a uniquely named historical quotation.
    
    if history_path.exists():
        existing_quote = load_gold_price(str(history_path))

        if gold_quote_sha256(existing_quote) != fingerprint:
            raise ValueError("Archived quotation hash mismatch")
    else:
        with history_path.open("x", encoding="utf-8") as file:
            file.write(content)


    # Validate the archive before updating the latest copy.
    load_gold_price(str(history_path))

    LATEST_PATH.parent.mkdir(parents=True, exist_ok=True)
    LATEST_PATH.write_text(content, encoding="utf-8")

    return {
        "archive": str(history_path),
        "latest": str(LATEST_PATH),
        "quoted_at": quote["quoted_at"],
        "price_sar_per_gram": quote["price_sar_per_gram"],
        "quote_sha256": fingerprint,
    }


if __name__ == "__main__":
    print(json.dumps(refresh_gold_price(), indent=2))
