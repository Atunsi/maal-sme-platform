// I8 (DECISIONS 45): the search's fixed lists. No API call; a research ID never becomes a business to open.
import { describe, expect, it } from "vitest";
import { paletteItems, paletteMatches } from "@/components/CommandPalette";
import { GLOSSARY } from "@/lib/glossary";
import { en } from "./helpers";

const scenarios = [{ name: "severe_collapse", label: "Severe revenue collapse" }];
const items = paletteItems("en", en, "10004", "admin", scenarios);

describe("search lists", () => {
  it("search jumps to a page, a term and a business", () => {
    expect(paletteMatches(items, "zakat", "en", en, "admin").map((i) => i.href)).toContain("/en/business/10004/zakat?as=admin");
    expect(paletteMatches(items, "severe", "en", en, "admin").map((i) => i.href)).toEqual(["/en/scenarios?s=severe_collapse&as=admin"]);
    const term = GLOSSARY[0]!;
    expect(paletteMatches(items, term.en.term, "en", en, null).some((i) => i.href.endsWith(`/en/glossary?as=admin#${term.id}`))).toBe(true);
    const open = paletteMatches(items, "10037", "en", en, "admin")[0]!;
    expect(open.label).toBe("Open business 10037");
    expect(open.href).toBe("/en/business/10037?as=admin");
  });

  it("search rejects a research id", () => {
    for (const q of ["20001", "99999", "00001", "1003"]) expect(paletteMatches(items, q, "en", en, null).some((i) => i.id.startsWith("business-"))).toBe(false);
  });
});
