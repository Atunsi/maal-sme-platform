// Guard 3: the API key cannot reach the browser. Run `npm run build` first; this reads its output.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { webRoot } from "./helpers";

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

function devKey(): string {
  const line = readFileSync(join(webRoot, ".env.local"), "utf8")
    .split(/\r?\n/)
    .find((l) => l.startsWith("MAAL_API_KEY="));
  return line!.slice("MAAL_API_KEY=".length);
}

const SOURCE_DIRS = ["app", "components", "lib"];
const sources = SOURCE_DIRS.flatMap((dir) => walk(join(webRoot, dir))).filter((file) => /\.tsx?$/.test(file));

function resolveImport(from: string, spec: string): string | null {
  const base = spec.startsWith("@/") ? join(webRoot, spec.slice(2)) : spec.startsWith(".") ? join(dirname(from), spec) : null;
  if (!base) return null;
  return [`${base}.ts`, `${base}.tsx`].find(existsSync) ?? null;
}

/** Every module a client component pulls in. `import type` is erased, so it does not count. */
function clientGraph(): Set<string> {
  const seen = new Set<string>();
  const todo = sources.filter((file) => /^["']use client["']/.test(readFileSync(file, "utf8")));
  while (todo.length) {
    const file = todo.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    const text = readFileSync(file, "utf8");
    // A "use server" module (app/actions.ts, DECISIONS 45) is the server-action boundary: Next sends the
    // browser a reference to call, never the module's code, so its imports stay on the server.
    if (/^["']use server["']/.test(text)) continue;
    for (const match of text.matchAll(/^import (?!type )[^;]*?from ["']([^"']+)["']/gm)) {
      const target = resolveImport(file, match[1]!);
      if (target) todo.push(target);
    }
  }
  return seen;
}

describe("key-leak guard", () => {
  it("the build output exists", () => {
    expect(existsSync(join(webRoot, ".next", "static"))).toBe(true);
  });

  it("nothing under .next/static holds the variable name or the dev key", () => {
    const key = devKey();
    expect(key.length).toBeGreaterThan(10);
    const leaks = walk(join(webRoot, ".next", "static")).filter((file) => {
      const text = readFileSync(file, "latin1");
      return text.includes("MAAL_API_KEY") || text.includes(key);
    });
    expect(leaks).toEqual([]);
  });

  it("no client module imports lib/api or lib/scenarios, directly or through another module", () => {
    const graph = [...clientGraph()].map((file) => relative(webRoot, file).replaceAll("\\", "/"));
    expect(graph.length).toBeGreaterThan(5);
    expect(graph.filter((file) => file === "lib/api.ts" || file === "lib/scenarios.ts")).toEqual([]);
  });

  it("every server action module the client reaches is marked use server", () => {
    const actions = [...clientGraph()].filter((file) => readFileSync(file, "utf8").includes("@/lib/api"));
    for (const file of actions) expect(readFileSync(file, "utf8")).toMatch(/^"use server";/);
  });

  it("lib/api.ts is marked server-only", () => {
    expect(readFileSync(join(webRoot, "lib", "api.ts"), "utf8")).toMatch(/^import "server-only";/m);
  });

  it("no NEXT_PUBLIC_ variable exists", () => {
    expect(sources.filter((file) => readFileSync(file, "utf8").includes("NEXT_PUBLIC_"))).toEqual([]);
  });

  it("lens results are never cached", () => {
    expect(readFileSync(join(webRoot, "lib", "api.ts"), "utf8")).toContain('cache: "no-store"');
  });
});
