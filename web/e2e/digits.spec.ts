// E8: the Arabic-Indic digits switch, N3, and hydration (DECISIONS 43).
import { expect, test, type Page } from "@playwright/test";

const ARAB = /[٠-٩]/;
const LATN = /[0-9]/;

function watchConsole(page: Page) {
  const messages: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning") messages.push(m.text());
  });
  page.on("pageerror", (e) => messages.push(e.message));
  return messages;
}

const chooseArab = (page: Page) => page.addInitScript(() => localStorage.setItem("maal-digits", "arab"));

test("digits switch only shows in arabic", async ({ page }) => {
  await page.goto("/en/business/10040", { waitUntil: "networkidle" });
  await expect(page.locator("[data-digits-toggle]")).toHaveCount(0);
  await page.goto("/en/sign-in", { waitUntil: "networkidle" });
  await expect(page.locator("[data-digits-toggle]")).toHaveCount(0);
  await page.goto("/ar/business/10040", { waitUntil: "networkidle" });
  const toggle = page.locator("[data-digits-toggle]");
  await expect(toggle).toHaveText("أرقام عربية");
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
});

test("digits switch changes amounts and persists without cookies", async ({ page, context }) => {
  await page.goto("/ar/business/10040/zakat", { waitUntil: "networkidle" });
  const heading = page.locator("main").getByText(/ر\.س\./).first();
  await expect(heading).toHaveText(LATN);
  await page.locator("[data-digits-toggle]").click();
  await expect(page.locator("[data-digits-toggle]")).toHaveText("أرقام عربية");
  await expect(page.locator("[data-digits-toggle]")).toHaveAttribute("aria-pressed", "true");
  await expect(heading).toHaveText(ARAB);
  await expect(heading).not.toHaveText(LATN);
  expect(await page.evaluate(() => localStorage.getItem("maal-digits"))).toBe("arab");
  expect(await context.cookies()).toEqual([]);

  await page.reload({ waitUntil: "networkidle" });
  await expect(page.locator("main").getByText(/ر\.س\./).first()).toHaveText(ARAB);
  // A client-side move keeps the choice: the new page's text is rewritten too.
  await page.getByRole("navigation").getByRole("link", { name: "التدفق النقدي" }).click();
  await expect(page).toHaveURL(/\/forecast/);
  await expect(page.locator("table").first()).toHaveText(ARAB);
  await expect(page.locator("[data-forecast-chart] svg text").last()).toHaveText(ARAB); // axis labels follow

  await page.locator("[data-digits-toggle]").click();
  await expect(page.locator("table").first()).not.toHaveText(ARAB);
  expect(await context.cookies()).toEqual([]);
});

test("arabic digits never touch hashes or commands", async ({ page }) => {
  await chooseArab(page);
  await page.goto("/ar/business/10037", { waitUntil: "networkidle" });
  await expect(page.locator("main h1, main h2").first()).toBeVisible();
  await expect(page.getByText(/١٠٠٣٧/).first()).toBeVisible(); // the business ID in plain text follows the setting
  await expect(page.locator("dl[data-latin]")).not.toHaveText(ARAB);
  for (const summary of await page.locator("details[data-receipt] > summary").all()) await summary.click();
  for (const code of await page.locator("details[data-receipt] code").all()) await expect(code).not.toHaveText(ARAB);
  await expect(page.locator("[data-rerun] code").first()).toHaveText("python -m pipeline.verify <file>");
  await page.goto("/ar/admin?as=admin", { waitUntil: "networkidle" });
  await expect(page.getByRole("link", { name: "افتح 10004", exact: true })).toBeVisible(); // IDs inside links stay Latin
});

for (const path of ["/ar/business/10001", "/ar/admin?as=admin", "/ar/scenarios", "/ar/business/10004/forecast"]) {
  test(`no hydration warnings with arabic digits: ${path}`, async ({ page }) => {
    await chooseArab(page);
    const messages = watchConsole(page);
    await page.goto(path, { waitUntil: "networkidle" });
    await expect(page.locator("main")).toHaveText(ARAB);
    await page.waitForTimeout(500);
    expect(messages.filter((m) => /hydrat|did not match|mismatch/i.test(m))).toEqual([]);
  });
}
