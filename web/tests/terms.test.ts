// TB1 (DECISIONS 63): one component renders the glossary term button, and no stylesheet gives it a second look.
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

describe("term buttons (TB1)", () => {
  it("only one term button class exists", () => {
    // The class "term" on its own, not term-wrap or term-tip.
    const uses = [...files(join(webRoot, "components"), /\.tsx$/), ...files(join(webRoot, "app"), /\.tsx$/)].filter((file) =>
      /className=(["'`])(?:[^"'`]*\s)?term(?:\s[^"'`]*)?\1/.test(readFileSync(file, "utf8")),
    );
    expect(uses.map((f) => relative(webRoot, f).replaceAll("\\", "/"))).toEqual(["components/Term.tsx"]);
  });

  it("the term background comes from the term tokens only", () => {
    const sheets = files(join(webRoot, "app"), /\.css$/);
    const found: string[] = [];
    for (const sheet of sheets) {
      const css = readFileSync(sheet, "utf8");
      // Every rule whose selector names .term (not .term-wrap or .term-tip) and sets a background.
      for (const [, selector, body] of css.matchAll(/([^{}]*\.term(?![\w-])[^{}]*)\{([^{}]*)\}/g)) {
        for (const [, value] of body!.matchAll(/background(?:-color)?\s*:\s*([^;]+);/g)) {
          if (!/^var\(--term-bg(?:-active)?\)$|^none(?:\s*!important)?$/.test(value!.trim())) found.push(`${relative(webRoot, sheet)} ${selector!.trim()}: ${value}`);
        }
      }
    }
    expect(found).toEqual([]);
  });
});
