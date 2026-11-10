import { describe, expect, it } from "vitest";
import { formatDate, formatRaw, formatSar } from "@/lib/format";
import { fill } from "@/lib/i18n";
import { ar, en } from "./helpers";

const PLURAL = new Set(["zero", "one", "two", "few", "many", "other"]);

/** A plural message (DECISIONS 57) is one message: Arabic carries six forms, English two (tests/arabic-catalogue.test.ts). */
const isPlural = (value: object) => "other" in value && Object.keys(value).every((key) => PLURAL.has(key));

function keys(value: unknown, prefix = ""): string[] {
  if (typeof value !== "object" || value === null || Array.isArray(value) || isPlural(value)) return [prefix];
  return Object.entries(value).flatMap(([key, child]) => keys(child, `${prefix}.${key}`));
}

describe("number and date formatting", () => {
  it("U3 SAR keeps exactly 2 decimals and changes nothing", () => {
    expect(formatSar(5963.26, "en")).toContain("5,963.26");
    expect(formatSar(47000, "en")).toContain("47,000.00");
    expect(formatSar(5963.26, "ar")).toContain("5,963.26");
  });

  it("Arabic uses Western digits until that is decided", () => {
    expect(formatSar(1234.5, "ar")).toMatch(/[0-9]/);
    expect(formatSar(1234.5, "ar")).not.toMatch(/[٠-٩]/);
    expect(formatDate("2026-07-30", "ar")).not.toMatch(/[٠-٩]/);
  });

  it("Arabic negatives carry no bidi marks that scramble inside LTR text", () => {
    for (const text of [formatSar(-23054.75, "ar"), formatRaw(-0.386669, "ar")]) {
      expect(text).not.toMatch(/[‎‏؜]/);
      expect(text.startsWith("-")).toBe(true);
    }
  });

  it("Arabic dates stay Gregorian, not Umm al-Qura", () => {
    expect(formatDate("2026-07-30", "ar")).toContain("2026");
    expect(formatDate("2026-07-30", "ar")).toContain("يوليو");
  });

  it("formatRaw keeps every digit the API sent", () => {
    expect(formatRaw(0.055732, "en")).toBe("0.055732");
    expect(formatRaw(-2.829859, "en")).toBe("-2.829859");
  });
});

describe("catalogues", () => {
  it("en and ar have the same keys", () => {
    expect(keys(ar).sort()).toEqual(keys(en).sort());
  });

  it("no value is empty", () => {
    const walk = (value: unknown): string[] =>
      typeof value === "string" ? [value] : Object.values(value as object).flatMap(walk);
    expect([...walk(en), ...walk(ar)].filter((text) => text.trim() === "")).toEqual([]);
  });

  it("U6 the fixed Sharia label is exact in English and present in Arabic", () => {
    expect(en.sharia.label).toBe("Rule-based screening, pending Sharia-advisor confirmation");
    expect(ar.sharia.label).toContain("المستشار الشرعي");
  });

  it("U15 the footer states the demo scope", () => {
    expect(en.footer.scope).toMatch(/Synthetic data only/);
    expect(en.footer.scope).toMatch(/PDPL/);
    expect(en.footer.scope).toMatch(/per-owner access/);
    expect(en.footer.scope).toMatch(/SAMA Open Banking consent/);
  });

  it("the catalogues quote no measured figure", () => {
    expect(JSON.stringify(en)).not.toMatch(/\d\.\d/);
    expect(JSON.stringify(ar)).not.toMatch(/\d\.\d/);
  });

  it("fill replaces placeholders", () => {
    expect(fill("Day {n}", { n: 30 })).toBe("Day 30");
  });
});
