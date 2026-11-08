// E3: glossary terms on the pages, and the glossary page (DECISIONS 43).
import { expect, test } from "@playwright/test";

test("term popover opens on focus and closes on escape", async ({ page }) => {
  await page.goto("/en/business/10037/zakat", { waitUntil: "networkidle" });
  const term = page.locator('[data-term="hawl"] button');
  const tip = page.locator('[data-term="hawl"] [role=tooltip]');
  await expect(tip).toBeHidden();
  await term.focus();
  await expect(tip).toBeVisible();
  await expect(tip).toContainText("lunar year");
  expect(await term.getAttribute("aria-describedby")).toBe(await tip.getAttribute("id"));
  await page.keyboard.press("Escape");
  await expect(tip).toBeHidden();
});

test("on a phone a tap opens the definition below the term, inside the screen", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 360, height: 740 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  await page.goto("/ar/business/10004/sharia", { waitUntil: "networkidle" });
  const term = page.locator('[data-term="rule-table-status"] button');
  await term.scrollIntoViewIfNeeded();
  await term.tap();
  const tip = page.locator('[data-term="rule-table-status"] [role=tooltip]');
  await expect(tip).toBeVisible();
  const [t, b] = [(await tip.boundingBox())!, (await term.boundingBox())!];
  expect(t.y).toBeGreaterThanOrEqual(b.y + b.height); // never over the control that opened it
  expect(t.x).toBeGreaterThanOrEqual(0);
  expect(t.x + t.width).toBeLessThanOrEqual(360);
  await page.locator("h1").first().tap();
  await expect(tip).toBeHidden();
  await context.close();
});

test("glossary page renders in both locales and is linked from the footer", async ({ page }) => {
  await page.goto("/en", { waitUntil: "networkidle" });
  await page.locator("footer").getByRole("link", { name: "Glossary" }).click();
  await expect(page).toHaveURL(/\/en\/glossary$/);
  await expect(page.getByRole("heading", { level: 1, name: "Glossary" })).toBeVisible();
  await expect(page.locator("main dt").first()).toBeVisible();
  const enCount = await page.locator("main dt").count();
  await page.goto("/ar/glossary", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { level: 1, name: "المسرد" })).toBeVisible();
  await expect(page.locator("main dt")).toHaveCount(enCount);
});
