// DECISIONS 58: the plain-language decision record. PR1 (owner sees no technical record), PR2 (it stays for admin,
// the public demo and the Compliance View), PR4 (one reference everywhere), and the admin lookup (P8).
import { expect, test, type Page } from "@playwright/test";

const LENS = ["", "/credit", "/sharia", "/zakat", "/forecast", "/review"];
const IDS = [10001, 10037];

/** Every visible identifier a technical record would show: hashes, commits, field names, the scope, the command. */
async function technicalTraces(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const text = document.querySelector("main")!.innerText;
    const found: string[] = [];
    for (const pattern of [/[0-9a-f]{12,}/g, /\b[a-z_]+_sha256\b/g, /\bcode_commit\b/g, /python -m/g, /deterministic core/g, /الجزء الحتمي/g]) {
      for (const match of text.match(pattern) ?? []) found.push(match);
    }
    return found;
  });
}

for (const locale of ["en", "ar"] as const) {
  for (const id of IDS) {
    for (const lens of LENS) {
      const path = `/${locale}/business/${id}${lens}`;
      test(`owner sees no technical record: ${path}`, async ({ page }) => {
        await page.goto(`${path}?as=owner`, { waitUntil: "networkidle" });
        await expect(page.locator("[data-record]").first()).toBeVisible();
        await expect(page.locator("details[data-receipt]")).toHaveCount(0);
        expect(await technicalTraces(page)).toEqual([]);
        await expect(page.locator("[data-reference]").first()).toHaveText(new RegExp(`^M-${id}-[0-9A-F]{8}$`));
        const owner = await page.locator("main").innerText();
        expect(owner).not.toMatch(locale === "en" ? /receipt/i : /إيصال/);
      });
    }
  }
}

test("technical record stays for admin, public and compliance", async ({ page }) => {
  for (const lens of ["/zakat", "/forecast"]) {
    await page.goto(`/en/business/10001${lens}?as=admin`, { waitUntil: "networkidle" });
    await expect(page.locator("details[data-receipt][open]")).toHaveCount(1);
    await expect(page.locator("details[data-receipt]").getByText(/Covers the deterministic core only/)).toBeVisible(); // U13
    await page.goto(`/en/business/10001${lens}`, { waitUntil: "networkidle" });
    await expect(page.locator("details[data-receipt]")).toHaveCount(1);
    await expect(page.locator("details[data-receipt][open]")).toHaveCount(0);
    await expect(page.locator("[data-record]")).toHaveCount(1);
  }
  await page.goto("/en/business/10001/credit?view=compliance&as=owner", { waitUntil: "networkidle" });
  await expect(page.locator("[data-record]")).toHaveCount(0);
  await expect(page.locator("details[data-receipt][open]")).toHaveCount(1);
  // Switching back to the public view brings the card back without a reload.
  await page.getByRole("button", { name: "Public view" }).click();
  await expect(page.locator("[data-record]")).toHaveCount(1);
  await expect(page.locator("details[data-receipt]")).toHaveCount(0); // owner role
});

test("reference number matches the output hash", async ({ page, request }) => {
  await page.goto("/en/business/10001?as=owner", { waitUntil: "networkidle" });
  const card = (await page.locator("[data-reference]").first().textContent())!.trim();
  await page.goto("/en/business/10001/credit?as=owner", { waitUntil: "networkidle" });
  expect((await page.locator("[data-reference]").first().textContent())!.trim()).toBe(card);
  await page.goto("/en/business/10001/sheet?as=owner", { waitUntil: "networkidle" });
  expect((await page.locator("[data-reference]").first().textContent())!.trim()).toBe(card);
  await page.goto("/en/business/10001/credit?as=admin", { waitUntil: "networkidle" });
  const hash = (await page.locator("details[data-receipt] dd code").filter({ hasText: /^[0-9a-f]{64}$/ }).last().textContent())!;
  void request;
  expect(card).toBe(`M-10001-${hash.slice(0, 8).toUpperCase()}`);
});

test("admin opens a business from its reference", async ({ page }) => {
  await page.goto("/en/business/10037?as=owner", { waitUntil: "networkidle" });
  const ref = (await page.locator("[data-reference]").first().textContent())!.trim();
  await page.goto(`/en/admin?as=admin&q=${ref.toLowerCase()}`, { waitUntil: "networkidle" });
  await expect(page).toHaveURL(new RegExp(`/en/business/10037\\?as=admin&ref=${ref}$`));
  await expect(page.locator("[data-reference-note]")).toContainText(ref);
  await expect(page.locator("[data-reference-note]")).not.toContainText("earlier result");
  // The admin sees the credit result's technical record open in the aside (the profile panel has its own).
  await expect(page.locator("aside[data-tour=receipt] details[data-receipt][open]")).toHaveCount(1);
});

test("an old reference shows the earlier-result plate", async ({ page }) => {
  await page.goto("/en/admin?as=admin&q=M-10001-00000000", { waitUntil: "networkidle" });
  await expect(page.locator("[data-reference-note]")).toContainText("M-10001-00000000");
  await expect(page.locator("[data-reference-note]")).toContainText("This reference is from an earlier result.");
});

test("a research id inside a reference is rejected", async ({ page }) => {
  await page.goto("/en/admin?as=admin&q=M-42-7F3A9C2B", { waitUntil: "networkidle" });
  await expect(page).toHaveURL(/\/en\/admin\?/);
  await expect(page.locator("[data-reference-refused]")).toBeVisible();
});

test("print sheet shows the reference, not the scope, for the owner", async ({ page }) => {
  await page.goto("/en/business/10001/sheet?as=owner", { waitUntil: "networkidle" });
  await expect(page.locator("[data-reference]")).toHaveText(/^M-10001-[0-9A-F]{8}$/);
  expect(await technicalTraces(page)).toEqual([]);
  await page.goto("/en/business/10001/sheet?as=admin", { waitUntil: "networkidle" });
  await expect(page.getByText(/Covers the deterministic core only/)).toBeVisible();
});
