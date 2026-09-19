# §15 exclusion selectivity on Berka (SOP_Monshaat_Unblock B4)

Labelled accounts 682; excluded as `insufficient_data` under `coverage_days_90d ≥ 10`: 67 (coverage among excluded: median 9, max 9 active days per 90).

| label set | excluded n / defaults / rate | retained n / defaults / rate | risk ratio (excluded ÷ retained) | Fisher exact p (two-sided) | share of all defaults excluded |
|---|---|---|---|---|---|
| primary (A vs B, finished contracts) | 25 / 9 / 0.360 | 209 / 22 / 0.105 | **3.42** | 0.0018 | 29.0% |
| secondary (A+C vs B+D, censored) | 67 / 17 / 0.254 | 615 / 59 / 0.096 | **2.64** | 0.0007 | 22.4% |

**Verdict: the exclusion is SELECTIVE.** Accounts with fewer than 10 active days in the 90 days before the loan default at 3.4× the rate of retained accounts. Every Berka AUC in `eval/out/real_vs_synthetic.md` is therefore computed on a population from which the thinnest — and riskiest — accounts were removed by the eligibility rule, not by the model. A model that had to score them would face a harder problem than the reported AUC describes; the reported number is an estimate on the *eligible* population only, and is labelled as such. The synthetic side applies the same kind of rule (`coverage_days_90d ≥ 60`) to its own thin-file businesses, whose default rate is also reported by `validate_emergent`.

Nothing is changed by this finding: the threshold (entry 9) stands, the AUCs stand, and both now carry the selection caveat.
