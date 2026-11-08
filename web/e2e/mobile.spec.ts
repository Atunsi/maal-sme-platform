// E7: phones and tablets (DECISIONS 43). Runs in the phone-360, phone-390, tablet-768 and laptop-1280
// projects (playwright.config.ts). N7: no page scrolls sideways; menus, targets and axe at small widths.
import { expect, test, type Page } from "@playwright/test";
import { expectAxeClean } from "./axe";
import { LOCALES, PAGES } from "./pages";

const width = (page: Page) => page.viewportSize()!.width;

/** Controls that must be at least 44 by 44: everything a finger presses, except links and terms inside text. */
async function smallTargets(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const small: string[] = [];
    const controls = document.querySelectorAll<HTMLElement>("button, a[href], input, select, summary, [tabindex='0']");
    for (const el of controls) {
      const style = getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden" || el.closest("[hidden], .sr-only, [aria-hidden=true]")) continue;
      if (el.matches(".term, .sr-only") || el.closest("p, li, dd, td, th, .term-wrap")?.matches("p, li, dd")) continue; // inline in text (WCAG 2.5.8 exception)
      if (el.matches("a[href^='#main']")) continue; // the skip link, visible only on focus
      // A checkbox or field inside its label is pressed through the whole label: measure the label.
      const r = (el.matches("input") && el.closest("label") ? el.closest("label")! : el).getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      if (r.width < 43.5 || r.height < 43.5) small.push(`${el.tagName.toLowerCase()} "${(el.textContent ?? el.getAttribute("aria-label") ?? "").trim().slice(0, 30)}" ${r.width.toFixed(0)}x${r.height.toFixed(0)}`);
    }
    return small;
  });
}

for (const locale of LOCALES) {
  for (const path of PAGES) {
    test(`no horizontal page scroll at mobile widths: /${locale}${path}`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto(`/${locale}${path}`, { waitUntil: "networkidle" });
      const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(over).toBeLessThanOrEqual(0);
      if (width(page) === 360) expect(await smallTargets(page)).toEqual([]);
      if (width(page) === 390) {
        await expectAxeClean(page);
        await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
        await expectAxeClean(page);
      }
    });
  }
}

test("mobile menu opens closes and returns focus", async ({ page }) => {
  await page.goto("/en/business/10001", { waitUntil: "networkidle" });
  const button = page.getByRole("button", { name: "Menu" });
  const nav = page.getByRole("navigation", { name: "Pages" });
  if (width(page) >= 768) {
    await expect(button).toBeHidden();
    await expect(nav).toBeVisible();
    return;
  }
  await expect(nav).toBeHidden();
  await expect(button).toHaveAttribute("aria-expanded", "false");
  await button.click();
  await expect(button).toHaveAttribute("aria-expanded", "true");
  await expect(nav).toBeVisible();
  await expect(page.getByRole("button", { name: /theme/i })).toBeVisible(); // the toggles stay reachable
  await nav.getByRole("link", { name: "Zakat" }).focus();
  await page.keyboard.press("Escape");
  await expect(nav).toBeHidden();
  await expect(button).toBeFocused();
  await button.click();
  await nav.getByRole("link", { name: "Zakat" }).click();
  await expect(page).toHaveURL(/\/zakat$/);
  await expect(page.getByRole("navigation", { name: "Pages" })).toBeHidden(); // moving page closes it
});

test("the Arabic logo stands alone below 390 px", async ({ page }) => {
  await page.goto("/ar/business/10001", { waitUntil: "networkidle" });
  const home = page.locator("header a").first();
  const logos = home.locator("svg");
  if (width(page) < 390) {
    await expect(logos.nth(1)).toBeHidden();
    expect((await logos.first().boundingBox())!.height).toBeCloseTo(32, 0);
  } else {
    await expect(logos.nth(1)).toBeVisible();
  }
  if (width(page) < 768) await expect(page.locator("[data-digits-toggle]")).toBeHidden(); // inside the closed menu
  if (width(page) < 768) await page.getByRole("button", { name: "القائمة" }).click();
  await expect(page.locator("[data-digits-toggle]")).toBeVisible();
});

test("diff sheet stacks below 768 and keeps each plate with its row", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" }); // measure the rows at rest, not mid-animation
  await page.goto("/en/scenarios?s=severe_collapse", { waitUntil: "networkidle" });
  const row = page.locator(".diff-table tbody tr").first();
  const [plate, cells] = [row.locator("th .plate"), row.locator("td")];
  await expect(plate).toBeVisible();
  const p = (await plate.boundingBox())!;
  const c = (await cells.first().boundingBox())!;
  if (width(page) < 768) {
    expect(c.y).toBeGreaterThan(p.y + p.height - 1); // values sit under the plate and label
    await expect(cells.first()).toHaveAttribute("data-label", /Baseline/);
  } else {
    expect(Math.abs(c.y - p.y)).toBeLessThan(40); // one line per row on wider screens
  }
});

test("chart readouts stay inside the screen", async ({ page }) => {
  await page.goto("/en/business/10001/forecast", { waitUntil: "networkidle" });
  const chart = page.locator("[data-forecast-chart]");
  await chart.scrollIntoViewIfNeeded();
  for (const key of ["Home", "End"]) {
    await chart.focus();
    await page.keyboard.press(key);
    const r = (await page.locator("[data-readout]").boundingBox())!;
    expect(r.x).toBeGreaterThanOrEqual(0);
    expect(r.x + r.width).toBeLessThanOrEqual(width(page));
  }
});
