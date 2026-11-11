// FX3 (DECISIONS 62): the shared request layer every server-side API read goes through.
//
// - A call already in flight for the same key is shared, not repeated (RL1).
// - A good answer is kept in the server's memory for a short time (lib/cache-lifetimes.ts). The API computes
//   every answer from a fixed store, so a kept answer is the same answer, receipt and hashes included (PR4).
// - The key holds the route (which names the business), the demo role and the locale, so an answer is never
//   shown for a different business, role or locale (RL2).
// - An error, a 429 included, is never kept.
//
// This is memory in the server process. It is not browser storage, sets no cookie, and nothing in it reaches
// the browser except through the page that asked for it. It has no "server-only" import so the tests can use it.
import { CACHE_MAX_ENTRIES } from "@/lib/cache-lifetimes";

/** Who is asking: part of the cache key (RL2). */
export type Scope = { role?: string | null; locale?: string | null };

export function cacheKey(path: string, scope?: Scope): string {
  return `${scope?.locale || "-"}|${scope?.role || "-"}|${path}`;
}

type Entry = { value: unknown; expires: number };

export function createRequestLayer(now: () => number = () => Date.now(), maxEntries: number = CACHE_MAX_ENTRIES) {
  const kept = new Map<string, Entry>();
  const inFlight = new Map<string, Promise<unknown>>();

  /**
   * The answer for `key`: a kept one if it is still fresh, the call already in flight if there is one, otherwise
   * `load()`. Only an answer `keep` accepts is kept.
   */
  function shared<T>(key: string, lifetimeMs: number, load: () => Promise<T>, keep: (value: T) => boolean): Promise<T> {
    const hit = kept.get(key);
    if (hit && hit.expires > now()) return Promise.resolve(hit.value as T);
    if (hit) kept.delete(key);
    const running = inFlight.get(key);
    if (running) return running as Promise<T>;
    const call = load().then(
      (value) => {
        inFlight.delete(key);
        if (keep(value)) {
          if (kept.size >= maxEntries) kept.delete(kept.keys().next().value as string);
          kept.set(key, { value, expires: now() + lifetimeMs });
        }
        return value;
      },
      (error: unknown) => {
        inFlight.delete(key);
        throw error;
      },
    );
    inFlight.set(key, call);
    return call;
  }

  return { shared, clear: () => (kept.clear(), inFlight.clear()), size: () => kept.size };
}

/** The one layer lib/api.ts uses. Tests clear it between cases (tests/setup.ts). */
export const apiLayer = createRequestLayer();

/** How long to wait before the one retry after a 429: what the API states, in seconds, or the default. */
export function retryDelayMs(retryAfter: string | null, fallbackMs: number, maxMs: number): number {
  const seconds = retryAfter === null ? Number.NaN : Number(retryAfter);
  const ms = Number.isFinite(seconds) && seconds >= 0 ? seconds * 1000 : fallbackMs;
  return Math.min(ms, maxMs);
}
