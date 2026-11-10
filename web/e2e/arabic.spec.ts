// DECISIONS 57: A4 (no untranslated text on an Arabic page) and RS1 to RS3 (the Saudi riyal sign).
//
// Recording mode: ARABIC_RECORD=<file.json> npx playwright test e2e/arabic.spec.ts -g "records"
// lists every Latin word on every /ar page with the pages it is on, and asserts nothing. It produced the
// before and after inventories in the DECISIONS 57 report.
import { writeFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { BUSINESSES, PAGES } from "./pages";

const ROUTES = [...new Set([...PAGES, ...BUSINESSES.map((id) => `/business/${id}/sheet`)])];

type Finding = { text: string; where: string };

/** Every visible text node and every aria-label, title, placeholder and alt with a Latin word of two letters or more. */
async function latin(page: Page): Promise<Finding[]> {
  return page.evaluate(() => {
    // Code, commands and marked-Latin spans (hashes, IDs in links) are identifiers. [lang=en] is NOT skipped:
    // an English block on an Arabic page is exactly the untranslated text this rule looks for.
    const SKIP = "script, style, code, pre, kbd, [data-latin]";
    const word = /[A-Za-z][A-Za-z'’]+/;
    const out: { text: string; where: string }[] = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const el = node.parentElement;
      const text = node.textContent?.trim() ?? "";
      if (!el || !text || !word.test(text) || el.closest(SKIP)) continue;
      if (!el.checkVisibility() && !el.closest(".sr-only")) continue;
      out.push({ text, where: "text" });
    }
    for (const el of document.querySelectorAll("[aria-label], [title], [placeholder], [alt]")) {
      if (el.closest(SKIP)) continue;
      for (const name of ["aria-label", "title", "placeholder", "alt"]) {
        const value = el.getAttribute(name)?.trim();
        if (value && word.test(value)) out.push({ text: value, where: name });
      }
    }
    return out;
  });
}

// A4 allowlist. Each entry is a whole Latin token that may appear in Arabic text, with the reason.
const ALLOWED_TOKENS: Record<string, string> = {
  "Ma'al": "the brand, in the language link and the English wordmark",
  English: "the language link names the other language in that language",
  AUC: "no common Arabic short form; always next to its Arabic description («قيمة AUC بالتحقق المتقاطع»)",
  PDF: "the file format, on the print button",
  SHAP: "the method's name, glossary only",
  Murabaha: "only where the glossary defines it",
  pass: "the demo password, shown so it can be typed",
  Home: "a key name in the chart's keyboard help",
  End: "a key name in the chart's keyboard help",
  Escape: "a key name in the chart's keyboard help",
  Ctrl: "a key name in the copy fallback",
  Cmd: "a key name in the copy fallback",
  GET: "an API route named in the admin note (GET /businesses), an identifier",
  businesses: "the same API route, /businesses",
  DECISIONS: "the change-control file named in the scenario receipt note (DECISIONS.md)",
  // The backend's Arabic method line names its method code, as the English one does (the {method} placeholder).
  naive30: "forecast method code", naive90: "forecast method code", blend: "forecast method code",
  ewma: "forecast method code", ols_damped: "forecast method code", structural: "forecast method code",
};
// Identifiers by shape: hashes, rule IDs (ACT-NOMCC-retail_trade, INC-FI-SHARE), module paths and commands.
const ALLOWED_SHAPES = [/^[0-9a-f]{7,64}$/, /^[A-Z]{2,}(?:-[A-Za-z0-9_]+)+$/, /^[a-z_]+(?:\.[a-z_]+)+$/, /^python$/, /^--[a-z]+$/];

function untranslated(text: string): string[] {
  const tokens = text.match(/[A-Za-z0-9][A-Za-z0-9_'’.-]*[A-Za-z0-9]|[A-Za-z]{2,}/g) ?? [];
  return tokens.filter((t) => /[A-Za-z]{2,}/.test(t) && !(t in ALLOWED_TOKENS) && !ALLOWED_SHAPES.some((s) => s.test(t)));
}

const RECORD = process.env.ARABIC_RECORD;

test.describe("arabic pages", () => {
  test.skip(!!RECORD, "recording run");
  for (const route of ROUTES) {
    test(`arabic pages show no untranslated text: /ar${route}`, async ({ page }) => {
      await page.goto(`/ar${route}`, { waitUntil: "networkidle" });
      const bad = (await latin(page)).flatMap((f) => untranslated(f.text).map((token) => `${f.where}: ${token} in «${f.text.slice(0, 120)}»`));
      expect(bad).toEqual([]);
    });
  }
});

test("records the Latin words on every Arabic page", async ({ page }) => {
  test.skip(!RECORD, "set ARABIC_RECORD=<file> to record");
  test.setTimeout(30 * 60_000);
  const seen = new Map<string, Set<string>>();
  for (const route of ROUTES) {
    await page.goto(`/ar${route}`, { waitUntil: "networkidle" });
    for (const f of await latin(page)) {
      const key = `${f.where}: ${f.text.slice(0, 200)}`;
      seen.set(key, (seen.get(key) ?? new Set()).add(route));
    }
  }
  const rows = [...seen].map(([text, routes]) => ({ text, pages: routes.size, untranslated: untranslated(text.replace(/^[a-z-]+: /, "")) }));
  rows.sort((a, b) => b.pages - a.pages);
  writeFileSync(RECORD!, JSON.stringify({ routes: ROUTES.length, distinct: rows.length, offending: rows.filter((r) => r.untranslated.length).length, rows }, null, 1));
});

// RS1 to RS3
const SIGN = "⃁";
const RS_PAGES = ["/business/10001", "/business/10001/credit", "/business/10001/zakat", "/business/10001/forecast", "/business/10004/review", "/scenarios?s=severe_collapse", "/business/10001/sheet", "/admin", ""];

test.describe("riyal sign", () => {
  test.skip(!!RECORD, "recording run");
  for (const locale of ["en", "ar"] as const) {
    for (const route of RS_PAGES) {
      test(`amounts show the riyal sign: /${locale}${route}`, async ({ page }) => {
        await page.goto(`/${locale}${route}`, { waitUntil: "networkidle" });
        const result = await page.evaluate((sign) => {
          const amounts = [...document.querySelectorAll("[data-sar]")].map((el) => el.textContent ?? "");
          const bad: string[] = [];
          const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
          for (let node = walker.nextNode(); node; node = walker.nextNode()) {
            const el = node.parentElement!;
            if (el.closest("script, style, code, pre, [data-latin]")) continue;
            if (/\bSAR\b|ر\.س/.test(node.textContent ?? "")) bad.push(node.textContent!.trim());
          }
          return { amounts, bad, sign };
        }, SIGN);
        for (const text of result.amounts) expect(text).toMatch(new RegExp(`^-?${SIGN} [0-9٠-٩,٬]+[.٫][0-9٠-٩]{2} `));
        expect(result.bad).toEqual([]);
      });

      test(`riyal sign is hidden from screen readers and spoken as words: /${locale}${route}`, async ({ page }) => {
        await page.goto(`/${locale}${route}`, { waitUntil: "networkidle" });
        const result = await page.evaluate((sign) => {
          const exposed: string[] = [];
          const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
          for (let node = walker.nextNode(); node; node = walker.nextNode()) {
            if (!node.textContent?.includes(sign)) continue;
            // Hidden from the accessibility tree: aria-hidden, or inside role=img, whose children are presentational.
            if (!node.parentElement!.closest('[aria-hidden="true"], [role="img"]')) exposed.push(node.textContent);
          }
          const attributes = [...document.querySelectorAll("*")].flatMap((el) => [...el.attributes].filter((a) => a.value.includes(sign)).map((a) => `${el.tagName}[${a.name}]`));
          const spoken = [...document.querySelectorAll("[data-sar] .sr-only")].map((el) => el.textContent?.trim());
          return { exposed, attributes, spoken, amounts: document.querySelectorAll("[data-sar]").length };
        }, SIGN);
        expect(result.exposed).toEqual([]);
        expect(result.attributes).toEqual([]);
        expect(result.spoken).toHaveLength(result.amounts);
        for (const word of result.spoken) expect(word).toBe(locale === "ar" ? "ريال سعودي" : "Saudi riyals");
      });
    }
  }

  test("riyal font is self-hosted and renders", async ({ page }) => {
    const requests: string[] = [];
    page.on("request", (r) => requests.push(r.url()));
    await page.goto("/ar/business/10001", { waitUntil: "networkidle" });
    const result = await page.evaluate(async (sign) => {
      const family = getComputedStyle(document.documentElement).getPropertyValue("--font-riyal").trim();
      await document.fonts.load(`16px ${family}`, sign);
      const canvas = document.createElement("canvas").getContext("2d")!;
      canvas.font = `16px ${family}`;
      const width = canvas.measureText(sign).width;
      canvas.font = "16px serif";
      const fallback = canvas.measureText(sign).width;
      return { family, check: document.fonts.check(`16px ${family}`, sign), width, fallback };
    }, SIGN);
    expect(result.family).not.toBe("");
    expect(result.check).toBe(true);
    // The face's advance is 895 of 1000 units: 14.32 px at 16 px, not the fallback box's width.
    expect(Math.abs(result.width - 14.32)).toBeLessThan(0.5);
    expect(result.width).not.toBeCloseTo(result.fallback, 1);
    expect(requests.filter((url) => /riyal/i.test(url)).every((url) => url.startsWith("http://127.0.0.1:"))).toBe(true);
  });
});
