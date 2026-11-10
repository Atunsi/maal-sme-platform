"use client";

import { useParams } from "next/navigation";
import { Page } from "@/components/ui";
import { getMessages, isLocale } from "@/lib/i18n";

// The admin page makes one credit call per demo business through the queue (entry 41), several seconds in
// all, so a navigation to it lands here at once instead of waiting on the old page.
export default function AdminLoading() {
  const { locale } = useParams<{ locale: string }>();
  const m = getMessages(isLocale(locale) ? locale : "en");
  return (
    <Page>
      <p role="status" className="text-muted">
        {m.common.loading}
      </p>
    </Page>
  );
}
