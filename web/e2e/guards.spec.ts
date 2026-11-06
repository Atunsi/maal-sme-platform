// Guards from the redesign (DECISIONS 42), run against the real pages.
import { expect, test } from "@playwright/test";
import { LOCALES, PAGES } from "./pages";

const BANNED = /[✓✔✕✗×!→←▶◀Δ·…—]/;

for (const locale of LOCALES) {
  for (const path of PAGES) {
    test(`no symbol characters in rendered text: /${locale}${path}`, async ({ page }) => {
      await page.goto(`/${locale}${path}`, { waitUntil: "networkidle" });
      const texts = await page.evaluate(() => {
        const found: string[] = [];
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          const tag = node.parentElement?.tagName;
          if (tag !== "SCRIPT" && tag !== "STYLE") found.push(node.textContent ?? "");
        }
        return found;
      });
      expect(texts.filter((text) => BANNED.test(text))).toEqual([]);
    });
  }
}

test("the dark theme follows the system and the choice survives a reload, with no cookie", async ({ page, context }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/en/scenarios");
  const html = page.locator("html");
  await expect(html).toHaveClass(/th-dark/);

  await page.getByRole("button", { name: "Light theme" }).click();
  await expect(html).toHaveClass(/th-light/);
  await page.reload();
  await expect(html).toHaveClass(/th-light/);
  expect(await context.cookies()).toEqual([]);
});
