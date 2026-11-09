// B21 (DECISIONS 45): visual snapshots replace the hand-taken PNGs. Baselines live in visual.spec.ts-snapshots/.
// Anything that changes between runs without the page changing (hashes, commit IDs, receipts) is masked.
import { expect, test, type Page } from "@playwright/test";

const PAGES = [
  ["landing", ""],
  ["overview", "/business/10001"],
  ["credit", "/business/10001/credit"],
  ["compliance", "/business/10001/credit?view=compliance"],
  ["zakat", "/business/10001/zakat"],
  ["forecast", "/business/10001/forecast"],
  ["review", "/business/10001/review"],
  ["scenarios", "/scenarios?s=severe_collapse"],
] as const;

// Only what is on screen: hidden elements (closed receipts, the collapsed profile table) would be masked at
// meaningless positions and cover real content.
const masks = (page: Page) => [page.locator("[data-latin]").filter({ visible: true }), page.locator("code").filter({ visible: true })];

async function shoot(page: Page, path: string, name: string) {
  await page.goto(path, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await expect(page).toHaveScreenshot(`${name}.png`, { fullPage: true, animations: "disabled", mask: masks(page), maxDiffPixelRatio: 0.002 });
}

test.describe.configure({ mode: "serial" });

for (const theme of ["light", "dark"] as const) {
  for (const locale of ["en", "ar"] as const) {
    for (const [name, path] of PAGES) {
      test(`visual: ${name} ${locale} ${theme} 1280`, async ({ page }) => {
        await page.setViewportSize({ width: 1280, height: 900 });
        await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
        await shoot(page, `/${locale}${path}`, `${name}-${locale}-${theme}-1280`);
      });
    }
  }
}

for (const locale of ["en", "ar"] as const) {
  for (const [name, path] of PAGES.filter(([n]) => n === "overview" || n === "scenarios")) {
    test(`visual: ${name} ${locale} light 390`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
      await shoot(page, `/${locale}${path}`, `${name}-${locale}-light-390`);
    });
  }
}
