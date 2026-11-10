import type { Metadata } from "next";
import { nameOf } from "@/lib/business-names";
import { fill, getMessages, isLocale, type Messages } from "@/lib/i18n";

/**
 * T17 (DECISIONS 57): each page's browser title, in the page's language: the page name from the catalogue, the
 * business when the page is about one, and the app name ("«التمويل»، … | مآل", "Credit, … | Ma'al"). The landing
 * page keeps the layout's title.
 */
export function titleFor(page: (m: Messages) => string) {
  return async ({ params }: { params: Promise<{ locale: string; id?: string }> }): Promise<Metadata> => {
    const { locale, id } = await params;
    if (!isLocale(locale)) return {};
    const m = getMessages(locale);
    const business = id !== undefined && /^\d+$/.test(id) ? nameOf(Number(id), locale) : null;
    const template = business === null ? m.meta.pageTitleShort : m.meta.pageTitle;
    return { title: fill(template, { page: page(m), business: business ?? "", app: m.app.name }) };
  };
}
