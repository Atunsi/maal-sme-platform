// Guard 9: scenario objects (DECISIONS 41), and what the comparison may show.
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ScenarioCompare } from "@/components/ScenarioCompare";
import { formatRaw, formatSar } from "@/lib/format";
import { ScenarioIndex, ScenarioObject } from "@/lib/schemas";
import { ar, en, readJson, webRoot } from "./helpers";

const index = ScenarioIndex.parse(readJson("scenarios-data", "index.json"));
const load = (name: string) => ScenarioObject.parse(readJson("scenarios-data", `${name}.json`));
const baseline = load("baseline");

const HASHES = `
import json, sys
from pipeline.week8 import output_sha256
for path in sys.argv[1:]:
    print(output_sha256(json.load(open(path, encoding="utf-8"))))
`;

describe("scenario objects", () => {
  it("the menu holds the 8 library entries, each with an object that parses", () => {
    expect(index.scenarios).toHaveLength(8);
    for (const { name } of index.scenarios) expect(load(name).scenario.id).toBe(name);
  });

  it("every object's integrity hash matches its receipt, recomputed by the repo's own function", () => {
    const paths = index.scenarios.map(({ name }) => join("web", "scenarios-data", `${name}.json`));
    const run = spawnSync("python", ["-c", HASHES, ...paths], { cwd: join(webRoot, ".."), encoding: "utf8" });
    expect(run.stderr).toBe("");
    const computed = run.stdout.trim().split(/\r?\n/);
    expect(computed).toEqual(index.scenarios.map(({ name }) => load(name).receipt.output_sha256));
    expect(computed).toEqual(index.scenarios.map(({ output_sha256 }) => output_sha256));
  });

  it("every receipt names one clean commit and the library hash", () => {
    expect(index.code_commit).toMatch(/^[0-9a-f]{40}$/);
    for (const { name } of index.scenarios) {
      expect(load(name).receipt.code_commit).toBe(index.code_commit);
      expect(load(name).receipt.scenario_library_sha256).toBe(index.library_sha256);
    }
  });
});

describe("scenario comparison", () => {
  const compare = (name: string) => render(<ScenarioCompare baseline={baseline} chosen={load(name)} locale="en" m={en} />);

  it("shows both columns' values from the objects", () => {
    const chosen = load("severe_collapse");
    const { container } = compare("severe_collapse");
    const text = container.textContent!;
    expect(text).toContain(formatRaw(chosen.credit_decision_detail!.pd, "en"));
    expect(text).toContain(formatRaw(baseline.credit_decision_detail!.pd, "en"));
    expect(text).toContain(formatSar(baseline.credit!.amount_sar!, "en"));
    expect(text).toContain(formatSar(chosen.zakat!.liability_sar!, "en"));
  });

  it("U12 PD is labelled as model output", () => {
    compare("severe_collapse");
    expect(screen.getByText(en.scenarios.pd)).toBeTruthy();
    expect(en.scenarios.pd).toContain("model output");
  });

  it("U6 U7 U8 the Sharia label, the nisab badge and the review-queue line appear", () => {
    compare("severe_collapse");
    expect(screen.getByText(en.sharia.label)).toBeTruthy();
    expect(screen.getByText(en.zakat.placeholder)).toBeTruthy();
    expect(screen.getByText(en.anomaly.queue)).toBeTruthy();
  });

  it("U10 the thin-file newcomer is refused, with the Sharia status still shown", () => {
    const { container } = compare("thin_file_newcomer");
    expect(screen.getByText(en.refusal.body)).toBeTruthy();
    expect(container.textContent).toContain(en.enums.sharia.compliant);
  });

  it("U13 each receipt has its verbatim scope and the UI note under it", () => {
    compare("severe_collapse");
    expect(screen.getAllByText(baseline.receipt.scope!)).toHaveLength(2);
    expect(screen.getAllByText(en.scenarios.receiptNote)).toHaveLength(2);
  });

  it("U8 no scenario id or wording says fraud", () => {
    const { container } = compare("fraud_pattern");
    expect(container.textContent!.replaceAll(baseline.receipt.scope!, "")).not.toMatch(/fraud|score/i);
  });
});

describe("What these show panel", () => {
  it("U12 states the four entry 29 findings in both languages", () => {
    expect(en.scenarios.findings).toHaveLength(4);
    expect(ar.scenarios.findings).toHaveLength(4);
  });

  it("U12 quotes no number, and carries the N = 1 caveat", () => {
    for (const m of [en, ar]) {
      expect(m.scenarios.findings.join(" ")).not.toMatch(/\d/);
      expect(m.scenarios.caveat).toContain("N = 1");
    }
  });
});
