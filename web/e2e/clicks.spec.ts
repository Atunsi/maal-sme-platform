// Guard 10: the controls, clicked. Each test uses its own business because of the API's per-business
// rate limit, so the page-load tests can't push another test over it.
import { nameOf } from "../lib/business-names";
import { expect, test } from "@playwright/test";
import { apiEnv } from "./helpers";

test("compliance toggle switches the view and updates the URL", async ({ page }) => {
  await page.goto("/en/business/10002/credit", { waitUntil: "networkidle" });
  const view = page.getByTestId("compliance-view");
  const compliance = page.getByRole("button", { name: "Compliance View" });
  const publicView = page.getByRole("button", { name: "Public view" });

  await expect(view).toBeHidden();
  await compliance.click();
  await expect(view).toBeVisible();
  await expect(compliance).toHaveAttribute("aria-pressed", "true");
  await expect(page).toHaveURL(/\?view=compliance$/);

  await publicView.click();
  await expect(view).toBeHidden();
  await expect(page).not.toHaveURL(/view=compliance/);
});

test("compliance toggle works from the keyboard and shows a focus ring", async ({ page }) => {
  await page.goto("/en/business/10006/credit", { waitUntil: "networkidle" });
  const compliance = page.getByRole("button", { name: "Compliance View" });
  await compliance.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("compliance-view")).toBeVisible();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Shift+Tab");
  await expect(compliance).toBeFocused();
  const outline = await compliance.evaluate((el) => getComputedStyle(el).outlineStyle);
  expect(outline).toBe("solid");
});

test("credit view and URL never disagree after back", async ({ page }) => {
  // B5: the toggle replaces the history entry, so Back leaves the credit page instead of flipping the view.
  await page.goto("/en/business/10009", { waitUntil: "networkidle" });
  await page.goto("/en/business/10009/credit", { waitUntil: "networkidle" });
  const view = page.getByTestId("compliance-view");
  await page.getByRole("button", { name: "Compliance View" }).click();
  await expect(page).toHaveURL(/\/credit\?view=compliance$/);
  await expect(view).toBeVisible();
  await page.getByRole("button", { name: "Public view" }).click();
  await expect(page).toHaveURL(/\/credit$/);
  await expect(view).toBeHidden();
  await page.goBack();
  await expect(page).toHaveURL(/\/en\/business\/10009$/);
  await page.goForward();
  await expect(page).toHaveURL(/\/credit$/);
  await expect(view).toBeHidden();
  await expect(page.getByRole("button", { name: "Public view" })).toHaveAttribute("aria-pressed", "true");
});

test("a shared ?view=compliance link opens the Compliance View", async ({ page }) => {
  await page.goto("/en/business/10007/credit?view=compliance", { waitUntil: "networkidle" });
  await expect(page.getByTestId("compliance-view")).toBeVisible();
});

test("language toggle keeps the page, the business and the view", async ({ page }) => {
  await page.goto("/en/business/10008/credit", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Compliance View" }).click();
  await expect(page).toHaveURL(/\?view=compliance$/);

  await page.getByRole("link", { name: /العربية/ }).click();
  await expect(page).toHaveURL(/\/ar\/business\/10008\/credit\?view=compliance$/);
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByTestId("compliance-view")).toBeVisible();

  await page.getByRole("link", { name: /English/ }).click();
  await expect(page).toHaveURL(/\/en\/business\/10008\/credit\?view=compliance$/);
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
});

test("language toggle keeps the chosen scenario", async ({ page }) => {
  await page.goto("/en/scenarios?s=severe_collapse");
  await page.getByRole("link", { name: /العربية/ }).click();
  await expect(page).toHaveURL(/\/ar\/scenarios\?s=severe_collapse$/);
});

test("scenario menu changes the chosen scenario", async ({ page }) => {
  await page.goto("/en/scenarios?s=severe_collapse");
  await page.getByRole("link", { name: /^Newcomer/ }).click();
  await expect(page).toHaveURL(/s=thin_file_newcomer$/);
  await expect(page.getByRole("link", { name: /^Newcomer/ })).toHaveAttribute("aria-current", "page");
  await expect(page.getByText("This is a refusal to score.", { exact: false })).toBeVisible();
});

test("picker: a valid ID opens the dashboard", async ({ page }) => {
  await page.goto("/en/admin", { waitUntil: "networkidle" });
  await page.getByRole("combobox", { name: "Find a business by name or ID" }).fill("10009");
  await page.getByRole("button", { name: "Open", exact: true }).click();
  await expect(page).toHaveURL(/\/en\/business\/10009$/);
  await expect(page.getByRole("heading", { name: nameOf(10009, "en") })).toBeVisible();
});

for (const value of ["9999", "11001", "abc", "10001.5", ""]) {
  test(`picker: "${value}" is refused before any call`, async ({ page }) => {
    await page.goto("/en/admin", { waitUntil: "networkidle" });
    await page.getByRole("combobox", { name: "Find a business by name or ID" }).fill(value);
    await page.getByRole("button", { name: "Open", exact: true }).click();
    await expect(page.locator("main").getByRole("alert")).toContainText("No serving business matches");
    await expect(page).toHaveURL(/\/en\/admin$/);
  });
}

test("a serving-range ID the store does not hold says so", async ({ page }) => {
  const { serving_businesses } = await (await fetch(`${apiEnv().MAAL_API_URL}/health`)).json();
  test.skip(serving_businesses >= 1000, "the full store holds every serving ID");
  await page.goto("/en/business/10999", { waitUntil: "networkidle" });
  await expect(page.locator("main").getByRole("alert")).toContainText("not in the serving population");
});

test("a research ID in the URL is refused", async ({ page }) => {
  await page.goto("/en/business/5", { waitUntil: "networkidle" });
  await expect(page.locator("main").getByRole("alert")).toContainText("not in the serving population");
});

test("receipt panel opens and shows the scope verbatim", async ({ page }) => {
  await page.goto("/en/business/10010/zakat", { waitUntil: "networkidle" });
  const summary = page.getByText("Technical record: Zakat") // DECISIONS 58;
  const scope = page.locator("details", { has: summary }).getByText("Covers the deterministic core only", { exact: false });
  await expect(scope).toBeHidden();
  await summary.click();
  await expect(scope).toBeVisible();
});

test("429: every card says so, and retry recovers once the window passes", async ({ page }) => {
  test.setTimeout(150_000);
  const { MAAL_API_URL, MAAL_API_KEY } = apiEnv();
  const id = 10011;
  // Real requests, one at a time because of the store bug, until the API starts refusing.
  for (let i = 0; i < 70; i += 1) {
    const res = await fetch(`${MAAL_API_URL}/lenses/zakat?business_id=${id}`, { headers: { "X-API-Key": MAAL_API_KEY } });
    if (res.status === 429) break;
  }
  const limited = Date.now();

  await page.goto(`/en/business/${id}`, { waitUntil: "networkidle" });
  await expect(page.locator("main").getByRole("alert").first()).toContainText("request limit");
  const retry = page.getByRole("button", { name: "Try again" }).first();
  await expect(retry).toBeVisible();

  await page.waitForTimeout(Math.max(0, 62_000 - (Date.now() - limited)));
  await retry.click();
  await expect(page.locator("main [role=alert]")).toHaveCount(0, { timeout: 20_000 });
  await expect(page.getByRole("heading", { name: nameOf(id, "en") })).toBeVisible();
});

test("401: a wrong server key shows a setup error, not a login form", async ({ page }) => {
  await page.goto("http://127.0.0.1:3001/en/business/10012", { waitUntil: "networkidle" });
  await expect(page.locator("main").getByRole("alert").first()).toContainText("Setup error");
  await expect(page.locator("input[type=password]")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Try again" })).toHaveCount(0);
});

test("the key never appears in what the browser receives", async ({ page }) => {
  const { MAAL_API_KEY } = apiEnv();
  const bodies: string[] = [];
  page.on("response", async (res) => {
    const text = await res.text().catch(() => "");
    bodies.push(text);
  });
  await page.goto("/en/business/10013", { waitUntil: "networkidle" });
  expect(bodies.length).toBeGreaterThan(1);
  expect(bodies.filter((text) => text.includes(MAAL_API_KEY))).toEqual([]);
});

test("a first-pass ?view=compliance link on the overview lands on the credit page", async ({ page }) => {
  await page.goto("/en/business/10014?view=compliance", { waitUntil: "networkidle" });
  await expect(page).toHaveURL(/\/en\/business\/10014\/credit\?view=compliance$/);
  await expect(page.getByTestId("compliance-view")).toBeVisible();
});

test("credit factor opens its raw value from the profile", async ({ page }) => {
  // I3: the disclosure fetches /profile once, through a server action, and shows the raw named value.
  await page.goto("/en/business/10016/credit", { waitUntil: "networkidle" });
  const posts: string[] = [];
  page.on("request", (r) => {
    if (r.method() === "POST") posts.push(r.url());
  });
  const buttons = page.locator("button[data-factor]");
  expect(await buttons.count()).toBeGreaterThan(0);
  await buttons.first().click();
  const panel = page.locator("[data-factor-panel]").first();
  await expect(panel).toContainText("Value:");
  await expect(panel).toContainText((await buttons.first().getAttribute("data-factor"))!);
  if ((await buttons.count()) > 1) await buttons.nth(1).click();
  await expect(page.locator("[data-factor-panel]").nth(1)).toContainText("Value:");
  expect(posts).toHaveLength(1); // one server action for the page
  expect(posts.every((u) => !u.includes(":8000"))).toBe(true);
});
