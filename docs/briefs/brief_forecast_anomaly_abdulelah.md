# Decision brief — forecast and anomaly (Abdulelah Alsalamah)

> **Status 2026-11-10:** most lines in this brief were ticked on the owners' behalf on verbal agreement (DECISIONS entry 53), and entries 40, 47, 48 and 49 were decided; entry 40 is implemented (`00ae025`). Read entry 53 for what is still open. The brief below is kept as written.
> DECISIONS.md line numbers below are as of commit `5ca3ba3` (read them with `git show 5ca3ba3:DECISIONS.md`); entries after 40 have moved since.

Prepared 2026-11-10 from `DECISIONS.md` on `main`. Nothing here is decided for you. Line numbers
refer to `DECISIONS.md` unless a file is named. None of your sign-off lines is ticked yet.

| Entry | What is decided | What is blocking |
|---|---|---|
| 23.3 Anomaly + forecast v1 | Built and running as PROPOSED | Your line |
| 27 `naive90` | Chosen on validation, tested once | Your line |
| 29 Findings 3–4 | Reported on business 10001 | Your line |
| 36.1–36.5 Pre-registration | Written before any result | Your line; generator owner; team |
| 36.6–36.8 Results | Recorded; repeat rule left OFF | Your line |
| 37 Repeat variants | `exact` shipped by the 37.2 rule | Your line; team |
| 49 Prophet/ARIMA in the SOP | Nothing | Your line, the credit owner's, the team's |
| Flag cap | 36.5 position: the cap stays | Your tick on 36.5 covers it |

## 23.3 and 27 — the lenses as they ship (lines 1571 and 1843, sign-offs 1704–1706 and 1890)

**Question.** Do you take over the anomaly lens (per-business Isolation Forest, `flag_reason` only,
four logic fixes made before any held-out result) and the forecast method `naive90`
(`lenses/lens_config.yaml:68`)? On the untouched test `naive90` beats naive30 on median error, 0.323
vs 0.376 (research, N = 9,495), with crunch recall 79.4% vs 81.8% (NUMBERS §5). **Options:** tick;
annotate; change a parameter only through a new entry with its rule fixed first. Never change
`forecast.method` by reading the test table (line 1883). **Risk:** the lenses stay "the generator
owner's v1" in every document.

## 29 findings 3–4 (line 1931, sign-off 1973–1974)

**Question.** Finding 3: a shock in the final three weeks is invisible. `late_sudden_shock` is approved
for 104,000 SAR against the baseline's 47,000, with no cash alert (still true after the retrain,
entry 46). Finding 4: 10 flags in every scenario. **Tick:** "☐ forecast + anomaly owner (findings
3–4)". **Risk:** a judge finds both on a second click.

## 36 — holdout shock, Ramadan run, seasonal gate, repeat rule (line 2444)

**Lines to tick:** 2568 "(36.1–36.5)" and 2682 "(36.6–36.8, and the open repeat-rule decision)".
Results: lead time median 15 vs 27 days for naive30, detected 88.9% vs 96.3%, false alarms 3.8% vs
8.3% (NUMBERS §5c). Seasonal gate switched on by its pre-registered rule (1.37 → 1.02). The
repeat-rule decision in 36.8 was settled by entry 37 shipping `exact`, so the open item there is
closed in practice; your tick records it. **Risk:** the pre-registration has no owner's name on it.

## 37 — repeat-payment variants (line 2702, sign-off 2762)

`exact` was chosen by the 37.2 rule and tested once: re-sent payment 0.00, vendor-record duplicate
0.04 (NUMBERS §5). Any further variant needs a new held-out type first (§12). **Tick:**
"☐ forecast + anomaly owner".

## 49 — Prophet/ARIMA (line 3276, sign-off 3308)

**Question.** SOP §3 names Prophet/ARIMA; neither was among the six candidates (entry 27), and 36.5
(line 2565) states "no new forecast candidate (Prophet or ARIMA) this term". **Options:** A amend the
SOP/schema wording; B evaluate them under a new protocol with a new untouched window; C state it in
the limitations only. **Risk:** the proposal promises a method the project never tested.

## The 10-flag cap

**Evidence.** 584 of 943 serving businesses return the cap of 10 (`lenses/lens_config.yaml:85`); none
returns fewer than 4 (NUMBERS §5d, `eval/out/demo_exposure.md`). **Your recorded position** (36.5):
the cap stays; a shorter list needs a materiality rule designed on injected types only and
pre-registered, not planned this term. **Options:** keep and say "review queue, not alarms"; open a
new entry for a materiality rule. **Risk:** an empty review queue never happens, so an examiner will
ask what a flag means.

Latency: the anomaly route was re-timed on 2026-11-09 on the original machine, max 1,028 ms, PASS
(NUMBERS §6b), which closes the re-time request in 36.9.
