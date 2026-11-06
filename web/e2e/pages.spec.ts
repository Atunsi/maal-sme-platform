// Guards 6 and 7: every page renders in both locales and both themes, with no serious or critical axe
// violation. Reduced motion puts every element in its final state, so axe measures the real colours.
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { LOCALES, PAGES, THEMES } from "./pages";

const FOOTER = { en: "Synthetic data only. Population: serving.", ar: "بيانات اصطناعية فقط. المجموعة: الخدمة." };

for (const theme of THEMES) {
  for (const locale of LOCALES) {
    for (const path of PAGES) {
      test(`renders and passes axe: /${locale}${path} (${theme})`, async ({ page }) => {
        await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
        await page.goto(`/${locale}${path}`, { waitUntil: "networkidle" });

        await expect(page.locator("html")).toHaveAttribute("lang", locale);
        await expect(page.locator("html")).toHaveAttribute("dir", locale === "ar" ? "rtl" : "ltr");
        await expect(page.locator("html")).toHaveClass(new RegExp(`th-${theme}`));
        await expect(page.locator("main [role=alert]")).toHaveCount(0);
        await expect(page.locator("footer")).toContainText(FOOTER[locale]); // U11, as amended
        await expect(page.getByText(locale === "ar" ? "جارٍ التحميل" : "Loading", { exact: true })).toHaveCount(0);

        const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
        const blocking = violations.filter((v) => v.impact === "serious" || v.impact === "critical");
        expect(blocking.map((v) => `${v.id}: ${v.nodes[0]?.target}`)).toEqual([]);
      });
    }
  }
}
