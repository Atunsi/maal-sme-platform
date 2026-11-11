// IN3 (DECISIONS 62): change over time, in the browser.
import { expect, test } from "@playwright/test";
import { expectAxeClean } from "./axe";

const openProfile = async (page: import("@playwright/test").Page) => page.locator("#profile > details > summary").click();

test("trend shows only what the API returned", async ({ page }) => {
  await page.goto("/en/business/10001?as=owner", { waitUntil: "networkidle" });
  // OV1 (DECISIONS 63): its own section, open without a click.
  const block = page.locator("[data-trends]");
  await expect(block).toBeVisible();
  await expect(block).toContainText("is not compared with any other business");
  const rows = block.locator("[data-trend]");
  await expect(rows).toHaveCount(4);
  for (const row of await rows.all()) {
    const marks = await row.locator("[data-trend-point]").evaluateAll((els) => els.map((el) => el.getAttribute("data-trend-point")));
    await row.locator("[data-trend-table] summary").click();
    const tableDates = await row.locator("[data-trend-row]").evaluateAll((els) => els.map((el) => el.getAttribute("data-trend-row")));
    expect(marks.length).toBeGreaterThanOrEqual(3);
    expect(tableDates).toEqual(marks); // one mark per table row, same dates
    expect([...marks].sort()).toEqual(marks); // oldest first
  }
});

test("latest trend value equals the current value", async ({ page }) => {
  await page.goto("/en/business/10001", { waitUntil: "networkidle" });
  await openProfile(page);
  const cell = page.locator("#profile table").first().locator("tr", { hasText: "avg_monthly_inflow" }).locator("td").nth(1);
  const raw = Number(await cell.innerText());
  const last = page.locator('[data-trend="avg_monthly_inflow"] [data-trend-point]').last();
  expect(Number(await last.getAttribute("data-value"))).toBe(raw);
});

test("trend marks show a readout on focus and never move a value", async ({ page }) => {
  await page.goto("/en/business/10001", { waitUntil: "networkidle" });
  const row = page.locator('[data-trend="avg_daily_balance"]');
  const first = row.locator("[data-trend-point]").first();
  const before = await row.locator("[data-trend-current]").innerText();
  // Reach the mark with the keyboard, as a keyboard user does: the ring is for keyboard focus.
  await first.focus();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  await expect(first).toBeFocused();
  await expect(row.locator("[data-trend-readout]")).not.toHaveText("");
  // The shared focus ring (MT3) and a target of at least 44 px.
  const ring = await first.evaluate((el) => { const s = getComputedStyle(el); return `${s.outlineStyle} ${s.outlineWidth}`; });
  expect(ring).toBe("solid 2px");
  expect((await first.boundingBox())!.width).toBeGreaterThanOrEqual(44);
  await page.waitForTimeout(2000);
  expect(await row.locator("[data-trend-current]").innerText()).toBe(before); // MO1
  // The line is drawn at once: no running animation on it.
  expect(await row.locator("[data-trend-line] svg line").first().evaluate((el) => el.getAnimations().length)).toBe(0);
});

test("short history shows the sentence", async ({ page }) => {
  await page.goto("/en/business/10032", { waitUntil: "networkidle" });
  const block = page.locator("[data-trends]");
  await expect(block.locator("[data-trend-short]").first()).toHaveText("Not enough history yet to show a trend");
  await expect(block.locator("[data-trend-line]")).toHaveCount(0);
  // Refused as insufficient data: no profile, so no trend.
  await page.goto("/en/business/10003", { waitUntil: "networkidle" });
  await expect(page.locator("[data-trends]")).toHaveCount(0);
});

for (const [locale, theme, width] of [["en", "light", 1280], ["ar", "dark", 1280], ["ar", "light", 390], ["en", "dark", 390]] as const) {
  test(`trend block passes axe and fits: ${locale} ${theme} ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
    await page.goto(`/${locale}/business/10004`, { waitUntil: "networkidle" });
    await expect(page.locator("[data-trends]")).toBeVisible();
    for (const summary of await page.locator("[data-trend-table] summary").all()) await summary.click();
    await expectAxeClean(page);
    // N7: no sideways page scroll.
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
    await expect(page.locator("[data-trend-line]").first()).toHaveAttribute("dir", "ltr");
  });
}

// OV1 (DECISIONS 63): the overview's four sections, in the markup and on screen, for every role, locale and width.
const ORDER = ["verdict", "readouts", "trends", "profile"] as const;
for (const role of ["owner", "default"] as const) {
  for (const locale of ["en", "ar"] as const) {
    for (const width of [1280, 390]) {
      test(`overview sections follow the fixed order: ${role} ${locale} ${width}`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(`/${locale}/business/10001${role === "owner" ? "?as=owner" : ""}`, { waitUntil: "networkidle" });
        const found = await page.evaluate((order) => {
          const pick: Record<string, Element | null> = {
            verdict: document.querySelector("[data-tour='verdict']"),
            readouts: document.querySelector("section[aria-labelledby='readouts']"),
            trends: document.querySelector("[data-trends]"),
            profile: document.querySelector("#profile"),
          };
          const els = order.map((k) => pick[k]);
          if (els.some((el) => !el)) return { missing: order.filter((k) => !pick[k]) };
          const domOrdered = els.every((el, i) => i === 0 || els[i - 1]!.compareDocumentPosition(el!) & Node.DOCUMENT_POSITION_FOLLOWING);
          const tops = els.map((el) => el!.getBoundingClientRect().top + window.scrollY);
          // No CSS order or reversed flex to fake it (OV1, decision 3).
          const faked = els.some((el) => {
            const s = getComputedStyle(el!);
            const p = getComputedStyle(el!.parentElement!);
            return s.order !== "0" || p.flexDirection.endsWith("reverse");
          });
          return { domOrdered, tops, faked };
        }, ORDER);
        expect(found).not.toHaveProperty("missing");
        expect(found.domOrdered).toBe(true);
        expect(found.faked).toBe(false);
        for (let i = 1; i < found.tops!.length; i++) expect(found.tops![i]).toBeGreaterThan(found.tops![i - 1]!);
      });
    }
  }
}

test("figures moved is visible without opening anything", async ({ page }) => {
  await page.goto("/en/business/10001", { waitUntil: "networkidle" });
  const block = page.locator("[data-trends]");
  await expect(block).toBeVisible();
  await expect(block.getByRole("heading", { level: 2, name: "How your figures have moved" })).toBeVisible();
  await expect(block.locator("xpath=ancestor::details")).toHaveCount(0);
  await expect(block.locator("[data-trend-line]").first()).toBeVisible();
});
