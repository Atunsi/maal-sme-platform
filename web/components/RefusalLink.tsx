"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { DEMO_BUSINESS, roleQuery } from "@/lib/businesses";
import type { Locale } from "@/lib/i18n";

type Props = { locale: Locale; label: string };

function RoleLink({ locale, label, query }: Props & { query: string }) {
  return (
    <Link href={`/${locale}/business/${DEMO_BUSINESS}${query}`} prefetch={false} data-latin className="textlink mt-1 font-semibold">
      {label}
    </Link>
  );
}

function WithRole(props: Props) {
  return <RoleLink {...props} query={roleQuery(useSearchParams()?.get("as"))} />;
}

/** C6: a refusal leads somewhere: the demo business's overview, keeping the demo role. A pre-built page (the
 * online snapshot) links without the role until the query can be read. */
export function RefusalLink(props: Props) {
  return (
    <Suspense fallback={<RoleLink {...props} query="" />}>
      <WithRole {...props} />
    </Suspense>
  );
}
