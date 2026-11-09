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
