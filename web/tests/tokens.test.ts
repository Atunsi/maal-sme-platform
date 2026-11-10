// B17 (DECISIONS 45): components use theme tokens, not hex colours.
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { webRoot } from "./helpers";

/** The one exception: the logos take a colour prop, and on the indigo hero they are drawn in white. */
const LOGO_WHITE = /<(ArabicLogo|EnglishWordmark)\b[^>]*\bcolor="#ffffff"/g;

function tsxFiles(): string[] {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.name.endsWith(".tsx")) files.push(path);
    }
  };
  walk(join(webRoot, "components"));
  walk(join(webRoot, "app"));
  return files;
}

describe("colour tokens", () => {
  it("components use theme tokens, not hex colours", () => {
    const found: string[] = [];
    for (const file of tsxFiles()) {
      const code = readFileSync(file, "utf8").replace(LOGO_WHITE, "");
      for (const [hex] of code.matchAll(/#[0-9a-fA-F]{6}\b/g)) found.push(`${relative(webRoot, file)}: ${hex}`);
    }
    expect(found).toEqual([]);
  });

  it("every B17 token has a value in both themes", () => {
    const css = readFileSync(join(webRoot, "app", "globals.css"), "utf8");
    const block = (selector: string) => css.slice(css.indexOf(selector), css.indexOf("}", css.indexOf(selector)));
    for (const token of ["--gold-amount", "--gold-shadow", "--hero-ink", "--hero-muted", "--night", "--night-ink", "--night-rule", "--night-muted"]) {
      expect(block(":root,\n.th-light {").replace(/\r/g, "")).toContain(`${token}:`);
      expect(block(".th-dark {")).toContain(`${token}:`);
    }
  });
});
