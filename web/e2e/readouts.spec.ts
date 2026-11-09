// E5: chart readouts on hover, keyboard and tap, and the cash-floor label (DECISIONS 43).
import { expect, test, type Page } from "@playwright/test";
import { apiEnv } from "./helpers";

async function forecastOf(id: number) {
  const { MAAL_API_URL, MAAL_API_KEY } = apiEnv();
  const res = await fetch(`${MAAL_API_URL}/lenses/forecast?business_id=${id}`, { headers: { "X-API-Key": MAAL_API_KEY } });
  return (await res.json()) as {
    forecast: { balance_today_sar: number; model: { horizon_days: number; projected_balance_sar: number }[]; naive_baseline: { horizon_days: number; projected_balance_sar: number }[] };
  };
}

const sar = (v: number) => new Intl.NumberFormat("en-GB-u-nu-latn", { style: "currency", currency: "SAR", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);

test("forecast readout follows keyboard and matches the table", async ({ page }) => {
  const { forecast } = await forecastOf(10001);
  await page.goto("/en/business/10001/forecast", { waitUntil: "networkidle" });
  const chart = page.locator("[data-forecast-chart]");
  await chart.focus();
  await page.keyboard.press("Home");
  const readout = page.locator("[data-readout]");
  await expect(readout).toContainText("today");
  await expect(readout).toContainText(sar(forecast.balance_today_sar));
  for (const row of forecast.model) {
    await page.keyboard.press("ArrowRight");
    await expect(readout).toContainText(`Day ${row.horizon_days}`);
    await expect(readout).toContainText(sar(row.projected_balance_sar));
    const naive = forecast.naive_baseline.find((b) => b.horizon_days === row.horizon_days)!;
    await expect(readout).toContainText(sar(naive.projected_balance_sar));
    await expect(page.locator("table").first()).toContainText(sar(row.projected_balance_sar));
  }
  await page.keyboard.press("Home");
  await expect(readout).toContainText("today");
  await page.keyboard.press("End");
  await expect(readout).toContainText(`Day ${forecast.model.at(-1)!.horizon_days}`);
  await expect(page.getByRole("status").filter({ hasText: `Day ${forecast.model.at(-1)!.horizon_days}` })).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(readout).toHaveCount(0);
});

// Spread over the demo businesses: the API allows 60 requests a minute per business, and specs run in parallel.
test("forecast readout follows the pointer and hides on a tap elsewhere", async ({ page }) => {
  await page.goto("/en/business/10004/forecast", { waitUntil: "networkidle" });
  await page.locator("[data-forecast-chart]").scrollIntoViewIfNeeded();
  const box = (await page.locator("[data-forecast-chart]").boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.93, box.y + box.height / 2);
  await expect(page.locator("[data-readout]")).toContainText("Day 90");
  await expect(page.locator("[data-guide]")).toHaveCount(1);
  await page.mouse.move(box.x + 5, box.y + box.height / 2);
  await expect(page.locator("[data-readout]")).toContainText("today");
  await page.mouse.click(box.x + box.width / 2, Math.max(box.y - 60, 5));
  await expect(page.locator("[data-readout]")).toHaveCount(0);
});

/** For each of the label box's sample points, whether it lies on a data line's stroke. */
async function labelHitsLines(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const label = document.querySelector("[data-floor-label]") as SVGTextElement;
    const box = label.getBBox();
    const lines = [...document.querySelectorAll<SVGPolylineElement>("polyline[data-series]")];
    for (let i = 0; i <= 20; i++) {
      for (let j = 0; j <= 4; j++) {
        const point = new DOMPoint(box.x + (box.width * i) / 20, box.y + (box.height * j) / 4);
        if (lines.some((line) => line.isPointInStroke(point))) return true;
      }
    }
    return false;
  });
}

for (const id of [10001, 10004, 10037]) {
  test(`cash floor label does not overlap the lines for ${id}`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(`/en/business/${id}/forecast`, { waitUntil: "networkidle" });
    test.skip((await page.locator("[data-floor-label]").count()) === 0, "no computed forecast");
    expect(await labelHitsLines(page)).toBe(false);
    const label = (await page.locator("[data-floor-label]").boundingBox())!;
    for (const series of ["model", "baseline"]) {
      const line = (await page.locator(`polyline[data-series=${series}]`).boundingBox())!;
      expect(line.width).toBeGreaterThan(0);
    }
    const chart = (await page.locator("[data-forecast-chart] svg").boundingBox())!;
    expect(label.x + label.width).toBeLessThanOrEqual(chart.x + chart.width);
    expect(label.x + label.width).toBeGreaterThan(chart.x + chart.width * 0.8); // the right end of the floor line
  });
}

test("zakat bars show values on focus", async ({ page }) => {
  await page.goto("/en/business/10037/zakat", { waitUntil: "networkidle" });
  const bar = page.getByRole("button", { name: /^Zakatable assets: SAR / });
  await bar.focus();
  await expect(bar.locator(".tip")).toBeVisible();
  await expect(bar.locator(".tip")).toHaveText(/^Zakatable assets: SAR\s[\d,]+\.\d\d$/);
  await page.keyboard.press("Escape");
  await expect(bar.locator(".tip")).toBeHidden();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: /^Less deductible liabilities: SAR / }).locator(".tip")).toBeVisible();
});

test("review mark readout shows flag reason only", async ({ page }) => {
  await page.goto("/en/business/10004/review", { waitUntil: "networkidle" });
  const mark = page.locator(".tick").first();
  await mark.hover();
  const tip = mark.locator(".tip");
  await expect(tip).toBeVisible();
  const text = (await tip.textContent())!;
  expect(text).toBe(await mark.getAttribute("aria-label"));
  expect(text).toMatch(/^\d{1,2} [A-Z][a-z]+ \d{4}, [A-Za-z ,]+$/);
  expect(text).not.toMatch(/fraud|score|SAR/i);
  await page.mouse.move(0, 0);
  await expect(tip).toBeHidden();
  await mark.focus();
  await expect(tip).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(tip).toBeHidden();
});

test("reduced motion: readouts still appear, without transitions", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/en/business/10001/forecast", { waitUntil: "networkidle" });
  await page.locator("[data-forecast-chart]").focus();
  await page.keyboard.press("End");
  await expect(page.locator("[data-readout]")).toBeVisible();
  expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
  await page.goto("/en/business/10040/zakat", { waitUntil: "networkidle" });
  const bar = page.getByRole("button", { name: /^Zakat base: SAR / });
  await bar.focus();
  await expect(bar.locator(".tip")).toBeVisible();
  expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
});
