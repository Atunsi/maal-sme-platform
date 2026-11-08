// E11: the API does not send the cap (S9, DECISIONS 44), so the review queue shows the count alone.
import { expect, test } from "@playwright/test";

test("review queue falls back to count when limits absent", async ({ page }) => {
  await page.goto("/en/business/10037/review", { waitUntil: "networkidle" });
  await expect(page.locator("[data-slots]")).toHaveCount(0);
  await expect(page.getByText(/listed, from [\d,]+ transactions scanned/)).toBeVisible();
});
