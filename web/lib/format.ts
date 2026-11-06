import type { Locale } from "@/lib/i18n";

// Western digits in both languages until the digit question is decided (report section 10).
// Arabic pins the Gregorian calendar: ar-SA defaults to Umm al-Qura, which would silently
// change every date the API returns.
const TAGS: Record<Locale, string> = { en: "en-GB-u-nu-latn", ar: "ar-SA-u-ca-gregory-nu-latn" };

/** Bidi marks from the Arabic number formats scramble negatives inside the LTR wrapper (Num). */
const plain = (text: string) => text.replace(/[‎‏؜]/g, "");

/** 2 decimals: the API rounds SAR to 2, so this never changes a displayed amount (U3). */
export function formatSar(value: number, locale: Locale): string {
  return plain(
    new Intl.NumberFormat(TAGS[locale], {
      style: "currency",
      currency: "SAR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value),
  );
}

export function formatInt(value: number, locale: Locale): string {
  return plain(new Intl.NumberFormat(TAGS[locale], { maximumFractionDigits: 0 }).format(value));
}

/** All the digits the API sent, for rates, PD, hazards and percentages. */
export function formatRaw(value: number, locale: Locale): string {
  return plain(new Intl.NumberFormat(TAGS[locale], { maximumFractionDigits: 20, useGrouping: false }).format(value));
}

/** Month names, not digits: the Arabic numeric form carries bidi marks that scramble inside LTR text. */
export function formatDate(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(TAGS[locale], { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${iso}T00:00:00Z`),
  );
}
