// E2: the printable decision sheet (DECISIONS 51).
import { expect, test } from "@playwright/test";

test("print sheet shows the required labels", async ({ page }) => {
  await page.emulateMedia({ media: "print" });
  await page.goto("/en/business/10001/sheet", { waitUntil: "networkidle" });
  const sheet = page.locator("article.sheet");
  await expect(sheet).toContainText("Rule-based screening, pending Sharia-advisor confirmation"); // U6
  await expect(sheet).toContainText("Nisab price is a commercial quote, pending independent verification"); // U7
  await expect(sheet).toContainText("Not a ZATCA assessment");
  await expect(sheet).toContainText("Base markup, fixed at signing"); // U1
  await expect(sheet).toContainText("go to charity"); // U2
  await expect(sheet).toContainText("Population: Serving"); // U11
  await expect(sheet).toContainText("verify: python -m pipeline.verify <file>"); // U13, scope verbatim
  await expect(page.locator("footer p")).toContainText("Synthetic data only. Population: serving."); // U11, U15 note
});

test("print sheet hides navigation and toggles", async ({ page }) => {
  await page.emulateMedia({ media: "print" });
  await page.goto("/en/business/10001/sheet?as=admin", { waitUntil: "networkidle" });
  for (const selector of ["header", "nav", ".weave", "button", "[data-print-hide]"]) {
    for (const el of await page.locator(selector).all()) await expect(el).toBeHidden();
  }
  expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
  // Light tokens on paper whatever the theme.
  await page.emulateMedia({ media: "print", colorScheme: "dark" });
  await page.reload({ waitUntil: "networkidle" });
  expect(["#fff", "#ffffff"]).toContain(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--surface").trim().toLowerCase()));
});

test("print sheet insufficient_data for 10003", async ({ page }) => {
  await page.emulateMedia({ media: "print" });
  await page.goto("/en/business/10003/sheet", { waitUntil: "networkidle" });
  await expect(page.locator("article.sheet")).toContainText("Insufficient data");
  await expect(page.locator("article.sheet")).toContainText("Not scored");
  await expect(page.locator("article.sheet")).not.toContainText("Base markup, fixed at signing");
});

test("print sheet renders in arabic rtl", async ({ page }) => {
  await page.emulateMedia({ media: "print" });
  await page.goto("/ar/business/10001/sheet", { waitUntil: "networkidle" });
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.locator("article.sheet h1")).toContainText("ورقة القرار");
  await expect(page.locator("article.sheet")).toContainText("هامش");
});

test("the overview and the sheet both offer print", async ({ page }) => {
  await page.goto("/en/business/10004", { waitUntil: "networkidle" });
  await page.evaluate(() => {
    (window as unknown as { printed: number }).printed = 0;
    window.print = () => void ((window as unknown as { printed: number }).printed += 1);
  });
  await page.getByRole("button", { name: "Print or save as PDF" }).click();
  expect(await page.evaluate(() => (window as unknown as { printed: number }).printed)).toBe(1);
  await page.getByRole("link", { name: "Decision sheet" }).click();
  await expect(page).toHaveURL(/\/en\/business\/10004\/sheet$/);
  await expect(page.getByRole("button", { name: "Print or save as PDF" })).toBeVisible();
});
