import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { AppTabBar } from "@/components/AppTabBar";
import { DigitsSync } from "@/components/DigitsToggle";
import { FooterLinks } from "@/components/FooterLinks";
import { SiteHeader } from "@/components/SiteHeader";
import { TourPanel } from "@/components/TourPanel";
import { APP_BOOT } from "@/lib/app-mode";
import { DIGITS_BOOT } from "@/lib/digits";
import { dirOf, getMessages, isLocale, LOCALES } from "@/lib/i18n";
import { scenarioName } from "@/lib/scenario-label";
import { getScenarioIndex } from "@/lib/scenarios";
import { BAR_COLOUR, THEME_BOOT } from "@/lib/theme";
import "../globals.css";
// Phone-only rules, after the shared ones: every rule in it sits inside the phone media query.
import "../phone.css";

// B19 (DECISIONS 45): the four IBM Plex families are self-hosted from app/fonts (woff2 files from the
// Fontsource 5.3.0 packages, SIL Open Font License, licences beside them), so neither the build nor the page
// calls Google. Same weights, subsets and CSS variables as before.
const sans = localFont({
  src: [
    { path: "../fonts/ibm-plex-sans-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "../fonts/ibm-plex-sans-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "../fonts/ibm-plex-sans-latin-600-normal.woff2", weight: "600", style: "normal" },
  ],
  variable: "--font-plex-sans",
  display: "swap",
});
const arabic = localFont({
  src: [
    { path: "../fonts/ibm-plex-sans-arabic-arabic-400-normal.woff2", weight: "400", style: "normal" },
    { path: "../fonts/ibm-plex-sans-arabic-arabic-500-normal.woff2", weight: "500", style: "normal" },
    { path: "../fonts/ibm-plex-sans-arabic-arabic-600-normal.woff2", weight: "600", style: "normal" },
    { path: "../fonts/ibm-plex-sans-arabic-arabic-700-normal.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-plex-arabic",
  display: "swap",
});
const condensed = localFont({
  src: [
    { path: "../fonts/ibm-plex-sans-condensed-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "../fonts/ibm-plex-sans-condensed-latin-600-normal.woff2", weight: "600", style: "normal" },
  ],
  variable: "--font-plex-cond",
  display: "swap",
});
const mono = localFont({
  src: [
    { path: "../fonts/ibm-plex-mono-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "../fonts/ibm-plex-mono-latin-500-normal.woff2", weight: "500", style: "normal" },
  ],
  variable: "--font-plex-mono",
  display: "swap",
});

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

// The page may run under a phone's notch and home bar (viewport-fit=cover); the header and fixed panels pad
// themselves with the safe-area insets. Zoom is never blocked. THEME_BOOT and setDark re-colour these metas
// when the visitor's chosen theme differs from the system's.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: BAR_COLOUR.light },
    { media: "(prefers-color-scheme: dark)", color: BAR_COLOUR.dark },
  ],
};

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const m = getMessages(locale);
  return {
    title: `${m.app.name}: ${m.app.tagline}`,
    // The app variant: added to an iPhone's home screen, it opens full screen under a translucent status bar.
    appleWebApp: { capable: true, title: m.app.name, statusBarStyle: "black-translucent" },
  };
}

export default async function LocaleLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const m = getMessages(locale);
  // I8: the search covers the scenario library, read from the exported index (a file, not the API).
  const index = await getScenarioIndex();
  const scenarios = index.ok ? index.data.scenarios.map((s) => ({ name: s.name, label: scenarioName(s.label).name })) : [];
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
        <script dangerouslySetInnerHTML={{ __html: APP_BOOT }} />
      </head>
      <body className="flex min-h-screen flex-col">
        <a href="#main" className="sr-only focus:not-sr-only focus:m-2 focus:inline-block focus:underline">
          {m.nav.skip}
        </a>
        <Suspense>
          <SiteHeader
            locale={locale}
            m={{ nav: m.nav, app: m.app, tour: m.tour, switcher: m.switcher, enums: m.enums, errors: m.errors, search: m.search, sheet: m.sheet }}
            scenarios={scenarios}
          />
        </Suspense>
        <main id="main" className="w-full flex-1">
          {children}
        </main>
        <footer className="border-t border-line">
          <div className="mx-auto flex max-w-[1240px] flex-col gap-1 px-4 py-4 sm:px-6">
            <Suspense>
              <FooterLinks locale={locale} footer={m.footer} />
            </Suspense>
            <p className="text-[13px] text-muted">{m.footer.scope}</p>
          </div>
        </footer>
        {locale === "ar" && <DigitsSync />}
        <Suspense>
          <AppTabBar locale={locale} nav={m.nav} />
        </Suspense>
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
