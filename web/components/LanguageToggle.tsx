"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const LABELS = { en: "English", ar: "العربية" } as const;

/**
 * Swaps the locale segment and keeps the page, the business and any query state. On screen it is a globe icon,
 * the same on every page; the target language's name stays in the link's name and hidden text.
 */
export function LanguageToggle({ locale, label }: { locale: "en" | "ar"; label: string }) {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const target = locale === "en" ? "ar" : "en";
  const href = pathname.replace(/^\/(en|ar)(?=\/|$)/, `/${target}`) + (search ? `?${search}` : "");
  const name = `${label}: ${LABELS[target]}`;
  return (
    <Link href={href} lang={target} hrefLang={target} aria-label={name} title={name} className="themebtn icon-btn no-underline" data-language-toggle>
      <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3Z" />
      </svg>
      <span className="sr-only">{LABELS[target]}</span>
    </Link>
  );
}
