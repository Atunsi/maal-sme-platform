// DECISIONS 57: the Arabic catalogue against the English one (A5), counts (A6) and terminology (A7).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { fill, pluralForm, type PluralForms } from "@/lib/i18n";
import { ar, en } from "./helpers";

const CATEGORIES = ["zero", "one", "two", "few", "many", "other"] as const;
type Tree = { [key: string]: string | Tree };

const isPlural = (value: unknown): value is PluralForms =>
  typeof value === "object" && value !== null && "other" in value && Object.keys(value).every((key) => (CATEGORIES as readonly string[]).includes(key));

/** Every message by dotted key: a string, or a plural message as one entry. */
function messages(tree: Tree, prefix = ""): Map<string, string | PluralForms> {
  const out = new Map<string, string | PluralForms>();
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string" || isPlural(value)) out.set(path, value as string | PluralForms);
    else for (const [k, v] of messages(value, path)) out.set(k, v);
  }
  return out;
}

const placeholders = (text: string) => new Set([...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]!));
const union = (texts: string[]) => new Set(texts.flatMap((text) => [...placeholders(text)]));
const forms = (value: string | PluralForms) => (typeof value === "string" ? [value] : Object.values(value));

const EN = messages(en as unknown as Tree);
const AR = messages(ar as unknown as Tree);

// A5: keys whose Arabic may equal the English, each with its reason.
const SAME_AS_ENGLISH: Record<string, string> = {
  "dashboard.title": "the brand's own name, as written in both languages",
};

describe("arabic catalogue matches english", () => {
  it("every English key exists in Arabic, and the reverse", () => {
    expect([...AR.keys()].sort()).toEqual([...EN.keys()].sort());
  });

  it("every Arabic message has the English placeholders, no more and no fewer", () => {
    for (const [key, english] of EN) {
      if (key === "_review") continue;
      const arabic = AR.get(key)!;
      const wanted = union(forms(english));
      expect([...union(forms(arabic))].sort(), key).toEqual([...wanted].sort());
      // A plural form may leave out {n} («يوم واحد»), but never adds a placeholder the English lacks.
      for (const form of forms(arabic)) for (const name of placeholders(form)) expect(wanted.has(name), `${key}: {${name}}`).toBe(true);
    }
  });

  it("an Arabic value equals the English only for keys on the named list", () => {
    const same = [...EN].filter(([key, english]) => typeof english === "string" && AR.get(key) === english).map(([key]) => key);
    expect(same.sort()).toEqual(Object.keys(SAME_AS_ENGLISH).sort());
  });
});

// A6
const COUNTED_EN = /\{(?:n|count|days|months)\}\s+(?:days?|months?|transactions?|business(?:es)?|shocks?|scenarios?|match(?:es)?|slots?)\b/i;
const COUNTED_AR = /\{(?:n|count|days|months)\}\s+(?:يوم|أيام|يومًا|شهر|أشهر|شهرًا|معاملة|معاملات|منشأة|منشآت|صدمة|صدمات|سيناريو|سيناريوهات|مطابقة|مطابقات|خانة|خانات|غرام)/;

describe("counts follow plural rules", () => {
  const plural = [...EN].filter(([, value]) => isPlural(value)).map(([key]) => key);

  it("no plain catalogue string puts a count directly before a counted noun", () => {
    for (const [key, value] of EN) if (typeof value === "string") expect(value, key).not.toMatch(COUNTED_EN);
    for (const [key, value] of AR) if (typeof value === "string") expect(value, key).not.toMatch(COUNTED_AR);
  });

  it("each plural message has every category its language needs", () => {
    expect(plural.length).toBeGreaterThanOrEqual(15);
    for (const key of plural) {
      expect(Object.keys(EN.get(key) as object).sort(), key).toEqual(["one", "other"]);
      expect(Object.keys(AR.get(key) as object).sort(), key).toEqual([...CATEGORIES].sort());
    }
  });

  it("n = 0 to 120 picks the CLDR form in both locales and leaves no placeholder unfilled", () => {
    for (const key of plural) {
      for (const [locale, table] of [["en", EN], ["ar", AR]] as const) {
        const message = table.get(key) as PluralForms;
        const names = union(forms(message));
        for (let n = 0; n <= 120; n++) {
          const category = new Intl.PluralRules(locale).select(n);
          const template = pluralForm(n, message, locale);
          expect(template, `${key} ${locale} ${n}`).toBe(message[category] ?? message.other);
          const filled = fill(template, Object.fromEntries([...names].map((name) => [name, String(n)])));
          expect(filled, `${key} ${locale} ${n}`).not.toMatch(/\{\w+\}/);
        }
      }
    }
  });

  it("Arabic days: one, two, few and many read as Arabic grammar wants", () => {
    const days = ar.forecast.horizonDays as PluralForms;
    expect(fill(pluralForm(1, days, "ar"), { n: "1" })).toBe("يوم واحد");
    expect(fill(pluralForm(2, days, "ar"), { n: "2" })).toBe("يومان");
    expect(fill(pluralForm(3, days, "ar"), { n: "3" })).toBe("3 أيام");
    expect(fill(pluralForm(30, days, "ar"), { n: "30" })).toBe("30 يومًا");
    expect(fill(pluralForm(100, days, "ar"), { n: "100" })).toBe("100 يوم");
    expect(fill(pluralForm(1, en.forecast.horizonDays, "en"), { n: "1" })).toBe("1 day");
  });
});

// A7: one Arabic term per concept (DECISIONS 57, 1a.6). Each banned form names the term that replaces it.
const BANNED: [RegExp, string][] = [
  [/مجموعة العرض|منشآت العرض|منشأة العرض/, "serving population: مجموعة الخدمة"],
  [/هذا العرض|في العرض|من العرض|للعرض|حالات العرض/, "demo: النسخة التجريبية"],
  [/^العرض$/, "Display menu: المظهر; serving: الخدمة"],
  [/أرقام عربية/, "Arabic-Indic digits: الأرقام الهندية"],
  [/ر\.س/, "Saudi riyal: the sign, or ريال سعودي"],
  [/الفائدة/, "markup: هامش الربح"],
  [/\bPD\b/, "PD: احتمالية التعثر"],
  [/\bMCC\b/, "MCC: رمز فئة التاجر"],
];

const repo = join(process.cwd(), "..");
const TEMPLATE_FILES = [
  "lenses/credit/templates_ar.yaml",
  "compliance/sharia_templates_ar.yaml",
  "lenses/forecast/templates_ar.yaml",
  "lenses/zakat/templates_ar.yaml",
  "lenses/anomaly/templates_ar.yaml",
  "scenarios/library_ar.yaml",
];

/** The Arabic string literals of a source file (English strings and code are skipped). */
function arabicStrings(file: string): string[] {
  const text = readFileSync(file, "utf8");
  return [...text.matchAll(/"([^"\n]*[؀-ۿ][^"\n]*)"/g)].map((match) => match[1]!);
}

describe("arabic terminology is consistent", () => {
  const sources: [string, string[]][] = [
    ["messages/ar.json", [...AR].filter(([key]) => key !== "_review").flatMap(([, value]) => forms(value))],
    ...["lib/glossary.ts", "lib/tour.ts", "lib/howItWorks.ts"].map((file): [string, string[]] => [file, arabicStrings(file)]),
    ...TEMPLATE_FILES.map((file): [string, string[]] => [file, arabicStrings(join(repo, file))]),
  ];

  it("reads every source", () => {
    for (const [file, texts] of sources) expect(texts.length, file).toBeGreaterThan(0);
  });

  for (const [pattern, use] of BANNED) {
    it(`no ${pattern} (${use})`, () => {
      for (const [file, texts] of sources) for (const text of texts) expect(text, file).not.toMatch(pattern);
    });
  }

  it("the serving population has one name everywhere", () => {
    expect(ar.enums.population.serving).toBe("الخدمة");
    expect(ar.errors.not_found).toContain("مجموعة الخدمة");
    expect(ar.nav.display).toBe("المظهر");
  });
});
