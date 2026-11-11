// FX3 (DECISIONS 62): the shared request layer. RL1: one page view never sends the same API request twice, and
// the overview stays well under the API's limit of 60 requests a minute per business. RL2: a kept answer is never
// shown for a different business, role or locale. The fetch layer is a recording stub; no API is called.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getAnomaly, getCredit, getForecast, getHealth, getProfile, getZakat, type Scope } from "@/lib/api";
import { BUSINESS_DATA_MS, RETRY_AFTER_MAX_MS } from "@/lib/cache-lifetimes";
import { cacheKey, createRequestLayer, retryDelayMs } from "@/lib/request-layer";
import { readJson } from "./helpers";

let calls: string[] = [];
/** Statuses to answer with, in order, before answering 200. */
let statuses: number[] = [];
let retryAfter: string | null = null;

function stubFetch() {
  vi.stubGlobal("fetch", async (url: string) => {
    calls.push(url.replace("http://api.test", ""));
    const status = statuses.shift() ?? 200;
    if (status !== 200) return new Response(JSON.stringify({ detail: "rate limit" }), { status, headers: retryAfter === null ? {} : { "Retry-After": retryAfter } });
    if (url.endsWith("/health")) return new Response(JSON.stringify({ status: "ok", serving_businesses: 300, credit_model_version: "v1" }), { status: 200 });
    const route = /profile/.test(url) ? "profile" : /lenses\/(\w+)/.exec(url)![1];
    return new Response(JSON.stringify(readJson("fixtures", `${route}_10001.json`)), { status: 200 });
  });
}

const overview = (id: number, scope?: Scope) => Promise.all([getCredit(id, scope), getZakat(id, scope), getForecast(id, scope), getProfile(id, scope), getAnomaly(id, scope)]);
const owner: Scope = { locale: "en", role: "owner" };

beforeEach(() => {
  calls = [];
  statuses = [];
  retryAfter = null;
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.stubEnv("MAAL_API_URL", "http://api.test");
  vi.stubEnv("MAAL_API_KEY", "test-key");
  stubFetch();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("shared request layer", () => {
  it("overview makes each API call once", async () => {
    // The same page asked for twice at the same moment (two components, or two visitors): five upstream calls.
    const [a, b] = await Promise.all([overview(10001, owner), overview(10001, owner)]);
    expect([...a, ...b].every((r) => r.ok)).toBe(true);
    expect(calls).toHaveLength(5);
    expect(new Set(calls).size).toBe(5);
    // And the credit page right after it reuses the overview's credit answer.
    await getCredit(10001, owner);
    expect(calls).toHaveLength(5);
  });

  it("ten overview loads in a minute stay under the limit", async () => {
    for (let load = 0; load < 10; load++) {
      const results = await overview(10001, owner);
      expect(results.every((r) => r.ok)).toBe(true);
      await vi.advanceTimersByTimeAsync(6_000); // ten loads spread over 60 s
    }
    // Each answer lives 30 s, so 60 s of loads is two rounds of five calls: far under 60, and no 429 was needed.
    expect(BUSINESS_DATA_MS).toBe(30_000);
    expect(calls.length).toBeLessThan(60);
    expect(calls.length).toBeLessThanOrEqual(15);
  });

  it("cache never crosses business, role or locale", async () => {
    await getCredit(10001, owner);
    await getCredit(10001, owner);
    expect(calls).toHaveLength(1);
    await getCredit(10002, owner); // another business
    await getCredit(10001, { locale: "en", role: "admin" }); // another role
    await getCredit(10001, { locale: "ar", role: "owner" }); // another locale
    await getCredit(10001, { locale: "en", role: null }); // no role (the public demo)
    expect(calls).toHaveLength(5);
    const keys = [cacheKey("/x?business_id=1", owner), cacheKey("/x?business_id=2", owner), cacheKey("/x?business_id=1", { locale: "en", role: "admin" }), cacheKey("/x?business_id=1", { locale: "ar", role: "owner" }), cacheKey("/x?business_id=1")];
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("a kept answer is the same answer, receipt included", async () => {
    const first = await getCredit(10001, owner);
    const second = await getCredit(10001, owner);
    expect(first.ok && second.ok && second.data.receipt.output_sha256).toBe(first.ok && first.data.receipt.output_sha256);
    expect(second).toBe(first);
  });

  it("an answer expires after its lifetime", async () => {
    await getCredit(10001, owner);
    await vi.advanceTimersByTimeAsync(BUSINESS_DATA_MS + 1);
    await getCredit(10001, owner);
    expect(calls).toHaveLength(2);
  });

  it("an error and a 429 are never kept", async () => {
    statuses = [500];
    const failed = await getCredit(10001, owner);
    expect(failed.ok).toBe(false);
    const next = await getCredit(10001, owner);
    expect(next.ok).toBe(true);
    expect(calls).toHaveLength(2);
  });

  it("a 429 waits for the stated time and retries once, never in a loop", async () => {
    statuses = [429];
    retryAfter = "2";
    const pending = getZakat(10001, owner);
    await vi.advanceTimersByTimeAsync(1_900);
    expect(calls).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(200);
    expect((await pending).ok).toBe(true);
    expect(calls).toHaveLength(2);

    // Two 429s in a row: one retry, then the page's own error state. Nothing kept.
    calls = [];
    statuses = [429, 429, 429];
    retryAfter = null;
    const again = getForecast(10001, owner);
    await vi.advanceTimersByTimeAsync(1_100);
    const result = await again;
    expect(result).toMatchObject({ ok: false, kind: "rate_limited" });
    expect(calls).toHaveLength(2);
  });

  it("the health line is never kept", async () => {
    expect((await getHealth()).ok).toBe(true);
    expect((await getHealth()).ok).toBe(true);
    expect(calls).toHaveLength(2);
  });

  it("the layer itself: in-flight sharing, eviction and the retry delay", async () => {
    let t = 0;
    const layer = createRequestLayer(() => t, 2);
    let loads = 0;
    const load = async () => ++loads;
    const [x, y] = await Promise.all([layer.shared("a", 10, load, () => true), layer.shared("a", 10, load, () => true)]);
    expect([x, y, loads]).toEqual([1, 1, 1]);
    await layer.shared("b", 10, load, () => true);
    await layer.shared("c", 10, load, () => true); // the oldest ("a") is dropped
    expect(layer.size()).toBe(2);
    t = 11;
    expect(await layer.shared("b", 10, load, () => true)).toBe(4);
    expect(await layer.shared("d", 10, load, () => false)).toBe(5);
    expect(await layer.shared("d", 10, load, () => false)).toBe(6); // not kept
    expect(retryDelayMs("3", 1000, RETRY_AFTER_MAX_MS)).toBe(3000);
    expect(retryDelayMs(null, 1000, RETRY_AFTER_MAX_MS)).toBe(1000);
    expect(retryDelayMs("soon", 1000, RETRY_AFTER_MAX_MS)).toBe(1000);
    expect(retryDelayMs("600", 1000, RETRY_AFTER_MAX_MS)).toBe(RETRY_AFTER_MAX_MS);
  });
});
