// DECISIONS 59 (L1): the drifting logo band is gone from every page. The section mark stays.
import { expect, test } from "@playwright/test";

const PAGES = ["", "/sign-in", "/business/10001", "/business/10001/credit"];

for (const locale of ["en", "ar"] as const) {
  for (const path of PAGES) {
    test(`no logo band on any page: /${locale}${path}`, async ({ page }) => {
      await page.goto(`/${locale}${path}`, { waitUntil: "networkidle" });
      await expect(page.locator("main, body").first()).toBeVisible();
      await expect(page.locator(".weave")).toHaveCount(0);
      // Nothing on the page still runs the band's animation.
      const names = await page.evaluate(() => document.getAnimations().map((a) => (a as CSSAnimation).animationName ?? ""));
      expect(names).not.toContain("weave");
    });
  }
}
