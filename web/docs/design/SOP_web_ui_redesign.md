# SOP: Web UI redesign to the "Sealed Ledger" direction

**For:** Claude Code, working on Faris Alsharifi's behalf
**Repo:** `Atunsi/maal-sme-platform`
**Branch:** `faris/web-ui` (work on this branch only)
**Written:** 2026-11-06
**Input:** the design bundle `maal-design-direction.zip`, unzipped to `web/docs/design/`
**Runs after:** `SOP_web_ui_first_pass.md` v2 (pushed HEAD `47d4741`). Rules U1 to U15 from that SOP still apply, as amended in section 1a below.
**Runs alongside:** `SOP_profile_engine_entries_30_35.md`. That SOP owns `ahmed/entry-30-counterparty-windows`. This one never touches that branch.

Read this whole file, then `web/docs/design/README.md` and `web/docs/design/DESIGN_DIRECTION.md`, before running anything. Follow the phases in order. If a stop condition (section 9) is hit, stop there, don't improvise around it, and go straight to the report (section 10).

---

## 1. Goal

Restyle and restructure the existing web UI to match the design bundle:

1. Brand: Faris's Arabic logo (master) and the English wordmark, with the entrance motion, in every header.
2. Light and dark themes on every page.
3. One page per lens instead of one long dashboard, plus an overview.
4. The lens visuals and motion described in `DESIGN_DIRECTION.md` section 4 and the mockups.
5. The scenario diff sheet.
6. A public landing page.
7. A demo sign-in (two roles) and an admin business list, front-end only (section 1a).
8. Arabic and RTL for every new page.

The deliverable is the branch pushed with the redesign, its tests, DECISIONS entry 42, the README row, new screenshots, and the report in section 10.

### 1a. Decisions Faris has taken for this SOP

These amend the first-pass rules. Record them in DECISIONS 42 (Phase H).

- **U11 amended.** The yellow synthetic-data banner is removed. Instead, every page shows population and data source: the footer of every page reads "Synthetic data only. Population: serving." (and its Arabic), and the landing, sign-in and admin pages say "synthetic data" in their body copy. Every number still carries its population where the old rule required it.
- **U15 amended.** A demo sign-in page is allowed, front-end only: it chooses a role (Business owner or Admin) and routes to the right page. It checks no credentials, creates no account or session, stores nothing, sets no cookie and sends nothing to the API. The page says so in plain words. Everything else in U15 stands (no tracking, analytics or logging of business data; the PDPL and SAMA Open Banking footer note).
- **No symbol characters in UI text.** No check marks, crosses, exclamation marks, arrows, delta signs, middle dots, ellipses or em dashes in any rendered text, in either language. Status is a word on a plate.
- **No hash-derived visual patterns** ("seals" or "fingerprints") anywhere. Receipts stay plain text.
- **Theme preference** may be kept in `localStorage` only (no cookie), defaulting to the system `prefers-color-scheme`.

If any of these conflicts with CLAUDE.md, the schema or DECISIONS, that is S6.

## 2. What you may and may not do

**Allowed:**
- Create and edit anything under `web/`, including moving and renaming routes, components and tests.
- Copy brand files from `web/docs/design/` into `web/public/brand/` or `web/components/brand/`.
- Add **one** new DECISIONS entry (42, see Phase H) and update the README "Next.js UI" status row.
- Add pinned dev dependencies if a phase needs them (record each version in the report).
- Run the Python backend locally (`api.store`, `uvicorn`, `scenarios.run`) to develop against it.
- Commit and push to `faris/web-ui`.

**Not allowed:**
- Editing anything outside `web/` except the items above. No change to `api/` (the store bug stays the API owner's), `pipeline/`, `lenses/`, `profile_engine/`, `compliance/`, `scenarios/`, `config.yaml` or the schema.
- Removing the request queue in `web/lib/api.ts`. Each page may make fewer requests, but they still go through the queue.
- Merging to `main`, pushing to `main`, force-pushing, rebasing a pushed branch, or opening a PR.
- Committing anything under `data/`, any `.duckdb` file, any `.env` file, `node_modules` or `.next`.
- Putting `MAAL_API_KEY` anywhere the browser can see it.
- Any LLM call, generated text or machine translation in the app.
- **Copying numbers from the mockups.** The mockups hold values copied from the 10001 fixtures so they look real. In the app, every number comes from an API response or an exported scenario object. The landing page's illustrative card uses the exported `baseline` scenario object and is labelled synthetic. The landing counts come from code: lenses from the lens list, scenarios from `web/scenarios-data/index`, languages from the locale list.
- Editing the logo artwork. Use `logo/maal-ar.svg` and `logo/maal-en.svg` as given. If they look wrong in the app, report it.
- Using the mockups' `.dc.html` markup or `DCLogic` scripts as code. They are a spec: copy layout, copy text, tokens, keyframes and timings, and rebuild in the app's own React and Tailwind.

## 3. Rules the redesign must keep

U1 to U15 from the first-pass SOP, with the U11 and U15 amendments above. Every existing named test for those rules must still exist and pass, moved to the page where the rule now lives. Notes:

- **U4:** the mockup shortens credit factor labels. The app renders the API's `text` field verbatim.
- **U6, U7:** the pending-advisor frame and the nisab placeholder plate must be visible without any animation (reduced motion).
- **U8:** the review timeline carries `flag_reason` only. No score, no "fraud".
- **U10:** `insufficient_data` and `partial_profile` keep their explicit states on every lens page and on the overview card.
- **U14:** WCAG 2.1 AA in **both themes**. Every chart keeps its table. Every animation stops under `prefers-reduced-motion: reduce`, and the final state must then show without animating (for example, stroke dash offsets at 0).

---

## 4. Phases

### Phase A: Preflight (no edits yet)

1. Sync and check for others' work:
   ```bash
   git status
   git fetch origin
   git checkout faris/web-ui
   git pull --ff-only origin faris/web-ui
   git log --oneline -5
   git log --oneline HEAD..origin/faris/web-ui      # must be empty
   git log --oneline origin/faris/web-ui..origin/main
   ```
   - If anyone else has pushed to `faris/web-ui`, stop (S1).
   - If `origin/main` has commits not on the branch, don't merge. List them. If any touch `api/`, `pipeline/`, `scenarios/` or response shapes, stop (S1).
2. Check the bundle is in place: `web/docs/design/README.md`, `DESIGN_DIRECTION.md`, `logo/maal-ar.svg`, `logo/maal-en.svg`, `assets/maal-logo-tile-light.svg`, `assets/maal-logo-tile-dark.svg`, and 12 files in `mockups/`. Record `sha256sum` of the two logo SVGs. If anything is missing, stop (S3).
3. Check the next DECISIONS number on both `origin/main` and `ahmed/entry-30-counterparty-windows`. 41 is used on this branch and 38 to 40 on Ahmed's. Use 42 if free on both, else the next free number, and say so in the report.
4. Baseline, from `web/` then the repo root. Record every count:
   ```bash
   npx tsc --noEmit
   npx eslint .
   npm run build
   npm run test          # baseline: 104 passed
   npm run e2e           # baseline: 48 passed, against the dev backend
   cd .. && python -m pytest tests -q    # baseline: 98 passed, 1 xfailed
   python -m ruff check .
   ```
   If anything already fails, record it and carry on. Don't count those failures against your changes.
5. Start the dev backend as in the first-pass SOP section 4 (quick data, N = 300 serving businesses).

### Phase B: Foundation

1. **Tokens.** Put the light and dark tokens from `DESIGN_DIRECTION.md` section 5 into CSS variables (`:root`/`.th-light` and `.th-dark`) and map them into the Tailwind theme. Take the exact values from the mockups' `.th-light` / `.th-dark` blocks, including `--warnText`, `--warnBg`, `--panel` and the rest.
2. **Fonts.** IBM Plex Sans, IBM Plex Sans Arabic, IBM Plex Sans Condensed and IBM Plex Mono through `next/font` (self-hosted at build, no runtime call to Google). The logo is artwork, not a font.
3. **Logo components.** `ArabicLogo` and `EnglishWordmark` as inline SVG React components built from the two SVG files, keeping the two paths in each (body, madda). Props: height, colour (default `currentColor`), decorative or labelled. The entrance motion: body rises (`lgrise`, 0.6 s, delay 0.1 s), madda lands (`lgland`, 0.55 s, delay 0.6 s); English delayed 0.2 s more. Copy the keyframes from any mockup's `<helmet>`.
4. **Brand assets.** Copy the two tiles to `web/public/brand/`. A `LogoBand` component (the drifting band under the header) and a `SectionMark` (small logo before section labels), both decorative (`aria-hidden`).
5. **`Plate`.** One component with variants `ok`, `bad`, `warn`, `ink`, always holding a word. Replace every status chip in the app with it.
6. **Theme toggle.** A real `<button>` with `aria-pressed`, labelled "Dark theme" / "Light theme" (Arabic "الوضع الداكن" / "الوضع الفاتح"). Default from `prefers-color-scheme`, choice saved in `localStorage` only.
7. **Shared layout.** Header: Arabic logo (46 px) plus English wordmark (20 px) linking home, the page nav with `aria-current="page"`, the theme toggle, and on business pages "Signed in as" with the demo role. The `LogoBand` under the header. Footer with the amended U11 line and the existing U15 note.
8. **Guards (new tests):**
   - `no symbol characters in rendered text`: renders every page in both locales and fails on any of ✓ ✔ ✕ ✗ × ! → ← ▶ ◀ Δ · … — (the exclamation mark only in text nodes, not in code).
   - `theme toggle switches and persists without cookies`.
   - `logo components render both paths and carry a label when labelled`.
9. Commit: "Web UI redesign foundation: tokens, themes, fonts, logos, Plate, layout". Run tsc, eslint, build and vitest first; all must pass.

### Phase C: Split into pages

1. Routes, as in the bundle README: overview `/[locale]/business/[id]`, and `/credit`, `/sharia`, `/zakat`, `/forecast`, `/review` under it. Keep `/[locale]/scenarios`. Keep any existing route working by redirecting it to the overview.
2. Each lens page fetches only its own lens (and the common header) through the queue. The overview fetches what its five readout cards need, still through the queue.
3. Move each existing card, and its tests, to its page. Keep every test name from the first-pass report. Update paths only.
4. Overview content, from `Main.dc.html`: welcome line, verdict sheet (decision word, amount, months, markup fixed at signing, charity-directed late payments), receipt panel as plain text ("You can re-run this decision", output hash, model, commit, scope verbatim on expand), five readout cards linking to the lens pages.
5. Commit. All U tests must pass.

### Phase D: Lens visuals and motion

Build one page at a time, from its mockup. After each page run vitest and the Playwright tests for that page, then commit that page alone.

| Page | Build | Motion (from the mockup's keyframes) |
|---|---|---|
| Credit | Public view: factor rows on a centre axis, against on one side, supports on the other, bar length from the magnitude word only. Compliance view: dark ledger panel with pd, logit, risk tier, CV AUC and ceiling from the receipt, contributions table. Offer terms row. | Bars grow from the axis in turn; the compliance panel slides in |
| Sharia | Pending-advisor frame (U6), "what was checked" rows including `rule_table_status`, owner question | Frame draws edge by edge, then breathes; rows rise |
| Zakat | Waterfall: zakatable assets, less deductible liabilities, base, nisab marker; the amount panel (base, rate, liability); hawl timeline (start, snapshot, completion); placeholder plate (U7); "Not a ZATCA assessment" | Bars fill in order, nisab marker drops, hawl track fills |
| Forecast | Key figures, runway chart with SAR 0 as the cash floor, model and naive baseline, the full table on the page | Lines revealed left to right; pulse on today |
| Review queue | "N of cap" slots from the response, 180-day timeline with one mark per queued transaction placed by date, reason counts, the transaction table; clicking a mark or a row highlights the other | Scan line sweeps; marks rise as it passes |

Rules for every page:
- Positions, widths and dates in the visuals are computed from the response at render time. Nothing is copied from the mockup.
- The zakat waterfall scale and the forecast chart scale come from the response values.
- Every visual has a text alternative (`role="img"` with a label built from the same values, or a table).
- Add a reduced-motion Playwright test per page: with `reducedMotion: 'reduce'`, the final state is visible and nothing animates.

### Phase E: Scenario diff sheet

From `Scenarios.dc.html`: the menu, the diff sheet (baseline and chosen scenario side by side; "Changed" or "Same" plate per row, computed by comparing the two objects), the findings panel and the N = 1 caveat, and the DECISIONS 41 note under the receipt scope. Rows rise in sequence; changed plates stamp in. Keep the scenario integrity tests from the first pass. Commit.

### Phase F: Landing page

From `Landing.dc.html`, at `/[locale]`:
- Hero promise and two calls to action (sign in, scenarios).
- The illustrative card built from the exported `baseline` scenario object, labelled "Illustrative, synthetic data".
- "Built for" strip, the animated flow (four steps, travelling dots), the four lens cards linking to the demo pages for 10001, the counts (computed, see section 2), "Why Ma'al", the FAQ as native `<details>`, the closing sign-in band.
- The faint oversized Arabic logo behind the hero; `LogoBand` between sections.

Commit.

### Phase G: Demo sign-in and admin

1. **Sign-in** at `/[locale]/sign-in`, from `Login.dc.html`: brand panel with the large logo and the line on what مآل means; a role switch (Business owner, Admin); the fields shown in the mockup, which accept input but are not read, checked or sent; a button that routes Business owner to the overview for 10001 and Admin to `/admin`. Visible text: "Demo sign-in. No accounts exist and nothing you type is checked or saved." Test: `sign-in sends no request and stores nothing` (no network call, no cookie, no storage write except the theme).
2. **Admin** at `/[locale]/admin`, from `Admin.dc.html`: a table of the five demo businesses (10001, 10004, 10037, 10040, 10003). Keep the five IDs in one config constant. Fetch each row's status and credit decision from the API through the queue; never hard-code a status. An "Open a business by ID" field that validates like the existing picker. The note that a full list needs `GET /businesses` (already a proposed API change).
3. The role shown in the header ("Signed in as") is the demo role chosen on the sign-in page, held in memory or the URL only.
4. Commit.

### Phase H: Arabic, checks, record and push

1. Arabic copy for every new string, from `Arabic.dc.html` where it exists. Mark every new Arabic string as draft for review in the catalogue (the existing convention). Check RTL for every page: animation origins mirror (bars grow from the right), the logo band and section marks sit correctly.
2. Full checks from `web/`: typecheck, lint, build, vitest, Playwright. axe on every page in **both locales and both themes**, no serious or critical violations. Then at the repo root: pytest and ruff must equal the Phase A baseline.
3. Manual pass against the dev backend for 10001, 10003, 10004, 10037 and 10040, and every scenario, in both languages and both themes. Save screenshots to `web/docs/screenshots/` (replace the old six): landing, sign-in, admin, overview 10001, credit 10001 public and compliance, zakat 10001, review 10001, scenarios `severe_collapse`, overview 10003 (`insufficient_data`); each in English light, plus overview 10001 in Arabic dark. **Look at every screenshot you save**, and say which ones you looked at.
4. **DECISIONS 42**, titled along the lines of "Web UI redesign to the design bundle; U11 and U15 amended for the demo: PROPOSED". Cover: what changed and why (the design bundle and its competitor findings, as findings, not citations); the U11 and U15 amendments from section 1a, word for word; the no-symbol and no-hash-pattern rules; the logo files and their sha256; that all figures come from responses or scenario objects; anything from the bundle you could not build, and why. Sign-off line: `☐ team (redesign, U11 and U15 amendments) ☐ compliance owner (Sharia and Zakat pages, Arabic copy) ☐ credit lens owner (Credit and Compliance views)`. Tick nothing.
5. README "Next.js UI" row: point to entry 42. Update `web/README.md` with the new routes, the theme note and the demo sign-in note.
6. Commit, then:
   ```bash
   git fetch origin
   git log --oneline HEAD..origin/faris/web-ui    # must be empty
   git push origin faris/web-ui
   ```
   Don't open a PR.

---

## 9. Stop conditions

| Code | Condition |
|---|---|
| S1 | Someone else has pushed to `faris/web-ui`, or `origin/main` has moved in a way that touches `api/`, `pipeline/`, `scenarios/` or the response shapes. |
| S2 | The work seems to need a change outside `web/` beyond section 2's allowed items. Stop that part, finish the rest, and report it as a proposal. |
| S3 | The design bundle is missing or incomplete, the dev backend won't start, or `api.store` fails. Don't stub the API with hand-written data; fixtures come from the real API, except the existing `*_synthetic_state.json` files. |
| S4 | The repo's pytest or ruff counts change, a scenario integrity check fails, or `scenarios.run --check` exits non-zero. |
| S5 | A design element can't be built from what the API returns (for example, a value the mockup shows that no response contains). Leave it out, say so in DECISIONS 42 and the report. Don't fake the field. |
| S6 | Anything here or in the bundle conflicts with CLAUDE.md, the schema or DECISIONS (beyond the U11 and U15 amendments Faris made in section 1a). Follow the repo and report the conflict. |
| S7 | Anything that must not be committed (section 2) is found staged. Unstage it and report; don't push until it's clean. |
| S8 | An existing U-rule test fails after a phase and can't be fixed without weakening the rule. Stop that phase and report. Never delete or loosen a rule test to make a page match the mockup. |

---

## 10. The report you must return

One report, in exactly this structure. Plain language. Every number carries its population and N.

```markdown
# Web UI report: redesign to the design bundle (<date>)

## 1. Outcome in one paragraph
What got done, what didn't, and any stop code.

## 2. Status by task
| Task | Status (Done / Partly / Not done / Stopped) | Commit | Notes |
|---|---|---|---|
| A preflight | | | |
| B foundation | | | |
| C split into pages | | | |
| D lens visuals and motion (one row per page) | | | |
| E scenario diff sheet | | | |
| F landing page | | | |
| G demo sign-in and admin | | | |
| H Arabic, checks, DECISIONS 42, push | | | |

## 3. What changed
Files and folders, one line each. Commit hashes and messages. Pushed HEAD. Versions added.

## 4. Design fidelity
For each mockup: built as designed, built with changes (say what and why), or left out (say why, with stop code if any).

## 5. Rules
One line per rule U1 to U15 (with the U11 and U15 amendments): how it is enforced now, which page it lives on, and the test name. Then the new guards from Phase B, G and D.

## 6. Checks
| Command | Exit code | Result | Notes |
typecheck, lint, build, vitest counts, Playwright counts, axe (pages × locales × themes), repo pytest and ruff (baseline vs final), scenarios.run --check.

## 7. Screenshots
Paths under web/docs/screenshots/, and which ones you looked at.

## 8. Proposed API changes (not built)
Anything new beyond the first-pass report's list.

## 9. Deviations from the SOP
"None" if none.

## 10. Decisions still needed from Faris
Numbered, most urgent first. At least: Arabic copy review for the new pages; whether the English wordmark needs changes after seeing it in the app; whether the looping animations stay; the first-pass items still open (UI ownership, digits, default locale, Arabic backend templates, policies to archive, PR timing, removing the queue after the store fix).
```

The report is the deliverable. A run that built the pages but returns a vague report is not finished.
