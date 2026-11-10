"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { DEMO_BUSINESS, roleQuery } from "@/lib/businesses";
import type { Locale, Messages } from "@/lib/i18n";

type Tab = { href: string; label: string; icon: ReactNode; current: boolean };

const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" } as const;
const Icon = ({ children }: { children: ReactNode }) => (
  <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" {...stroke}>
    {children}
  </svg>
);
const ICONS = {
  overview: (
    <Icon>
      <path d="M4 11.5 12 5l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5h-5v5H5a1 1 0 0 1-1-1z" />
    </Icon>
  ),
  credit: (
    <Icon>
      <rect x="3.5" y="6" width="17" height="12" rx="2" />
      <path d="M3.5 10h17M7 14.5h4" />
    </Icon>
  ),
  forecast: (
    <Icon>
      <path d="M4 19h16M5 15l4-4 3 3 6-6" />
      <path d="M15 8h3v3" />
    </Icon>
  ),
  review: (
    <Icon>
      <path d="M8 6h11M8 12h11M8 18h11" />
      <circle cx="4.5" cy="6" r="1" />
      <circle cx="4.5" cy="12" r="1" />
      <circle cx="4.5" cy="18" r="1" />
    </Icon>
  ),
  more: (
    <Icon>
      <circle cx="5.5" cy="12" r="1.3" />
      <circle cx="12" cy="12" r="1.3" />
      <circle cx="18.5" cy="12" r="1.3" />
    </Icon>
  ),
};

/**
 * The app variant's bottom tab bar (lib/app-mode.ts): four business pages a thumb reaches without the header
 * menu, and More for the rest, in a sheet that rises from the bar. CSS shows it on phones only (app/phone.css),
 * so larger screens are unchanged. Every tab is a link, so a tap works before the page's script has taken over.
 */
export function AppTabBar({ locale, nav, links }: { locale: Locale; nav: Messages["nav"]; links: { glossary: string; how: string } }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const [moreOn, setMoreOn] = useState<string | null>(null);
  const sheetId = useId();
  const moreButton = useRef<HTMLButtonElement>(null);
  const sheet = useRef<HTMLDivElement>(null);
  const more = moreOn === pathname; // like the header menu: moving to another page closes it

  useEffect(() => {
    if (!more) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setMoreOn(null);
      moreButton.current?.focus();
    };
    // A tap outside the sheet and the More button only closes the sheet, as in AFC2027's menu.
    const onDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!sheet.current?.contains(target) && !moreButton.current?.contains(target)) setMoreOn(null);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [more]);

  const rest = pathname.replace(/^\/(en|ar)/, "").replace(/\/$/, "");
  const match = /^\/business\/(\d+)(\/[a-z]+)?/.exec(rest);
  // Every app page has the bar; the landing page and sign-in are the way in, not the app.
  if (rest === "" || rest === "/sign-in") return null;
  // Off the business pages the tabs open the demo business: the demo stores nothing to remember another by.
  const id = match?.[1] ?? String(DEMO_BUSINESS);
  // null off the business pages, so no business tab is marked there.
  const page = match ? (match[2] ?? "") : null;
  const role = params.get("as");
  const query = roleQuery(role);
  const root = `/${locale}/business/${id}`;
  const tab = (path: string, label: string, icon: ReactNode): Tab => ({ href: `${root}${path}${query}`, label, icon, current: page === path });
  const tabs = [tab("", nav.overview, ICONS.overview), tab("/credit", nav.credit, ICONS.credit), tab("/forecast", nav.forecast, ICONS.forecast), tab("/review", nav.review, ICONS.review)];
  const extra = [
    { href: `${root}/sharia${query}`, label: nav.sharia, current: page === "/sharia" },
    { href: `${root}/zakat${query}`, label: nav.zakat, current: page === "/zakat" },
    { href: `/${locale}/scenarios${query}`, label: nav.scenarios, current: rest.startsWith("/scenarios") },
    ...(role === "admin" || rest === "/admin" ? [{ href: `/${locale}/admin${query}`, label: nav.admin, current: rest === "/admin" }] : []),
    { href: `/${locale}/glossary${query}`, label: links.glossary, current: rest === "/glossary" },
    { href: `/${locale}/how-it-works${query}`, label: links.how, current: rest === "/how-it-works" },
  ];
  const moreCurrent = extra.some((item) => item.current);

  return (
    <nav aria-label={nav.appTabs} className="app-tabbar" data-app-tabbar>
      {more && (
        <div ref={sheet} id={sheetId} className="app-more">
          <ul>
            {extra.map((item) => (
              <li key={item.href}>
                <Link href={item.href} prefetch={false} aria-current={item.current ? "page" : undefined} onClick={() => setMoreOn(null)}>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      <ul className="app-tabs">
        {tabs.map((t) => (
          <li key={t.href}>
            <Link href={t.href} prefetch={false} aria-current={t.current ? "page" : undefined} className="app-tab">
              {t.icon}
              <span>{t.label}</span>
            </Link>
          </li>
        ))}
        <li>
          <button
            ref={moreButton}
            type="button"
            className="app-tab"
            aria-expanded={more}
            aria-controls={sheetId}
            data-current={moreCurrent || undefined}
            onClick={() => setMoreOn(more ? null : pathname)}
          >
            {ICONS.more}
            <span>{nav.more}</span>
          </button>
        </li>
      </ul>
    </nav>
  );
}
