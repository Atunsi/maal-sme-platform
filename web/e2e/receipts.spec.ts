// E4: copy buttons, the re-run command and the hash check, in a real browser (DECISIONS 43).
import { expect, test } from "@playwright/test";
import { expectAxeClean } from "./axe";
import { apiEnv } from "./helpers";

async function apiReceipt(path: string) {
  const { MAAL_API_URL, MAAL_API_KEY } = apiEnv();
  const res = await fetch(`${MAAL_API_URL}${path}`, { headers: { "X-API-Key": MAAL_API_KEY } });
  return ((await res.json()) as { receipt: { output_sha256: string } }).receipt;
}

test("receipt copy button copies the full output hash", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/en/business/10001/credit", { waitUntil: "networkidle" });
  const receipt = page.locator("details[data-receipt]").first();
  await receipt.locator("summary").click();
  await receipt.getByRole("button", { name: "Copy output_sha256" }).click();
  await expect(receipt.getByRole("button", { name: "Copied output_sha256" })).toBeVisible();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toBe((await apiReceipt("/lenses/credit?business_id=10001")).output_sha256);
  expect(copied).toHaveLength(64);
  await expect(receipt.getByRole("button", { name: "Copy output_sha256" })).toBeVisible({ timeout: 4000 });
});

test("copy falls back when clipboard is blocked", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", { value: { writeText: () => Promise.reject(new Error("blocked")) }, configurable: true });
  });
  await page.goto("/en/business/10037/zakat", { waitUntil: "networkidle" });
  const receipt = page.locator("details[data-receipt]").first();
  await receipt.locator("summary").click();
  await receipt.getByRole("button", { name: "Copy output_sha256" }).click();
  const field = receipt.getByRole("textbox", { name: "output_sha256" });
  await expect(field).toBeVisible();
  await expect(field).toHaveValue((await apiReceipt("/lenses/zakat?business_id=10037")).output_sha256);
  await expect(receipt.getByText("Press Ctrl+C to copy")).toBeVisible();
  expect(await field.evaluate((el: HTMLInputElement) => el.selectionEnd! - el.selectionStart!)).toBe(64);
});

test("rerun command is shown verbatim from scope, and hash check reports match and no match", async ({ page }) => {
  await page.goto("/en/business/10040/forecast", { waitUntil: "networkidle" });
  const receipt = page.locator("details[data-receipt]").first();
  await receipt.locator("summary").click();
  await expect(receipt.locator("[data-rerun] code")).toHaveText("python -m pipeline.verify <file>");
  const { output_sha256 } = await apiReceipt("/lenses/forecast?business_id=10040");
  const field = receipt.getByLabel("Check a hash");
  await field.fill(` ${output_sha256.toUpperCase()} `);
  await receipt.getByRole("button", { name: "Check", exact: true }).click();
  await expect(receipt.getByText("Match", { exact: true })).toBeVisible();
  await field.fill("abc");
  await field.press("Enter");
  await expect(receipt.getByText("No match", { exact: true })).toBeVisible();
});

test("profile receipt shows no rerun command; scenario receipts show their own", async ({ page }) => {
  await page.goto("/en/business/10001", { waitUntil: "networkidle" });
  const profile = page.locator("details[data-receipt]").filter({ hasText: "Receipt: profile" });
  await profile.locator("summary").click();
  await expect(profile.locator("[data-rerun]")).toHaveCount(0);
  await page.goto("/en/scenarios?s=severe_collapse", { waitUntil: "networkidle" });
  const chosen = page.locator("details[data-receipt]").nth(1);
  await chosen.locator("summary").click();
  await expect(chosen.locator("[data-rerun] code")).toHaveText("python -m scenarios.run --scenario severe_collapse");
});

// Spread over the demo businesses: the API allows 60 requests a minute per business, and specs run in parallel.
for (const [locale, theme, id] of [
  ["en", "light", 10004],
  ["en", "dark", 10037],
  ["ar", "light", 10040],
  ["ar", "dark", 10004],
] as const) {
  test(`open receipt panels pass axe: ${locale} ${theme}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
    for (const path of [`/business/${id}`, `/business/${id}/credit`, "/scenarios?s=severe_collapse"]) {
      await page.goto(`/${locale}${path}`, { waitUntil: "networkidle" });
      for (const summary of await page.locator("details[data-receipt] > summary").all()) await summary.click();
      await expectAxeClean(page);
    }
  });
}
