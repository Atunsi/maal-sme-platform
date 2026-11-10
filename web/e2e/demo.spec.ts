// The demo sign-in, the admin list and the landing page (DECISIONS 42).
import { expect, test } from "@playwright/test";
import index from "../scenarios-data/index.json";
import { nameOf } from "../lib/business-names";
import { apiEnv } from "./helpers";

const TYPED = "demo-secret-value";

test("sign-in sends no request and stores nothing", async ({ page, context }) => {
  await page.goto("/en/sign-in", { waitUntil: "networkidle" });
  const requests: { url: string; body: string | null; method: string }[] = [];
  page.on("request", (request) => requests.push({ url: request.url(), body: request.postData(), method: request.method() }));

  await page.getByLabel("Commercial registration number").fill(TYPED);
  await page.getByLabel("Password").fill(TYPED);
  await page.getByRole("button", { name: "Admin" }).click();
  await page.getByLabel("Username").fill(TYPED);
  await page.getByRole("button", { name: "Business owner" }).click();
  await page.getByRole("button", { name: "Sign in to my business" }).click();
  await expect(page.locator("#sign-in-wrong")).toHaveText("Wrong password. Try again.");
  await expect(page).toHaveURL(/\/en\/sign-in$/);
  await page.waitForTimeout(300);
  expect(requests).toEqual([]);

  await page.getByLabel("Password").fill("pass");
  await page.getByRole("button", { name: "Sign in to my business" }).click();
  await expect(page).toHaveURL(/\/en\/business\/10001\?as=owner$/);
  await expect(page.getByText("Demo role: business owner")).toBeVisible(); // X5

  expect(requests.filter(({ method }) => method !== "GET")).toEqual([]);
  expect(requests.filter(({ url, body }) => `${url}${body ?? ""}`.includes(TYPED))).toEqual([]);
  expect(await context.cookies()).toEqual([]);
  const stored = await page.evaluate(() => ({ local: Object.keys(localStorage), session: Object.keys(sessionStorage).filter((key) => !key.startsWith("__next")) }));
  expect(stored).toEqual({ local: [], session: [] });
});

test("sign-in says what it is, on the page", async ({ page }) => {
  await page.goto("/en/sign-in");
  await expect(page.getByText("Demo sign-in. No accounts exist. The password is checked in this browser only, and nothing you type is saved or sent.")).toBeVisible();
  await expect(page.locator("footer")).toContainText("Synthetic data only. Population: serving.");
});

test("sign-in shows the demo password", async ({ page }) => {
  for (const [locale, text] of [["en", "Demo password: pass"], ["ar", "كلمة المرور التجريبية: pass"]] as const) {
    await page.goto(`/${locale}/sign-in`);
    const hint = page.getByText(text, { exact: true });
    await expect(hint).toBeVisible();
    await expect(page.locator('input[type="password"]')).toHaveAttribute("aria-describedby", "sign-in-demo-password");
  }
});

test("the Admin role routes to the admin page and shows in the header", async ({ page }) => {
  await page.goto("/en/sign-in", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Admin" }).click();
  await page.getByLabel("Username").fill("faris");
  await page.getByLabel("Password").fill("pass");
  await page.getByRole("button", { name: "Sign in as admin" }).click();
  await expect(page).toHaveURL(/\/en\/admin\?as=admin$/);
  await expect(page.getByRole("heading", { name: "All businesses" })).toBeVisible();
  await expect(page.getByText("Demo role: admin")).toBeVisible(); // X5
});

test("the demo role stays in the URL as the visitor moves between pages", async ({ page }) => {
  await page.goto("/en/business/10016?as=owner", { waitUntil: "networkidle" });
  await page.getByRole("link", { name: "Zakat", exact: true }).first().click();
  await expect(page).toHaveURL(/\/business\/10016\/zakat\?as=owner$/);
  await expect(page.getByText("Demo role: business owner")).toBeVisible(); // X5
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
  // The five demo businesses have their own table; 10004 is also on the first page of the full list.
  await page.getByRole("region", { name: "Businesses", exact: true }).getByRole("link", { name: `Open ${nameOf(10004, "en")}`, exact: true }).click();
  await expect(page).toHaveURL(/\/en\/business\/10004\?as=admin$/);
  await expect(page.getByText("Demo role: admin")).toBeVisible(); // X5
  const main = page.getByRole("navigation", { name: "Pages" });
  await main.getByRole("link", { name: "Zakat", exact: true }).click();
  await expect(page).toHaveURL(/\/en\/business\/10004\/zakat\?as=admin$/);
  await main.getByRole("link", { name: "All businesses" }).click();
  await expect(page).toHaveURL(/\/en\/admin\?as=admin$/);
  await expect(page.getByRole("heading", { name: "All businesses" })).toBeVisible();
});

test("an owner gets no link to the admin list", async ({ page }) => {
  await page.goto("/en/business/10001?as=owner", { waitUntil: "networkidle" });
  await expect(page.getByRole("link", { name: "All businesses" })).toHaveCount(0);
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

test("review row picks its mark from the keyboard", async ({ page }) => {
  // B8, R4: the date cell's button is reachable with Tab and picks the row and its mark.
  await page.goto("/en/business/10010/review", { waitUntil: "networkidle" });
  const button = page.locator("tbody tr").first().getByRole("button");
  await button.focus();
  await expect(button).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator('tbody tr[data-picked="true"]')).toHaveCount(1);
  await expect(button).toHaveAttribute("aria-pressed", "true");
  const id = await page.locator("tbody tr").first().getAttribute("data-id");
  await expect(page.locator(`button.tick[data-ids="${id}"]`)).toHaveAttribute("aria-pressed", "true");
  expect(await button.evaluate((el) => getComputedStyle(el).outlineStyle)).toBe("solid");
});

test("clicking a timeline mark highlights its table row", async ({ page }) => {
  await page.goto("/en/business/10001/review", { waitUntil: "networkidle" });
  await page.locator("button.tick").nth(3).click();
  await expect(page.locator('tbody tr[data-picked="true"]')).toHaveCount(1);
});

test("footer links keep the demo role", async ({ page }) => {
  // B14: the footer carried no ?as=, so following it dropped the demo role.
  await page.goto("/en/business/10012?as=admin", { waitUntil: "networkidle" });
  const footer = page.getByRole("navigation", { name: "More about Ma'al" });
  await expect(footer.getByRole("link", { name: "How Ma'al decides" })).toHaveAttribute("href", "/en/how-it-works?as=admin");
  await expect(footer.getByRole("link", { name: "Glossary" })).toHaveAttribute("href", "/en/glossary?as=admin");
  await page.goto("/en/business/10012", { waitUntil: "networkidle" });
  await expect(footer.getByRole("link", { name: "Glossary" })).toHaveAttribute("href", "/en/glossary");
});

test("faq word follows the open state", async ({ page }) => {
  // B15: "Open" while closed, "Close" while open; the word is aria-hidden, the native details state is announced.
  await page.goto("/en");
  const item = page.locator("details.faq").filter({ hasText: "Is the data real?" });
  await expect(item.locator(".faq-open")).toBeVisible();
  await expect(item.locator(".faq-close")).toBeHidden();
  await item.locator("summary").click();
  await expect(item).toHaveAttribute("open", "");
  await expect(item.locator(".faq-open")).toBeHidden();
  await expect(item.locator(".faq-close")).toBeVisible();
  await expect(item.locator(".faq-close")).toHaveText("Close");
  expect(await item.locator("summary [aria-hidden=true]").count()).toBe(1);
});

test("demo role label names no business", async ({ page }) => {
  // X5: a demo role, not access control: the owner label carries no business ID, on any business.
  await page.goto("/en/business/10013/zakat?as=owner", { waitUntil: "networkidle" });
  const role = page.locator("header [data-demo-role]");
  await expect(role).toHaveText("Demo role: business owner");
  await expect(role).not.toHaveText(/[0-9]/);
  await page.goto("/ar/business/10013?as=admin", { waitUntil: "networkidle" });
  await expect(page.locator("header [data-demo-role]")).toHaveText("الدور التجريبي: مشرف");
});

test("registration hint is visible text", async ({ page }) => {
  // X3: the hint shows as text under the label, not only as a placeholder.
  await page.goto("/en/sign-in");
  await expect(page.locator("#sign-in-cr-hint")).toHaveText("10 digits");
  await expect(page.locator("#sign-in-cr-hint")).toBeVisible();
  const field = page.getByLabel("Commercial registration number");
  await expect(field).toHaveAttribute("aria-describedby", "sign-in-cr-hint");
  await expect(field).not.toHaveAttribute("placeholder", /./);
});

test("arabic plates keep their padding", async ({ page }) => {
  // X1: Arabic plates get more padding, weight 500 and a 1.6 line height.
  await page.goto("/ar/business/10001", { waitUntil: "networkidle" });
  const style = await page.locator("main .plate").first().evaluate((el) => {
    const s = getComputedStyle(el);
    return { top: parseFloat(s.paddingTop), side: parseFloat(s.paddingInlineStart), weight: s.fontWeight, line: parseFloat(s.lineHeight) / parseFloat(s.fontSize) };
  });
  expect(style.top).toBeGreaterThanOrEqual(6);
  expect(style.side).toBeGreaterThanOrEqual(12);
  expect(style.weight).toBe("500");
  expect(style.line).toBeCloseTo(1.6, 1);
});

test("overview greeting follows the demo role", async ({ page }) => {
  // C7: "Welcome back" for the owner only; the admin and a visitor with no role see the business named.
  await page.goto("/en/business/10014?as=owner", { waitUntil: "networkidle" });
  await expect(page.locator("main h1")).toHaveText(`Welcome back. Here is where ${nameOf(10014, "en")} is heading.`);
  await page.goto("/en/business/10014?as=admin", { waitUntil: "networkidle" });
  await expect(page.locator("main h1")).toHaveText(`${nameOf(10014, "en")}: where it is heading`);
  await page.goto("/en/business/10014", { waitUntil: "networkidle" });
  await expect(page.locator("main h1")).toHaveText(`${nameOf(10014, "en")}: where it is heading`);
});

test("landing strip shows a live plate for each demo business", async ({ page }) => {
  // I9: each card's decision and profile status come from the API, never typed in.
  const { MAAL_API_URL, MAAL_API_KEY } = apiEnv();
  await page.goto("/en", { waitUntil: "networkidle" });
  const strip = page.locator("[data-try-strip]");
  await expect(strip.locator("[data-try]")).toHaveCount(5);
  for (const id of [10001, 10004, 10037, 10040, 10003]) {
    const res = await fetch(`${MAAL_API_URL}/lenses/credit?business_id=${id}`, { headers: { "X-API-Key": MAAL_API_KEY } });
    const body = (await res.json()) as { status: string; credit: { decision: string } | null; credit_decision_detail: { offer_status: string | null } | null };
    const card = strip.locator(`[data-try="${id}"]`);
    const word = !body.credit ? "Not run" : body.credit.decision === "declined" ? "Declined" : body.credit_decision_detail?.offer_status === "unconditional" ? "Approved" : "Approved, conditional";
    await expect(card.locator(".plate").first()).toHaveText(word);
    await expect(card).toContainText({ scored: "Scored", partial_profile: "Partial profile", insufficient_data: "Insufficient data" }[body.status]!);
    await expect(card).toHaveAttribute("href", `/en/business/${id}`);
  }
});

test("landing strip loads after the hero", async ({ request }) => {
  // I9: the hero is in the stream before any card has its answer; each card waits in its own boundary.
  const html = await (await request.get("/en")).text();
  const hero = html.indexOf('id="hero"');
  const firstCard = html.search(/data-try="\d+"/);
  const firstFallback = html.search(/data-try-loading="\d+"/);
  expect(hero).toBeGreaterThan(-1);
  expect(firstFallback).toBeGreaterThan(hero);
  expect(firstCard).toBeGreaterThan(firstFallback);
});

test("review mark scrolls to its row and back", async ({ page }) => {
  // I2: a mark brings its first row into view; a row brings its mark into view.
  await page.setViewportSize({ width: 1280, height: 600 });
  await page.goto("/en/business/10015/review", { waitUntil: "networkidle" });
  const mark = page.locator("button.tick").last();
  const first = (await mark.getAttribute("data-ids"))!.split(" ")[0];
  await mark.click();
  await expect(page.locator(`tbody tr[data-id="${first}"]`)).toBeInViewport();
  await expect(page.locator(`tbody tr[data-id="${first}"]`)).toHaveAttribute("data-picked", "true");
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.mouse.wheel(0, 2000);
  const row = page.locator("tbody tr").first();
  const id = await row.getAttribute("data-id");
  await row.getByRole("button").click();
  await expect(page.locator(`button.tick[data-ids~="${id}"]`)).toBeInViewport();
});
