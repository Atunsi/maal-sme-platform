// E3: the glossary catalogue, its rules (N1, N2) and the term popover. DECISIONS 43.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Term } from "@/components/Term";
import { GLOSSARY, glossaryFor } from "@/lib/glossary";
import { HOW_INTRO, HOW_SECTIONS, plainText } from "@/lib/howItWorks";
import { TOUR_STEPS } from "@/lib/tour";
import GlossaryPage from "@/app/[locale]/glossary/page";
import { en, webRoot } from "./helpers";

const DIGITS = /[0-9٠-٩]/;
const BANNED = /[✓✔✕✗×!→←▶◀Δ·…—]/;
const repo = join(webRoot, "..");

/** Every fixed-text catalogue N1 covers: glossary now, the tour and how-it-works as they are added. */
export const FIXED_TEXT: { name: string; texts: string[] }[] = [
  { name: "glossary", texts: GLOSSARY.flatMap((g) => [g.en.term, g.en.definition, g.ar.term, g.ar.definition]) },
  {
    name: "how it works",
    texts: [
      ...Object.values(HOW_INTRO).flatMap((i) => [i.eyebrow, i.title, i.intro]),
      ...HOW_SECTIONS.flatMap((s) => [s.en.title, s.en.linkLabel, s.ar.title, s.ar.linkLabel, ...[...s.en.body, ...s.ar.body].map(plainText)]),
    ],
  },
  { name: "tour", texts: TOUR_STEPS.flatMap((s) => [s.en.title, s.en.caption, s.ar.title, s.ar.caption]) },
];

describe("glossary catalogue", () => {
  it("fixed text catalogues contain no digits", () => {
    for (const { name, texts } of FIXED_TEXT) {
      expect(texts.length, name).toBeGreaterThan(0);
      expect(texts.filter((text) => DIGITS.test(text)), name).toEqual([]);
    }
  });

  it("every glossary entry names a repo source", () => {
    for (const entry of GLOSSARY) {
      expect(entry.source.trim(), entry.id).not.toBe("");
      const file = entry.source.split(/[ ;]/)[0]!; // the first file the source names must exist in the repo
      const path = file.includes("/") || file.endsWith(".md") ? file : "";
      if (file === "schema") continue;
      expect(existsSync(join(repo, path)), `${entry.id}: ${file}`).toBe(true);
    }
  });

  it("definitions are short, plain, and carry no symbol characters", () => {
    for (const entry of GLOSSARY) {
      expect(entry.en.definition.split(/\s+/).length, entry.id).toBeLessThanOrEqual(30);
      for (const text of [entry.en.term, entry.en.definition, entry.ar.term, entry.ar.definition]) expect(text, entry.id).not.toMatch(BANNED);
      expect(entry.ar.draft).toBe(true);
    }
    expect(new Set(GLOSSARY.map((g) => g.id)).size).toBe(GLOSSARY.length);
  });

  it("lists entries alphabetically for each locale", () => {
    for (const locale of ["en", "ar"] as const) {
      const terms = glossaryFor(locale).map((g) => g[locale].term);
      expect(terms).toEqual([...terms].sort((a, b) => a.localeCompare(b, locale)));
    }
  });
});

describe("term popover", () => {
  it("term popover opens on focus and closes on escape", () => {
    render(<Term id="hawl" locale="en" />);
    const button = screen.getByRole("button", { name: "Hawl" });
    const tip = screen.getByRole("tooltip", { hidden: true });
    expect(button.getAttribute("aria-describedby")).toBe(tip.id);
    expect(tip.textContent).toBe(GLOSSARY.find((g) => g.id === "hawl")!.en.definition);
    expect(tip.getAttribute("data-open")).toBe("false");
    fireEvent.focus(button);
    expect(tip.getAttribute("data-open")).toBe("true");
    fireEvent.keyDown(button, { key: "Escape" });
    expect(tip.getAttribute("data-open")).toBe("false");
  });

  it("glossary tip stays open while the pointer moves onto it", () => {
    // B9 (WCAG 1.4.13): hover belongs to the wrapper, so moving from the term onto the tip keeps it open.
    render(<Term id="hawl" locale="en" />);
    const button = screen.getByRole("button", { name: "Hawl" });
    const tip = screen.getByRole("tooltip", { hidden: true });
    fireEvent.mouseOver(button, { relatedTarget: document.body });
    expect(tip.getAttribute("data-open")).toBe("true");
    fireEvent.mouseOut(button, { relatedTarget: tip });
    fireEvent.mouseOver(tip, { relatedTarget: button });
    expect(tip.getAttribute("data-open")).toBe("true");
    fireEvent.mouseOut(tip, { relatedTarget: document.body });
    expect(tip.getAttribute("data-open")).toBe("false");
  });

  it("a tap opens it, a second tap or a tap elsewhere closes it", () => {
    render(<Term id="nisab" locale="ar" />);
    const button = screen.getByRole("button");
    const tip = screen.getByRole("tooltip", { hidden: true });
    fireEvent.pointerDown(button);
    fireEvent.focus(button);
    fireEvent.click(button, { detail: 1 });
    expect(tip.getAttribute("data-open")).toBe("true");
    fireEvent.pointerDown(button);
    fireEvent.click(button, { detail: 1 });
    expect(tip.getAttribute("data-open")).toBe("false");
    fireEvent.pointerDown(button);
    fireEvent.click(button, { detail: 1 });
    expect(tip.getAttribute("data-open")).toBe("true");
    fireEvent.pointerDown(document.body);
    expect(tip.getAttribute("data-open")).toBe("false");
  });
});

describe("glossary page", () => {
  it("glossary page renders in both locales", async () => {
    for (const locale of ["en", "ar"] as const) {
      const { container, unmount } = render(await GlossaryPage({ params: Promise.resolve({ locale }) }));
      const terms = [...container.querySelectorAll("dt")].map((dt) => dt.textContent);
      expect(terms).toEqual(glossaryFor(locale).map((g) => g[locale].term));
      expect(container.textContent).not.toMatch(BANNED);
      expect(container.textContent).not.toMatch(DIGITS);
      if (locale === "en") expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(en.glossary.title);
      unmount();
    }
  });
});
