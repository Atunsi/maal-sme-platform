# Berka adapter — BUILT (Phases 0–2 accepted, Phase 4 run)

**Owner:** generator owner · **Governed by:** `SOP_Data_Grounding_And_Dimensions.md` v2.0 §4–§6, Appendix B ·
**Source:** PKDD'99 Czech financial dataset, archived at [`../sources/berka/`](../sources/berka/SOURCE.md)

Turns the raw Berka CSVs (`data/berka_raw/`, git-ignored) into the repo's
existing table contract (`data/berka/`, git-ignored), validated against the
**same Pandera schemas the generator uses** (`generator/schemas.py`). The
profile engine runs on the output unmodified — it has no Berka-specific code.

| File | Role |
|---|---|
| `probe.py` | Phase 0 viability probes. Reads and prints, writes nothing. Results: [`DECISIONS.md` entry 7](../DECISIONS.md) — all four PASS. |
| `column_map.yaml` | The upload's columns, dates and value domains. `io.py` fails loudly with the real header on any mismatch; nothing is silently coerced. |
| `io.py` | Verified loader shared by probe and build. |
| `build.py` | Phase 1 adapter → `data/berka/`. |
| `coverage.py` | Phase 2 coverage bands as a code constant (`COMPUTABLE` / `PARTIAL` / `NOT_COMPUTABLE`), derived from the probe results. |

## What `build.py` does, in order

1. **Sign at the boundary.** `PRIJEM` → inflow, `VYDAJ`/`VYBER` → outflow. The raw unsigned amount never passes the adapter.
2. **Completeness gate (§5.5) on the full history.** Per-day chain `close[d] = close[d−1] + Σ signed amounts`, order-independent within the day. Tolerance 0.21 CZK because month-end interest postings carry a 0.1–0.2 CZK rounding. Result: **4,500 / 4,500 accounts pass**; 94.3% of account-days chain to the cent.
3. **Entity resolution.** `business_id = account_id` (Probe 4: every client holds exactly one account). `own_transfer_flag` is emitted on every row and is always False.
4. **Point-in-time windows (§7.2).** A labelled account's 180-day window ends the day **before** `loan.date`; the emitted tables physically contain nothing at or after the loan, and it is asserted. Unlabelled accounts are observed at their last transaction.
5. **Mapping (Appendix B).** `k_symbol`/`operation` → `category`, `subfamily`, `counterparty_type`; `bank:account` → `counterparty_id` (null where the source has no partner — cash, bank-originated rows). Declared standing orders (`order` table key match) feed `recurring_outflow_total`.
6. **Emit** `transactions`, `daily_aggregates`, `balances_daily` (bank's verified day closes, forward-filled), `obligations` (the real `order` table; frequency **measured** from executions before the observation date), `businesses` (sector/size/age = `not_available_in_source`, MCC null), `labels` (two label sets, censoring named), `accounts` (metadata; district is geography, never a sector proxy).

## Honesty list (say these before you are asked)

- Czech retail and small-account data, 1993–1998. The claim is that the feature engineering transfers, not that the populations match.
- The schema's §15 rule (`coverage_days_90d ≥ 60`) excludes **100%** of Berka accounts; the median account has 13 active days per 90. Every Berka number is computed under `external_real: 10` ([entry 9](../DECISIONS.md)).
- 682 loans; 31 confirmed defaults (A vs B); `C` is censored. Both label sets are reported, always with a bootstrap interval.
- No time-of-day (`hour` = 12), no value date, no balance sheet, no sector, no MCC, no mandate history, no credit facilities. Each is a `not_available_in_source` null, never a fabricated value.
- One account per business is assumed on both sources; our data contains no own-account transfer by construction.

## Commands (from the repo root)

```bash
python -m berka_adapter.probe            # Phase 0 gate — writes nothing
python -m berka_adapter.build [--quick]  # Phase 1 → data/berka/
python -m profile_engine.compute --dir data/berka
python -m eval.berka_coverage            # Phase 2 report → eval/out/berka_coverage.md
python -m eval.compare_real              # Phase 4 → eval/out/real_vs_synthetic.md
```
