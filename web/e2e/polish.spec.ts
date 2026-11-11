// DECISIONS 60: the web UI motion and visual polish rules that need a browser (MO1 to MO8, LG1 to LG5).
import { expect, test, type Page } from "@playwright/test";

// The API allows 60 requests per business per minute; these tests load 10001 many times.
const pause = () => new Promise((resolve) => setTimeout(resolve, 3000));

/** Every rendered text size on the page, for elements that hold text themselves (SVG chart text excluded). */
async function textSizes(page: Page): Promise<number[]> {
  return page.evaluate(() => {
    const sizes: number[] = [];
    for (const el of document.querySelectorAll("body *")) {
      if (!(el instanceof HTMLElement) || el.closest("svg") || !el.checkVisibility()) continue;
      if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent!.trim())) continue;
      sizes.push(Math.round(parseFloat(getComputedStyle(el).fontSize) * 10) / 10);
    }
    return sizes;
  });
}

// MO6 / LG3: the scale is 14, 16, 18 and 22 px from 768 px up, 14, 16, 18 and 20 px below; anything from 26 px up
// is a display size, outside the scale and unchanged.
const SCALE = { 1280: [14, 16, 18, 22], 390: [14, 16, 18, 20] } as const;

test("text sizes follow the scale", async ({ page }) => {
  test.setTimeout(600_000);
  const off: string[] = [];
  for (const width of [1280, 390] as const) {
    await page.setViewportSize({ width, height: 900 });
    for (const locale of ["en", "ar"]) {
      for (const lens of ["", "/credit", "/zakat", "/review"]) {
        await page.goto(`/${locale}/business/10001${lens}?as=owner`, { waitUntil: "networkidle" });
        for (const size of await textSizes(page)) {
          if (size < 14 || (size < 26 && !(SCALE[width] as readonly number[]).includes(size))) off.push(`${width} /${locale}${lens}: ${size}px`);
        }
        await pause();
      }
    }
  }
  expect([...new Set(off)]).toEqual([]);
});

// LG2 / MO7: from 768 px up the header is sticky; it never covers the focused control.
test("sticky header never covers the focused control", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/en/business/10001?as=owner", { waitUntil: "networkidle" });
  const covered: string[] = [];
  for (let i = 0; i < 45; i++) {
    await page.keyboard.press("Tab");
    const r = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      const header = document.querySelector("body > header")!;
      if (!el || header.contains(el) || el === document.body) return null;
      const box = el.getBoundingClientRect();
      const h = header.getBoundingClientRect();
      // The skip link sits above the header in the flow; only a control under the header counts.
      return { what: `${el.tagName} ${el.textContent?.trim().slice(0, 30)}`, top: box.top, under: box.bottom > h.top + 1, headerBottom: h.bottom };
    });
    if (r && r.under && r.top < r.headerBottom - 1) covered.push(`${r.what}: ${r.top} < ${r.headerBottom}`);
  }
  expect(covered).toEqual([]);
});

test("header stays in view after scrolling at 1280", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/en/business/10001/forecast", { waitUntil: "networkidle" });
  const full = await page.locator("body > header").evaluate((el) => el.getBoundingClientRect().height);
  await page.mouse.wheel(0, 1600);
  await page.waitForTimeout(400);
  const after = await page.locator("body > header").evaluate((el) => ({ top: el.getBoundingClientRect().top, height: el.getBoundingClientRect().height, position: getComputedStyle(el).position }));
  expect(after.position).toBe("sticky");
  expect(after.top).toBe(0);
  // It condenses where scroll timelines exist (Edge does), and never grows.
  expect(after.height).toBeLessThan(full);
});

test("phone header is unchanged", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/en/business/10001/forecast", { waitUntil: "networkidle" });
  const before = await page.locator("body > header").evaluate((el) => ({ height: el.getBoundingClientRect().height, position: getComputedStyle(el).position }));
  await page.mouse.wheel(0, 1600);
  await page.waitForTimeout(400);
  const after = await page.locator("body > header").evaluate((el) => el.getBoundingClientRect().height);
  // The phone bar was sticky and 71 px tall before DECISIONS 60; it stays so and does not condense.
  expect(before.position).toBe("sticky");
  expect(Math.round(before.height)).toBe(71);
  expect(Math.round(after)).toBe(71);
});

// LG5: the overview shows one record card (the verdict's) until the profile figures are opened.
test("overview shows one record card until the profile figures are opened", async ({ page }) => {
  for (const role of ["owner", "admin"]) {
    await page.goto(`/en/business/10037?as=${role}`, { waitUntil: "networkidle" });
    const visible = () => page.locator("[data-record]").evaluateAll((els) => els.filter((el) => (el as HTMLElement).checkVisibility()).length);
    expect(await visible(), role).toBe(1);
    await page.locator("#profile > details > summary").click();
    expect(await visible(), role).toBe(2);
    await expect(page.locator("aside[data-tour=receipt]")).toBeVisible();
    await pause();
  }
});

// MO1: motion never changes a displayed value.
test("amount text never changes after first render", async ({ page }) => {
  test.setTimeout(300_000);
  for (const lens of ["", "/credit", "/zakat", "/forecast"]) {
    await page.goto(`/en/business/10001${lens}`, { waitUntil: "domcontentloaded" });
    await page.locator("main [data-sar]").first().waitFor();
    const read = () => page.locator("main [data-sar], main [data-probability]").allTextContents();
    const first = await read();
    await page.waitForTimeout(2000);
    expect(await read(), lens || "overview").toEqual(first);
    await pause();
  }
});

// MO2: without scrolling, nothing in <main> is hidden by motion once entrances are done.
// Static decoration with a fixed opacity class is not motion; only elements with a finite (entrance or scroll) animation count;
// the four loops of MO5 are decoration and are checked in tests/motion.test.ts.
test("scroll reveals never hide content", async ({ page }) => {
  for (const path of ["/en/business/10001", "/en/how-it-works", "/en"]) {
    await page.goto(path, { waitUntil: "networkidle" });
    await page.waitForTimeout(1000);
    const faded = await page.evaluate(() =>
      [...document.querySelectorAll("main *")].filter((el) => (el as HTMLElement).checkVisibility() && el.getAnimations().some((a) => a.effect?.getTiming().iterations !== Infinity) && getComputedStyle(el).opacity !== "1").map((el) => el.className.toString().slice(0, 40)),
    );
    expect(faded, path).toEqual([]);
  }
});

// MO3: reduced motion stops page and theme transitions too.
test("reduced motion disables page and theme transitions", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/en/business/10001", { waitUntil: "networkidle" });
  const animated = await page.evaluate(async () => {
    const names: string[] = [];
    const doc = document as Document & { startViewTransition?: (cb: () => void) => { ready: Promise<void>; finished: Promise<void> } };
    if (!doc.startViewTransition) return ["no api"];
    const vt = doc.startViewTransition(() => document.body.classList.toggle("x"));
    await vt.ready;
    for (const a of document.getAnimations()) names.push((a.effect as KeyframeEffect).pseudoElement ?? "element");
    await vt.finished;
    return names;
  });
  expect(animated).toEqual([]);
  await page.locator("[data-theme-toggle]").click();
  expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
});

// MO4: navigation works the same without the View Transitions API.
test("navigation works without view transitions", async ({ page }) => {
  await page.addInitScript(() => {
    delete (Document.prototype as unknown as { startViewTransition?: unknown }).startViewTransition;
  });
  await page.goto("/en/business/10001?as=owner", { waitUntil: "networkidle" });
  expect(await page.evaluate(() => "startViewTransition" in document)).toBe(false);
  await page.locator("header nav a", { hasText: "Zakat" }).click();
  await expect(page).toHaveURL(/\/en\/business\/10001\/zakat\?as=owner$/);
  await expect(page.locator("main h1")).toBeVisible();
  await page.locator("header nav a", { hasText: "Overview" }).click();
  await expect(page).toHaveURL(/\/en\/business\/10001\?as=owner$/);
  await page.locator("[data-r=lens]", { hasText: "Forecast" }).click();
  await expect(page).toHaveURL(/\/en\/business\/10001\/forecast\?as=owner$/);
});

test("page transition stays under the cap", async ({ page }) => {
  await page.goto("/en/business/10001", { waitUntil: "networkidle" });
  // Watch the view transition pseudo-elements' animations while a nav link is followed.
  await page.evaluate(() => {
    (window as unknown as { vtDurations: number[] }).vtDurations = [];
    new MutationObserver(() => {}).observe(document.body, { childList: true });
    const watch = () => {
      for (const a of document.getAnimations()) {
        const pseudo = (a.effect as KeyframeEffect | null)?.pseudoElement;
        if (pseudo?.startsWith("::view-transition")) (window as unknown as { vtDurations: number[] }).vtDurations.push(Number(a.effect!.getTiming().duration));
      }
      requestAnimationFrame(watch);
    };
    requestAnimationFrame(watch);
  });
  await page.locator("header nav a", { hasText: "Credit" }).click();
  await expect(page).toHaveURL(/\/en\/business\/10001\/credit$/);
  await page.waitForTimeout(600);
  const durations = await page.evaluate(() => (window as unknown as { vtDurations?: number[] }).vtDurations ?? []);
  // Every page-change animation lasts at most 0.3 s (the crossfade 0.25 s, a carried element 0.3 s).
  for (const d of durations) expect(d).toBeLessThanOrEqual(300);
});

test("view transition names are unique on every page", async ({ page }) => {
  for (const path of ["/en/business/10001", "/en/business/10001/credit", "/ar/business/10037/zakat", "/en/business/10004/review"]) {
    await page.goto(path, { waitUntil: "networkidle" });
    const names = await page.evaluate(() =>
      [...document.querySelectorAll("*")].filter((el) => (el as HTMLElement).checkVisibility()).map((el) => getComputedStyle(el).viewTransitionName).filter((n) => n && n !== "none"),
    );
    expect(new Set(names).size, path).toBe(names.length);
    expect(names, path).toContain("site-header");
    await pause();
  }
});

// MT4: the thumb sits under the pressed option, in both locales.
test("segmented thumb sits under the pressed option in both locales", async ({ page }) => {
  for (const locale of ["en", "ar"]) {
    await page.goto(`/${locale}/business/10001/credit`, { waitUntil: "networkidle" });
    for (const index of [1, 0]) {
      const group = page.locator(".segmented").first();
      await group.locator("button").nth(index).click();
      await page.waitForTimeout(350);
      const { thumb, pressed } = await group.evaluate((el) => ({
        thumb: el.querySelector(".segmented-thumb")!.getBoundingClientRect().toJSON() as DOMRect,
        pressed: el.querySelector("button[aria-pressed=true]")!.getBoundingClientRect().toJSON() as DOMRect,
      }));
      expect(Math.abs(thumb.left - pressed.left), `${locale} ${index}`).toBeLessThanOrEqual(2);
      expect(Math.abs(thumb.width - pressed.width), `${locale} ${index}`).toBeLessThanOrEqual(2);
    }
    await pause();
  }
});

test("credit view and URL never disagree after back", async ({ page }) => {
  await page.goto("/en/business/10001", { waitUntil: "networkidle" });
  await page.locator("header nav a", { hasText: "Credit" }).click();
  await expect(page).toHaveURL(/\/credit$/);
  const group = page.locator(".segmented").first();
  await group.locator("button").nth(1).click();
  await expect(page).toHaveURL(/\/credit\?view=compliance$/);
  await expect(group).toHaveAttribute("data-thumb", "end");
  // The toggle replaces the history entry, so Back leaves the page; Forward returns to the compliance view.
  await page.goBack();
  await expect(page).toHaveURL(/\/en\/business\/10001$/);
  await page.goForward();
  await expect(page).toHaveURL(/\/credit\?view=compliance$/);
  await expect(group.locator("button").nth(1)).toHaveAttribute("aria-pressed", "true");
  await expect(group).toHaveAttribute("data-thumb", "end");
});

// MT5: the theme switches without the API too.
test("theme change works without view transitions", async ({ page }) => {
  await page.addInitScript(() => {
    delete (Document.prototype as unknown as { startViewTransition?: unknown }).startViewTransition;
  });
  await page.goto("/en", { waitUntil: "networkidle" });
  const dark = () => page.evaluate(() => document.documentElement.classList.contains("th-dark"));
  const before = await dark();
  await page.locator("[data-theme-toggle]").first().click();
  expect(await dark()).toBe(!before);
});

// MT3: one focus ring; MO8: plates and static cards have no hover style.
test("every control shows the shared focus ring", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/en/business/10001", { waitUntil: "networkidle" });
  const rings: string[] = [];
  for (let i = 0; i < 25; i++) {
    await page.keyboard.press("Tab");
    rings.push(await page.evaluate(() => {
      const s = getComputedStyle(document.activeElement!);
      return `${s.outlineStyle} ${s.outlineWidth} ${s.outlineOffset}`;
    }));
  }
  expect([...new Set(rings)]).toEqual(["solid 2px 2px"]);
});

test("plates and static cards have no hover style", async ({ page }) => {
  await page.goto("/en/business/10001/credit", { waitUntil: "networkidle" });
  for (const selector of [".plate", "main .border.bg-card:not(a)", "main h1"]) {
    const target = page.locator(selector).first();
    const style = () => target.evaluate((el) => { const s = getComputedStyle(el); return [s.backgroundColor, s.borderColor, s.boxShadow, s.transform, s.color, s.textDecorationLine].join("|"); });
    await page.mouse.move(0, 0);
    const before = await style();
    await target.hover();
    await page.waitForTimeout(250);
    expect(await style(), selector).toBe(before);
  }
});

// VS1, VS2: raised surfaces differ from their ground; the print sheet carries no decoration.
test("raised surfaces differ from their ground in both themes", async ({ page }) => {
  for (const theme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: theme });
    await page.goto("/en/business/10001", { waitUntil: "networkidle" });
    const s = await page.evaluate(() => {
      const css = (el: Element) => getComputedStyle(el);
      const verdict = document.querySelector("[data-tour=verdict]")!;
      const card = document.querySelector("#profile")!;
      return { page: css(document.body).backgroundColor, card: css(card).backgroundColor, cardShadow: css(card).boxShadow, verdict: css(verdict).backgroundColor, verdictShadow: css(verdict).boxShadow, image: css(verdict).backgroundImage };
    });
    expect(s.card, theme).not.toBe(s.page);
    if (theme === "dark") expect(s.verdict, theme).not.toBe(s.card);
    else expect(s.verdictShadow, theme).not.toBe(s.cardShadow);
    expect(s.image, theme).toContain("radial-gradient");
    await pause();
  }
});

test("print sheet has no background decoration", async ({ page }) => {
  await page.emulateMedia({ media: "print" });
  for (const path of ["/en/business/10001", "/en/business/10001/credit"]) {
    await page.goto(path, { waitUntil: "networkidle" });
    const images = await page.evaluate(() => [...document.querySelectorAll("[data-tour=verdict], [data-phone=lens-head]")].map((el) => getComputedStyle(el).backgroundImage));
    for (const image of images) expect(image, path).toBe("none");
  }
});

test("demo role label stays on one line", async ({ page }) => {
  for (const [locale, width, role] of [["ar", 1280, "admin"], ["ar", 1440, "admin"], ["en", 1280, "owner"], ["ar", 1280, "owner"]] as const) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`/${locale}/business/10013/zakat?as=${role}`, { waitUntil: "networkidle" });
    const label = page.locator("header [data-demo-role-short]");
    // One line box: an inline span that wraps has one client rect per line.
    expect(await label.evaluate((el) => el.getClientRects().length), `${locale} ${width} ${role}`).toBe(1);
    expect(parseFloat(await label.evaluate((el) => getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(14);
  }
});
