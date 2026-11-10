# Decision brief — generator (Ahmed Altunusi)

> **Status 2026-11-10:** most lines in this brief were ticked on the owners' behalf on verbal agreement (DECISIONS entry 53), and entries 40, 47, 48 and 49 were decided; entry 40 is implemented (`00ae025`). Read entry 53 for what is still open. The brief below is kept as written.
> DECISIONS.md line numbers below are as of commit `5ca3ba3` (read them with `git show 5ca3ba3:DECISIONS.md`); entries after 40 have moved since.

Prepared 2026-11-10 from `DECISIONS.md` on `main`. Nothing here is decided for you. Line numbers
refer to `DECISIONS.md` unless a file is named.

| Entry / item | What is decided | What is blocking |
|---|---|---|
| 46 Scenario re-run | Measurement recorded | Your line; credit owner; team |
| 30 Thinning fix | Your decision recorded; fix merged; profile engine owner ticked | Your line; team |
| 33 Schema text 60–69 | Rows drafted; profile engine owner ticked with two wording fixes | Your line; team |
| 39 Two `insufficient_data` counts | NUMBERS now labels both windows; A9 corrected | Your line; whether the gate's window changes |
| 40 Receipt hashes | Reproduced in tests; patch tested, not applied | Your line, the profile engine owner's, the team's |
| 36.1 Crunch lever in the harness | Used as written | Your line on 36.1–36.5 |
| Handover walkthroughs | Kits written (`docs/briefs/handover_*.md`) | Three 30-minute sessions to schedule |
| Limitations into the report | Draft has 20 items | Where it lives in the report |

## 46 — scenario library re-run (line 3127, sign-off 3171)

You ran the library; only PDs moved (NUMBERS §5b). **Tick:** "☐ generator owner (scenario library
re-run)". **Risk:** low; the credit owner's and team's boxes matter more.

## 30 — counterparty totals before thinning (line 1978, sign-off 2115)

Your decision is recorded at lines 2054–2066; the fix is on `main`; Faris reproduced it (2098–2113).
**Tick:** "☐ generator owner". **Risk:** the log shows your own decision as unsigned.

## 33 — schema text for 60–69 and 62b (line 2192, sign-off 2245)

**Question.** Do the proposed rows describe what the generator's `obligations` and `facilities`
tables feed? Faris asked for two wording fixes (lines 2235–2240): 69 also lists `not_applicable`
when there is no facilities row, and the header says every feature is null `insufficient_data` for a
refused business. **Options:** tick as is; tick with the two fixes; annotate. **Tick:** "☐ generator
owner (60–69 are produced from the generator's tables)". **Risk:** the schema keeps saying 59
features while the engine computes 71 (entry 49 cites this too).

## 39 — two counts of `insufficient_data` (line 2940, sign-off 2987)

**Evidence.** The gate's window ends at the last month-end (`eval/gate_week3.py:74–110`, threshold at
line 49); the engine's at `window_end`. Gate: 1,086 refused; engine: 562. NUMBERS §2 (A9, N 9,016) and
§6 now say which window each number uses. **Options:** A keep both and the labels; B change the gate to
the engine's window (the Week 3 gate re-runs and its criterion-1 numbers move; decide before seeing
them). **Tick:** "☐ generator owner". **Risk:** "scorable" means two sets in one report.

## 40 — receipt hashes and line endings (line 2991, sign-off 3031)

Options A–D, the tested patch and the effect on existing receipts are in
`docs/briefs/brief_profile_engine_faris.md`. Your concern: option B or C renormalises `config.yaml`
(stored CRLF in git), which changes `config_sha256` in every receipt and the calibration receipts.

## 36.1 — the crunch lever (line 2454, sign-off 2568–2569)

"☐ generator owner (36.1 uses the crunch lever and the window-start override from the harness; no
generator change)". Checking it: `eval/holdout_shock.py` overrides only those two demo levers.

## Handover walkthroughs (`docs/HANDOVER_lenses.md`)

Three kits: `handover_abdulrahman.md`, `handover_abdulelah.md`, `handover_mohammed.md`. Each is a
30-minute agenda run on the owner's machine with `--quick` data. The kits send every evaluation to a
scratch folder, because the scripts' defaults overwrite `eval/out/` and `lenses/credit/model_v1.json`.

## Moving `docs/LIMITATIONS_generator.md` into the report

Items 1–11 are the generator's; 12–20 (added 2026-11-09) belong to the lens and compliance owners.
**Options:** A paste it whole and keep the file as the source; B split items 12–20 to their owners for
wording; C cite the file and quote only the numbered headings. Item 19 was updated on
2026-11-10 from the §14 re-run (entry 52). **Risk:** the report's
limitations drift from the register once numbers move again.
