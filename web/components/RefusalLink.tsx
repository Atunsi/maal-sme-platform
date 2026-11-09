"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { DEMO_BUSINESS, roleQuery } from "@/lib/businesses";
import type { Locale } from "@/lib/i18n";

/** C6: a refusal leads somewhere: the demo business's overview, keeping the demo role. */
export function RefusalLink({ locale, label }: { locale: Locale; label: string }) {
  const query = roleQuery(useSearchParams()?.get("as"));
  return (
    <Link href={`/${locale}/business/${DEMO_BUSINESS}${query}`} prefetch={false} data-latin className="textlink mt-1 font-semibold">
      {label}
    </Link>
  );
}
