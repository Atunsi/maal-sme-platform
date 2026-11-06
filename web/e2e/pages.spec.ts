// Guards 6 and 7: every page renders in both locales, with no serious or critical axe violation.
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { PAGES } from "./pages";

for (const locale of ["en", "ar"]) {
  for (const path of PAGES) {
    test(`renders and passes axe: /${locale}${path}`, async ({ page }) => {
      await page.goto(`/${locale}${path}`, { waitUntil: "networkidle" });

      await expect(page.locator("html")).toHaveAttribute("lang", locale);
      await expect(page.locator("html")).toHaveAttribute("dir", locale === "ar" ? "rtl" : "ltr");
      await expect(page.locator("main [role=alert]")).toHaveCount(0);
      await expect(page.locator("footer")).toBeVisible();
      await expect(page.locator("footer")).toContainText(locale === "ar" ? "بيانات اصطناعية فقط. المجموعة: الخدمة." : "Synthetic data only. Population: serving."); // U11, as amended
      await expect(page.getByText(locale === "ar" ? "جارٍ التحميل" : "Loading")).toHaveCount(0);

      const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
      const blocking = violations.filter((v) => v.impact === "serious" || v.impact === "critical");
      expect(blocking.map((v) => `${v.id}: ${v.nodes[0]?.target}`)).toEqual([]);
    });
  }
}
