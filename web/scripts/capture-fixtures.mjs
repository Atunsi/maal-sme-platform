// Captures real API responses into web/fixtures/ for the tests (SOP Phase 1).
// Needs the Python API running. Reads MAAL_API_URL and MAAL_API_KEY from web/.env.local.
//   node scripts/capture-fixtures.mjs
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const webDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const env = Object.fromEntries(
  readFileSync(join(webDir, ".env.local"), "utf8")
    .split(/\r?\n/)
    .filter((line) => line.includes("="))
    .map((line) => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1)]),
);

const BUSINESSES = [10001, 10003, 10004, 10037, 10040];
const ROUTES = {
  profile: (id) => `/profile/${id}`,
  credit: (id) => `/lenses/credit?business_id=${id}`,
  forecast: (id) => `/lenses/forecast?business_id=${id}`,
  anomaly: (id) => `/lenses/anomaly?business_id=${id}`,
  zakat: (id) => `/lenses/zakat?business_id=${id}`,
};

mkdirSync(join(webDir, "fixtures"), { recursive: true });
for (const id of BUSINESSES) {
  for (const [route, path] of Object.entries(ROUTES)) {
    const res = await fetch(env.MAAL_API_URL + path(id), { headers: { "X-API-Key": env.MAAL_API_KEY } });
    if (!res.ok) throw new Error(`${route} ${id}: HTTP ${res.status}`);
    const body = await res.json();
    writeFileSync(join(webDir, "fixtures", `${route}_${id}.json`), JSON.stringify(body, null, 2) + "\n");
    console.log(`${route}_${id}.json  status=${body.status}`);
  }
}
