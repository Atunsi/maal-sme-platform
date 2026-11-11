// IN3 (DECISIONS 62): change over time.
// TR1: the trend shows only real periods; a missing period is absent, not estimated.
import { fireEvent, render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MIN_TREND_POINTS, Trends } from "@/components/Trends";
import { formatDate, formatSar } from "@/lib/format";
import { HistoryResponse, ProfileResponse } from "@/lib/schemas";
import type { HistoryResponse as History } from "@/lib/types";
import { ar, en, fixture, webRoot } from "./helpers";

const METRICS = ["avg_monthly_inflow", "inflow_outflow_ratio", "avg_daily_balance", "cash_flow_volatility"];
const history = (id: number) => fixture(`history_${id}`, HistoryResponse);
const ok = (data: History) => Promise.resolve({ ok: true as const, data });

async function show(data: History, locale: "en" | "ar" = "en") {
  return render(await Trends({ result: ok(data), locale, m: locale === "en" ? en : ar }));
}

describe("change over time", () => {
  it("trend shows no value the API did not return", async () => {
    const data = history(10001);
    const { container } = await show(data);
    expect(data.history!.points).toHaveLength(4);
    for (const metric of METRICS) {
      const row = container.querySelector(`[data-trend="${metric}"]`)!;
      const returned = data.history!.points.map((p) => [p.as_of, p.metrics[metric]] as const);
      // One mark per returned value, at that value, and nothing else.
      const marks = [...row.querySelectorAll("[data-trend-point]")].map((b) => [b.getAttribute("data-trend-point"), Number(b.getAttribute("data-value"))] as const);
      expect(marks, metric).toEqual(returned);
      expect(row.querySelectorAll("[data-trend-segment]")).toHaveLength(returned.length - 1);
    }

    // A date the API gave no value for: no mark, no table row, and the line does not join across it.
    const gap = structuredClone(data);
    delete gap.history!.points[1]!.metrics.avg_daily_balance;
    const gapped = (await show(gap)).container.querySelectorAll(`[data-trend="avg_daily_balance"]`);
    const row = gapped[gapped.length - 1]!;
    const dates = [...row.querySelectorAll("[data-trend-point]")].map((b) => b.getAttribute("data-trend-point"));
    expect(dates).toEqual([data.history!.points[0]!.as_of, data.history!.points[2]!.as_of, data.history!.points[3]!.as_of]);
    expect(row.querySelectorAll("[data-trend-segment]")).toHaveLength(1); // only the two dates one step apart
    expect([...row.querySelectorAll("[data-trend-row]")].map((r) => r.getAttribute("data-trend-row"))).toEqual(dates);
    // The other figures still show all four.
    expect(row.parentElement!.querySelectorAll(`[data-trend="avg_monthly_inflow"] [data-trend-point]`)).toHaveLength(4);
  });

  it("latest trend value equals the current value", async () => {
    const data = history(10001);
    const profile = fixture("profile_10001", ProfileResponse);
    const last = data.history!.points.at(-1)!;
    expect(last.as_of).toBe(profile.as_of);
    for (const metric of METRICS) expect(last.metrics[metric], metric).toBe(profile.features[metric]);
    const { container } = await show(data);
    const current = container.querySelector(`[data-trend="avg_monthly_inflow"] [data-trend-current]`)!.textContent!;
    expect(current).toContain(formatSar(Number(profile.features.avg_monthly_inflow), "en").replace(/^\S+\s/, ""));
    // The sentence quotes the API's two values and a direction word; no difference is worked out.
    const change = container.querySelector(`[data-trend="avg_monthly_inflow"] [data-trend-change]`)!;
    const previous = data.history!.points.at(-2)!;
    expect(change.getAttribute("data-trend-change")).toBe(last.metrics.avg_monthly_inflow! > previous.metrics.avg_monthly_inflow! ? "up" : "down");
    expect(change.textContent).toContain(`since ${formatDate(previous.as_of, "en")}`);
    expect(change.textContent).toContain(formatSar(previous.metrics.avg_monthly_inflow!, "en").replace(/^\S+\s/, ""));
    expect(change.textContent).not.toMatch(/%|about|roughly/i);
  });

  it("trend has a table equivalent", async () => {
    const data = history(10001);
    const { container } = await show(data);
    for (const metric of METRICS) {
      const row = container.querySelector(`[data-trend="${metric}"]`)!;
      const table = row.querySelector("[data-trend-table] table")!;
      expect(table.querySelector("caption")!.textContent).toBe((en.trend.metrics as Record<string, string>)[metric]);
      expect([...table.querySelectorAll("th")].map((th) => th.textContent)).toEqual(["As of", "Value"]);
      const rows = [...table.querySelectorAll("tbody tr")];
      expect(rows.map((r) => r.getAttribute("data-trend-row"))).toEqual(data.history!.points.map((p) => p.as_of));
      expect(rows.map((r) => r.children[0]!.textContent)).toEqual(data.history!.points.map((p) => formatDate(p.as_of, "en")));
      // Each mark's name carries the same date as its table row, and a readout shows on focus.
      const marks = [...row.querySelectorAll("[data-trend-point]")];
      marks.forEach((mark, i) => expect(mark.getAttribute("aria-label")).toContain(formatDate(data.history!.points[i]!.as_of, "en")));
      expect(row.querySelector("[data-trend-readout]")!.textContent).toBe("");
      fireEvent.focus(marks[0]!);
      expect(row.querySelector("[data-trend-readout]")!.textContent).toContain(formatDate(data.history!.points[0]!.as_of, "en"));
      fireEvent.blur(marks[0]!);
      expect(row.querySelector("[data-trend-readout]")!.textContent).toBe("");
    }
    // Time runs left to right in Arabic too.
    const arabic = await show(data, "ar");
    expect(arabic.container.querySelector("[data-trend-line]")!.getAttribute("dir")).toBe("ltr");
    expect(arabic.container.querySelector("[data-trends] h2")!.textContent).toBe(ar.trend.title);
  });

  it("short history shows the sentence", async () => {
    expect(MIN_TREND_POINTS).toBe(3);
    // Two dates: the current value and the sentence, no line and no "since".
    const two = await show(history(10032));
    expect(history(10032).history!.points).toHaveLength(2);
    for (const metric of METRICS) {
      const row = two.container.querySelector(`[data-trend="${metric}"]`)!;
      expect(row.querySelector("[data-trend-short]")!.textContent).toBe("Not enough history yet to show a trend");
      expect(row.querySelector("[data-trend-line]")).toBeNull();
      expect(row.querySelector("[data-trend-change]")).toBeNull();
      expect(row.querySelector("[data-trend-current]")).not.toBeNull();
    }
    // Three dates is enough.
    const three = await show(history(10014));
    expect(three.container.querySelectorAll("[data-trend-line]")).toHaveLength(METRICS.length);
    // No date at all: the block holds only the sentence.
    const none = await show(history(10005));
    expect(history(10005).history!.points).toHaveLength(0);
    expect(none.container.querySelector("[data-trends] [data-trend-short]")!.textContent).toBe("Not enough history yet to show a trend");
    expect(none.container.querySelector("[data-trend]")).toBeNull();
    // Refused as insufficient data: no block.
    const refused = await show(history(10003));
    expect(refused.container.querySelector("[data-trends]")).toBeNull();
  });

  it("the trend draws nothing through values and compares with no other business", async () => {
    // MO1: no draw animation, no tween; the dot's own entrance is switched off here.
    const line = readFileSync(join(webRoot, "components", "TrendLine.tsx"), "utf8");
    expect(line).not.toMatch(/stroke-dash|strokeDash|requestAnimationFrame|setInterval|frame-path|bar-grow/);
    expect(line).toContain('animation: "none"');
    // U9, schema §36.4: a business beside its own past only.
    const { container } = await show(history(10001));
    const text = container.textContent!;
    expect(text).toContain("is not compared with any other business");
    expect(text).not.toMatch(/similar businesses|peers?\b|percentile|sector average|than most/i);
    for (const file of ["Trends.tsx", "TrendLine.tsx"]) expect(readFileSync(join(webRoot, "components", file), "utf8")).not.toMatch(/p25|p50|p75|percentile/);
    expect(ar.trend.intro).toContain("ولا يُقارَن بأي منشأة أخرى");
  });
});
