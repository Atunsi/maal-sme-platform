// Each page sends only the requests it needs, and each of those goes through the queue in lib/api.ts.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { webRoot } from "./helpers";

const route = (...path: string[]) => readFileSync(join(webRoot, "app", "[locale]", "business", "[id]", ...path, "page.tsx"), "utf8");
const fetchers = (source: string) => [...new Set(source.match(/\bget(Credit|Zakat|Forecast|Anomaly|Profile|Health)\b/g))].sort();

describe("page requests", () => {
  it.each([
    ["credit", "getCredit"],
    ["sharia", "getCredit"], // the Sharia screen arrives in the credit response
    ["zakat", "getZakat"],
    ["forecast", "getForecast"],
    ["review", "getAnomaly"],
  ])("the %s page fetches only %s", (page, fetcher) => {
    expect(fetchers(route(page))).toEqual([fetcher]);
  });

  it("the overview fetches what its readouts and profile need", () => {
    expect(fetchers(route())).toEqual(["getAnomaly", "getCredit", "getForecast", "getProfile", "getZakat"]);
  });

  it("the overview starts the slowest route last", () => {
    const body = route();
    expect(body.indexOf("= getAnomaly(id)")).toBeGreaterThan(body.indexOf("= getProfile(id)"));
  });

  it("no page reaches the API except through lib/api.ts", () => {
    for (const source of [route(), ...["credit", "sharia", "zakat", "forecast", "review"].map((page) => route(page))]) {
      expect(source).not.toMatch(/\bfetch\(/);
    }
  });
});
