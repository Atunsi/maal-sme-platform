// E6: scenario Play all (DECISIONS 43).
import { expect, test } from "@playwright/test";
import index from "../scenarios-data/index.json";
import { scenarioName } from "../lib/scenario-label";

const names = index.scenarios.map((s) => s.name);

test("play all steps through every scenario", async ({ page }) => {
  test.setTimeout(240_000);
  await page.clock.install();
  await page.goto(`/en/scenarios?scenario=${names[0]}`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Play all" }).click();
  await expect(page.getByRole("button", { name: "Pause" })).toBeVisible(); // R3: the label carries the state
  for (let i = 1; i < names.length; i++) {
    await page.clock.runFor(8000);
    await expect(page).toHaveURL(new RegExp(`scenario=${names[i]}`));
    await expect(page.locator("[data-position]")).toHaveText(`Scenario ${i + 1} of ${names.length}`);
    await expect(page.locator("main nav a[aria-current=page]")).toHaveAttribute("href", new RegExp(`s=${names[i]}`));
  }
  await expect(page.getByRole("button", { name: "Play all" })).toBeVisible();
  // B13: the last scenario is announced after playback stops.
  await expect(page.locator("[data-player] [role=status]")).toHaveText(scenarioName(index.scenarios.at(-1)!.label).name);
});

test("play all pauses and stops on user choice", async ({ page }) => {
  await page.clock.install();
  await page.goto(`/en/scenarios?scenario=${names[0]}`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Play all" }).click();
  await page.getByRole("button", { name: "Pause" }).click();
  await page.clock.runFor(20_000);
  await expect(page).toHaveURL(new RegExp(`scenario=${names[0]}`));
  await page.getByRole("button", { name: "Play all" }).click();
  await page.locator("main nav").getByRole("link").nth(4).click();
  await expect(page).toHaveURL(new RegExp(`s=${names[4]}`));
  await expect(page.getByRole("button", { name: "Play all" })).toBeVisible();
  await page.clock.runFor(20_000);
  await expect(page).toHaveURL(new RegExp(`s=${names[4]}`));
});

test("play all stops when the tab is hidden", async ({ page }) => {
  await page.clock.install();
  await page.goto(`/en/scenarios?scenario=${names[0]}`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Play all" }).click();
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { value: true, configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(page.getByRole("button", { name: "Play all" })).toBeVisible();
  await page.clock.runFor(20_000);
  await expect(page).toHaveURL(new RegExp(`scenario=${names[0]}`));
});

test("reduced motion: play all still steps, with no animation", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.clock.install();
  await page.goto(`/en/scenarios?scenario=${names[0]}`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Play all" }).click();
  await page.clock.runFor(8000);
  await expect(page).toHaveURL(new RegExp(`scenario=${names[1]}`));
  expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
});

test("play all progress bar resets each step", async ({ page }) => {
  // I4: a thin bar fills over each 8 s step and starts again on the next scenario.
  await page.clock.install();
  await page.goto(`/en/scenarios?scenario=${names[0]}`, { waitUntil: "networkidle" });
  await expect(page.locator("[data-play-progress]")).toHaveCount(0);
  await page.getByRole("button", { name: "Play all" }).click();
  const fill = page.locator("[data-play-progress] .play-progress-fill");
  await expect(fill).toHaveCount(1);
  const before = await fill.evaluate((el) => el.getAnimations()[0]?.effect?.getComputedTiming().duration);
  expect(before).toBe(8000);
  const first = await fill.elementHandle();
  await page.clock.runFor(8000);
  await expect(page).toHaveURL(new RegExp(`scenario=${names[1]}`));
  await expect(page.locator("[data-position]")).toHaveText(`Scenario 2 of ${names.length}`);
  // A new fill element: the bar starts again from empty.
  const second = await fill.elementHandle();
  expect(await page.evaluate(([a, b]) => a === b, [first, second])).toBe(false);
});

test("changed rows toggle hides same rows", async ({ page }) => {
  await page.goto("/en/scenarios?s=severe_collapse", { waitUntil: "networkidle" });
  const toggle = page.getByRole("button", { name: "Changed rows only" });
  const same = page.locator("tbody tr[data-same]");
  const sameCount = await same.count();
  expect(sameCount).toBeGreaterThan(0);
  await expect(same.first()).toBeVisible();
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await expect(toggle).toHaveText("Changed rows only");
  await expect(page).toHaveURL(/changed=1/);
  for (let i = 0; i < sameCount; i++) await expect(same.nth(i)).toBeHidden();
  await expect(page.locator("tbody tr:not([data-same])").first()).toBeVisible();
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.getByRole("button", { name: "Changed rows only" })).toHaveAttribute("aria-pressed", "true");
  await expect(same.first()).toBeHidden();
});

test("arrow keys move between scenarios", async ({ page }) => {
  await page.goto(`/en/scenarios?s=${names[1]}`, { waitUntil: "networkidle" });
  const menu = page.locator("[data-scenario-menu]");
  // Roving tabindex: only the current scenario is in the tab order.
  await expect(menu.locator('a[tabindex="0"]')).toHaveCount(1);
  await menu.locator("a[aria-current=page]").focus();
  await page.keyboard.press("ArrowRight");
  await expect(page).toHaveURL(new RegExp(`s=${names[2]}`));
  await expect(menu.locator("a").nth(2)).toBeFocused();
  await page.keyboard.press("ArrowLeft");
  await expect(page).toHaveURL(new RegExp(`s=${names[1]}`));
  await page.goto(`/ar/scenarios?s=${names[1]}`, { waitUntil: "networkidle" });
  await page.locator("[data-scenario-menu] a[aria-current=page]").focus();
  await page.keyboard.press("ArrowLeft"); // Arabic reads right to left: Left is next
  await expect(page).toHaveURL(new RegExp(`s=${names[2]}`));
});
