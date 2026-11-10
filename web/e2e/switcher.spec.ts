// I1 (DECISIONS 45): the header's business switcher.
import { expect, test, type Page } from "@playwright/test";
import { expectAxeClean } from "./axe";

async function openSwitcher(page: Page) {
  if ((page.viewportSize()?.width ?? 1280) < 768) await page.getByRole("button", { name: "Menu" }).click();
  await page.getByRole("button", { name: "Business", exact: true }).click();
  return page.getByRole("combobox", { name: /Open another business/ });
}

test("business switcher keeps the lens page and role", async ({ page }) => {
  await page.goto("/en/business/10001/zakat?as=admin", { waitUntil: "networkidle" });
  await openSwitcher(page);
  const option = page.getByRole("option").filter({ hasText: "10004" });
  await expect(option).toBeVisible();
  // Each demo business shows its decision plate, read from the API through a server action.
  await expect(page.getByRole("option").filter({ hasText: "10037" }).locator(".plate")).toHaveText("Approved, conditional");
  await option.click();
  await expect(page).toHaveURL(/\/en\/business\/10004\/zakat\?as=admin$/);
});

test("business switcher searches serving ids only", async ({ page }) => {
  await page.goto("/en/business/10001/credit", { waitUntil: "networkidle" });
  const box = await openSwitcher(page);
  await box.fill("1002");
  const options = page.getByRole("option");
  await expect(options.first()).toContainText("1002");
  const ids = (await options.allTextContents()).map((t) => Number(t.match(/\d{5}/)![0]));
  expect(ids.length).toBeGreaterThan(0);
  expect(ids.length).toBeLessThanOrEqual(10);
  for (const id of ids) {
    expect(String(id).startsWith("1002")).toBe(true);
    expect(id).toBeGreaterThanOrEqual(10001);
    expect(id).toBeLessThanOrEqual(10300);
  }
  await box.fill("99");
  await expect(page.getByText("No serving business matches.")).toBeVisible();
  // No request from the browser goes to the API itself.
  const calls: string[] = [];
  page.on("request", (r) => calls.push(r.url()));
  await box.fill("1001");
  await expect(options.first()).toContainText("1001");
  expect(calls.filter((u) => u.includes(":8000"))).toEqual([]);
});

test("business switcher works from the keyboard", async ({ page }) => {
  await page.goto("/en/business/10001/forecast?as=owner", { waitUntil: "networkidle" });
  const button = page.getByRole("button", { name: "Business", exact: true });
  await button.focus();
  await page.keyboard.press("Enter");
  const box = page.getByRole("combobox", { name: /Open another business/ });
  await expect(box).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(box).toHaveCount(0);
  await expect(button).toBeFocused();
  await page.keyboard.press("Enter");
  await page.keyboard.press("ArrowDown"); // the second demo business
  await expect(box).toHaveAttribute("aria-activedescendant", /o1$/);
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/en\/business\/10004\/forecast\?as=owner$/);
});

for (const width of [1280, 390]) {
  for (const locale of ["en", "ar"] as const) {
    test(`business switcher passes axe at ${width} px: ${locale}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/${locale}/business/10001`, { waitUntil: "networkidle" });
      if (width < 768) await page.getByRole("button", { name: locale === "en" ? "Menu" : "القائمة" }).click();
      await page.getByRole("button", { name: locale === "en" ? "Business" : "المنشأة", exact: true }).click();
      await expect(page.getByRole("listbox")).toBeVisible();
      await expectAxeClean(page);
    });
  }
}
