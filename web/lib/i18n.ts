import ar from "@/messages/ar.json";
import en from "@/messages/en.json";

export const LOCALES = ["en", "ar"] as const;
export type Locale = (typeof LOCALES)[number];

export type Messages = typeof en;

// Annotating ar as Messages makes a key missing from either catalogue a type error.
const CATALOGUES: Record<Locale, Messages> = { en, ar };

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

export function dirOf(locale: Locale): "rtl" | "ltr" {
  return locale === "ar" ? "rtl" : "ltr";
}

export function getMessages(locale: Locale): Messages {
  return CATALOGUES[locale];
}

/** Fills {name} placeholders. Catalogue text only; never used on text from the API. */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => String(values[k] ?? `{${k}}`));
}

/** Which locale a catalogue belongs to. The two catalogues are module singletons, so identity tells them apart. */
export function localeOf(m: Messages): Locale {
  return m === CATALOGUES.ar ? "ar" : "en";
}
