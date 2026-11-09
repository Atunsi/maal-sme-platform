# Limitations — synthetic data and its validation (generator owner, for the final report)

Draft for the report's limitations section. Every number is quoted from
[`NUMBERS.md`](NUMBERS.md) or the artifact named beside it; if a number here
disagrees with the register, the register wins. Populations: research = IDs
1–10,000, serving = 10,001–11,000.

**1. All results on Saudi SMEs are synthetic.** No Saudi open-banking
transaction data was available. The generator is calibrated to published
figures (SAMA POS bulletins, the Monsha'at register, GASTAT), and the engine's
signal is checked on one real dataset, Berka (Czech retail accounts,
1993–1998). Synthetic results are never presented as validated on real
transactions.

**2. Calibration is to published figures, not to today's economy.** The sector
mix and size tiers come from the Monsha'at register at 2021 Q4, the latest
quarter the gateway serves (DECISIONS 14). SAMA ticket sizes are pinned to the
12-Sep-2026 bulletin (retail 61.5 SAR, restaurants 29.0 SAR); across four
editions they vary by about 20% (entry 20.1).

**3. Four sectors only.** Retail trade, construction, food and beverage and
professional services. Logistics is a deliberate cut: the schema defines no
balance-sheet archetype for it, and an invented one would be unsourced
(DECISIONS 2, decided 2026-10-31).

**4. Professional services is too small to report on.** Its register weight
(2.9%) gives 237 research businesses and 3 defaults, below the §23 minimum cell
of 30 businesses and 10 defaults. The Week 3 gate skips the sector differential
for it loudly rather than passing it (`eval/out/gate_week3_after_monshaat.txt`).

**5. Seasonality is measured only where card data measures it.** Ramadan and
Eid effects for retail and food and beverage come from SAMA POS data; 7 of those
16 measured parameters are B-weak (their 95% interval contains 1.0, entry 17).
Construction and professional services use author judgement (class C): POS data
records consumer card spending, not contractor or firm receipts. On held-out
years 2024–2025: 12 PASS, 8 BOUNDED, 0 FAIL, 16 NOT_APPLIED.

**6. Real data carries more signal than the synthetic data.** Under one
protocol and one 25-feature set, the engine reaches AUC 0.721 [0.681, 0.770]
on Berka's primary label against 0.570 [0.563, 0.580] on synthetic labels. The
pre-registered §21 tolerance was 0.10. The gap is 0.152, so the miss is
reported as a finding, and the generator was not tuned to close it (entry 19).

**7. The synthetic labels have a ceiling by design.** Default labels are drawn
from hidden variables plus noise that nothing observable can see, so no model
can exceed an AUC of 0.666 on scorable research businesses. The credit lens's
0.591 is 88.8% of that ceiling. An AUC of 0.85 is impossible on this data, and
reaching it would indicate leakage (entries 21, 22). This makes the synthetic
problem harder than the real one, which contributes to the gap in item 6.

**8. Six §21 input-consistency targets miss their bands.** For example, the
medium tier's revenue share is 19.7% against GASTAT's 34.3%, and the sector
total-variation distance is 0.384. These misses are reported, not retuned
(`eval/out/emergent_validation.md`, entry 12). There are no emergent-target
misses.

**9. Obligations are not reconciled with transactions.** A synthetic standing
order or direct debit does not add a matching row to `transactions.csv`, because
that would move the gate numbers. So committed outflow can exceed observed
outflow for some businesses (entry 11).

**10. Zakat inputs are generated separately.** Cash flow alone cannot support
Zakat. Monthly balance sheets are generated alongside the transactions, whereas
a real system would read them from the business's accounts. The nisab gold price
is a placeholder (`lens_config.yaml`), not a sourced price.

**11. The default rate is an outcome, not a target.** 4.78% of research
businesses default (478 of 10,000). That rate comes out of the label model and
is not fitted to a published Saudi SME non-performing-loan series, because no
archived series exists.
