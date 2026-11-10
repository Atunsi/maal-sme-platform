import { createElement, Fragment, type ReactNode } from "react";
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

/**
 * A catalogue message that counts something (A6, DECISIONS 57): one template per CLDR plural category. Arabic
 * carries all six (zero, one, two, few, many, other), English one and other; a missing category falls back to
 * other. Arabic counted nouns change form with the number («يوم واحد»، «يومان»، «3 أيام»، «11 يومًا»), so a
 * single "{n} يوم" string is wrong for most counts.
 */
export type PluralForms = Partial<Record<Intl.LDMLPluralRule, string>> & { other: string };

/** The template for count n in this locale, unfilled: pass it to fill (or fillNodes). */
export function pluralForm(n: number, forms: PluralForms, locale: Locale): string {
  return forms[new Intl.PluralRules(locale).select(n)] ?? forms.other;
}

/** Fills {name} placeholders with React nodes, so an amount or count keeps its own element inside a sentence. */
export function fillNodes(template: string, values: Record<string, ReactNode>): ReactNode[] {
  return template.split(/(\{\w+\})/).map((part, i) => {
    const key = /^\{(\w+)\}$/.exec(part)?.[1];
    return key !== undefined && key in values ? createElement(Fragment, { key: i }, values[key]) : part;
  });
}

/** Which locale a catalogue belongs to. The two catalogues are module singletons, so identity tells them apart. */
export function localeOf(m: Messages): Locale {
  return m === CATALOGUES.ar ? "ar" : "en";
}
