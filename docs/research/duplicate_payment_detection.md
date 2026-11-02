# Duplicate-payment detection: how others do it, and what applies to MA'AL

Prepared 2026-11-02 for the forecast + anomaly owner, alongside DECISIONS entry 37. Sources are web pages
and papers read on that date. None is archived in `sources/` yet, so per §21 none of the figures below may
be quoted in the report as a benchmark until it is archived and pinned.

## 1. The difference that matters most

Every duplicate-payment tool found in this research works on **invoices**: the invoice number, the vendor
master record, the invoice date and the amount. MA'AL's anomaly lens sees **bank transactions** only: an
amount, a date, a counterparty ID, a category. It has no invoice number and no vendor name. Most of the
techniques below lean on exactly the fields MA'AL lacks, which is why a pure amount-and-date rule is noisy
on our data (entry 36.8).

## 2. Approaches in use

**Exact and near-exact field matching (the audit standard).** Audit software runs a *same-same-same*
test, flagging records where every chosen field matches, and a *same-same-different* test, where all
fields match except one designated field, for example a payment sent to the wrong vendor and then to the
right one ([IDEA Scripting](https://www.ideascripting.com/Same-Same-Different-Test)). Practitioners run
the passes in order: exact, then relaxed (same vendor, amount inside a date window), then fuzzy on vendor
names, expecting the most noise on the loosest pass ([Stampli](https://www.stampli.com/resources/duplicate-anomaly-detection-analytics/)).
The Arizona Auditor General's guidance puts it simply: the more fields two payments share, the higher the
risk ([Arizona Auditor General](https://www.azauditor.gov/sites/default/files/2023-11/18-406.pdf)).

**Fuzzy matching on identifiers.** Commercial tools compare invoice numbers with edit-distance measures,
catching typos such as O/0 and I/l ([Xelix](https://xelix.com/ai-for-world-leading-duplicate-invoice-prevention-software)),
and resolve one supplier entered under several vendor records using name, address and tax-ID matching
with graph clustering ([Coupa](https://www.coupa.com/blog/technology-innovation-finding-duplicate-invoices-flight-ai/)).
Duplicate vendor records are a named cause of duplicate payments
([HighRadius](https://www.highradius.com/resources/Blog/duplicate-payments/)).

**Two stages: broad candidates, then a score.** The common architecture is a loose rule that generates
candidate pairs, followed by a model that scores or filters them. Celonis groups suspected duplicates
with a fuzzy matcher and then attaches a machine-learning confidence score to each group
([Celonis](https://documentation.celonis.com/en/before-getting-started-with-the-duplicate-invoice-checker.html)).
Xelix screens pairs with rules, then uses tree-boosting models to remove likely false positives and rate
the rest high, medium or low. Coupa narrows candidates with filters for recurring and instalment
invoices, which are the classic look-alikes.

**Probabilistic record linkage (Fellegi–Sunter).** Each field that agrees adds a weight of log(m/u),
where u is the chance the field agrees by coincidence. Agreement on a rare value therefore counts for
more than agreement on a common one, and pairs between two thresholds go to human review
([Wikipedia: Record linkage](https://en.wikipedia.org/wiki/Record_linkage)). This is the principled
version of the `rarity` variant in entry 37: a close amount match matters only if close matches are
unusual for that counterparty.

**Ranking instead of a yes/no threshold.** Practitioners prioritise by money at risk and keep alert
volume to what people can actually review, warning that too many alerts lead reviewers to dismiss
everything ([Stampli](https://www.stampli.com/resources/duplicate-anomaly-detection-analytics/)). In
anti-money-laundering, a model placed after the rules scores their alerts so that low scores can be
suppressed or the queue reordered; the authors report about 80% recall at a 20% false-positive rate
([AML Alert Optimization Using Machine Learning with Graphs, arXiv 2112.07508](https://arxiv.org/pdf/2112.07508)).

**Reviewer feedback.** Celonis, Xelix and Coupa all feed reviewers' "duplicate / not a duplicate"
decisions back into the scoring model. This is what lets a loose first-stage rule stay usable.

**Generic accounting anomaly detection.** Deep autoencoders on journal entries flag unusual entries by
reconstruction error and report fewer false alerts than baselines
([Schreyer et al., arXiv 1709.05254](https://arxiv.org/abs/1709.05254v2)). They are not duplicate
detectors; a duplicate looks entirely normal on its own, which is also why our Isolation Forest misses it.

## 3. Reality checks

- **Even professional exact-match audits mostly flag legitimate look-alikes.** Richmond's auditor flagged
  5,249 invoices with two exact-match tests, followed up 204, and confirmed 50 as duplicates
  ([City of Richmond OCA 2026-09](https://rva.gov/sites/default/files/2026-05/OCA%202026-09%20Continuous%20Monitoring%20-%20Duplicate%20Payments%205.11.26.pdf)).
- **Identical same-day charges can be genuine.** A user renewing several domain names was charged the
  same amount by the same registrar several times in one day, and a bank feed marked them as duplicates
  ([QuickFile community](https://community.quickfile.co.uk/t/yodlee-marking-genuine-transactions-as-duplicates/16576)).
  So even the `exact` variant will produce some false flags in real data.

## 4. What this means for MA'AL

1. **The largest gain would come from a data field, not a cleverer rule.** Open-banking transaction data
   can carry a transaction reference, a free-text narrative and the creditor account
   ([UK Open Banking v3.1 Transactions](https://openbankinguk.github.io/read-write-api-site2/standards/v3.1.3/resources-and-data-models/aisp/Transactions)).
   An invoice reference in the narrative would let the lens run the audit-standard tests. Whether the
   Saudi open-banking data MA'AL targets carries such a field was not confirmed in this research; it is
   worth checking before designing further.
2. **`rarity` is a first step towards Fellegi–Sunter weighting.** A fuller version would add weights for
   several agreeing fields (amount, gap, hour, counterparty) instead of one yes/no cut-off.
3. **Two stages fit the 10-flag cap.** A loose rule can generate candidates as long as something scores
   them before they claim a slot. That is what `forest_feature` approximates, and what a value-at-risk
   ordering would make explicit.
4. **Duplicate vendor records need entity resolution on names.** The generator's counterparty IDs carry no
   names, so `vendor_record_duplicate` cannot be caught on this data by any variant. That is a limitation
   of the synthetic data to state in the report, not a detector bug.
5. **A feedback loop needs labels**, which synthetic data cannot supply honestly. It belongs in future
   work, after real reviewed cases exist.
