// The online demo snapshot (MAAL_STATIC=1, next.config.ts): API responses captured once by
// scripts/capture-static.mjs into web/static-data/, read here at build time in place of the API. A static
// host (GitHub Pages) can serve no Python, so the snapshot holds a fixed set of serving businesses and the
// library scenarios; anything that needs the live engine (a custom scenario) says so instead of running.
import "server-only";

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const STATIC = process.env.MAAL_STATIC === "1";

const DIR = join(process.cwd(), "static-data");

/** The file a captured API path was saved to: the path with every run of other characters as "_". */
export function snapshotFile(path: string): string {
  return `${path.replace(/^\//, "").replace(/[^a-zA-Z0-9]+/g, "_")}.json`;
}

/** The captured response for an API path, or undefined when that path was not captured. */
export function staticJson(path: string): unknown {
  const file = join(DIR, snapshotFile(path));
  return existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : undefined;
}

/**
 * A page's query string, read on the live server. A snapshot page is one file for every query, so it reads
 * none (and so never waits on the request); what must follow the query there is read in the browser.
 */
export async function searchOf<T extends object>(searchParams: Promise<T>): Promise<Partial<T>> {
  return STATIC ? {} : await searchParams;
}

type Listed = { business_id: number; sector: string };

/** The captured businesses, in ID order: the only ones the snapshot has pages for. */
export function staticBusinesses(): Listed[] {
  return (staticJson("/businesses-snapshot") as Listed[] | undefined) ?? [];
}

export function staticIds(): number[] {
  return staticBusinesses().map((b) => b.business_id);
}
