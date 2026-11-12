// TT1 (DECISIONS 64): one component renders the glossary term, the button stays plain, and only the term tip
// carries the tint, from its one token.
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { webRoot } from "./helpers";

function files(dir: string, ext: RegExp): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...files(path, ext));
    else if (ext.test(entry.name)) out.push(path);
  }
  return out;
}

const rules = (pattern: RegExp) => {
  const out: { sheet: string; selector: string; body: string }[] = [];
  for (const sheet of files(join(webRoot, "app"), /\.css$/)) {
    for (const [, selector, body] of readFileSync(sheet, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/([^{}]*)\{([^{}]*)\}/g)) {
      if (pattern.test(selector!)) out.push({ sheet: relative(webRoot, sheet).replaceAll("\\", "/"), selector: selector!.trim(), body: body! });
    }
  }
  return out;
};

describe("term tips (TT1)", () => {
  it("only one term component exists", () => {
    const uses = [...files(join(webRoot, "components"), /\.tsx$/), ...files(join(webRoot, "app"), /\.tsx$/)].filter((file) =>
      /className=(["'`])(?:[^"'`]*\s)?term(?:\s[^"'`]*)?\1/.test(readFileSync(file, "utf8")),
    );
    expect(uses.map((f) => relative(webRoot, f).replaceAll("\\", "/"))).toEqual(["components/Term.tsx"]);
  });

  it("the term button has no background but none", () => {
    const found = rules(/\.term(?![\w-])/)
      .flatMap(({ sheet, selector, body }) => [...body.matchAll(/background(?:-color|-image)?\s*:\s*([^;]+);/g)].map(([, v]) => ({ sheet, selector, v: v!.trim() })))
      .filter(({ v }) => v !== "none")
      .map(({ sheet, selector, v }) => `${sheet} ${selector}: ${v}`);
    expect(found).toEqual([]);
  });

  it("the tip's tint comes from the tip token only", () => {
    const found = rules(/\.term-tip(?![\w-])/)
      .flatMap(({ sheet, selector, body }) => [...body.matchAll(/background-image\s*:\s*([^;]+);/g)].map(([, v]) => `${sheet} ${selector}: ${v!.trim()}`));
    expect(found).toEqual(["app/globals.css .term-wrap > .term-tip: linear-gradient(var(--term-tip-tint), var(--term-tip-tint))"]);
  });
});
