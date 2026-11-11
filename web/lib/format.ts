import type { Digits } from "@/lib/digits";
import type { Locale } from "@/lib/i18n";
import ar from "@/messages/ar.json";
import en from "@/messages/en.json";

// Every number, amount, percentage and date the app shows is formatted here. Western digits are the
// default in both languages; Arabic can also show Arabic-Indic digits (E8, DECISIONS 51). The server always
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

/** The Saudi riyal sign. The only place the character is written in the code base (RS, DECISIONS 57). */
export const RIYAL = "\u20C1";

const SPOKEN: Record<Locale, string> = { en: en.currency.spoken, ar: ar.currency.spoken };

/** 2 decimals: the API rounds SAR to 2, so this never changes a displayed amount (U3). No currency style, no sign. */
function amount(value: number, locale: Locale, digits: Digits): string {
  return plain(new Intl.NumberFormat(TAGS[locale][digits], { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value));
}

/**
 * A visible amount: the riyal sign, a no-break space, then the number with exactly 2 decimals (U3 unchanged).
 * SAMA's usage guide puts the sign to the left of the number in every language, with a space between, so in
 * Arabic the amount stays in its LTR wrapper (Num, Sar). A negative amount reads "-U+20C1 1,250.00". Screen readers
 * do not know U+20C1 yet: on a page the sign is drawn only by <Sar>, which hides it and speaks the words.
 */
export function formatSar(value: number, locale: Locale, digits: Digits = "latn"): string {
  return `${value < 0 ? "-" : ""}${RIYAL} ${amount(Math.abs(value), locale, digits)}`;
}

/** The same amount for an attribute (aria-label, title, alt) or a live region: the number, then the currency in words. */
export function formatSarSpoken(value: number, locale: Locale, digits: Digits = "latn"): string {
  return `${value < 0 ? "-" : ""}${amount(Math.abs(value), locale, digits)} ${SPOKEN[locale]}`;
}

export function formatInt(value: number, locale: Locale, digits: Digits = "latn"): string {
  return plain(new Intl.NumberFormat(TAGS[locale][digits], { maximumFractionDigits: 0 }).format(value));
}

/** All the digits the API sent, for rates, PD, hazards and percentages. */
export function formatRaw(value: number, locale: Locale, digits: Digits = "latn"): string {
  return plain(new Intl.NumberFormat(TAGS[locale][digits], { maximumFractionDigits: 20, useGrouping: false }).format(value));
}

/** A plain figure to a fixed number of decimals (IN3: a ratio to two), with the page's digits. */
export function formatFixed(value: number, locale: Locale, decimals: number, digits: Digits = "latn"): string {
  return plain(new Intl.NumberFormat(TAGS[locale][digits], { minimumFractionDigits: decimals, maximumFractionDigits: decimals, useGrouping: false }).format(value));
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

/**
 * C3: a probability or rate in [0, 1] as a percentage with one decimal, then the exact value as returned,
 * in brackets. The Compliance View and receipts show the exact value alone (formatRaw).
 */
export function formatProbability(value: number, locale: Locale, digits: Digits = "latn"): { pct: string; exact: string; text: string } {
  const pct = formatPct(value * 100, locale, digits, 1);
  const exact = formatRaw(value, locale, digits);
  return { pct, exact, text: `${pct} (${exact})` };
}

/** Month names, not digits: the Arabic numeric form carries bidi marks that scramble inside LTR text. */
export function formatDate(iso: string, locale: Locale, digits: Digits = "latn"): string {
  return new Intl.DateTimeFormat(TAGS[locale][digits], { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${iso}T00:00:00Z`),
  );
}

/** A month's short name, for chart axes ("Feb"; in Arabic the month's name). */
export function formatMonth(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(TAGS[locale].latn, { month: "short", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));
}
