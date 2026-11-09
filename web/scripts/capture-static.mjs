// Captures the online demo snapshot (lib/static-data.ts) from a running API: every lens, the profile and the
// sector for a fixed set of serving businesses, plus the scenario catalogue. Run it against the full-scale
// serving store, from web/, with the API up and web/.env.local set (MAAL_API_URL, MAAL_API_KEY):
//
//   node scripts/capture-static.mjs
//
// It writes web/static-data/, replacing what is there. The files are plain API responses; nothing is edited.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
);
const URL_BASE = process.env.MAAL_API_URL ?? env.MAAL_API_URL;
const KEY = process.env.MAAL_API_KEY ?? env.MAAL_API_KEY;
if (!URL_BASE || !KEY) throw new Error("Set MAAL_API_URL and MAAL_API_KEY (web/.env.local).");

// The five demo businesses (lib/businesses.ts, one per state the API returns) and the first thirty serving IDs.
const DEMO = [10001, 10004, 10037, 10040, 10003];
const IDS = [...new Set([...DEMO, ...Array.from({ length: 30 }, (_, i) => 10001 + i)])].sort((a, b) => a - b);

const DIR = "static-data";
const fileOf = (path) => `${path.replace(/^\//, "").replace(/[^a-zA-Z0-9]+/g, "_")}.json`;

async function get(path) {
  const res = await fetch(URL_BASE + path, { headers: { "X-API-Key": KEY } });
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return res.json();
}
const save = (path, json) => writeFileSync(join(DIR, fileOf(path)), JSON.stringify(json));

rmSync(DIR, { recursive: true, force: true });
mkdirSync(DIR, { recursive: true });

// One request at a time, as lib/api.ts does (the API store's shared-connection bug, DECISIONS 41).
save("/health", await get("/health"));
save("/scenarios", await get("/scenarios"));
const listed = [];
for (let offset = 0; ; offset += 50) {
  const page = await get(`/businesses?offset=${offset}&limit=50`);
  listed.push(...page.businesses);
  if (offset + 50 >= page.total) break;
}
const sectorOf = new Map(listed.map((b) => [b.business_id, b.sector]));
const snapshot = IDS.filter((id) => sectorOf.has(id)).map((id) => ({ business_id: id, sector: sectorOf.get(id) }));
save("/businesses-snapshot", snapshot);
for (const { business_id: id } of snapshot) {
  save(`/profile/${id}`, await get(`/profile/${id}`));
  for (const lens of ["credit", "forecast", "anomaly", "zakat"]) save(`/lenses/${lens}?business_id=${id}`, await get(`/lenses/${lens}?business_id=${id}`));
  process.stdout.write(".");
}
console.log(`\ncaptured ${snapshot.length} businesses of ${listed.length} serving, into ${DIR}/`);
