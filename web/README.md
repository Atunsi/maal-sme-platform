# Web UI — first pass, PROPOSED (DECISIONS entry 41)

**Schema:** §8, §10, §11, §13, §15, §29, §36 · **Due:** Weeks 9 and 10 (§19) · **Owner:** open (entry 41)

A Next.js app over the five API read-paths: a business picker, a dashboard, the Compliance View,
a scenario demo page, and English and Arabic with RTL. It is a demo on synthetic data. It has no
accounts, tracking or logging of business data.

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

`npm run e2e` takes about three minutes, because the 429 test waits out the API's real one-minute
rate window.

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
- **Rules U1 to U15** are listed in entry 41, each with how it is enforced and tested.

## Fixtures and scenarios

- `fixtures/`: real API responses from `npm run capture-fixtures`. The exceptions are the
  `*_synthetic_state.json` files from `npm run synthetic-fixtures`, which are edited copies for
  states the quick data never reaches.
- `scenarios-data/`: exported by `npm run export-scenarios`. Run it from a clean tree, so the
  receipts carry no `+dirty`. A scenario object is verified by its integrity hash and by
  `scenarios.run --check`, never by `pipeline.verify` (entry 41).
