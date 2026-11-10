# Decision brief — compliance (Mohammed Alshaibani, with the Sharia advisor)

> **Status 2026-11-10:** most lines in this brief were ticked on the owners' behalf on verbal agreement (DECISIONS entry 53), and entries 40, 47, 48 and 49 were decided; entry 40 is implemented (`00ae025`). Read entry 53 for what is still open. The brief below is kept as written.
> DECISIONS.md line numbers below are as of commit `5ca3ba3` (read them with `git show 5ca3ba3:DECISIONS.md`); entries after 40 have moved since.

Prepared 2026-11-10 from `DECISIONS.md` on `main`. Nothing here is decided for you. Line numbers
refer to `DECISIONS.md` unless a file is named.

| Entry | What is decided | What is blocking |
|---|---|---|
| 48 Nisab price and date | Implemented 2026-11-10 as the calculation month's price (entry 54) | Your confirmation of the monthly average; Sharia advisor on basis and date |
| 26 Sharia rule table | Built, `proposed_unverified` | Your tick; Sharia advisor review; sources not archived |
| 31 Feature 24 value + null | Profile engine owner chose (b) | Your tick, then the fix and a test |
| 32 Where 24–26, 34, 35 live | Profile engine owner chose (b) | Your tick; team |
| 23.3 Zakat | Implemented as PROPOSED | Your + the Sharia advisor's line; team on Zakat for `insufficient_data` |

## 48 — nisab price and valuation date (line 3228, sign-off 3272)

**Question.** The nisab is 85 g × SAR 491.291 = SAR 41,759.74, a LivePriceOfGold quote of
2026-11-08 (`lenses/lens_config.yaml:55`, `sources/zakat_nisab_gold_price.md`). Every calculation
date in the data is 2026-01-27 to 2026-07-30, so the price is later than all of them. The
`--gold-quote` path refuses exactly that case (`pipeline/week8.py:241`).
**Options.** A keep one pinned reference price and say so in the output, and remove the date check or
apply it to the default too; B pin a price dated on or before the calculation dates, archived in
`sources/`; C keep the live GoldAPI path for a future deployment only, and decide whether the daily
workflow (`.github/workflows/update-gold-price.yml`) belongs in the repo.
**Tick:** "☐ compliance owner (choose; record the 2026-11-08 change)"; the Sharia advisor's box
covers basis and valuation date. **Risk:** an examiner asks which day's gold price a July Zakat used.

## 26 — Sharia screening rule table (line 1795, sign-off 1839)

**Question.** Confirm, change or reject `compliance/sharia_rules.yaml`. Research result: 85.1%
compliant, 14.9% soft flag, 0.0% hard flag (NUMBERS §5). No generated business is ever hard-flagged,
so that path is tested only on crafted inputs (`tests/test_sharia.py`).
**Options.** Accept as v1 pending the advisor; amend lists or thresholds (a new rule-table version,
which changes `sharia_rules_sha256` in every receipt); leave it labelled "pending Sharia-advisor
confirmation". **Also owed:** archive AAOIFI Shari'ah Standard No. 21 and ISO 18245 in `sources/`
(line 1835). **Risk:** any slide that says "Sharia-compliant" overstates the evidence.

## 31 and 32 — feature 24's seam (lines 2119 and 2154, sign-offs 2150 and 2188)

**Question.** 31: a refused business carries both a Sharia value and an `insufficient_data` null
(`pipeline/week8.py:173–185`). 32: should the engine or the pipeline compute 24? Faris chose 32(b),
the pipeline, and 31(b), not writing 24 for refused businesses. **What a tick changes:** it unblocks
his README change and a seam test; with 32(b) a rule-table change never changes `profiles.csv`.
**Ticks:** "☐ compliance owner" on 31 and on 32. **Risk:** the Week 8 output keeps a value that also
claims to be missing.

## Questions for the Sharia advisor (from the repo; no rule invented)

1. **Rule table** (`compliance/sharia_rules.yaml`, entry 26): every hard and soft MCC list; 5993
   tobacco and 7929 entertainment, where scholars differ; the 5% financial-institution inflow
   threshold; retail with no MCC → soft flag; existing financing as a disclosure, not a flag, because
   refinancing interest-based debt into a Murabaha is treated as legitimate.
2. **Zakat method** (`lenses/zakat/zakat.py`, entry 23.3): net working capital = cash + inventory +
   receivables − payables − short-term liabilities; 2.5% per 354-day lunar year; 85 g gold basis and
   its valuation date (entry 48); hawl = nisab at start and end, dips not tracked; Zakat skipped for
   `insufficient_data` businesses.
3. **Murabaha mechanics** (schema §17, entry 23.3): markup fixed at signing; risk tiers at fixed
   rates 5.0 / 6.5 / 8.0%; no rate shown on a decline (`base_markup_pct` null).
4. **Late payment:** `late_penalty_policy: "charity_directed"` (schema §17).
5. **Wording:** the fixed owner prompts and the financing disclosure in `sharia_rules.yaml` under
   `prompts:`; the label "rule-based screening, pending Sharia-advisor confirmation"; offers marked
   `conditional_on_sharia_review`.
