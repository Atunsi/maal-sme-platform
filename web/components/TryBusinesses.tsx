import Link from "next/link";
import { Suspense } from "react";
import { Plate } from "@/components/ui";
import { getCredit } from "@/lib/api";
import { DEMO_BUSINESSES } from "@/lib/businesses";
import { creditPlate } from "@/lib/decision";
import { fill, localeOf, type Locale, type Messages } from "@/lib/i18n";
import { nameOf } from "@/lib/business-names";

const STATUS_VARIANT = { scored: "ink", partial_profile: "warn", insufficient_data: "warn" } as const;

/** One demo business: its ID, its decision plate and profile status, both read from the API, never typed. */
export async function TryCard({ id, locale, m }: { id: number; locale: Locale; m: Messages }) {
  const r = await getCredit(id); // through the queue in lib/api.ts, from the server
  const l = m.landing;
  if (!r.ok) {
    // A failed card says so and blocks no other card. Not a link: there is nothing to open.
    return (
      <div role="alert" data-try={id} data-try-error className="flex min-h-[150px] flex-col gap-2.5 border border-bad bg-bad-soft p-5 text-bad">
        <span className="heading text-value">
          {fill(m.dashboard.title, { id, name: nameOf(id, locale) })}
        </span>
        <span className="text-label">
          {m.admin.error} {m.errors[r.kind]}
        </span>
      </div>
    );
  }
  const plate = creditPlate(r.data, m);
  return (
    <Link href={`/${locale}/business/${id}`} prefetch={false} data-try={id} data-phone="try" className="lift flex min-h-[150px] flex-col gap-2.5 border border-line bg-card p-5 text-ink no-underline">
      <span className="heading text-value">
        {fill(m.dashboard.title, { id, name: nameOf(id, locale) })}
      </span>
      <span className="flex flex-wrap gap-2">
        <Plate variant={plate.variant}>{plate.word}</Plate>
        <Plate variant={STATUS_VARIANT[r.data.status]}>{m.enums.status[r.data.status]}</Plate>
      </span>
      <span className="mt-auto text-label font-semibold text-accent">{l.tryOpen}</span>
    </Link>
  );
}

function TryCardLoading({ id, m }: { id: number; m: Messages }) {
  return (
    <div aria-busy="true" data-try-loading={id} className="flex min-h-[150px] flex-col gap-2.5 border border-line bg-card p-5">
      <span className="heading text-value">
        {fill(m.dashboard.title, { id, name: nameOf(id, localeOf(m)) })}
      </span>
      <span aria-hidden="true" className="skeleton h-6 w-40" />
      <span className="sr-only">{m.common.loading}</span>
    </div>
  );
}

/**
 * I9 (DECISIONS 45): the landing page's "Try a business" strip. Each card waits for its own credit response
 * in its own Suspense boundary, so the hero renders first, and a card that fails shows its error alone.
 */
export function TryBusinesses({ locale, m }: { locale: Locale; m: Messages }) {
  const l = m.landing;
  return (
    <section aria-labelledby="tryh" className="mx-auto flex w-full max-w-[1240px] flex-col gap-5 px-6 py-[56px]" data-try-strip>
      <div>
        <h2 id="tryh" className="heading text-[32px]">
          {l.tryTitle}
        </h2>
        <p className="mt-1 max-w-3xl text-label text-muted">{l.tryIntro}</p>
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
        {DEMO_BUSINESSES.map((id) => (
          <Suspense key={id} fallback={<TryCardLoading id={id} m={m} />}>
            <TryCard id={id} locale={locale} m={m} />
          </Suspense>
        ))}
      </div>
    </section>
  );
}
