// Builds the online demo snapshot into web/out/, ready for GitHub Pages: the static export (MAAL_STATIC=1,
// next.config.ts) over the captured API responses (scripts/capture-static.mjs), plus what a static host
// needs that Next.js does not write. From web/:
//
//   node scripts/build-static.mjs /<repository-name>
//
// The argument is the Pages path, the repository's name after the account's github.io address.
import { execSync } from "node:child_process";
import { copyFileSync, cpSync, existsSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

const base = process.argv[2] ?? "";
if (base && !/^\/[A-Za-z0-9._-]+$/.test(base)) throw new Error(`Pages path must look like /repo-name, got "${base}"`);
if (!existsSync("static-data/businesses_snapshot.json")) throw new Error("No snapshot: run scripts/capture-static.mjs first.");

// The business pages' param list exists only for this build (scripts/static-only/business-id-layout.tsx).
const LAYOUT = "app/[locale]/business/[id]/layout.tsx";
copyFileSync("scripts/static-only/business-id-layout.tsx", LAYOUT);
try {
  execSync("npx next build", { stdio: "inherit", env: { ...process.env, MAAL_STATIC: "1", MAAL_BASE_PATH: base, MSYS_NO_PATHCONV: "1" } });
} finally {
  rmSync(LAYOUT, { force: true });
  // The build also rewrote .next/types for that layout; regenerate the live app's, or `npm run typecheck` fails.
  execSync("npx next typegen", { stdio: "ignore" });
}

// With distDir set (next.config.ts), the export lands in .next-static/; the site is assembled in out/.
// Empty out/ rather than delete it: on Windows a folder some shell is standing in cannot be removed.
if (existsSync("out")) for (const name of readdirSync("out")) rmSync(join("out", name), { recursive: true, force: true });
cpSync(".next-static", "out", { recursive: true });

// The browser-side stand-ins for the server actions (lib/static-actions.ts) read the snapshot from here.
cpSync("static-data", "out/static-data", { recursive: true });

// CSS url()s are not given the base path by Next.js: the logo tiles would load from the account's root.
const walk = (dir) => readdirSync(dir).flatMap((name) => (statSync(join(dir, name)).isDirectory() ? walk(join(dir, name)) : [join(dir, name)]));
const walkDirs = (dir) => readdirSync(dir).filter((name) => statSync(join(dir, name)).isDirectory()).flatMap((name) => [join(dir, name), ...walkDirs(join(dir, name))]);
let rewritten = 0;
for (const file of walk("out/_next").filter((f) => f.endsWith(".css"))) {
  const css = readFileSync(file, "utf8");
  const next = css.replaceAll('url("/brand/', `url("${base}/brand/`).replaceAll("url(/brand/", `url(${base}/brand/`);
  if (next === css) continue;
  writeFileSync(file, next);
  rewritten++;
}

// Prefetch segments: the export nests them (__next.$d$locale/business/$d$id/__PAGE__.txt) but the client asks
// for one flat name (__next.$d$locale.business.$d$id.__PAGE__.txt). Without a flat copy every prefetch is a
// 404 and each tap falls back to a full page load.
let flattened = 0;
for (const dir of walkDirs("out").filter((d) => /[\\/]__next\.[^\\/]*$/.test(d) && !/[\\/]__next\.[^\\/]*[\\/]/.test(d.slice(4)))) {
  const parent = dir.slice(0, dir.lastIndexOf(sep));
  const name = dir.slice(dir.lastIndexOf(sep) + 1);
  for (const file of walk(dir)) {
    const flat = `${name}.${relative(dir, file).split(sep).join(".")}`;
    copyFileSync(file, join(parent, flat));
    flattened++;
  }
}

// The bare address opens the English pages (the live app's redirect, which a static host cannot run).
writeFileSync(
  "out/index.html",
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Ma'al</title><meta http-equiv="refresh" content="0; url=${base}/en/"><link rel="canonical" href="${base}/en/"></head><body><a href="${base}/en/">Ma'al</a></body></html>\n`,
);
// GitHub Pages runs Jekyll by default, which drops folders that start with "_" (Next.js's _next/).
writeFileSync("out/.nojekyll", "");

const pages = walk("out").filter((f) => f.endsWith(".html")).length;
console.log(`\nstatic site in web/out/: ${pages} pages, base path "${base || "/"}", ${rewritten} stylesheet(s) re-pathed, ${flattened} prefetch file(s) flattened`);
