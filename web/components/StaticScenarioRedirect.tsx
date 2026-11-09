"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import type { Locale } from "@/lib/i18n";

function Redirect({ locale }: { locale: Locale }) {
  const params = useSearchParams();
  const router = useRouter();
  useEffect(() => {
    const name = params.get("scenario") ?? params.get("s");
    if (!name || !/^[a-z0-9_]+$/.test(name)) return;
    const rest = new URLSearchParams(params.toString());
    rest.delete("scenario");
    rest.delete("s");
    const query = rest.toString();
    router.replace(`/${locale}/scenarios/s/${name}/${query ? `?${query}` : ""}`, { scroll: false });
  }, [params, router, locale]);
  return null;
}

/**
 * The online snapshot's /scenarios is one file, so a link that names a scenario in the query (the tour's
 * step, an old ?s= link) moves on to that scenario's own file, keeping the rest of the query (the tour step).
 */
export function StaticScenarioRedirect({ locale }: { locale: Locale }) {
  return (
    <Suspense>
      <Redirect locale={locale} />
    </Suspense>
  );
}
