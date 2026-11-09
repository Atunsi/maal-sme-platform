// E9: "How Ma'al decides" (DECISIONS 51). Axe, themes and the symbol guard come from pages.ts.
import { expect, test } from "@playwright/test";

for (const locale of ["en", "ar"] as const) {
  test(`how it works renders in both locales and themes: ${locale}`, async ({ page }) => {
    for (const theme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: theme });
      await page.goto(`/${locale}/how-it-works`, { waitUntil: "networkidle" });
      await expect(page.locator("main h2")).toHaveCount(9);
      await expect(page.locator("main [data-term]").first()).toBeVisible();
    }
  });
}

test("linked from the footer and the landing FAQ; sections open the demo business", async ({ page }) => {
  await page.goto("/en", { waitUntil: "networkidle" });
  await page.getByRole("link", { name: "Read how Ma'al decides" }).click();
  await expect(page).toHaveURL(/\/en\/how-it-works$/);
  await page.getByRole("link", { name: "Open the Zakat page" }).click();
  await expect(page).toHaveURL(/\/en\/business\/10001\/zakat$/);
  await page.locator("footer").getByRole("link", { name: "How Ma'al decides" }).click();
  await expect(page).toHaveURL(/\/en\/how-it-works$/);
});
