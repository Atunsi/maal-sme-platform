// CR1, CR2 (DECISIONS 62): the commercial registration number field, in the browser.
import { expect, test } from "@playwright/test";
import ar from "../messages/ar.json";
import en from "../messages/en.json";
import { expectAxeClean } from "./axe";

const M = { en, ar } as const;

for (const locale of ["en", "ar"] as const) {
  test(`entry field says the number is a demo number: ${locale}`, async ({ page }) => {
    const r = M[locale].registration;
    await page.goto(`/${locale}/sign-in`, { waitUntil: "networkidle" });
    await expect(page.getByLabel(r.label, { exact: true })).toBeVisible();
    const hint = page.locator("[data-registration-hint]");
    await expect(hint).toBeVisible();
    await expect(hint).toContainText(r.hint);
    await expect(hint).toContainText("10001");
    // CR-V2: nothing on the page calls the demo number a real registration.
    await expect(page.locator("main, body").first()).not.toContainText(/real registration number is 10001/i);
  });
}

test("demo hint fills the field", async ({ page }) => {
  await page.goto("/en/sign-in", { waitUntil: "networkidle" });
  const field = page.getByLabel("Commercial registration number", { exact: true });
  await page.getByRole("button", { name: "Use the demo number 10001" }).click();
  await expect(field).toHaveValue("10001");
  await expect(field).toBeFocused();
  await page.getByLabel("Password").fill("pass");
  await page.getByRole("button", { name: "Sign in to my business" }).click();
  await expect(page).toHaveURL(/\/en\/business\/10001\?as=owner$/);
});

test("a demo number opens that business, typed in Arabic-Indic digits too", async ({ page }) => {
  await page.goto("/ar/sign-in", { waitUntil: "networkidle" });
  await page.getByLabel(ar.registration.label, { exact: true }).fill("١٠٠٣٧");
  await page.getByLabel(ar.signIn.password).fill("pass");
  await page.getByRole("button", { name: ar.signIn.ctaOwner }).click();
  await expect(page).toHaveURL(/\/ar\/business\/10037\?as=owner$/);
});

test("entry field error is announced and tied to the field", async ({ page }) => {
  await page.goto("/en/sign-in", { waitUntil: "networkidle" });
  const requests: string[] = [];
  page.on("request", (request) => requests.push(`${request.method()} ${request.url()}`));
  const field = page.getByLabel("Commercial registration number", { exact: true });
  const error = page.locator("[data-registration-error]");
  const cases: [string, string][] = [
    ["", "Enter a commercial registration number"],
    ["12ab", "Use digits only"],
    ["1000", "A commercial registration number is 10 digits and starts with 7. Demo commercial registration number: 10001"],
    ["7001234567", "This looks like a real commercial registration number. This demo holds synthetic businesses only. Try 10001"],
    ["1010123456", "A commercial registration number is 10 digits and starts with 7"],
    ["10999", "No demo business has this number. Demo numbers run from 10001 to 10300"],
  ];
  for (const [input, message] of cases) {
    await field.fill(input);
    await page.getByRole("button", { name: "Sign in to my business" }).click();
    await expect(error, input).toHaveText(message);
    await expect(error).toHaveAttribute("role", "alert");
    await expect(page.locator("main [role=alert]")).toHaveCount(1); // announced once (Next's own route announcer sits outside main)
    await expect(field).toHaveAttribute("aria-invalid", "true");
    expect((await field.getAttribute("aria-describedby"))!.split(" ")).toContain((await error.getAttribute("id"))!);
    await expect(field).toBeFocused();
    await expect(page).toHaveURL(/\/en\/sign-in$/);
  }
  // CR-V1: none of that called anything.
  expect(requests).toEqual([]);
  // Leaving the field checks the format; typing clears the message.
  await field.fill("abc");
  await page.getByLabel("Password").focus();
  await expect(error).toHaveText("Use digits only");
  await field.fill("1");
  await expect(error).toHaveCount(0);
});

for (const [path, why] of [
  ["/en/business/99999", "outside the demo range"],
  ["/en/business/10999/zakat", "in the range, not in the store"],
  ["/ar/business/abc", "not a number"],
] as const) {
  test(`unknown business in the URL shows the hint: ${why}`, async ({ page }) => {
    const r = path.startsWith("/ar") ? ar.registration : en.registration;
    const response = await page.goto(path, { waitUntil: "networkidle" });
    expect(response!.status()).toBeLessThan(500);
    const hint = page.locator("main [data-registration-hint]");
    await expect(hint).toContainText(r.notFoundHint);
    await hint.getByRole("link").click();
    await expect(page).toHaveURL(/\/business\/10001$/);
  });
}

for (const [locale, theme] of [["en", "light"], ["en", "dark"], ["ar", "light"], ["ar", "dark"]] as const) {
  test(`registration field passes axe with an error showing: ${locale} ${theme}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
    await page.goto(`/${locale}/sign-in`, { waitUntil: "networkidle" });
    await expectAxeClean(page);
    await page.getByLabel(M[locale].registration.label, { exact: true }).fill("7001234567");
    await page.getByRole("button", { name: M[locale].signIn.ctaOwner }).click();
    await expect(page.locator("[data-registration-error]")).toBeVisible();
    await expectAxeClean(page);
    await page.goto(`/${locale}/business/99999`, { waitUntil: "networkidle" });
    await expectAxeClean(page);
  });
}

test("admin finder reads a typed number as a registration number", async ({ page }) => {
  await page.goto("/en/admin?as=admin", { waitUntil: "networkidle" });
  const field = page.getByRole("combobox").first();
  await field.fill("7001234567");
  await field.press("Enter");
  await expect(page.locator("#business-id-error")).toHaveText("This looks like a real commercial registration number. This demo holds synthetic businesses only. Try 10001");
  await field.fill("١٠٠٠٤");
  await field.press("Enter");
  await expect(page).toHaveURL(/\/en\/business\/10004\?as=admin$/);
});
