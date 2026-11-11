// DECISIONS 60: the motion rules that can be checked in the source (MO1, MO2, MO5, MO8 and the stylesheet hygiene).
// The browser checks are in e2e/polish.spec.ts. R6 (the entrance cap) stays in tests/motion.test.ts, unchanged.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { webRoot } from "./helpers";

const css = ["globals.css", "phone.css"].map((f) => readFileSync(join(webRoot, "app", f), "utf8")).join("\n");

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? sources(join(dir, e.name)) : /\.(tsx?|css)$/.test(e.name) ? [join(dir, e.name)] : [],
  );
}
const code = ["app", "components", "lib"].flatMap((d) => sources(join(webRoot, d))).map((f) => [f, readFileSync(f, "utf8")] as const);

/** Every @keyframes block: its name and body. */
function keyframes(): Map<string, string> {
  const out = new Map<string, string>();
  for (const m of css.matchAll(/@keyframes ([\w-]+) \{([\s\S]*?)\n\}/g)) out.set(m[1]!, m[2]!);
  return out;
}

// MO5: the infinite animations found in Phase A; nothing may be added to this list without a DECISIONS entry.
const LOOPS = ["breathe", "pulse", "travel", "float"];

describe("motion in the source", () => {
  it("no number tween in the code", () => {
    // MO1: amounts render once. No count-up helper, no animated CSS counter, no tween of a displayed number.
    const tween = /countUp|count-up|animateNumber|tweenNumber|useCountUp|@property\s+--num|counter-increment[^;]*var\(--/i;
    expect(code.filter(([, text]) => tween.test(text)).map(([f]) => f)).toEqual([]);
  });

  it("scroll reveals never hide content", () => {
    // MO2: every keyframes block driven by a scroll or view timeline moves things; it never hides them.
    const timed = [...css.matchAll(/animation:\s*([\w-]+)[^;]*;[^}]*animation-timeline:\s*(?!auto)[\w(]/g)].map((m) => m[1]!);
    expect(timed.sort()).toEqual(["drift", "header-brand", "header-condense"]);
    const frames = keyframes();
    for (const name of timed) expect(frames.get(name), name).not.toMatch(/opacity|visibility|clip-path|display/);
    expect(frames.get("drift")).toMatch(/translateY\(16px\)/);
  });

  it("no new infinite animations", () => {
    const infinite = [...css.matchAll(/animation:\s*([\w-]+)[^;]*\binfinite\b/g)].map((m) => m[1]!);
    expect([...new Set(infinite)].sort()).toEqual([...LOOPS].sort());
  });

  it("every keyframes block is used", () => {
    const used = (name: string) =>
      new RegExp(`animation(-name)?:[^;]*\\b${name}\\b`).test(css) || code.some(([, text]) => new RegExp(`animation(Name)?:[^;,}]*\\b${name}\\b`).test(text));
    expect([...keyframes().keys()].filter((name) => !used(name))).toEqual([]);
  });

  it("no transition all in the stylesheet", () => {
    expect(css).not.toMatch(/transition:\s*all\b/);
    expect(code.filter(([, text]) => /\btransition-all\b|transition:\s*["']?all\b/.test(text)).map(([f]) => f)).toEqual([]);
  });

  it("hover styles sit inside (hover: hover) and never on plates or static cards", () => {
    // MT3, MO8: walk the stylesheet keeping track of @media (hover: hover) blocks.
    const outside: string[] = [];
    const static_: string[] = [];
    let depth = 0;
    const stack: boolean[] = [];
    for (const line of css.split("\n")) {
      const opens = (line.match(/\{/g) ?? []).length;
      const closes = (line.match(/\}/g) ?? []).length;
      if (line.includes(":hover")) {
        if (!stack.includes(true)) outside.push(line.trim());
        if (/\.plate\b|\.bg-card\b|\.heading\b|\bh[1-6]\b/.test(line.split(":hover")[0]!)) static_.push(line.trim());
      }
      for (let i = 0; i < opens; i++) stack.push(/@media \(hover: hover\)/.test(line));
      for (let i = 0; i < closes; i++) stack.pop();
      depth += opens - closes;
    }
    expect(depth).toBe(0);
    expect(outside).toEqual([]);
    expect(static_).toEqual([]);
  });

  it("one reduced-motion block stops every animation and transition, page and theme transitions included", () => {
    // MO3: the global block covers elements; view transition pseudo-elements need their own rule.
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\) \{\s*\*,\s*\*::before,\s*\*::after \{\s*animation: none !important;\s*transition: none !important;/);
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\) \{\s*::view-transition-group\(\*\),\s*::view-transition-old\(\*\),\s*::view-transition-new\(\*\) \{\s*animation: none !important;/);
  });
});
