// B19 (DECISIONS 45): the fonts are self-hosted. No module imports next/font/google, and every face the
// layout names is a committed file with its family's OFL licence beside it.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { webRoot } from "./helpers";

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? sources(join(dir, e.name)) : /\.(tsx?|mjs|css)$/.test(e.name) ? [join(dir, e.name)] : []));
}

describe("fonts", () => {
  it("fonts are self-hosted", () => {
    const google = ["app", "components", "lib"].flatMap((d) => sources(join(webRoot, d))).filter((f) => /next\/font\/google|fonts\.googleapis|fonts\.gstatic/.test(readFileSync(f, "utf8")));
    expect(google).toEqual([]);
    const layout = readFileSync(join(webRoot, "app", "[locale]", "layout.tsx"), "utf8");
    expect(layout).toContain('from "next/font/local"');
    const files = [...layout.matchAll(/path: "\.\.\/fonts\/([^"]+)"/g)].map((m) => m[1]!);
    expect(files).toHaveLength(11);
    for (const file of files) expect(existsSync(join(webRoot, "app", "fonts", file))).toBe(true);
    for (const family of ["ibm-plex-sans", "ibm-plex-sans-arabic", "ibm-plex-sans-condensed", "ibm-plex-mono"]) {
      expect(readFileSync(join(webRoot, "app", "fonts", `OFL-${family}.txt`), "utf8")).toContain("SIL Open Font License");
    }
    for (const variable of ["--font-plex-sans", "--font-plex-arabic", "--font-plex-cond", "--font-plex-mono"]) expect(layout).toContain(`variable: "${variable}"`);
  });
});
