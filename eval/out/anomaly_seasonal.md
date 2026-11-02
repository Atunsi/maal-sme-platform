# Anomaly lens — §16 false positives with and without the seasonal gate (DECISIONS entry 36.3)

Population: **serving**, the entry-36.1 sample (demo and `<1yr` excluded), N = 751, control series
(no shock, no injected or held-out rows: every flag is a false positive). Data source: synthetic.
Season = the pinned Ramadan-to-Eid windows feature 36 uses. The neutral window contains none.

| placement | gate | flags returned | flags in season | scanned in season | seasonal flag excess | rule hits per 1,000, in season | rule hits per 1,000, out of season |
|---|---|---|---|---|---|---|---|
| neutral | off | 6,603 | 0.0% | 0.0% | — | — | 3.48 |
| neutral | on | 6,603 | 0.0% | 0.0% | — | — | 3.48 |
| ramadan | off | 6,567 | 24.1% | 17.6% | 1.37 | 7.42 | 2.99 |
| ramadan | on | 6,656 | 17.9% | 17.6% | 1.02 | 4.47 | 3.62 |

Seasonal flag excess = (share of flags in season) ÷ (share of scanned transactions in season); 1.00 = no seasonal bias.

## Decision input — injected-type recall (demo business, full data)

| gate | injected anomalies among the flags |
|---|---|
| off | 2 of 2 |
| on | 2 of 2 |

Rule (entry 36.3): the gate ships on if the seasonal flag excess falls with the gate and injected recall does not fall.
Held-out recall is not part of the decision; it is re-run afterwards with `python -m eval.anomaly_eval`.
