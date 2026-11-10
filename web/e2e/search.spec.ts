// I8 (DECISIONS 45): Ctrl+K search over fixed lists.
import { nameOf } from "../lib/business-names";
import { expect, test } from "@playwright/test";
import { expectAxeClean } from "./axe";

test("search opens from the button and the shortcut", async ({ page }) => {
  await page.goto("/en/business/10001", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Search this demo" })).toBeVisible();
  await expect(page.getByRole("combobox")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.keyboard.press("Control+k");
  await expect(page.getByRole("dialog", { name: "Search this demo" })).toBeVisible();
});

test("search jumps to a page, a term and a business", async ({ page }) => {
  const calls: string[] = [];
  page.on("request", (r) => calls.push(r.url()));
  await page.goto("/en/business/10001", { waitUntil: "networkidle" });
  calls.length = 0;
  const open = async () => {
    await page.keyboard.press("Control+k");
    return page.getByRole("combobox");
  };
  await (await open()).fill("forecast");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/en\/business\/10001\/forecast$/);
  await (await open()).fill("Hawl");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/en\/glossary#hawl$/);
  await (await open()).fill("10037");
  await expect(page.getByRole("option").first()).toContainText(`Open ${nameOf(10037, "en")} (10037)`);
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/en\/business\/10037$/);
  expect(calls.filter((u) => u.includes(":8000"))).toEqual([]);
});

test("search rejects a research id", async ({ page }) => {
  await page.goto("/en/business/10001", { waitUntil: "networkidle" });
  await page.keyboard.press("Control+k");
  await page.getByRole("combobox").fill("20001");
  await expect(page.getByRole("option").filter({ hasText: "(20001)" })).toHaveCount(0);
  await expect(page.getByText("Nothing matches.")).toBeVisible();
});

test("search returns focus on escape", async ({ page }) => {
  await page.goto("/en/business/10001", { waitUntil: "networkidle" });
  const button = page.getByRole("button", { name: "Search", exact: true });
  await button.click();
  await page.keyboard.press("Tab"); // focus stays inside the dialog
  await expect(page.getByRole("combobox")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(button).toBeFocused();
});

for (const locale of ["en", "ar"] as const)
  for (const theme of ["light", "dark"] as const)
    test(`search passes axe: ${locale} ${theme}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      await page.goto(`/${locale}/business/10001`, { waitUntil: "networkidle" });
      await page.keyboard.press("Control+k");
      await expect(page.getByRole("dialog")).toBeVisible();
      await expectAxeClean(page);
    });
