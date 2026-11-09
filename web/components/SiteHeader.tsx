"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useRef, useState } from "react";
import { ArabicLogo, EnglishWordmark, LogoBand } from "@/components/brand/Logos";
import { DigitsToggle } from "@/components/DigitsToggle";
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
  const all = { href: `${base}/admin${query}`, label: nav.admin, current: rest === "/admin" };
  if (admin && !rest.startsWith("/business")) return [all, scenarios];
  const id = /^\/business\/(\d+)/.exec(rest)?.[1] ?? DEMO_BUSINESS;
  const root = `${base}/business/${id}`;
  return [
    // An admin who opened a business can always get back to the list.
    ...(admin ? [all] : []),
    { href: `${root}${query}`, label: nav.overview, current: rest === `/business/${id}` },
    ...LENSES.map((lens) => ({ href: `${root}/${lens}${query}`, label: nav[lens], current: rest === `/business/${id}/${lens}` })),
    scenarios,
  ];
}

export function SiteHeader({ locale, m }: { locale: Locale; m: Pick<Messages, "nav" | "app"> }) {
  const pathname = usePathname();
  const role = useSearchParams().get("as");
  // The phone menu is open on the page it was opened on, so moving to another page closes it.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const menuButton = useRef<HTMLButtonElement>(null);
  const rest = pathname.replace(/^\/(en|ar)/, "").replace(/\/$/, "");
  if (rest === "/sign-in") return null; // the sign-in page carries its own brand panel

  const { nav } = m;
  const base = `/${locale}`;
  const query = roleQuery(role);
  const admin = role === "admin" || rest === "/admin";
  const id = /^\/business\/(\d+)/.exec(rest)?.[1];
  const signedIn = role === "admin" ? nav.roleAdmin : role === "owner" ? fill(nav.roleOwner, { id: id ?? DEMO_BUSINESS }) : null;

  const items = navItems(rest, base, query, nav, admin);
  const close = () => setOpenOn(null);
  return (
    <>
      <header className="bleed border-b border-line bg-card">
        <div className="mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3.5">
            <Link href={base} aria-label={nav.home} className="flex min-h-11 min-w-11 items-center gap-3.5 text-accent no-underline">
              {/* E7: below 390 px the Arabic logo stands alone at 32 px, as the design rule allows. */}
              <ArabicLogo height={46} animate className="h-8 w-auto min-[390px]:h-[46px]" />
              <span className="hidden min-[390px]:inline-flex">
                <EnglishWordmark height={20} animate />
              </span>
            </Link>
            {/* Beside the link, not in it: visible text must be part of a link's accessible name. */}
            {!signedIn && <span className="hidden max-w-[120px] border-s border-line ps-3.5 text-xs leading-tight text-muted lg:block">{m.app.tagline}</span>}
          </div>
          {/* E7: below 768 px the page links and the buttons fold into this menu. */}
          <button
            ref={menuButton}
            type="button"
            className="themebtn md:hidden"
            aria-expanded={open}
            aria-controls="site-menu"
            onClick={() => setOpenOn(open ? null : pathname)}
          >
            {nav.menu}
          </button>
          <div
            id="site-menu"
            className={`${open ? "flex" : "hidden"} w-full flex-col gap-3 border-t border-line pt-3 md:contents`}
            onKeyDown={(event) => {
              if (event.key !== "Escape") return;
              close();
              menuButton.current?.focus();
            }}
          >
            <nav aria-label={rest === "" ? nav.sections : nav.main} className="flex flex-col gap-x-4 text-[15px] md:flex-row md:flex-wrap">
              {items.map((item) => (
                // No prefetch: a prefetch renders the page on the server, and its API calls would join the queue
                // (lib/api.ts) ahead of the page the visitor actually opens next.
                <Link key={item.href} href={item.href} prefetch={false} aria-current={item.current ? "page" : undefined} className="navlink" onClick={close}>
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
              <ThemeToggle label={nav.themeDark} />
              {locale === "ar" && <DigitsToggle label={nav.digitsArab} />}
              {signedIn ? (
                <Link href={`${base}/sign-in`} prefetch={false} className="textlink">
                  {nav.signOut}
                </Link>
              ) : (
                <Link href={`${base}/sign-in`} prefetch={false} className="solid-btn min-h-11">
                  {nav.signIn}
                </Link>
              )}
            </div>
          </div>
        </div>
      </header>
      <LogoBand />
    </>
  );
}
