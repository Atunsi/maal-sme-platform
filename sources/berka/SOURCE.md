# Berka — PKDD'99 Discovery Challenge financial dataset (archived copy)

Archived on download per Schema §21 source discipline, not on demand.

| Field | Value |
|---|---|
| Archive file | `the-berka-dataset.zip` (18,204,614 bytes) |
| SHA-256 | `dfd5e9490eb5a668e4465af8af3fcb8b607e9e4df75727d551f3e177ccfdd5af` |
| Accessed | 2026-09-15 |
| Mirror pulled | Kaggle, `marceloventura/the-berka-dataset` (public download endpoint, `https://www.kaggle.com/api/v1/datasets/download/marceloventura/the-berka-dataset`) |
| Mirror file dates | 2023-05-15 (inside the zip) |
| Original publication | Berka, P. (1999). *PKDD'99 Discovery Challenge — Guide to the Financial Data Set.* 3rd European Conference on Principles and Practice of Knowledge Discovery in Databases, Prague. Original host `sorry.vse.cz/~berka/challenge/` — **did not resolve on 2026-09-15**, which is exactly why the copy is archived here. |

## Contents (as extracted to `data/berka_raw/`, git-ignored)

Semicolon-delimited, double-quoted strings, `YYMMDD` integer dates, amounts in CZK.

| File | Rows (excl. header) | Published figure | Match |
|---|---|---|---|
| `account.csv` | 4,500 | 4,500 | yes |
| `client.csv` | 5,369 | 5,369 | yes |
| `disp.csv` | 5,369 | 5,369 | yes |
| `trans.csv` | 1,056,320 | 1,056,320 | yes |
| `order.csv` | 6,471 | 6,471 | yes |
| `loan.csv` | 682 | 682 | yes |
| `card.csv` | 892 | 892 | yes |
| `district.csv` | 77 | 77 | yes |

Row counts are re-checked by `python -m berka_adapter.probe` (Probe 3).

## Population caveat (state it, never omit it)

This is **Czech retail and small-account banking data from 1993–1998**. It is
not Saudi SME data. Any result on it supports the claim that the feature
engineering transfers to real bank records, not that the populations are
equivalent.
