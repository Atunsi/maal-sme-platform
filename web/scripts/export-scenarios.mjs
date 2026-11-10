// Exports every scenario in scenarios/library.yaml and verifies it (SOP v2 Phase C). Run from a clean
// tree so the receipts' code_commit has no +dirty. Exit 1 means do not commit the files.
//   node scripts/export-scenarios.mjs
//
// A scenario counts as verified when its object hashes to its own receipt.output_sha256 and
// scenarios.run --check exits 0 (DECISIONS 41). pipeline.verify is deliberately not run: it re-runs
// from the generated data/, and a scenario is an in-memory overlay, so it can never reproduce one.
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const outDir = join("web", "scenarios-data");
mkdirSync(join(repo, outDir), { recursive: true });
// Export outside the repo first: writing a tracked file mid-run would make every later receipt +dirty.
const stage = mkdtempSync(join(tmpdir(), "maal-scenarios-"));

function python(args) {
  const env = { ...process.env, PYTHONIOENCODING: "utf-8", PYTHONUTF8: "1" };
  return spawnSync("python", args, { cwd: repo, encoding: "utf8", env, maxBuffer: 1 << 26 });
}

const LIBRARY = `
import json
from pathlib import Path
import yaml
from scenarios.run import load_library
lib, sha = load_library()
ar = yaml.safe_load(Path("scenarios/library_ar.yaml").read_bytes().decode("utf-8"))["scenarios"]  # DECISIONS 57
print(json.dumps({"library_version": lib["version"], "library_status": lib["status"], "library_sha256": sha,
    "base_business": lib["base_business"],
    "scenarios": [{"name": n, "label": s["label"], "story": s["story"], "label_ar": ar[n]["label"], "story_ar": ar[n]["story"]}
                  for n, s in lib["scenarios"].items()]}, ensure_ascii=False))
`;

const INTEGRITY = `
import json, sys
from pipeline.week8 import output_sha256
for path in sys.argv[1:]:
    obj = json.load(open(path, encoding="utf-8"))
    print(path, output_sha256(obj), obj["receipt"]["output_sha256"], obj["receipt"]["code_commit"])
`;

const library = python(["-c", LIBRARY]);
if (library.status !== 0) throw new Error(library.stderr);
const index = JSON.parse(library.stdout);

const files = [];
for (const { name } of index.scenarios) {
  const file = join(stage, `${name}.json`);
  const exported = python(["-m", "scenarios.run", "--scenario", name, "--out", file]);
  if (exported.status !== 0) throw new Error(`${name}: export failed\n${exported.stderr}`);
  files.push(file);
}

const integrity = python(["-c", INTEGRITY, ...files]);
if (integrity.status !== 0) throw new Error(integrity.stderr);
let failed = 0;
const commits = new Set();
integrity.stdout
  .trim()
  .split(/\r?\n/)
  .forEach((line, i) => {
    const [, computed, stored, commit] = line.split(" ");
    const scenario = index.scenarios[i];
    const ok = computed === stored;
    if (!ok) failed += 1;
    scenario.output_sha256 = stored;
    commits.add(commit);
    console.log(`${scenario.name}: integrity ${ok ? "PASS" : "FAIL"} ${stored}`);
  });

const check = python(["-m", "scenarios.run", "--check"]);
console.log(`scenarios.run --check: exit ${check.status}`);
console.log(`  ${check.stdout.trim().split(/\r?\n/).pop()}`);
if (check.status !== 0) failed += 1;

index.code_commit = [...commits].join(",");
for (const file of files) copyFileSync(file, join(repo, outDir, basename(file)));
rmSync(stage, { recursive: true, force: true });
console.log(`library sha256 ${index.library_sha256}\ncode commit ${index.code_commit}`);
writeFileSync(join(repo, outDir, "index.json"), JSON.stringify(index, null, 2) + "\n");

if (commits.size !== 1 || index.code_commit.includes("+dirty")) console.log("warning: receipts are not from one clean commit");
process.exit(failed === 0 ? 0 : 1);
