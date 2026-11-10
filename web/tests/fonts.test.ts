// B19 (DECISIONS 45): the fonts are self-hosted. No module imports next/font/google, and every face the
// layout names is a committed file with its family's OFL licence beside it.
import { createHash } from "node:crypto";
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
    expect(files).toHaveLength(13); // 11 IBM Plex faces and the two riyal faces (DECISIONS 57)
    for (const file of files) expect(existsSync(join(webRoot, "app", "fonts", file))).toBe(true);
    for (const family of ["ibm-plex-sans", "ibm-plex-sans-arabic", "ibm-plex-sans-condensed", "ibm-plex-mono"]) {
      expect(readFileSync(join(webRoot, "app", "fonts", `OFL-${family}.txt`), "utf8")).toContain("SIL Open Font License");
    }
    for (const variable of ["--font-plex-sans", "--font-plex-arabic", "--font-plex-cond", "--font-plex-mono"]) expect(layout).toContain(`variable: "${variable}"`);
  });

  // RS3 (DECISIONS 57): the riyal sign's font is the riyal npm package v1.2.1's own two files, pinned by hash,
  // with its MIT licence beside them, loaded locally and only for U+20C1. No package, no CDN.
  it("riyal font is self-hosted and renders", () => {
    const pinned: Record<string, string> = {
      "riyal-regular.woff2": "5064e10494f7029ac8db7d06362d5a1b6e61b6f39a35c8bd433f91a0e9abb894",
      "riyal-bold.woff2": "8059c13e4803e4720a76aa00169935b4392adaf8a9efdccec7fcd7990ebe8866",
      "MIT-riyal.txt": "434faf345e2f45c436ca5af8c006a12aa23430f6481d66384e9ce6a40f1cd773",
    };
    for (const [file, sha] of Object.entries(pinned)) {
      const bytes = readFileSync(join(webRoot, "app", "fonts", file));
      expect(createHash("sha256").update(bytes).digest("hex"), file).toBe(sha);
    }
    expect(readFileSync(join(webRoot, "app", "fonts", "MIT-riyal.txt"), "utf8")).toContain("Pooya Golchian");
    const layout = readFileSync(join(webRoot, "app", "[locale]", "layout.tsx"), "utf8");
    expect(layout).toContain('variable: "--font-riyal"');
    expect(layout).toContain('{ prop: "unicode-range", value: "U+20C1" }');
    expect(layout).toMatch(/--font-riyal"[\s\S]*?adjustFontFallback: false/);
    const pkg = JSON.parse(readFileSync(join(webRoot, "package.json"), "utf8"));
    expect(Object.keys({ ...pkg.dependencies, ...pkg.devDependencies })).not.toContain("riyal");
    const cdn = ["app", "components", "lib"].flatMap((d) => sources(join(webRoot, d))).filter((f) => /riyal\.js\.org|cdn\.jsdelivr|unpkg\.com|cdnjs/.test(readFileSync(f, "utf8")));
    expect(cdn).toEqual([]);
    const css = readFileSync(join(webRoot, "app", "globals.css"), "utf8");
    for (const stack of ["--font-sans:", "--font-cond:", "--font-mono:"]) expect(css).toContain(`${stack} var(--font-riyal),`);
  });
});
