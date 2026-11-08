// E10: the searchable admin list (DECISIONS 43). Axe at desktop and 390 px comes from pages.ts.
import { expect, test } from "@playwright/test";
import { apiEnv } from "./helpers";

async function apiList(query: string) {
  const { MAAL_API_URL, MAAL_API_KEY } = apiEnv();
  const res = await fetch(`${MAAL_API_URL}/businesses?${query}`, { headers: { "X-API-Key": MAAL_API_KEY } });
  return (await res.json()) as { total: number; businesses: { business_id: number; sector: string }[] };
}

test("admin list pages through businesses", async ({ page }) => {
  const first = await apiList("offset=0&limit=25");
  const second = await apiList("offset=25&limit=25");
  await page.goto("/en/admin?as=admin", { waitUntil: "networkidle" });
  const table = page.getByRole("region", { name: "Serving business list" });
  await expect(table.locator("tbody tr")).toHaveCount(first.businesses.length);
  await expect(table.locator("tbody tr").first()).toContainText(String(first.businesses[0]!.business_id));
  await page.getByRole("link", { name: "Next page" }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(page).toHaveURL(/as=admin/);
  await expect(table.locator("tbody tr").first()).toContainText(String(second.businesses[0]!.business_id));
  await page.getByRole("link", { name: "Previous page" }).click();
  await expect(page).not.toHaveURL(/page=/);
});

test("admin search and sector filter", async ({ page }) => {
  const expected = await apiList("q=1002&sector=retail_trade&limit=25");
  await page.goto("/en/admin?as=admin", { waitUntil: "networkidle" });
  await page.getByLabel(/^Business ID starts with/).fill("1002");
  await page.locator('select[name="sector"]').selectOption("retail_trade");
  await page.getByRole("button", { name: "Search" }).click();
  await expect(page).toHaveURL(/q=1002/);
  await expect(page).toHaveURL(/sector=retail_trade/);
  const rows = page.getByRole("region", { name: "Serving business list" }).locator("tbody tr");
  await expect(rows).toHaveCount(expected.businesses.length);
  for (const row of await rows.all()) await expect(row).toContainText(/1002\d+/);
  await page.getByRole("link", { name: "Clear" }).click();
  // Same route, new query: the page waits for its list, queued behind the five demo rows (lib/api.ts).
  await expect(page).not.toHaveURL(/q=/, { timeout: 20_000 });
});

test("admin list shows serving population", async ({ page }) => {
  const all = await apiList("limit=1");
  await page.goto("/en/admin", { waitUntil: "networkidle" });
  await expect(page.getByText(`${all.total} serving businesses`)).toBeVisible();
});

test("search, sector and page are handled on the server from the URL alone", async ({ request }) => {
  // No browser script runs here: the HTML the server sends already holds the filtered page. (The page
  // streams, so a browser with JavaScript off shows the loading state; see DECISIONS 43.)
  const some = await apiList("q=1003&sector=retail_trade&limit=25");
  const html = await (await request.get("/en/admin?q=1003&sector=retail_trade")).text();
  expect(html).toContain(`${some.total}`);
  for (const b of some.businesses) expect(html).toContain(`Open business ${b.business_id}`);
  const page2 = await apiList("offset=25&limit=25");
  const html2 = await (await request.get("/en/admin?page=2")).text();
  expect(html2).toContain(`Open business ${page2.businesses[0]!.business_id}`);
});
