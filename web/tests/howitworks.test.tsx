// E9: the "How Ma'al decides" page. DECISIONS 51.
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import HowItWorksPage from "@/app/[locale]/how-it-works/page";
import { DEMO_BUSINESS } from "@/lib/businesses";
import { GLOSSARY } from "@/lib/glossary";
import { HOW_INTRO, HOW_SECTIONS, plainText, segments } from "@/lib/howItWorks";

const BANNED = /[✓✔✕✗×!→←▶◀Δ·…—]/;
const page = async (locale: "en" | "ar", as?: string) => render(await HowItWorksPage({ params: Promise.resolve({ locale }), searchParams: Promise.resolve({ as }) }));

describe("how it works", () => {
  it("covers the sections the SOP lists, each in both languages with Arabic marked draft", () => {
    expect(HOW_SECTIONS.map((s) => s.id)).toEqual(["data", "profile", "credit", "sharia", "zakat", "forecast", "review", "receipts", "limits"]);
    for (const s of HOW_SECTIONS) {
      expect(s.ar.body).toHaveLength(s.en.body.length);
      expect(s.ar.draft).toBe(true);
    }
    expect(HOW_INTRO.ar.draft).toBe(true);
  });

  it("every term mark names a glossary entry", () => {
    const ids = new Set(GLOSSARY.map((g) => g.id));
    for (const s of HOW_SECTIONS) {
      for (const paragraph of [...s.en.body, ...s.ar.body]) {
        for (const part of segments(paragraph)) if (typeof part !== "string") expect(ids.has(part.term), part.term).toBe(true);
        expect(plainText(paragraph)).not.toContain("[[");
      }
    }
  });

  it("never names the anomaly lens's output in the words U8 forbids", () => {
    const text = HOW_SECTIONS.flatMap((s) => [...s.en.body, ...s.ar.body]).map(plainText).join(" ");
    expect(text).not.toMatch(/fraud|score|احتيال/i);
  });

  it("how it works renders in both locales", async () => {
    for (const locale of ["en", "ar"] as const) {
      const { container, unmount } = await page(locale);
      expect([...container.querySelectorAll("h2")].map((h) => h.textContent)).toEqual(HOW_SECTIONS.map((s) => s[locale].title));
      expect(container.textContent).not.toMatch(BANNED);
      // Each glossary term is a button once, at its first appearance.
      const terms = [...container.querySelectorAll("[data-term]")].map((el) => el.getAttribute("data-term"));
      expect(new Set(terms).size).toBe(terms.length);
      unmount();
    }
  });

  it("each section links to the matching page for the demo business, keeping the role", async () => {
    const { container } = await page("en", "admin");
    const hrefs = [...container.querySelectorAll("section a")].map((a) => a.getAttribute("href"));
    expect(hrefs).toEqual(HOW_SECTIONS.map((s) => `/en${s.link.replace("{id}", String(DEMO_BUSINESS))}?as=admin`));
    expect(hrefs.filter((h) => h!.includes("/business/")).every((h) => h!.includes(`/business/${DEMO_BUSINESS}`))).toBe(true);
  });
});
