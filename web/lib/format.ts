import type { Digits } from "@/lib/digits";
import type { Locale } from "@/lib/i18n";

// Every number, amount, percentage and date the app shows is formatted here. Western digits are the
// default in both languages; Arabic can also show Arabic-Indic digits (E8, DECISIONS 43). The server always
// formats Western: the digits choice lives in localStorage, and the client rewrites the page's text to
// exactly what these functions return with digits "arab" (lib/digits.ts, tests/digits.test.ts).
// Arabic pins the Gregorian calendar: ar-SA defaults to Umm al-Qura, which would silently
// change every date the API returns.
const TAGS: Record<Locale, Record<Digits, string>> = {
  en: { latn: "en-GB-u-nu-latn", arab: "en-GB-u-nu-latn" }, // English always shows Western digits
  ar: { latn: "ar-SA-u-ca-gregory-nu-latn", arab: "ar-SA-u-ca-gregory-nu-arab" },
};

/** Bidi marks from the Arabic number formats scramble negatives inside the LTR wrapper (Num). */
const plain = (text: string) => text.replace(/[‎‏؜]/g, "");

/** 2 decimals: the API rounds SAR to 2, so this never changes a displayed amount (U3). */
export function formatSar(value: number, locale: Locale, digits: Digits = "latn"): string {
  return plain(
    new Intl.NumberFormat(TAGS[locale][digits], {
      style: "currency",
      currency: "SAR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value),
  );
}

export function formatInt(value: number, locale: Locale, digits: Digits = "latn"): string {
  return plain(new Intl.NumberFormat(TAGS[locale][digits], { maximumFractionDigits: 0 }).format(value));
}

/** All the digits the API sent, for rates, PD, hazards and percentages. */
export function formatRaw(value: number, locale: Locale, digits: Digits = "latn"): string {
  return plain(new Intl.NumberFormat(TAGS[locale][digits], { maximumFractionDigits: 20, useGrouping: false }).format(value));
}

/**
 * B4: a percentage as one string with its sign, so the digits switch converts the sign with the number.
 * `value` is already in percent (6.5 means 6.5%). Without `decimals` every digit the API sent is kept, as
 * formatRaw does. With Western digits the sign is "%" in both languages, as the app has always shown it;
 * Arabic-Indic digits take Intl's "٪", which is exactly what the page rewrite writes, both ways.
 */
export function formatPct(value: number, locale: Locale, digits: Digits = "latn", decimals?: number): string {
  const options: Intl.NumberFormatOptions =
    decimals === undefined
      ? { style: "unit", unit: "percent", maximumFractionDigits: 20, useGrouping: false }
      : { style: "unit", unit: "percent", minimumFractionDigits: decimals, maximumFractionDigits: decimals };
  const text = plain(new Intl.NumberFormat(TAGS[locale][digits], options).format(value));
  return digits === "latn" ? text.replace("٪", "%") : text;
}

/** Month names, not digits: the Arabic numeric form carries bidi marks that scramble inside LTR text. */
export function formatDate(iso: string, locale: Locale, digits: Digits = "latn"): string {
  return new Intl.DateTimeFormat(TAGS[locale][digits], { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${iso}T00:00:00Z`),
  );
}
