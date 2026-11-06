"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const LABELS = { en: "English", ar: "العربية" } as const;

/** Swaps the locale segment and keeps the page, the business and any query state. */
export function LanguageToggle({ locale, label }: { locale: "en" | "ar"; label: string }) {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const target = locale === "en" ? "ar" : "en";
  const href = pathname.replace(/^\/(en|ar)(?=\/|$)/, `/${target}`) + (search ? `?${search}` : "");
  return (
    <Link href={href} lang={target} hrefLang={target} aria-label={`${label}: ${LABELS[target]}`} className="navlink">
      {LABELS[target]}
    </Link>
  );
}
