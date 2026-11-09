// E8: the Arabic-Indic digits switch, N3, and hydration (DECISIONS 43).
import { nameOf } from "../lib/business-names";
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

/** B12: on laptops the digits toggle sits under the Display button; open it if it is closed. */
async function openDisplay(page: Page) {
  const display = page.getByRole("button", { name: "العرض" });
  if ((await display.getAttribute("aria-expanded")) === "false") await display.click();
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
  await openDisplay(page);
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

  await openDisplay(page);
  await page.locator("[data-digits-toggle]").click();
  await expect(page.locator("table").first()).not.toHaveText(ARAB);
  expect(await context.cookies()).toEqual([]);
});

for (const lens of ["", "/credit", "/zakat", "/review"]) {
  test(`arabic digits convert every eligible number: 10001${lens}`, async ({ page }) => {
    // R2: no Western digit is left in <main> outside N3's elements, links and percent signs included.
    await chooseArab(page);
    await page.goto(`/ar/business/10001${lens}`, { waitUntil: "networkidle" });
    await expect(page.locator("main")).toHaveText(ARAB);
    const left = await page.locator("main").evaluate((main) => {
      const found: string[] = [];
      const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (node.parentElement?.closest("[data-latin], code, pre, [lang=en], input, textarea, select, script, style")) continue;
        if (/[0-9]/.test(node.nodeValue ?? "")) found.push(node.nodeValue!);
      }
      return found;
    });
    expect(left).toEqual([]);
  });
}

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
  await expect(page.getByRole("link", { name: `افتح ${nameOf(10004, "ar")}`, exact: true })).toBeVisible(); // links name the business; its ID sits beside them
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

test("arabic digits appear without waiting for load", async ({ page }) => {
  // B20: the rewrite starts right after hydration. The fonts are held back here, so window load comes late;
  // the digits must already be Arabic-Indic before it does.
  await chooseArab(page);
  await page.addInitScript(() => {
    (window as unknown as { __loaded: boolean }).__loaded = false;
    window.addEventListener("load", () => ((window as unknown as { __loaded: boolean }).__loaded = true));
  });
  await page.route(/\.woff2$/, async (route) => {
    await new Promise((r) => setTimeout(r, 4000));
    await route.continue();
  });
  await page.goto("/ar/business/10001/zakat", { waitUntil: "commit" });
  await expect(page.locator("main").getByText(/ر\.س\./).first()).toHaveText(ARAB, { timeout: 3500 });
  expect(await page.evaluate(() => (window as unknown as { __loaded: boolean }).__loaded)).toBe(false);
});
