// Captures real API responses into web/fixtures/ for the tests (SOP Phase 1).
// Needs the Python API running. Reads MAAL_API_URL and MAAL_API_KEY from web/.env.local.
//   node scripts/capture-fixtures.mjs          the five lens routes for the demo businesses
//   node scripts/capture-fixtures.mjs routes   only the DECISIONS 44 routes (list, catalogue, one custom run)
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

async function capture(name, path, init = {}) {
  const res = await fetch(env.MAAL_API_URL + path, { ...init, headers: { "X-API-Key": env.MAAL_API_KEY, "Content-Type": "application/json" } });
  if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
  writeFileSync(join(webDir, "fixtures", `${name}.json`), JSON.stringify(await res.json(), null, 2) + "\n");
  console.log(`${name}.json`);
}

if (process.argv[2] === "routes") {
  // E10 and E12 (DECISIONS 44). The custom run uses one shock of each numeric type, inside the bounds.
  await capture("businesses_page1", "/businesses?offset=0&limit=25");
  await capture("businesses_q1002", "/businesses?q=1002&limit=25");
  await capture("scenarios_catalog", "/scenarios");
  const shocks = [
    { type: "cash_crunch", params: { week: 16, severity_pct: 40 } },
    { type: "large_transfer", params: { week: 10 } },
  ];
  await capture("custom_scenario", "/scenarios/run", { method: "POST", body: JSON.stringify({ shocks }) });
  process.exit(0);
}

for (const id of BUSINESSES) {
  for (const [route, path] of Object.entries(ROUTES)) {
    const res = await fetch(env.MAAL_API_URL + path(id), { headers: { "X-API-Key": env.MAAL_API_KEY } });
    if (!res.ok) throw new Error(`${route} ${id}: HTTP ${res.status}`);
    const body = await res.json();
    writeFileSync(join(webDir, "fixtures", `${route}_${id}.json`), JSON.stringify(body, null, 2) + "\n");
    console.log(`${route}_${id}.json  status=${body.status}`);
  }
}
