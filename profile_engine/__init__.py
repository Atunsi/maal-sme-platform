"""Profile engine — features 1–65 computed from the shared table contract (Schema v2.9 §1–§6, §15, §16, §30–§35).

Source-agnostic by construction: the engine reads only the tables in
generator/schemas.py and a per-business as-of date (`businesses.window_end`).
It does not know whether a row came from the generator or from Berka; it only
sees `data_source` where the schema itself makes behaviour source-conditional
(the operating-day calendar behind feature 33).
"""
