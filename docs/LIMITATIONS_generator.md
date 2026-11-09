# Limitations — synthetic data, its validation, and the lenses built on it (for the final report)

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
a real system would read them from the business's accounts. The nisab is valued
at one commercial gold quotation (SAR 491.291 per gram on 8 November 2026, giving
SAR 41,759.74), which is not independently verified and is dated after every
calculation date in the synthetic data (entry 48). The gold basis and the hawl
rule have not been reviewed by a Sharia advisor.

**11. The default rate is an outcome, not a target.** 4.78% of research
businesses default (478 of 10,000). That rate comes out of the label model and
is not fitted to a published Saudi SME non-performing-loan series, because no
archived series exists.

## Lenses and governance (added 2026-11-09, refinement pass)

These go beyond the generator. They are here because the report needs them in one
place; each belongs to the owner named in the DECISIONS entry beside it. Numbers
are from `NUMBERS.md` §3, §5, §5b, §5c and §5d.

**12. The within-sector fairness audit did not pass.** In construction (research,
N = 3,486), only 1 of the 10 most influential features (2 under the wider
working-capital reading of entry 1b) is a liquidity or working-capital feature. The
most influential, inflow regularity, shifts nearly every construction business by
the same amount, which is a sector-level effect and not an assessment of
individual risk. Inflow regularity also enters through its sector-relative
z-score, and together the two let the model set a separate baseline per sector. We
therefore make no claim that the model rewards disciplined operators within
volatile sectors (entry 43).

**13. The customer explanation's first sentence is about the sector, not the
business.** For 834 of 943 serving businesses the first reason shown is inflow
regularity. It counts against every food and beverage and retail business where
it is first (138 and 373) and in favour of every construction and professional
services business where it is first (298 and 25). A retail owner with perfectly
regular daily takings is told that this consistency raises their risk. The text
is a fixed template, not generated, but it is misleading as it stands
(entry 47, open).

**14. The risk model decides few outcomes, and its score does not follow stress.**
Of 943 serving businesses, 281 are declined: 243 by the affordability gate and 38
by the risk model. In the demo scenarios the severe collapse has the lowest PD
(0.0390) and the calm half-year (0.0663) scores above the baseline (0.0526), one
business per scenario (entry 46). Out of sample the model's AUC is 0.628
[0.536, 0.710] on 943 serving businesses with 45 defaults, a wide interval.

**15. The forecast is a 90-day moving average.** It beats the 30-day baseline on
median error (0.323 against 0.376, research, N = 9,495) but warns later: on a 30%
shock the median lead time is 15 days against the baseline's 27, and it detects
88.9% of crunches against 96.3% (27 crunches), with about half the false alarms
(3.8% against 8.3%, N = 636). A shock in the final three weeks is not seen at all
(entry 29). Prophet and ARIMA, named in the project's working rules, were never
evaluated (entry 49).

**16. Anomaly flags are a review queue, not alarms.** 584 of 943 serving
businesses return the cap of 10 flags and none returns fewer than 4. Recall on the
held-out round-trip type is 0.93 (50 serving businesses). Same-day exact
duplicates are caught at 0.66, a type the check was designed for. A payment
re-sent a day or two later is not caught (0.00), and a duplicate paid under a
second supplier record almost never (0.04). The absence of false repeat flags is
a property of the synthetic data (entry 37.5).

**17. Sharia screening is a proposed rule table.** No Sharia advisor has reviewed
it, and the compliance owner's line is unsigned (entry 26). Across 10,000 research
businesses it returns 85.1% compliant, 14.9% review and 0.0% hard flags, so the
hard-flag path is exercised by unit tests only, never by a generated business.

**18. A decision receipt verifies only on the operating system that made it.**
Four receipt hashes depend on line endings, so a Windows receipt fails
verification on Linux or Mac although the decision is identical (entry 40, open).

**19. Some numbers predate this month's engine changes.** The §14 sensitivity
sweeps (NUMBERS §4, §4b, row A6) and the latency table (§6b) were measured before
entries 30, 35 and 38 and have not been re-run. The one comparison re-run after
the changes moved by 0.004.

**20. Several decisions are unsigned.** As of 2026-11-09 no sign-off line has
been ticked by the forecast and anomaly owner, the compliance owner or a Sharia
advisor, and the API has no named owner. Their parameters are therefore still
proposals (entries 23, 25, 26, 27, 36, 37, 48).
