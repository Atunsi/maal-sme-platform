// E1: the guided tour (DECISIONS 51).
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
      if (i < TOUR_STEPS.length - 1) await panel.getByRole("link", { name: next }).click();
    }
    await expect(panel.locator("a:not(.tour-dot)")).toHaveCount(2); // the print sheet and How Ma'al decides (the step dots, I10, are links too)
  });
}

test("tour step survives reload and Back", async ({ page }) => {
  await page.goto("/en/business/10001/zakat?tour=waterfall", { waitUntil: "networkidle" });
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.locator("[data-tour-panel] h2")).toHaveText("Zakat, step by step");
  await page.locator("[data-tour-panel]").getByRole("link", { name: "Next" }).click();
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
  await panel.getByRole("link", { name: "Next" }).click();
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

test("tour title shows a thin focus mark after a step change", async ({ page }) => {
  // X2: focus still moves to the step title, drawn as a thin underline instead of the full box.
  await page.goto("/en/business/10001/zakat?tour=waterfall", { waitUntil: "networkidle" });
  await page.locator("[data-tour-panel]").getByRole("link", { name: "Next" }).click();
  const title = page.locator("[data-tour-panel] h2");
  await expect(title).toBeFocused();
  const look = await title.evaluate((el) => ({ outline: getComputedStyle(el).outlineStyle, line: getComputedStyle(el).textDecorationLine, mark: el.hasAttribute("data-step-focus") }));
  expect(look).toEqual({ outline: "none", line: "underline", mark: true });
  // Once focus leaves, the mark goes: any later focus gets the full box.
  await page.keyboard.press("Tab");
  expect(await title.evaluate((el) => el.hasAttribute("data-step-focus"))).toBe(false);
});

test("tour dots jump to their step", async ({ page }) => {
  // I10: one dot per step, each a link to that step; the current one is aria-current="step".
  await page.goto("/en/business/10001?tour=verdict", { waitUntil: "networkidle" });
  const dots = page.locator("[data-tour-dots] a");
  await expect(dots).toHaveCount(TOUR_STEPS.length);
  await expect(dots.nth(0)).toHaveAttribute("aria-current", "step");
  await dots.nth(4).click();
  await expect(page).toHaveURL(new RegExp(`tour=${TOUR_STEPS[4]!.id}`));
  await expect(page.locator("[data-tour-dots] a").nth(4)).toHaveAttribute("aria-current", "step");
  await expect(page.locator("[data-tour-panel] h2")).toHaveText(TOUR_STEPS[4]!.en.title);
});

test("tour collapses and expands", async ({ page }) => {
  // I10: Collapse shrinks the panel to one line (title and Next), kept in ?tourMin=1, never in storage.
  await page.goto("/en/business/10001?tour=verdict", { waitUntil: "networkidle" });
  const panel = page.locator("[data-tour-panel]");
  const full = (await panel.boundingBox())!.height;
  await panel.getByRole("button", { name: "Collapse" }).click();
  await expect(page).toHaveURL(/tourMin=1/);
  await expect(panel.locator("[data-tour-dots]")).toHaveCount(0);
  await expect(panel.locator("h2")).toBeVisible();
  await expect(panel.getByRole("link", { name: "Next" })).toBeVisible();
  expect((await panel.boundingBox())!.height).toBeLessThan(full);
  await panel.getByRole("link", { name: "Next" }).click();
  await expect(page).toHaveURL(/tour=factors.*tourMin=1|tourMin=1.*tour=factors/);
  await panel.getByRole("button", { name: "Expand" }).click();
  await expect(page).not.toHaveURL(/tourMin/);
  await expect(panel.locator("[data-tour-dots]")).toBeVisible();
  expect(await page.evaluate(() => [Object.keys(localStorage).filter((k) => k.includes("tour")), Object.keys(sessionStorage).filter((k) => k.includes("tour"))])).toEqual([[], []]);
});

test("tour resume returns to the step it ended on", async ({ page }) => {
  // I10: after End tour, a Resume tour link stays in the header for the visit (in the URL, ?tourEnded=).
  await page.goto("/en/business/10001/zakat?tour=waterfall&as=owner", { waitUntil: "networkidle" });
  await page.locator("[data-tour-panel]").getByRole("link", { name: "End tour" }).click();
  await expect(page.locator("[data-tour-panel]")).toHaveCount(0);
  await expect(page).toHaveURL(/tourEnded=waterfall/);
  const resume = page.locator("[data-tour-resume]");
  await expect(resume).toBeVisible();
  // Moving to another page keeps it.
  await page.getByRole("navigation", { name: "Pages" }).getByRole("link", { name: "Overview" }).click();
  await expect(page).toHaveURL(/\/business\/10001\?as=owner&tourEnded=waterfall/);
  await page.locator("[data-tour-resume]").click();
  await expect(page).toHaveURL(/\/business\/10001\/zakat\?.*tour=waterfall/);
  await expect(page.locator("[data-tour-panel] h2")).toHaveText("Zakat, step by step");
});
