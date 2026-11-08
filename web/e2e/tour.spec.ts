// E1: the guided tour (DECISIONS 43).
import { expect, test } from "@playwright/test";
import { TOUR_STEPS } from "../lib/tour";
import { expectAxeClean } from "./axe";

for (const locale of ["en", "ar"] as const) {
  test(`tour walks all steps for 10001 in ${locale}`, async ({ page }) => {
    test.setTimeout(240_000);
    await page.goto(`/${locale}`, { waitUntil: "networkidle" });
    await page.locator("[data-tour-start]").first().click();
    const panel = page.locator("[data-tour-panel]");
    const next = locale === "en" ? "Next" : "التالي";
    for (const [i, step] of TOUR_STEPS.entries()) {
      await expect(page).toHaveURL(new RegExp(`tour=${step.id}`));
      await expect(panel.getByRole("heading", { level: 2 })).toHaveText(step[locale].title);
      await expect(panel.getByRole("heading", { level: 2 })).toBeFocused();
      await expect(panel.locator("[data-tour-position]")).toContainText(String(i + 1));
      await expect(page.locator(`[data-tour="${step.target}"]`)).toHaveClass(/tour-target/);
      if (i < TOUR_STEPS.length - 1) await panel.getByRole("button", { name: next }).click();
    }
    await expect(panel.getByRole("link")).toHaveCount(2); // the print sheet and How Ma'al decides
  });
}

test("tour step survives reload and Back", async ({ page }) => {
  await page.goto("/en/business/10001/zakat?tour=waterfall", { waitUntil: "networkidle" });
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.locator("[data-tour-panel] h2")).toHaveText("Zakat, step by step");
  await page.locator("[data-tour-panel]").getByRole("button", { name: "Next" }).click();
  await expect(page).toHaveURL(/tour=runway/);
  await page.goBack();
  await expect(page).toHaveURL(/tour=waterfall/);
  await expect(page.locator("[data-tour-panel] h2")).toHaveText("Zakat, step by step");
});

test("tour ends on escape and returns focus", async ({ page }) => {
  await page.goto("/en/business/10001?tour=verdict", { waitUntil: "networkidle" });
  await expect(page.locator("[data-tour-panel]")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-tour-panel]")).toHaveCount(0);
  await expect(page).not.toHaveURL(/tour=/);
  await expect(page.locator("[data-tour-start]")).toBeFocused();
  expect(await page.evaluate(() => Object.keys(localStorage).filter((k) => k !== "maal-theme"))).toEqual([]);
});

test("tour continues when a target fails to load", async ({ page }) => {
  // 10003 is refused as insufficient_data, so its Zakat page has no waterfall to point at.
  await page.goto("/en/business/10003/zakat?tour=waterfall", { waitUntil: "networkidle" });
  const panel = page.locator("[data-tour-panel]");
  await expect(panel).toContainText("This part didn't load. You can go to the next step.", { timeout: 10_000 });
  await panel.getByRole("button", { name: "Next" }).click();
  await expect(page).toHaveURL(/tour=runway/);
});

for (const theme of ["light", "dark"] as const) {
  test(`tour panel passes axe: ${theme}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
    await page.goto("/en/scenarios?scenario=severe_collapse&tour=diff", { waitUntil: "networkidle" });
    await expect(page.locator("[data-tour-panel]")).toBeVisible();
    await expectAxeClean(page);
    await page.goto("/ar/business/10001?tour=receipt", { waitUntil: "networkidle" });
    await expectAxeClean(page);
  });
}
