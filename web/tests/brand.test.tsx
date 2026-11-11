// Guards from the redesign (DECISIONS 42): the logos, the theme toggle and the no-symbol rule.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ArabicLogo, EnglishWordmark, SectionMark } from "@/components/brand/Logos";
import { AR_BODY, AR_MADDA, EN_BODY, EN_MADDA } from "@/components/brand/logoPaths";
import { DigitsToggle } from "@/components/DigitsToggle";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Plate } from "@/components/ui";
import { THEME_KEY } from "@/lib/theme";
import { ar, en, webRoot } from "./helpers";
import { applyDigits } from "@/lib/digits";

const logoFile = (name: string) => readFileSync(join(webRoot, "docs", "design", "logo", name), "utf8");
const pathsOf = (svg: string) => [...svg.matchAll(/ d="([^"]+)"/g)].map((match) => match[1]);

// The characters the redesign bans from rendered text. e2e/guards.spec.ts checks the real pages.
const BANNED = /[✓✔✕✗×!→←▶◀Δ·…—]/;

describe("logos", () => {
  it("logo components render both paths and carry a label when labelled", () => {
    const { container } = render(
      <>
        <ArabicLogo height={46} label="مآل" />
        <EnglishWordmark height={20} label="Ma'al" />
      </>,
    );
    const [arabic, english] = [...container.querySelectorAll("svg")];
    expect(arabic!.querySelectorAll("path")).toHaveLength(2);
    expect(english!.querySelectorAll("path")).toHaveLength(2);
    expect(screen.getByRole("img", { name: "مآل" })).toBe(arabic);
    expect(screen.getByRole("img", { name: "Ma'al" })).toBe(english);
  });

  it("an unlabelled logo is hidden from assistive technology", () => {
    const { container } = render(<ArabicLogo height={46} />);
    expect(container.querySelector("svg")!.getAttribute("aria-hidden")).toBe("true");
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("the artwork is the supplied artwork, coordinate for coordinate", () => {
    expect(pathsOf(logoFile("maal-ar.svg"))).toEqual([AR_BODY + AR_MADDA]);
    expect(pathsOf(logoFile("maal-en.svg"))).toEqual([EN_BODY, EN_MADDA]);
  });

  it("the logo files are the ones recorded in DECISIONS 42", () => {
    const sha = (name: string) => createHash("sha256").update(readFileSync(join(webRoot, "docs", "design", "logo", name))).digest("hex");
    expect(sha("maal-ar.svg")).toBe("75d20f0cc5bbdffb8f2eec20612f05522a83714a834a41beb1a32b2f40263311");
    expect(sha("maal-en.svg")).toBe("3e103bda95aee4c0745566147a6d389fcb124bacd6ca64d273a4265180229771");
  });

  it("the entrance motion is opt-in, and the English runs later than the Arabic", () => {
    const { container } = render(
      <>
        <ArabicLogo height={46} animate />
        <EnglishWordmark height={20} animate />
      </>,
    );
    const classes = [...container.querySelectorAll("path")].map((path) => path.getAttribute("class"));
    expect(classes).toEqual(["lg-body", "lg-madda", "lg-body lg-late", "lg-madda lg-late"]);
  });

  // DECISIONS 59 removed the drifting logo band, so it is no longer a subject here; the section mark's check stays.
  it("the section mark is decorative", () => {
    const { container } = render(<SectionMark />);
    expect([...container.children].map((el) => el.getAttribute("aria-hidden"))).toEqual(["true"]);
  });
});

describe("theme", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = "th-light";
  });
  afterEach(() => {
    document.documentElement.className = "";
  });

  it("theme toggle switches and persists without cookies", () => {
    render(<ThemeToggle label={en.nav.themeDark} />);
    const button = screen.getByRole("button", { name: en.nav.themeDark });
    expect(button.getAttribute("aria-pressed")).toBe("false");

    fireEvent.click(button);
    expect(document.documentElement.classList.contains("th-dark")).toBe(true);
    expect(document.documentElement.classList.contains("th-light")).toBe(false);
    expect(localStorage.getItem(THEME_KEY)).toBe("dark");
    expect(document.cookie).toBe("");
    expect(button.getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(button);
    expect(button.getAttribute("aria-pressed")).toBe("false");
    expect(document.documentElement.classList.contains("th-light")).toBe(true);
    expect(localStorage.getItem(THEME_KEY)).toBe("light");
    expect(document.cookie).toBe("");
  });

  it("pressed toggles keep one label", () => {
    // R3: the state is in aria-pressed; the words never change with it.
    document.documentElement.lang = "ar";
    for (const [element, label] of [
      [<ThemeToggle key="t" label={ar.nav.themeDark} />, ar.nav.themeDark],
      [<DigitsToggle key="d" label={ar.nav.digitsArab} />, ar.nav.digitsArab],
    ] as const) {
      const { unmount } = render(element);
      const button = screen.getByRole("button", { name: label });
      const before = button.getAttribute("aria-pressed");
      fireEvent.click(button);
      expect(button.getAttribute("aria-pressed")).not.toBe(before);
      expect(button.textContent).toBe(label);
      fireEvent.click(button);
      expect(button.getAttribute("aria-pressed")).toBe(before);
      expect(button.textContent).toBe(label);
      unmount();
    }
    document.documentElement.lang = "";
    delete document.documentElement.dataset.digits;
    for (const m of [en, ar]) expect(Object.keys(m.nav).filter((k) => /themeLight|digitsLatn/.test(k))).toEqual([]);
  });

  it("the toggle's Arabic labels are the agreed words", () => {
    expect(ar.nav.themeDark).toBe("الوضع الداكن");
    // DECISIONS 57 (1a.6): «أرقام عربية» was ambiguous, since many readers call 0 to 9 "Arabic numerals".
    expect(ar.nav.digitsArab).toBe("الأرقام الهندية (٠١٢٣)");
  });

  it("the digits label keeps its Arabic-Indic sample when the switch is turned off", () => {
    document.documentElement.lang = "ar";
    const { container, unmount } = render(<DigitsToggle label={ar.nav.digitsArab} />);
    const sample = container.querySelector("[data-latin]")!;
    expect(sample.textContent).toBe("٠١٢٣");
    applyDigits(container, "latn");
    expect(container.textContent).toBe(ar.nav.digitsArab);
    applyDigits(container, "arab");
    expect(container.textContent).toBe(ar.nav.digitsArab);
    unmount();
    document.documentElement.lang = "";
  });
});

describe("no symbol characters", () => {
  const strings = (value: unknown): string[] =>
    typeof value === "string" ? [value] : typeof value === "object" && value ? Object.values(value).flatMap(strings) : [];

  it("neither catalogue holds a banned character", () => {
    expect([...strings(en), ...strings(ar)].filter((text) => BANNED.test(text))).toEqual([]);
  });

  it("a plate holds its word and no glyph", () => {
    const { container } = render(<Plate variant="ok">Approved</Plate>);
    expect(container.textContent).toBe("Approved");
  });
});
