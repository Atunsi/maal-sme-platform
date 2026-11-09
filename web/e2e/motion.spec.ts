// U14: with reduced motion nothing animates and every page shows its final state at once. The base
// style of each animated element is its final state, so this holds even with the keyframes gone.
import { expect, test, type Page } from "@playwright/test";

async function settledWithoutMotion(page: Page, path: string) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(path, { waitUntil: "networkidle" });
  const state = await page.evaluate(() => {
    const decorative = (el: Element) => el.classList.contains("scan") || el.classList.contains("pulse-ring") || el.classList.contains("dot") || !!el.closest("[aria-hidden=true]");
    const main = [...document.querySelectorAll("main *")];
    return {
      running: document.getAnimations().length,
      faded: main.filter((el) => getComputedStyle(el).opacity === "0" && !decorative(el)).length,
      flattened: main.filter((el) => /^matrix\(0,|^matrix\(1, 0, 0, 0,/.test(getComputedStyle(el).transform)).length,
    };
  });
  expect(state).toEqual({ running: 0, faded: 0, flattened: 0 });
}

const widthOf = (page: Page, selector: string) => page.locator(selector).first().evaluate((el) => el.getBoundingClientRect().width);

test("motion runs when it is allowed", async ({ page }) => {
  await page.goto("/en/business/10001/credit");
  expect(await page.evaluate(() => document.getAnimations().length)).toBeGreaterThan(0);
});

test("the logo's entrance has the madda land after the body, Arabic before English", async ({ page }) => {
  // M1: the same order inside the 0.4 s cap on every page but the landing page and sign-in.
  await page.goto("/en/business/10001/credit");
  const delays = await page.locator("header svg path").evaluateAll((paths) => paths.map((path) => getComputedStyle(path).animationDelay));
  expect(delays).toEqual(["0.1s", "0.3s", "0.2s", "0.4s"]);
  // The landing page keeps its full sequence.
  await page.goto("/en");
  const full = await page.locator("header svg path").evaluateAll((paths) => paths.map((path) => getComputedStyle(path).animationDelay));
  expect(full).toEqual(["0.1s", "0.6s", "0.3s", "0.8s"]);
});

for (const path of ["/en/business/10001", "/en/business/10001/zakat", "/en/business/10001/review"]) {
  test(`entrance motion stays under the cap: ${path}`, async ({ page }) => {
    // R6: every entrance on the page ends within 1 s of starting (delay at most 0.4 s, duration at most 0.6 s),
    // and every .rise element is fully visible 1 s after the page has loaded.
    await page.goto(path, { waitUntil: "networkidle" });
    const timings = await page.evaluate(() =>
      document
        .getAnimations()
        .map((a) => a.effect?.getComputedTiming())
        .filter((t): t is ComputedEffectTiming => !!t && t.iterations !== Infinity)
        .map((t) => Number(t.delay) + Number(t.duration)),
    );
    expect(timings.filter((t) => t > 1000)).toEqual([]);
    await page.waitForTimeout(1000);
    const faded = await page.locator(".rise").evaluateAll((els) => els.filter((el) => Number(getComputedStyle(el).opacity) < 1).length);
    expect(faded).toBe(0);
  });
}

test("reduced motion: overview shows the verdict at its final state", async ({ page }) => {
  await settledWithoutMotion(page, "/en/business/10001");
  await expect(page.locator(".verdict-rule")).toBeVisible();
});

test("reduced motion: credit shows bars and the Compliance View at their final state", async ({ page }) => {
  await settledWithoutMotion(page, "/en/business/10001/credit");
  expect(await widthOf(page, ".bar-grow")).toBeGreaterThan(40);
  await page.getByRole("button", { name: "Compliance View" }).click();
  await expect(page.getByTestId("compliance-view")).toBeVisible();
  expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
});

test("reduced motion: U6 the Sharia frame and its outline stand without animation", async ({ page }) => {
  await settledWithoutMotion(page, "/en/business/10001/sharia");
  await expect(page.getByText("Rule-based screening, pending Sharia-advisor confirmation")).toBeVisible();
  const outline = page.locator(".frame-path");
  await expect(outline).toBeVisible();
  expect(await outline.evaluate((el) => getComputedStyle(el).strokeDashoffset)).toMatch(/^0(px)?$/);
});

test("reduced motion: U7 zakat shows the nisab plate, the bars and the nisab marker", async ({ page }) => {
  await settledWithoutMotion(page, "/en/business/10001/zakat");
  await expect(page.getByText("Nisab price is a commercial quote, pending independent verification")).toBeVisible();
  expect(await widthOf(page, ".fill-bar")).toBeGreaterThan(100);
  await expect(page.getByText(/^nisab /)).toBeVisible();
});

test("reduced motion: forecast shows both lines in full, with nothing covering them", async ({ page }) => {
  await settledWithoutMotion(page, "/en/business/10001/forecast");
  expect(await page.locator(".reveal").evaluate((el) => getComputedStyle(el).clipPath)).toBe("none");
  await expect(page.locator("polyline")).toHaveCount(2);
  await expect(page.locator(".fade-late text").first()).toBeVisible();
});

test("reduced motion: review shows every mark, and the scan line is gone", async ({ page }) => {
  await settledWithoutMotion(page, "/en/business/10001/review");
  expect(await page.locator(".scan").evaluate((el) => getComputedStyle(el).opacity)).toBe("0");
  await expect(page.locator(".tick-bar").first()).toBeVisible();
  expect(await page.locator(".tick-bar").first().evaluate((el) => el.getBoundingClientRect().height)).toBeGreaterThan(10);
});

test("reduced motion: scenarios shows every row and plate", async ({ page }) => {
  await settledWithoutMotion(page, "/en/scenarios?s=severe_collapse");
  await expect(page.getByText("Changed").first()).toBeVisible();
});

test("reduced motion: landing and sign-in", async ({ page }) => {
  await settledWithoutMotion(page, "/en");
  await settledWithoutMotion(page, "/en/sign-in");
});

test("in Arabic the bars grow from the right", async ({ page }) => {
  await page.goto("/ar/business/10001/credit");
  const origin = await page.locator(".bar-from-start").first().evaluate((el) => getComputedStyle(el).getPropertyValue("--o-start").trim());
  expect(origin).toBe("right");
});

test("time axes stay left to right in Arabic", async ({ page }) => {
  await page.goto("/ar/business/10001/review");
  await expect(page.locator('[dir="ltr"]:has(.tick)')).toHaveCount(1);
});
