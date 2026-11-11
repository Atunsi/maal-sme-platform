// TB1 (DECISIONS 63): every glossary term button has one look, a light tint of the accent, on every page.
import { expect, test, type Page } from "@playwright/test";

const PAGES = ["", "/credit", "/sharia", "/zakat", "/forecast"].map((p) => `/en/business/10001${p}`).concat("/en/how-it-works", "/ar/how-it-works", "/ar/business/10001/zakat");

type Look = { where: string; surface: string; background: string; radius: string; padding: string; colourMatchesSentence: boolean; alpha: number; contrast: number };

/** Every term button on the page, at rest: its look, its tint's strength, and its text against the tint over what lies under it. */
async function looks(page: Page, where: string): Promise<Look[]> {
  // Away from every term, so none is hovered.
  await page.mouse.move(0, 0);
  return page.locator(".term").evaluateAll((els, where) => {
    const probe = document.createElement("canvas").getContext("2d")!;
    const rgba = (css: string): [number, number, number, number] => {
      probe.clearRect(0, 0, 1, 1);
      probe.fillStyle = "#000";
      probe.fillStyle = css;
      probe.fillRect(0, 0, 1, 1);
      const [r, g, b, a] = probe.getImageData(0, 0, 1, 1).data;
      return [r!, g!, b!, a! / 255];
    };
    const over = (top: [number, number, number, number], under: [number, number, number]) =>
      [0, 1, 2].map((i) => top[i]! * top[3] + under[i]! * (1 - top[3])) as [number, number, number];
    const lum = ([r, g, b]: number[]) => {
      const c = [r!, g!, b!].map((v) => (v / 255 <= 0.03928 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4));
      return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
    };
    return els.map((el) => {
      const s = getComputedStyle(el);
      // The surface under the term: every background up the tree, laid over each other from the page up.
      const layers: [number, number, number, number][] = [];
      for (let n = el.parentElement; n; n = n.parentElement) {
        const c = rgba(getComputedStyle(n).backgroundColor);
        if (c[3] > 0) layers.push(c);
        if (c[3] >= 1) break;
      }
      let ground: [number, number, number] = [255, 255, 255];
      for (const layer of layers.reverse()) ground = over(layer, ground);
      const tint = rgba(s.backgroundColor);
      const behind = over(tint, ground);
      const text = over(rgba(s.color), behind);
      const [a, b] = [lum(text), lum(behind)].sort((x, y) => y - x);
      return {
        where,
        surface: `rgb(${ground.map(Math.round).join(", ")})`,
        background: s.backgroundColor,
        radius: s.borderRadius,
        padding: s.padding,
        colourMatchesSentence: s.color === getComputedStyle(el.parentElement!.parentElement!).color,
        alpha: tint[3],
        contrast: (a! + 0.05) / (b! + 0.05),
      };
    });
  }, where);
}

for (const theme of ["light", "dark"] as const) {
  test(`term buttons share one background: ${theme}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
    const all: Look[] = [];
    for (const path of PAGES) {
      await page.goto(path, { waitUntil: "networkidle" });
      all.push(...(await looks(page, path)));
    }
    expect(all.length).toBeGreaterThan(5);
    expect(new Set(all.map((l) => l.background))).toHaveProperty("size", 1);
    expect(new Set(all.map((l) => l.radius))).toHaveProperty("size", 1);
    expect(new Set(all.map((l) => l.padding))).toHaveProperty("size", 1);
    // The text keeps the colour of the sentence it sits in (Faris, 2026-11-11).
    expect(all.filter((l) => !l.colourMatchesSentence)).toEqual([]);
    // 4.5:1 for the term's text against its tint, laid over the surface it sits on: at rest, and with the
    // stronger tint of hover and open, on every page and surface.
    const active: Look[] = [];
    for (const path of PAGES) {
      await page.goto(path, { waitUntil: "networkidle" });
      await page.addStyleTag({ content: ".term { background: var(--term-bg-active) !important; transition: none !important; }" });
      active.push(...(await looks(page, path)));
    }
    const low = (list: Look[]) => list.filter((l) => l.contrast < 4.5).map((l) => `${l.where} on ${l.surface}: ${l.contrast.toFixed(2)}`);
    // The measurements for DECISIONS 63: the lowest contrast on each surface, at rest and active.
    const lowest = (list: Look[]) => Object.fromEntries([...new Set(list.map((l) => l.surface))].map((sf) => [sf, Math.min(...list.filter((l) => l.surface === sf).map((l) => l.contrast)).toFixed(2)]));
    console.log(`TB1 ${theme} rest ${JSON.stringify(lowest(all))} active ${JSON.stringify(lowest(active))}`);
    expect(low(all)).toEqual([]);
    expect(low(active)).toEqual([]);
  });

  test(`term button background is a light tint: ${theme}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
    await page.goto("/en/business/10001/zakat", { waitUntil: "networkidle" });
    const term = page.locator(".term").first();
    const alpha = async () => (await looks(page, "zakat"))[0]!.alpha;
    const rest = await alpha();
    expect(rest).toBeGreaterThanOrEqual(0.08);
    expect(rest).toBeLessThanOrEqual(0.14);
    // Hover and open take the stronger tint, still under 0.16 strength (a canvas read rounds to 1/255).
    await term.hover();
    await expect(term).toHaveAttribute("aria-expanded", "true");
    await page.waitForTimeout(400); // the 0.35 s background fade
    const open = (await page.locator(".term").first().evaluate((el) => getComputedStyle(el).backgroundColor));
    const active = await page.evaluate((css) => {
      const c = document.createElement("canvas").getContext("2d")!;
      c.fillStyle = css;
      c.fillRect(0, 0, 1, 1);
      return c.getImageData(0, 0, 1, 1).data[3]! / 255;
    }, open);
    expect(active).toBeGreaterThan(rest);
    expect(active).toBeLessThanOrEqual(0.165);
    // Never a solid fill.
    expect(active).toBeLessThan(0.5);
  });
}

test("term buttons print as plain text", async ({ page }) => {
  await page.goto("/en/business/10001/zakat", { waitUntil: "networkidle" });
  await page.emulateMedia({ media: "print" });
  const bg = await page.locator(".term").first().evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(bg).toBe("rgba(0, 0, 0, 0)");
});
