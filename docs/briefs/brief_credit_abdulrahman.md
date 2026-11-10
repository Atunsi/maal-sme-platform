# Decision brief — credit lens (Abdulrahman Alharbi)

> **Status 2026-11-10:** most lines in this brief were ticked on the owners' behalf on verbal agreement (DECISIONS entry 53), and entries 40, 47, 48 and 49 were decided; entry 40 is implemented (`00ae025`). Read entry 53 for what is still open. The brief below is kept as written.
> DECISIONS.md line numbers below are as of commit `5ca3ba3` (read them with `git show 5ca3ba3:DECISIONS.md`); entries after 40 have moved since.

Prepared 2026-11-10 from `DECISIONS.md` on `main`. Nothing here is decided for you. Line numbers
refer to `DECISIONS.md` unless a file is named. Numbers come from `docs/NUMBERS.md`.

| Entry | What is decided | What is blocking |
|---|---|---|
| 47 Customer explanation | Finding recorded; no option chosen | Your choice of A–D; then the team on demo wording |
| 46 Findings 1–2 | Re-run recorded; findings restated | Your tick on the restated wording |
| 49 XGBoost in SOP/schema | Nothing | Your line, the forecast owner's and the team's |
| 43 §25 fairness | Finding recorded; you signed | Team tick on the finding and the limitations wording |
| 29 Findings 1–2 | Menu signed by the generator owner | Your tick; one sentence is superseded by 46 |
| 35 Rebuild, then retrain | Rebuild done; retrain done (`79160cb`) | Your "retrain after the rebuild" tick; team |

## 47 — what the customer is told (line 3175, sign-off 3224)

**Question.** The first public reason is inflow regularity (feature 3) for 834 of 943 serving
businesses, and its direction is fixed by sector: against all 138 F&B and 373 retail cases, in favour
of all 298 construction and 25 professional services cases (NUMBERS §5d,
`eval/out/demo_exposure.md`). Demo business 10001 is told its consistency raises its risk.

**Evidence.** Text built at `lenses/credit/model.py:165–172` from `FEATURE_LABELS` (line 53) and
`PHRASES` (line 43). Mechanism: entry 43 (features 3 and 55 together act as a per-sector constant).

**Options and what each changes.**
- **A** Keep model and text, say it first in the demo. Changes nothing; the sentence still misleads.
- **B** Change only the public tier (a rule, written before you look at which sentences it removes).
  Model, PD and compliance tier unchanged; receipts change through `model.py`.
- **C** Change the feature set. New model: A1, A5, §5b, §5d and every receipt move; entry 43 requires
  the selection rule committed before evaluation.
- **D** Hold the public tier back from the demo until A–C is settled.

**Tick:** "☐ credit lens owner (choose A–D; withdraw the 'cannot shortcut' sentence)". That sentence
is entry 23.3 and `lenses/lens_config.yaml:37–38`; editing the YAML changes `lens_config_sha256`.

**Risk if open.** The first sentence a judge reads on business 10001 contradicts itself.

## 46 — entry 29's findings 1–2 restated (line 3127, sign-off 3171)

**Question.** Do you accept the restatement? With the retrained model the combined crisis scores
0.0656 against a baseline of 0.0526, so "the collapses' PDs are no higher than the baseline's" is
false; the severe collapse is still lowest (0.0390). Proposed wording: "the risk score does not track
how bad the scenario is." **Evidence:** `eval/out/scenario_library_check.txt`, NUMBERS §5b.
**Options:** tick as written; tick with your own wording; leave open. **Tick:** "☐ credit lens owner
(findings 1–2 as restated)". **Risk:** the demo repeats a sentence the shipped model contradicts.

## 49 — the SOP says XGBoost (line 3276, sign-off 3308)

**Question.** SOP §3 and §5 and schema §13 name XGBoost; the shipped model is L2 logistic, which won
when measured (0.5936 vs 0.5838 early-stopped, 0.5547 untuned; NUMBERS §4, re-run 2026-11-10).
**Options:** A amend SOP/schema wording to what shipped; B evaluate again under a new protocol;
C state it in the limitations only. A changes documents only. **Tick:** "☐ credit lens owner".
**Risk:** a reader comparing the proposal with the code finds a different model.

## 43 — §25 construction finding (line 3034, sign-off 3122)

Your line is ticked. Open: "☐ team (the finding and the limitations wording)". The wording is at lines
3111–3117 and already in `docs/LIMITATIONS_generator.md` item 12. **Risk:** without the team tick the
report may still describe the model as fair within sectors.

## 29 — findings 1–2 (line 1931, sign-off 1973–1974)

**Question.** Tick "☐ credit lens owner (findings 1–2)". Finding 1's sentence "Their PDs (0.0483,
0.0561) are no higher than the baseline's (0.0557)" (line 1958–1959) is true for the old model only.
**Options:** tick 29 noting "as restated in 46"; leave 29 and tick 46 only. Signed entries are never
edited, so 29's text stays either way.

## 35 — retrain after the rebuild (line 2299, sign-off 2440)

**Question.** The rebuild (v2 stats) and your retrain both happened: CV AUC 0.5911 [0.5842, 0.5996],
serving 0.628 [0.536, 0.710], artifact `7ed936b6…9274` (entry 38, lines 2926–2931). The tick records
that. **Tick:** "☐ credit lens owner (retrain after the rebuild)". **Risk:** low; the log shows a
step as pending that is done.
