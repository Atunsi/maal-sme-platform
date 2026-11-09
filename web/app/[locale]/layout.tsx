import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans, IBM_Plex_Sans_Arabic, IBM_Plex_Sans_Condensed } from "next/font/google";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { DigitsSync } from "@/components/DigitsToggle";
import { FooterLinks } from "@/components/FooterLinks";
import { SiteHeader } from "@/components/SiteHeader";
import { TourPanel } from "@/components/TourPanel";
import { DIGITS_BOOT } from "@/lib/digits";
import { dirOf, getMessages, isLocale, LOCALES } from "@/lib/i18n";
import { THEME_BOOT } from "@/lib/theme";
import "../globals.css";

// next/font downloads these at build time and serves them from this app: no runtime call to Google.
const sans = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-plex-sans" });
const arabic = IBM_Plex_Sans_Arabic({ subsets: ["arabic"], weight: ["400", "500", "600", "700"], variable: "--font-plex-arabic" });
const condensed = IBM_Plex_Sans_Condensed({ subsets: ["latin"], weight: ["500", "600"], variable: "--font-plex-cond" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-plex-mono" });

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
    // The boot scripts add the theme class and the digits mark before hydration, so React must not object.
    <html
      lang={locale}
      dir={dirOf(locale)}
      suppressHydrationWarning
      className={`${sans.variable} ${arabic.variable} ${condensed.variable} ${mono.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
        <script dangerouslySetInnerHTML={{ __html: DIGITS_BOOT }} />
      </head>
      <body className="flex min-h-screen flex-col">
        <a href="#main" className="sr-only focus:not-sr-only focus:m-2 focus:inline-block focus:underline">
          {m.nav.skip}
        </a>
        <Suspense>
          <SiteHeader locale={locale} m={{ nav: m.nav, app: m.app, tour: m.tour, switcher: m.switcher, enums: m.enums, errors: m.errors }} />
        </Suspense>
        <main id="main" className="w-full flex-1">
          {children}
        </main>
        <footer className="border-t border-line">
          <div className="mx-auto flex max-w-[1240px] flex-col gap-1 px-6 py-4">
            <Suspense>
              <FooterLinks locale={locale} footer={m.footer} />
            </Suspense>
            <p className="text-[13px] text-muted">{m.footer.scope}</p>
          </div>
        </footer>
        {locale === "ar" && <DigitsSync />}
        <Suspense>
          <TourPanel
            locale={locale}
            labels={{ ...m.tour, sheet: m.sheet.open, how: m.footer.how }}
          />
        </Suspense>
      </body>
    </html>
  );
}
