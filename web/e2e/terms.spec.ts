// TT1 (DECISIONS 64): the glossary term button is plain (no fill), and its definition, the term tip, carries one
// light tint of the accent over its own surface, on every page.
import { expect, test, type Page } from "@playwright/test";

const PAGES = ["", "/credit", "/sharia", "/zakat", "/forecast"].map((p) => `/en/business/10001${p}`).concat("/en/how-it-works", "/ar/how-it-works", "/ar/business/10001/zakat");

type Tip = { where: string; image: string; tintIsLocalAccent: boolean; radius: string; padding: string; alpha: number; contrast: number };

/** Every term tip on the page, shown one at a time: its look, its tint's strength, and its text against the tip. */
async function tips(page: Page, where: string): Promise<Tip[]> {
  await page.mouse.move(0, 0);
  return page.locator(".term-tip").evaluateAll((els, where) => {
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
      el.setAttribute("data-open", "true");
      const s = getComputedStyle(el);
      // What lies under the tip: every background up the tree, from the page up.
      const layers: [number, number, number, number][] = [];
      for (let n = el.parentElement; n; n = n.parentElement) {
        const c = rgba(getComputedStyle(n).backgroundColor);
        if (c[3] > 0) layers.push(c);
        if (c[3] >= 1) break;
      }
      let ground: [number, number, number] = [255, 255, 255];
      for (const layer of layers.reverse()) ground = over(layer, ground);
      const tintCss = s.backgroundImage.match(/linear-gradient\((rgba?\([^)]*\)|color\([^)]*\))/)?.[1] ?? "transparent";
      const tint = rgba(tintCss);
      // The tint is the accent in force where the tip sits (a dark .panel has its own), at reduced strength.
      const accent = rgba(s.getPropertyValue("--accent").trim());
      // Read the tint's channels from the CSS itself: at 10% alpha a canvas read-back loses their precision.
      const channels = tintCss.match(/color\(srgb ([\d.]+) ([\d.]+) ([\d.]+)/)?.slice(1).map((v) => Number(v) * 255) ?? tint.slice(0, 3);
      const tintIsLocalAccent = [0, 1, 2].every((i) => Math.abs(channels[i]! - accent[i]!) <= 1);
      const behind = over(tint, over(rgba(s.backgroundColor), ground));
      const text = over(rgba(s.color), behind);
      const [a, b] = [lum(text), lum(behind)].sort((x, y) => y - x);
      el.setAttribute("data-open", "false");
      return { where, image: s.backgroundImage, tintIsLocalAccent, radius: s.borderRadius, padding: s.padding, alpha: tint[3], contrast: (a! + 0.05) / (b! + 0.05) };
    });
  }, where);
}

for (const theme of ["light", "dark"] as const) {
  test(`term tips share one tint: ${theme}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
    const all: Tip[] = [];
    for (const path of PAGES) {
      await page.goto(path, { waitUntil: "networkidle" });
      all.push(...(await tips(page, path)));
    }
    expect(all.length).toBeGreaterThan(5);
    // One rule for every tip: a tint of the local accent (one colour on the page, another inside a dark panel).
    expect(all.filter((t) => !t.tintIsLocalAccent).map((t) => `${t.where}: ${t.image}`)).toEqual([]);
    expect(new Set(all.map((t) => t.radius))).toHaveProperty("size", 1);
    expect(new Set(all.map((t) => t.padding))).toHaveProperty("size", 1);
    // A light tint, never a solid block.
    for (const t of all) {
      expect(t.alpha).toBeGreaterThanOrEqual(0.08);
      expect(t.alpha).toBeLessThanOrEqual(0.14);
    }
    const low = all.filter((t) => t.contrast < 4.5).map((t) => `${t.where}: ${t.contrast.toFixed(2)}`);
    console.log(`TT1 ${theme} lowest tip contrast ${Math.min(...all.map((t) => t.contrast)).toFixed(2)}`);
    expect(low).toEqual([]);
  });

  test(`term buttons have no fill: ${theme}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
    await page.goto("/en/business/10001/zakat", { waitUntil: "networkidle" });
    const term = page.locator(".term").first();
    const look = () => term.evaluate((el) => { const s = getComputedStyle(el); return [s.backgroundColor, s.padding, s.borderRadius].join(" | "); });
    expect(await look()).toBe("rgba(0, 0, 0, 0) | 0px | 0px");
    await term.hover();
    await expect(term).toHaveAttribute("aria-expanded", "true");
    expect(await look()).toBe("rgba(0, 0, 0, 0) | 0px | 0px");
    // The open tip shows the tint.
    await expect(page.locator(".term-tip[data-open='true']").first()).toHaveCSS("background-image", /linear-gradient/);
  });
}
