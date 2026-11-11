// IN1 (DECISIONS 62): "what to do next", in the browser.
import { expect, test } from "@playwright/test";
import { expectAxeClean } from "./axe";

const block = "[data-next-steps]";

test("owner sees at most three next steps on the overview, each from a rule with its value", async ({ page }) => {
  await page.goto("/en/business/10001?as=owner", { waitUntil: "networkidle" });
  const steps = page.locator(`${block} [data-step]`);
  await expect(page.locator(block)).toBeVisible();
  await expect(page.locator(`${block} h2`)).toHaveText("What to do next");
  expect(await steps.count()).toBeGreaterThan(0);
  expect(await steps.count()).toBeLessThanOrEqual(3);
  for (const step of await steps.all()) {
    expect(await step.getAttribute("data-step")).toMatch(/^G-[a-z-]+$/);
    await step.locator("[data-step-why] summary").click();
    await expect(step.locator("[data-step-trigger]")).toBeVisible();
    await expect(step.locator("[data-step-trigger]")).toContainText("The value behind it");
  }
  // The block sits under the verdict and above the readouts.
  const order = await page.evaluate(() => {
    const y = (s: string) => document.querySelector(s)!.getBoundingClientRect().top;
    return [y("[data-tour=verdict]"), y("[data-next-steps]"), y("#readouts")];
  });
  expect(order[0]).toBeLessThan(order[1]!);
  expect(order[1]).toBeLessThan(order[2]!);
});

test("no next steps for roles that should not see them", async ({ page }) => {
  for (const query of ["", "?as=admin"]) {
    await page.goto(`/en/business/10001${query}`, { waitUntil: "networkidle" });
    await expect(page.locator("#readouts")).toBeVisible();
    await expect(page.locator(block)).toHaveCount(0);
  }
  await page.goto("/en/business/10001/credit?view=compliance&as=admin", { waitUntil: "networkidle" });
  await expect(page.locator(block)).toHaveCount(0);
  // 10003 is refused as insufficient data: no lens ran, so the owner gets no line either.
  await page.goto("/en/business/10003?as=owner", { waitUntil: "networkidle" });
  await expect(page.locator(block)).toHaveCount(0);
});

test("next steps amounts match the lens page", async ({ page }) => {
  await page.goto("/en/business/10001/zakat?as=owner", { waitUntil: "networkidle" });
  const zakatBlock = page.locator(block);
  await expect(zakatBlock).toBeVisible();
  // The zakat page's own lines only.
  for (const step of await zakatBlock.locator("[data-step]").all()) expect(await step.getAttribute("data-step")).toMatch(/^G-zakat-/);
  const quoted = await zakatBlock.locator("[data-step='G-zakat-due'] p [data-sar]").first().innerText();
  const onPage = await page.locator("main [data-sar]").first().innerText();
  expect(quoted.replace(/\s+/g, " ")).toBe(onPage.replace(/\s+/g, " "));
  // The same figure after 2 s: nothing counts up (MO1).
  await page.waitForTimeout(2000);
  expect((await zakatBlock.locator("[data-step='G-zakat-due'] p [data-sar]").first().innerText()).replace(/\s+/g, " ")).toBe(quoted.replace(/\s+/g, " "));
});

test("each lens page shows its own lines, and a link goes to the page that explains it", async ({ page }) => {
  for (const [lens, prefix] of [["credit", "G-credit-"], ["forecast", "G-cash-"], ["review", "G-review"], ["sharia", "G-sharia-"]] as const) {
    await page.goto(`/en/business/10001/${lens}?as=owner`, { waitUntil: "networkidle" });
    const rules = await page.locator(`${block} [data-step]`).evaluateAll((els) => els.map((el) => el.getAttribute("data-step")!));
    expect(rules.length, lens).toBeGreaterThan(0);
    for (const rule of rules) expect(rule.startsWith(prefix), `${lens} ${rule}`).toBe(true);
  }
  await page.goto("/en/business/10001?as=owner", { waitUntil: "networkidle" });
  const link = page.locator(`${block} [data-step-link]`).first();
  const href = (await link.getAttribute("href"))!;
  expect(href).toMatch(/^\/en\/business\/10001\/\w+\?as=owner$/);
  await link.click();
  await expect(page).toHaveURL(new RegExp(href.replace(/[?]/g, "\\?") + "$"));
});

test("reduced motion: the next steps block does not move", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/ar/business/10001?as=owner", { waitUntil: "networkidle" });
  await expect(page.locator(block)).toBeVisible();
  expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
});

for (const [locale, theme] of [["en", "light"], ["en", "dark"], ["ar", "light"], ["ar", "dark"]] as const) {
  test(`next steps pass axe: ${locale} ${theme}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
    for (const [path, width] of [["/business/10037?as=owner", 1280], ["/business/10037/forecast?as=owner", 390]] as const) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/${locale}${path}`, { waitUntil: "networkidle" });
      await expect(page.locator(block)).toBeVisible();
      for (const summary of await page.locator(`${block} [data-step-why] summary`).all()) await summary.click();
      await expectAxeClean(page);
    }
  });
}
