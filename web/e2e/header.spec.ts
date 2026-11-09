// R8 (DECISIONS 45, B12): the header fits one row on laptops, in both locales. Measured on the fullest header:
// a business page with the admin role (the admin link, every lens, the role label and, in Arabic, the digits
// toggle).
import { expect, test, type Page } from "@playwright/test";

const PATH = "/business/10011/zakat?as=admin";

async function headerHeight(page: Page, locale: "en" | "ar", width: number) {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(`/${locale}${PATH}`, { waitUntil: "networkidle" });
  return page.locator("header").evaluate((el) => el.getBoundingClientRect().height);
}

test("header fits one row on laptops", async ({ page }) => {
  const reference = await headerHeight(page, "en", 1440);
  const heights: Record<string, number> = {};
  for (const locale of ["en", "ar"] as const) for (const width of [1280, 1440]) heights[`${locale}-${width}`] = await headerHeight(page, locale, width);
  for (const [key, height] of Object.entries(heights)) expect(Math.abs(height - reference), `${key}: ${height} vs ${reference}`).toBeLessThanOrEqual(2);
  // One row: every item in the header bar shares a vertical band.
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`/ar${PATH}`, { waitUntil: "networkidle" });
  const rows = await page.locator("header nav a, header button:visible, header a:visible").evaluateAll((els) => {
    const centres = els.map((el) => {
      const r = el.getBoundingClientRect();
      return Math.round(r.top + r.height / 2);
    });
    return Math.max(...centres) - Math.min(...centres);
  });
  expect(rows).toBeLessThan(24);
});

test("display menu opens, closes with escape and returns focus", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`/ar${PATH}`, { waitUntil: "networkidle" });
  const display = page.getByRole("button", { name: "العرض" });
  const theme = page.getByRole("button", { name: "الوضع الداكن" });
  await expect(display).toHaveAttribute("aria-expanded", "false");
  await expect(theme).toBeHidden();
  await display.click();
  await expect(display).toHaveAttribute("aria-expanded", "true");
  await expect(theme).toBeVisible();
  await expect(page.locator("[data-digits-toggle]")).toBeVisible();
  // The toggles inside keep aria-pressed and their fixed labels (B7).
  await theme.click();
  await expect(theme).toHaveAttribute("aria-pressed", "true");
  await expect(theme).toHaveText("الوضع الداكن");
  await page.keyboard.press("Escape");
  await expect(theme).toBeHidden();
  await expect(display).toBeFocused();
});
