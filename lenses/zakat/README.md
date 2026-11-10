# Zakat lens — v1 BUILT, owner to take over

**v1 (2026-10-11, DECISIONS entry 23):** `zakat.py` — NWC method, nisab + hawl gates, explicit reasons. Demo 10001 → SAR 5,963.26; 10002 → `hawl_incomplete`. **The nisab is valued at the calculation month's gold price** (DECISIONS 48, 54): World Bank monthly average × 3.75 SAR/USD, built by `python -m lenses.zakat.nisab_prices --build` from archives in `sources/` into `gold_monthly_sar_per_gram.csv`; a month outside the table is refused. Every output says `nisab_source_status: world_bank_monthly_average_pending_sharia_advisor` and names `nisab_price_month`. The earlier SAR 491.291/g quotation (2026-11-08) is no longer used. Hawl rule (nisab at start and end of the year) awaits Sharia-advisor confirmation.

**Owner:** compliance owner · **Schema:** §7, §8, §17 · **Due:** Week 7

**100% deterministic, permanently.** No LLM anywhere near this, ever (§36.1,
SOP §2) — it computes a religious obligation.

## Reads a different table from every other lens

`data/balances_monthly.csv` (features 27–31) — **not** the transaction-derived
profile. Zakat is calculated from zakatable assets minus short-term
liabilities (Net Working Capital method), not from cash-flow volume. Features
1–26 are insufficient on their own (§7). `GET /profile` deliberately does not
return 27–31, so this lens reads its own path (§8).

## Nisab and hawl are not optional

- **Feature 34 `nisab_threshold_met`** — zakatable net assets above the nisab.
- **Feature 35 `hawl_completion_date`** — one full lunar year of ownership at or
  above nisab.
- If either fails, return `liability_sar: 0` **with an explicit reason**
  (`"below_nisab"` / `"hawl_incomplete"`) — never a computed figure that
  silently assumes both hold (§17).

## Demo data is already seeded for both branches

The 180-day window is under a lunar year, so every unseeded business correctly
returns `hawl_incomplete`. `config.yaml` seeds demo business **10001** with
`zakat_seed` (`hawl_start_date: 2025-08-01`, opening net assets SAR 120,000) so
it reaches a **non-zero** liability, and **10002** has no seed so it correctly
returns `hawl_incomplete` (§17). Showing both proves the rule is real rather
than hardcoded to always pass or always fail.

## Say this before being asked (SOP §10)

"Zakat requires balance-sheet data, not just cash flow. We generate it
synthetically in parallel; a real integration would pull it from an accounting
system rather than a bank feed alone."
