import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { LanguageToggle } from "@/components/LanguageToggle";
import { dirOf, getMessages, isLocale, LOCALES } from "@/lib/i18n";
import "../globals.css";

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const m = getMessages(locale);
  return { title: `${m.app.name}: ${m.app.tagline}` };
}

export default async function LocaleLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const m = getMessages(locale);
  return (
    <html lang={locale} dir={dirOf(locale)}>
      <body className="flex min-h-screen flex-col">
        <a href="#main" className="sr-only focus:not-sr-only focus:m-2 focus:inline-block focus:underline">
          {m.nav.skip}
        </a>
        <div role="note" className="bg-warn-soft px-4 py-2 text-center text-sm font-medium text-warn">
          <span aria-hidden="true">! </span>
          {m.banner.synthetic}
        </div>
        <header className="border-b border-line bg-card">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-4 py-3">
            <Link href={`/${locale}`} className="text-lg font-semibold text-brand">
              {m.app.name}
            </Link>
            <span className="text-sm text-muted">{m.app.tagline}</span>
            <nav aria-label={m.nav.main} className="ms-auto flex items-center gap-4">
              <Link href={`/${locale}`} className="text-sm font-medium underline">
                {m.nav.home}
              </Link>
              <Suspense>
                <LanguageToggle locale={locale} label={m.nav.language} />
              </Suspense>
            </nav>
          </div>
        </header>
        <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
          {children}
        </main>
        <footer className="border-t border-line bg-card">
          <p className="mx-auto max-w-6xl px-4 py-4 text-sm text-muted">{m.footer.scope}</p>
        </footer>
      </body>
    </html>
  );
}
