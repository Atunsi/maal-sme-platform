// Guard 8: the workaround for the api/store.py bug. At most one API request in flight, ever.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getAnomaly, getCredit, getForecast, getProfile, getZakat } from "@/lib/api";
import { readJson } from "./helpers";

let inFlight = 0;
let peak = 0;
let started: string[] = [];

function stubFetch(fail: (url: string) => boolean = () => false) {
  vi.stubGlobal("fetch", async (url: string) => {
    started.push(url);
    inFlight += 1;
    peak = Math.max(peak, inFlight);
    await new Promise((resolve) => setTimeout(resolve, 5));
    inFlight -= 1;
    if (fail(url)) throw new Error("connection refused");
    const route = /profile/.test(url) ? "profile" : /lenses\/(\w+)/.exec(url)![1];
    return new Response(JSON.stringify(readJson("fixtures", `${route}_10001.json`)), { status: 200 });
  });
}

beforeEach(() => {
  inFlight = 0;
  peak = 0;
  started = [];
  vi.stubEnv("MAAL_API_URL", "http://api.test");
  vi.stubEnv("MAAL_API_KEY", "test-key");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("request queue", () => {
  const dashboard = (id = 10001) => [getProfile(id), getCredit(id), getZakat(id), getForecast(id), getAnomaly(id)];

  it("never has more than one request in flight for one dashboard", async () => {
    stubFetch();
    const results = await Promise.all(dashboard());
    expect(results.every((r) => r.ok)).toBe(true);
    expect(peak).toBe(1);
  });

  it("never has more than one in flight across concurrent visitors", async () => {
    stubFetch();
    // Three visitors on three businesses: the request layer (FX3) shares identical reads, so identical dashboards
    // would be 5 requests. Different businesses keep this at 15 requests through the one queue.
    await Promise.all([...dashboard(10001), ...dashboard(10002), ...dashboard(10004)]);
    expect(started).toHaveLength(15);
    expect(peak).toBe(1);
  });

  it("runs the anomaly route last, so the slowest lens delays no other card", async () => {
    stubFetch();
    await Promise.all(dashboard());
    expect(started.at(-1)).toContain("/lenses/anomaly");
  });

  it("a failed request gives its own error and does not stop the queue", async () => {
    stubFetch((url) => url.includes("credit"));
    const [profile, credit, zakat] = await Promise.all(dashboard());
    expect(profile?.ok).toBe(true);
    expect(credit).toMatchObject({ ok: false, kind: "network" });
    expect(zakat?.ok).toBe(true);
    expect(peak).toBe(1);
  });
});
