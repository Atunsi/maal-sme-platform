"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ArabicLogo, EnglishWordmark, LogoBand } from "@/components/brand/Logos";
import { LanguageToggle } from "@/components/LanguageToggle";
import { ThemeToggle } from "@/components/ThemeToggle";
import { DEMO_BUSINESS, roleQuery } from "@/lib/businesses";
import { fill, type Locale, type Messages } from "@/lib/i18n";

type Item = { href: string; label: string; current?: boolean };

const LENSES = ["credit", "sharia", "zakat", "forecast", "review"] as const;

function navItems(rest: string, base: string, query: string, nav: Messages["nav"], admin: boolean): Item[] {
  const scenarios = { href: `${base}/scenarios${query}`, label: nav.scenarios, current: rest === "/scenarios" };
  if (rest === "") {
    return [
      { href: "#how", label: nav.how },
      { href: "#lenses", label: nav.lenses },
      { href: "#different", label: nav.why },
      scenarios,
      { href: "#faq", label: nav.faq },
    ];
  }
  if (admin && !rest.startsWith("/business")) {
    return [{ href: `${base}/admin${query}`, label: nav.admin, current: rest === "/admin" }, scenarios];
  }
  const id = /^\/business\/(\d+)/.exec(rest)?.[1] ?? DEMO_BUSINESS;
  const root = `${base}/business/${id}`;
  return [
    { href: `${root}${query}`, label: nav.overview, current: rest === `/business/${id}` },
    ...LENSES.map((lens) => ({ href: `${root}/${lens}${query}`, label: nav[lens], current: rest === `/business/${id}/${lens}` })),
    scenarios,
  ];
}

export function SiteHeader({ locale, m }: { locale: Locale; m: Pick<Messages, "nav" | "app"> }) {
  const pathname = usePathname();
  const role = useSearchParams().get("as");
  const rest = pathname.replace(/^\/(en|ar)/, "").replace(/\/$/, "");
  if (rest === "/sign-in") return null; // the sign-in page carries its own brand panel

  const { nav } = m;
  const base = `/${locale}`;
  const query = roleQuery(role);
  const admin = role === "admin" || rest === "/admin";
  const id = /^\/business\/(\d+)/.exec(rest)?.[1];
  const signedIn = role === "admin" ? nav.roleAdmin : role === "owner" ? fill(nav.roleOwner, { id: id ?? DEMO_BUSINESS }) : null;

  return (
    <>
      <header className="border-b border-line bg-card">
        <div className="mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-x-6 gap-y-3 px-6 py-3">
          <Link href={base} aria-label={nav.home} className="flex items-center gap-3.5 text-accent no-underline">
            <ArabicLogo height={46} animate />
            <EnglishWordmark height={20} animate />
            <span className="max-w-[120px] border-s border-line ps-3.5 text-xs leading-tight text-muted">{m.app.tagline}</span>
          </Link>
          <nav aria-label={rest === "" ? nav.sections : nav.main} className="flex flex-wrap gap-x-5 text-[15px]">
            {navItems(rest, base, query, nav, admin).map((item) => (
              <Link key={item.href} href={item.href} aria-current={item.current ? "page" : undefined} className="navlink">
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="flex flex-wrap items-center gap-3">
            {signedIn && (
              <span className="flex flex-col leading-tight">
                <span className="text-xs text-muted">{nav.signedInAs}</span>
                <span className="text-sm font-semibold">{signedIn}</span>
              </span>
            )}
            <LanguageToggle locale={locale} label={nav.language} />
            <ThemeToggle labels={{ dark: nav.themeDark, light: nav.themeLight }} />
            {signedIn ? (
              <Link href={`${base}/sign-in`} className="textlink">
                {nav.signOut}
              </Link>
            ) : (
              <Link href={`${base}/sign-in`} className="solid-btn min-h-11">
                {nav.signIn}
              </Link>
            )}
          </div>
        </div>
      </header>
      <LogoBand />
    </>
  );
}
