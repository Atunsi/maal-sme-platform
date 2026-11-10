# Decision brief — profile engine (Faris Alsharifi)

Prepared 2026-11-10 from `DECISIONS.md` on `main`. Nothing here is decided for you. Line numbers refer to `DECISIONS.md` unless a file is named.

| Entry | What is decided | What is blocking |
|---|---|---|
| 40 Receipt hashes and line endings | Finding reproduced in tests; no fix chosen | Your line, the generator owner's, the team's |
| 50 Class-A1 features dead on Berka | Headline narrowed; registry rule open | Your registry rule; team on wording |
| Entry 43 used twice | Resolved: web UI 43 → 51 at merge | Nothing |

## 40 — receipt hashes depend on line endings (line 2991, sign-off 3031)

**Evidence.** `tests/test_receipt_line_endings.py`: four strict-xfail tests show that
`lens_config_sha256` (`pipeline/week8.py:55`), `sharia_rules_sha256` (`compliance/sharia.py:39`),
`scenario_library_sha256` (`scenarios/run.py:53`) and `data_sha256` (`pipeline/week8.py:65`, via
`to_csv` and `os.linesep`) differ between an LF and a CRLF checkout. On this Windows checkout the lens
config hashes to `b8d62751…`, the value in today's demo receipts; a Linux checkout gets `eb715f89…`.
The reference-stats hash is already canonical (control test passes).

**Smallest fix**, tested in a throwaway worktree only: all four tests XPASS, 53 other unit tests pass.

```diff
--- a/pipeline/week8.py
 def _sha(path: str | Path) -> str:
-    return hashlib.sha256(Path(path).read_bytes()).hexdigest()
+    """Canonical LF before hashing (DECISIONS entry 40), as reference_stats_sha256 already does."""
+    return hashlib.sha256(Path(path).read_bytes().replace(b"\r\n", b"\n")).hexdigest()
-        h.update(t[t["business_id"] == b_id].to_csv(index=False, date_format="%Y-%m-%d").encode())
+        h.update(t[t["business_id"] == b_id].to_csv(index=False, date_format="%Y-%m-%d", lineterminator="\n").encode())
--- a/compliance/sharia.py
-    return yaml.safe_load(raw), hashlib.sha256(raw).hexdigest()
+    return yaml.safe_load(raw), hashlib.sha256(raw.replace(b"\r\n", b"\n")).hexdigest()
--- a/scenarios/run.py
-    return lib, hashlib.sha256(raw).hexdigest()
+    return lib, hashlib.sha256(raw.replace(b"\r\n", b"\n")).hexdigest()
```

**Options and their effect on existing receipts.**
- **A. Canonical hashing in code (the diff above).** Every OS agrees from then on. On Windows, existing
  receipts' `lens_config_sha256`, `config_sha256` (`config.yaml` is stored CRLF in git, so its
  canonical hash changes on every machine) and `data_sha256` change once and stop verifying. Sharia
  rules and scenario library hashes keep their value here (checked out LF) but change on a CRLF checkout.
- **B. `.gitattributes` `* text=auto eol=lf` only** (entry 40 item 1). Files hash alike, but
  `data_sha256` still depends on `os.linesep`, so Windows and Linux receipts still disagree.
  `config.yaml` is renormalised once.
- **C. A and B together** (entry 40's full proposal). Same receipt break as A, plus one renormalising commit.
- **D. No fix; say receipts verify on the OS that made them** (NUMBERS §1 already says so).

**Tick:** "☐ profile engine owner". **Risk:** a reviewer re-running `pipeline.verify` on a Mac sees
every Windows receipt fail.

## 50 — five A1 features carry nothing on Berka (line 3312, sign-off 3339)

**Evidence.** `eval/out/feature_transfer.md`: features 5, 41, 45, 46 constant on both label sets,
26 has no rows; A2 holds on the primary label for 14 of 43, on the censored secondary for 19, both 11.
NUMBERS §1 already says 14. **Options:** A keep classes, keep the narrower wording; B constant or empty
on the real source ⇒ not A1 (counts in NUMBERS §6 change by rule); C require the primary label for A2.
**Tick:** "☐ profile engine owner (registry rule)". **Risk:** "43 features computed on real data" is
repeated with five that compute nothing.

## Entry-number collision — resolved on `main` (2026-11-10)

When `faris/web-ui` was merged, its entry 43 (web UI enhancements) became **51**, as this brief had
suggested; `main`'s 43 stays the §25 fairness finding (`DECISIONS.md`, entry 51's first line). All 31
files under `web/` that cited it now say 51, and none cites 43. Entries 41, 42, 44 and 45 kept their
numbers. Nothing is left to decide; the next free number is 53 (52 is the §14 re-run).
