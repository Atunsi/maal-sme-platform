// E12: the custom scenario builder (DECISIONS 51). Axe and the phone checks come from pages.ts.
import { expect, test } from "@playwright/test";
import { apiEnv } from "./helpers";

test("custom builder renders bounds from the api", async ({ page }) => {
  const { MAAL_API_URL, MAAL_API_KEY } = apiEnv();
  const catalog = (await (await fetch(`${MAAL_API_URL}/scenarios`, { headers: { "X-API-Key": MAAL_API_KEY } })).json()) as {
    shock_types: Record<string, { params: Record<string, { min: number; max: number; step: number }> }>;
  };
  await page.goto("/en/scenarios", { waitUntil: "networkidle" });
  await page.getByRole("link", { name: "Build a custom scenario" }).click();
  await expect(page).toHaveURL(/\/en\/scenarios\/custom$/);
  for (const [type, spec] of Object.entries(catalog.shock_types)) {
    for (const [name, b] of Object.entries(spec.params)) {
      const input = page.locator(`input[name="${type}.${name}"]`);
      await expect(input).toHaveAttribute("min", String(b.min));
      await expect(input).toHaveAttribute("max", String(b.max));
    }
  }
});

test("custom builder blocks out of bound values", async ({ page }) => {
  await page.goto("/en/scenarios/custom", { waitUntil: "networkidle" });
  await page.locator('input[name="include"][value="cash_crunch"]').check();
  await page.locator('input[name="cash_crunch.severity_pct"]').fill("95");
  await page.getByRole("button", { name: "Run scenario" }).click();
  await expect(page).toHaveURL(/\/en\/scenarios\/custom$/); // the browser refused to submit
  expect(await page.locator('input[name="cash_crunch.severity_pct"]').evaluate((el: HTMLInputElement) => el.validity.rangeOverflow)).toBe(true);
  // A hand-made URL past the bounds reaches the API, which refuses it with its own reason.
  await page.goto("/en/scenarios/custom?shock=cash_crunch.16.95", { waitUntil: "networkidle" });
  await expect(page.locator("[data-custom-error]")).toContainText("The API refused the request:");
  await expect(page.locator("[data-custom-error]")).toContainText("severity_pct");
});

test("custom builder shows the custom plate and receipt", async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto("/en/scenarios/custom", { waitUntil: "networkidle" });
  await page.locator('input[name="include"][value="cash_crunch"]').check();
  await page.locator('input[name="cash_crunch.week"]').fill("16");
  await page.locator('input[name="cash_crunch.severity_pct"]').fill("40");
  await page.locator('input[name="include"][value="large_transfer"]').check();
  await page.locator('input[name="large_transfer.week"]').fill("10");
  await page.getByRole("button", { name: "Run scenario" }).click();
  await expect(page).toHaveURL(/shock=cash_crunch\.16\.40&shock=large_transfer\.10/);
  const result = page.locator("[data-custom-result]");
  await expect(result).toBeVisible({ timeout: 60_000 });
  await expect(result).toContainText("Custom scenario, not part of the library");
  await expect(result).toContainText("Each scenario is a single business (N = 1)");
  const chosen = result.locator("details[data-receipt]").nth(1);
  await chosen.locator("summary").click();
  await expect(chosen.getByRole("button", { name: "Copy output_sha256" })).toBeVisible();
  await expect(chosen.locator("[data-rerun]")).toHaveCount(0);
  await chosen.getByLabel("Check a hash").fill("0".repeat(64));
  await chosen.getByRole("button", { name: "Check", exact: true }).click();
  await expect(chosen.getByText("No match", { exact: true })).toBeVisible();
  // The shocks stay in the URL: a reload shows the same result.
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.locator("[data-custom-result]")).toContainText("Custom scenario, not part of the library");
});

test("custom builder handles 422 and 503", async ({ page }) => {
  await page.goto("/en/scenarios/custom?shock=large_transfer.99", { waitUntil: "networkidle" });
  const error = page.locator("[data-custom-error]");
  await expect(error).toContainText("The API refused the request:");
  await expect(error).toContainText("week must be a whole number");
  await expect(error.getByRole("link", { name: "Run again" })).toHaveCount(0);
  // A 503 cannot be forced from a real API in a test; tests/custom.test.tsx covers it with the API mocked.
  await page.goto("/en/scenarios/custom", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Run scenario" }).click();
  await expect(page.getByText("Pick at least one shock.")).toBeVisible();
});

test("builder focuses the result after a run", async ({ page }) => {
  // I5: start from a library scenario, run it, and land on the result heading with a copyable link.
  test.setTimeout(120_000);
  await page.goto("/en/scenarios/custom", { waitUntil: "networkidle" });
  await page.locator("select[data-start-from]").selectOption("mild_slowdown");
  await expect(page.locator('input[name="include"][value="cash_crunch"]')).toBeChecked();
  await page.getByRole("button", { name: "Run scenario" }).click();
  const heading = page.locator("#custom-result");
  await expect(heading).toBeFocused({ timeout: 60_000 });
  await expect(page).toHaveURL(/shock=cash_crunch.18.15/); // mild_slowdown's own shock
  await expect(page).not.toHaveURL(/ran=1/);
  await expect(page.locator("[data-copy-link] button")).toBeVisible();
});
