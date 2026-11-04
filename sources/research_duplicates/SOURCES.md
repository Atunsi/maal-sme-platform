# Duplicate-payment research sources (docs/research/duplicate_payment_detection.md)

Access date for every entry: 2026-11-02. Read through a web tool from a network-restricted workspace, so the
original files could **not** be downloaded and hashed here. Under §21, a source may be quoted in the report
only once its file sits in this folder with a `.sha256` and a `.meta.json`, like `sources/monshaat/`.

## Status

| # | Source | What the report would quote | File to save here | Archived |
|---|---|---|---|---|
| 1 | City of Richmond, Office of the City Auditor, *OCA 2026-09 Continuous Monitoring – Duplicate Payments* (5 Nov 2026 edition in the file name) — https://rva.gov/sites/default/files/2026-05/OCA%202026-09%20Continuous%20Monitoring%20-%20Duplicate%20Payments%205.11.26.pdf | 5,249 invoices flagged, 204 followed up, 50 confirmed duplicates | `richmond_oca_2026-09_duplicate_payments.pdf` | **no** |
| 2 | *Anti-Money Laundering Alert Optimization Using Machine Learning with Graphs*, arXiv:2112.07508 — https://arxiv.org/pdf/2112.07508 | about 80% recall at a 20% false-positive rate for an alert-triage model | `arxiv_2112.07508.pdf` | **no** |
| 3 | Schreyer et al., *Detection of Anomalies in Large Scale Accounting Data using Deep Autoencoder Networks*, arXiv:1709.05254v2 — https://arxiv.org/abs/1709.05254v2 | fewer false alerts than baselines (qualitative) | `arxiv_1709.05254v2.pdf` | **no** |
| 4 | QuickFile community, "Yodlee marking genuine transactions as duplicates" — https://community.quickfile.co.uk/t/yodlee-marking-genuine-transactions-as-duplicates/16576 | genuine identical same-day charges marked as duplicates (example only) | `quickfile_yodlee_duplicates.pdf` (print to PDF) | **no** |

Sources used only for description, not for any figure (no archive needed unless quoted): IDEA Scripting
(same-same-different test), Stampli, Celonis, Xelix, Coupa, HighRadius, Wikipedia "Record linkage", the
Arizona Auditor General guidance, and the UK Open Banking v3.1 Transactions specification. Their links
are in the research note.

## How to archive one (from the repo root)

```bash
cd sources/research_duplicates
sha256sum <file> > <file>.sha256
```

Then add `<file>.meta.json` with `file`, `sha256`, `bytes`, `access_date`, `origin_body`, `publication`,
`retrieval_url` and `edition`, as in `sources/monshaat/enterprises_2021Q4.json.meta.json`, and change
the row above to **yes**.
