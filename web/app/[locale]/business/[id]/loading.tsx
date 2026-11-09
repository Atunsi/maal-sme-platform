"use client";

import { useParams } from "next/navigation";
import { CardLoading, Page } from "@/components/ui";
import { getMessages, isLocale } from "@/lib/i18n";

// A business page waits on its lens calls through the API queue (entry 41). Like the admin page, a tap on
// any business page lands here at once, card-shaped (I7), instead of leaving the old page up with no sign
// that the tap was taken.
export default function BusinessLoading() {
  const { locale } = useParams<{ locale: string }>();
  const m = getMessages(isLocale(locale) ? locale : "en");
  return (
    <Page>
      <span aria-hidden="true" className="skeleton h-9 w-2/3 max-w-[480px]" />
      <div className="grid gap-6 md:grid-cols-2">
        <CardLoading title={m.common.loading} m={m} tall />
        <CardLoading title={m.common.loading} m={m} />
      </div>
    </Page>
  );
}
