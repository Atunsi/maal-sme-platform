// Exports every scenario in scenarios/library.yaml and verifies each file (SOP Phase 4).
// Run from web/. A verify failure exits 1: the files are not to be committed (stop condition S4).
//   node scripts/export-scenarios.mjs
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const outDir = join("web", "scenarios-data");
mkdirSync(join(repo, outDir), { recursive: true });

const run = (args) => spawnSync("python", args, { cwd: repo, encoding: "utf8", env: { ...process.env, PYTHONIOENCODING: "utf-8" } });

const library = readFileSync(join(repo, "scenarios", "library.yaml"), "utf8");
const body = library.slice(library.indexOf("scenarios:"));
const names = [...body.matchAll(/^ {2}([a-z_]+):\s*$/gm)].map((match) => match[1]);

let failed = 0;
for (const name of names) {
  const file = join(outDir, `${name}.json`);
  const exported = run(["-m", "scenarios.run", "--scenario", name, "--out", file]);
  if (exported.status !== 0) throw new Error(`${name}: export failed\n${exported.stderr}`);
  const verified = run(["-m", "pipeline.verify", file]);
  const lines = verified.stdout.trim().split(/\r?\n/);
  console.log(`${name}: verify exit ${verified.status}`);
  for (const line of lines.slice(0, 3)) console.log(`  ${line.trim()}`);
  if (verified.status !== 0) failed += 1;
}
console.log(`\n${names.length} scenarios, ${failed} failed verification`);
process.exit(failed === 0 ? 0 : 1);
