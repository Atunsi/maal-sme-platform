# Web UI — redesign, PROPOSED (DECISIONS entries 41 and 42)

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

Enhancements (DECISIONS 43):

- **Guided tour.** "Take the tour" on the landing page and the overview. The step is in the URL (`?tour=<step>`); Escape ends it. Steps live in `lib/tour.ts`.
- **Print sheet.** `/business/[id]/sheet`, with print CSS for A4. No print timestamp.
- **Glossary.** `lib/glossary.ts`; `<Term>` marks a term's first appearance on a page.
- **Receipts.** Copy buttons, the scope's re-run command, and "Check a hash", all in the browser.
- **Chart readouts.** The forecast chart takes focus (Left, Right, Home, End, Escape); Zakat bars and review marks show their value on hover, focus or tap.
- **Digits.** In Arabic only, a header switch to Arabic-Indic digits, kept in `localStorage` (`maal-digits`), never a cookie. The server renders Western digits and the client rewrites them after hydration; hashes, commands, links and backend text are never rewritten.
- **Phones and tablets.** Below 768 px the page links fold into a Menu; no page scrolls sideways at 360 px. Playwright projects `phone-360`, `phone-390`, `tablet-768` and `laptop-1280` run `e2e/mobile.spec.ts`; the rest of the suite runs as `desktop`.
- **Play all** on the scenario page, one scenario every 8 seconds, with Pause.
- **Custom scenarios** and the **admin list** call the DECISIONS 44 routes through the same queue.

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

## Constraints

- **The API key stays on the server.** Only `lib/api.ts` reads it, and `server-only` makes a client
  import a build error. `tests/keyleak.test.ts` checks this.
- **The request queue stays until `api/store.py` is fixed.** `lib/api.ts` sends one API request at
  a time, because the store shares one DuckDB connection across request threads (entry 41). Each
  card still loads and fails on its own. Remove the queue after the fix, and the five requests run
  in parallel as §8 intends.
- **The UI translates only its own text.** Backend templates stay in English in an LTR block,
  labelled as pending an Arabic template. A UI translation would be a second, unreviewed version.
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
