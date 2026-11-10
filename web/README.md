# Web UI — redesign, PROPOSED (DECISIONS entries 41 to 45)

**Schema:** §8, §10, §11, §13, §15, §29, §36 · **Due:** Weeks 9 and 10 (§19) · **Owner:** open (entry 41)

A Next.js app over the five API read-paths, in English and Arabic with RTL, in light and dark themes.
It is a demo on synthetic data. It has no real accounts, tracking or logging of business data.

## Pages

| Route | Page |
|---|---|
| `/[locale]` | Public landing page |
| `/[locale]/sign-in` | Demo sign-in, two roles |
| `/[locale]/admin` | The five demo businesses, then every serving business from `GET /businesses`, searched with `?q=`, `?sector=` and `?page=` |
| `/[locale]/business/[id]` | Overview: verdict sheet, receipt, five readouts, profile features |
| `/[locale]/business/[id]/credit` | Credit, with the Compliance View at `?view=compliance` |
| `/[locale]/business/[id]/sharia` | Sharia screen |
| `/[locale]/business/[id]/zakat` | Zakat |
| `/[locale]/business/[id]/forecast` | Forecast |
| `/[locale]/business/[id]/review` | Review queue |
| `/[locale]/business/[id]/sheet` | Printable decision sheet ("Print or save as PDF") |
| `/[locale]/scenarios` | Scenario diff sheet, chosen with `?s=` (or `?scenario=`, which Play all writes) |
| `/[locale]/scenarios/custom` | Custom scenario builder; the shocks ride in `?shock=` |
| `/[locale]/glossary` | Every glossary term |
| `/[locale]/how-it-works` | How Ma'al decides |

Enhancements (DECISIONS 51):

- **Guided tour.** "Take the tour" on the landing page and the overview. The step is in the URL (`?tour=<step>`); Escape ends it. Steps live in `lib/tour.ts`.
- **Print sheet.** `/business/[id]/sheet`, with print CSS for A4. No print timestamp.
- **Glossary.** `lib/glossary.ts`; `<Term>` marks a term's first appearance on a page.
- **Receipts.** Copy buttons, the scope's re-run command, and "Check a hash", all in the browser.
- **Chart readouts.** The forecast chart takes focus (Left, Right, Home, End, Escape); Zakat bars and review marks show their value on hover, focus or tap.
- **Digits.** In Arabic only, a header switch to Arabic-Indic digits, kept in `localStorage` (`maal-digits`), never a cookie. The server renders Western digits and the client rewrites them after hydration; hashes, commands, links and backend text are never rewritten.
- **Phones and tablets.** Below 768 px the page links fold into a Menu; no page scrolls sideways at 360 px. Playwright projects `phone-360`, `phone-390`, `tablet-768` and `laptop-1280` run `e2e/mobile.spec.ts`; the rest of the suite runs as `desktop`.
- **Play all** on the scenario page, one scenario every 8 seconds, with Pause.
- **Custom scenarios** and the **admin list** call the DECISIONS 44 routes through the same queue.

Review fixes (DECISIONS 45):

- **Business switcher.** A "Business" button in the header on business pages (in the Menu on phones) opens a
  combobox: the five demo businesses with their decision plates, or two or more digits to search serving IDs.
  Choosing keeps the lens page and `?as=`. Its calls are server actions in `app/actions.ts`, through the queue.
- **Search.** A "Search" button, or Ctrl+K / Cmd+K, opens a dialog over fixed lists: this business's pages, the
  scenarios, the glossary terms, and "Open business <ID>" for a serving ID. No API call.
- **Review queue.** One timeline track, one mark per listed transaction, with colour and height marking the reason;
  legend items filter marks and rows (`?reason=`); the table sorts by any column (`?sort=&dir=`), oldest first by
  default.
- **Tour.** Step dots, a Collapse button (`?tourMin=1`) and, after End tour, a "Resume tour" link in the header
  (`?tourEnded=<step>`). Nothing is stored.
- **Scenarios.** "Changed rows only" (`?changed=1`), arrow keys in the menu, a native select below 768 px, and a
  progress bar while Play all runs. The custom builder can start from a library scenario and pairs every number
  with a slider.
- **Local fonts.** The IBM Plex families are self-hosted from `app/fonts/` (`next/font/local`, Fontsource 5.3.0
  woff2 files, SIL Open Font License beside them). The build makes no call to Google.
- **The Saudi riyal sign** (U+20C1, entry 57). No system font has it yet, so its two faces come from the
  `riyal` npm package v1.2.1 (MIT, `app/fonts/MIT-riyal.txt`), copied as files, pinned by sha256 in
  `tests/fonts.test.ts` and loaded with `next/font/local` for `unicode-range: U+20C1` only, first in every
  stack (no fallback face, which would be Arial for every character). The package is not a dependency.
  Amounts render through `<Sar>`: the sign is `aria-hidden` and a hidden word follows ("Saudi riyals",
  «ريال سعودي»); attributes use `formatSarSpoken`. The character is written once, `RIYAL` in `lib/format.ts`.
- **Motion cap.** Outside the landing page and sign-in, no entrance waits more than 0.4 s or runs longer than
  0.6 s: named steps `--d-0` to `--d-4` in `globals.css` and `delay()` in `lib/motion.ts`.
- **Visual snapshots.** `e2e/visual.spec.ts` keeps Playwright screenshot baselines in
  `e2e/visual.spec.ts-snapshots/`. After an intended visual change, refresh them with
  `npx playwright test --project=desktop e2e/visual.spec.ts --update-snapshots` and look at every changed image.

The design reference is in `docs/design/` (read its README first). Its mockups are a spec, not code.

## Run

The Python API must be running first (from the repo root):

```bash
python -m generator.generate --quick
python -m api.store --dir data/quick --out data/serving_quick.duckdb
export MAAL_API_KEY=<a local secret>
export MAAL_STORE=data/serving_quick.duckdb
uvicorn api.app:app --port 8000
```

Then, from `web/` (Node 22):

```bash
npm ci
npm run build
npm run start        # http://127.0.0.1:3000
```

`web/.env.local` is git-ignored and must set two variables. Never give either a `NEXT_PUBLIC_`
prefix, and never commit a value.

| Variable | Meaning |
|---|---|
| `MAAL_API_URL` | Base URL of the Python API |
| `MAAL_API_KEY` | The same key the API was started with |

## Checks

```bash
npm run typecheck
npm run lint
npm run build        # before test: the key-leak guard reads the build output
npm run test         # vitest; the scenario test also calls python from the repo root
npm run e2e          # Playwright, in Microsoft Edge; needs the API and a finished build
```

`npm run e2e` takes a while: it runs axe on every page in both locales and both themes, and the 429
test waits out the API's real one-minute rate window.

`e2e/arabic.spec.ts` crawls every `/ar` route and fails on any Latin word outside its named allowlist
(A4, entry 57), and checks the riyal sign (RS1 to RS3). Its recording mode lists every Latin word with
the pages it is on, without asserting: `ARABIC_RECORD=<file.json> npx playwright test e2e/arabic.spec.ts -g records`.

## Constraints

- **The API key stays on the server.** Only `lib/api.ts` reads it, and `server-only` makes a client
  import a build error. `tests/keyleak.test.ts` checks this.
- **The request queue stays until `api/store.py` is fixed.** `lib/api.ts` sends one API request at
  a time, because the store shares one DuckDB connection across request threads (entry 41). Each
  card still loads and fails on its own. Remove the queue after the fix, and the five requests run
  in parallel as §8 intends.
- **The UI translates only its own text; Arabic backend text comes from the backend** (entry 57). Every
  template the backend shows has an Arabic sibling (`text_ar`, `drivers_ar`, `scope_ar` and the like) from
  fixed tables beside the English ones (`templates_ar.yaml`, `scenarios/library_ar.yaml`). `BackendText`
  shows that field verbatim in Arabic; when it is absent the English stays in an LTR block, labelled as
  pending an Arabic template. A UI translation would be a second, unreviewed version.
- **Every number comes from an API response or an exported scenario object.** Nothing from
  `docs/NUMBERS.md` is hard-coded.
- **Rules U1 to U15** are listed in entry 41, each with how it is enforced and tested. Entry 42 amends
  U11 and U15.
- **No symbol characters in UI text.** Status is a word on a plate (`Plate` in `components/ui.tsx`).
- **Motion never carries meaning.** Each animated element's base style is its final state, so under
  `prefers-reduced-motion: reduce` the page simply shows that state. Time axes stay left to right in
  Arabic; other bars mirror through `--o-start` and `--o-end`.

## Theme

Light and dark tokens are CSS variables in `app/globals.css`, on a `th-light` or `th-dark` class on
`<html>`. The default follows `prefers-color-scheme`. A choice is kept in `localStorage` only, never
in a cookie. `.panel` is a dark surface in either theme; components inside it need no dark variant.

## Demo sign-in

`/sign-in` chooses a role and routes to a page. The password for both roles is `pass`, checked in the
browser only; the registration number and username are not read, and the username need not be an email.
It creates no account or session, stores nothing, sets no cookie and sends nothing to the API. The fields
are unnamed. The role rides in the URL (`?as=owner` or `?as=admin`), proves nothing and gates nothing:
`/admin` is open to anyone who visits it. A real deployment would need PDPL handling.

## Fixtures and scenarios

- `fixtures/`: real API responses from `npm run capture-fixtures`. The exceptions are the
  `*_synthetic_state.json` files from `npm run synthetic-fixtures`, which are edited copies for
  states the quick data never reaches.
- `scenarios-data/`: exported by `npm run export-scenarios`. Run it from a clean tree, so the
  receipts carry no `+dirty`. A scenario object is verified by its integrity hash and by
  `scenarios.run --check`, never by `pipeline.verify` (entry 41).
