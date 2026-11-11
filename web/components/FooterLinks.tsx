"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { roleQuery } from "@/lib/businesses";
import type { Locale, Messages } from "@/lib/i18n";

/** B14: the footer's links keep the demo role, like every other link on the page. */
export function FooterLinks({ locale, footer }: { locale: Locale; footer: Messages["footer"] }) {
  const query = roleQuery(useSearchParams().get("as"));
  return (
    <nav aria-label={footer.links} className="flex flex-wrap gap-x-5 text-label">
      <Link href={`/${locale}/how-it-works${query}`} prefetch={false} className="textlink">
        {footer.how}
      </Link>
      <Link href={`/${locale}/glossary${query}`} prefetch={false} className="textlink">
        {footer.glossary}
      </Link>
    </nav>
  );
}
