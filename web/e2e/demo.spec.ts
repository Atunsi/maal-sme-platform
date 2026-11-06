// The demo sign-in, the admin list and the landing page (DECISIONS 42).
import { expect, test } from "@playwright/test";
import index from "../scenarios-data/index.json";
import { apiEnv } from "./helpers";

const TYPED = "demo-secret-value";

test("sign-in sends no request and stores nothing", async ({ page, context }) => {
  await page.goto("/en/sign-in", { waitUntil: "networkidle" });
  const requests: { url: string; body: string | null; method: string }[] = [];
  page.on("request", (request) => requests.push({ url: request.url(), body: request.postData(), method: request.method() }));

  await page.getByLabel("Commercial registration number").fill(TYPED);
  await page.getByLabel("Password").fill(TYPED);
  await page.getByRole("button", { name: "Admin" }).click();
  await page.getByLabel("Work email").fill(`${TYPED}@bank.sa`);
  await page.getByRole("button", { name: "Business owner" }).click();
  await page.waitForTimeout(300);
  expect(requests).toEqual([]);

  await page.getByRole("button", { name: "Sign in to my business" }).click();
  await expect(page).toHaveURL(/\/en\/business\/10001\?as=owner$/);
  await expect(page.getByText("Owner of business 10001")).toBeVisible();

  expect(requests.filter(({ method }) => method !== "GET")).toEqual([]);
  expect(requests.filter(({ url, body }) => `${url}${body ?? ""}`.includes(TYPED))).toEqual([]);
  expect(await context.cookies()).toEqual([]);
  const stored = await page.evaluate(() => ({ local: Object.keys(localStorage), session: Object.keys(sessionStorage).filter((key) => !key.startsWith("__next")) }));
  expect(stored).toEqual({ local: [], session: [] });
});

test("sign-in says what it is, on the page", async ({ page }) => {
  await page.goto("/en/sign-in");
  await expect(page.getByText("Demo sign-in. No accounts exist and nothing you type is checked or saved.")).toBeVisible();
  await expect(page.locator("footer")).toContainText("Synthetic data only. Population: serving.");
});

test("the Admin role routes to the admin page and shows in the header", async ({ page }) => {
  await page.goto("/en/sign-in", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Admin" }).click();
  await page.getByRole("button", { name: "Sign in as admin" }).click();
  await expect(page).toHaveURL(/\/en\/admin\?as=admin$/);
  await expect(page.getByRole("heading", { name: "All businesses" })).toBeVisible();
  await expect(page.getByText("Signed in as")).toBeVisible();
});

test("the demo role stays in the URL as the visitor moves between pages", async ({ page }) => {
  await page.goto("/en/business/10016?as=owner", { waitUntil: "networkidle" });
  await page.getByRole("link", { name: "Zakat", exact: true }).first().click();
  await expect(page).toHaveURL(/\/business\/10016\/zakat\?as=owner$/);
  await expect(page.getByText("Owner of business 10016")).toBeVisible();
});

test("admin rows read their status and decision from the API", async ({ page }) => {
  const { MAAL_API_URL, MAAL_API_KEY } = apiEnv();
  await page.goto("/en/admin", { waitUntil: "networkidle" });
  const rows = page.getByRole("region", { name: "Businesses" }).locator("tbody tr");
  await expect(rows).toHaveCount(5);
  for (const id of [10001, 10003, 10004, 10037, 10040]) {
    const res = await fetch(`${MAAL_API_URL}/lenses/credit?business_id=${id}`, { headers: { "X-API-Key": MAAL_API_KEY } });
    const { status, credit } = (await res.json()) as { status: string; credit: { decision: string } | null };
    const row = rows.filter({ hasText: String(id) });
    await expect(row).toContainText({ scored: "Scored", partial_profile: "Partial profile", insufficient_data: "Insufficient data" }[status]!);
    await expect(row).toContainText(credit ? (credit.decision === "approved" ? "Approved" : "Declined") : "Not run");
  }
});

test("admin links open a business with the admin role", async ({ page }) => {
  await page.goto("/en/admin?as=admin", { waitUntil: "networkidle" });
  await page.getByRole("link", { name: "Open 10004" }).click();
  await expect(page).toHaveURL(/\/en\/business\/10004\?as=admin$/);
  await expect(page.getByText("Signed in as")).toBeVisible();
});

test("the landing counts come from the code", async ({ page }) => {
  await page.goto("/en", { waitUntil: "networkidle" });
  const counts = page.getByRole("region", { name: "Ma'al in numbers" });
  await expect(counts).toContainText(`${index.scenarios.length}fixed stress scenarios`);
  await expect(counts).toContainText("4lenses on every business");
  await expect(counts).toContainText("2languages, Arabic and English");
});

test("the landing card is the baseline scenario object, labelled synthetic", async ({ page }) => {
  await page.goto("/en", { waitUntil: "networkidle" });
  await expect(page.getByText("Illustrative, synthetic data")).toBeVisible();
  await expect(page.getByRole("link", { name: "Sign in to the demo" })).toBeVisible();
  await page.getByRole("link", { name: `See the ${index.scenarios.length} scenarios` }).click();
  await expect(page).toHaveURL(/\/en\/scenarios$/);
});

test("the landing lens cards open the demo pages for 10001", async ({ page }) => {
  await page.goto("/en");
  await page.getByRole("link", { name: /Open the Zakat page/ }).click();
  await expect(page).toHaveURL(/\/en\/business\/10001\/zakat$/);
});

test("the FAQ uses native details", async ({ page }) => {
  await page.goto("/en");
  const answer = page.getByText("Every business in the demo is synthetic.", { exact: false });
  await expect(answer).toBeHidden();
  await page.getByText("Is the data real?").click();
  await expect(answer).toBeVisible();
});

test("clicking a timeline mark highlights its table row", async ({ page }) => {
  await page.goto("/en/business/10001/review", { waitUntil: "networkidle" });
  await page.locator("button.tick").nth(3).click();
  await expect(page.locator('tbody tr[data-picked="true"]')).toHaveCount(1);
});
