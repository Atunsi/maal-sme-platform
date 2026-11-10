import { RoleHeading } from "@/components/RoleHeading";
import { searchOf } from "@/lib/static-data";
import { RoleLink } from "@/components/RoleLink";
import { notFound, redirect } from "next/navigation";
import { Lens, NotServing } from "@/components/LensPage";
import { PrintButton } from "@/components/PrintButton";
import { ProfilePanel } from "@/components/ProfilePanel";
import { creditReadout, forecastReadout, ReadoutCard, reviewReadout, shariaReadout, zakatReadout } from "@/components/Readouts";
import { ApiError, Card, Page } from "@/components/ui";
import { VerdictSheet } from "@/components/VerdictSheet";
import { getAnomaly, getCredit, getForecast, getProfile, getZakat } from "@/lib/api";
import { roleQuery } from "@/lib/businesses";
import { fill, getMessages, isLocale } from "@/lib/i18n";
import { isServingId } from "@/lib/population";
import { TOUR_STEPS } from "@/lib/tour";
import { nameOf } from "@/lib/business-names";
import { titleFor } from "@/lib/page-title";
import { ReferenceNote } from "@/components/ReferenceNote";
import { referenceFor } from "@/lib/reference";


type Props = {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ view?: string | string[]; as?: string | string[] }>;
};

export const generateMetadata = titleFor((m) => m.nav.overview);

export default async function OverviewPage({ params, searchParams }: Props) {
  const { locale, id: rawId } = await params;
  if (!isLocale(locale)) notFound();
  const m = getMessages(locale);
  const id = Number(rawId);
  if (!isServingId(id)) return <NotServing locale={locale} m={m} id={rawId} />;
  const { view, as } = await searchOf(searchParams);
  const query = roleQuery(as);
  // First-pass links to the Compliance View pointed here. It now lives on the credit page.
  if (view === "compliance") redirect(`/${locale}/business/${id}/credit?view=compliance${query.replace("?", "&")}`);

  // All five start here and never reject. lib/api.ts runs them one at a time for now, so the order
  // matters: the anomaly route is the slowest, and last it delays no other card.
  const credit = getCredit(id);
  const zakat = getZakat(id);
  const forecast = getForecast(id);
  const profile = getProfile(id);
  const anomaly = getAnomaly(id);

  const first = await credit;
  if (!first.ok && first.kind === "not_found") return <NotServing locale={locale} m={m} id={rawId} />;

  const root = `/${locale}/business/${id}`;
  const partial = (status: string) => (status === "partial_profile" ? m.enums.status.partial_profile : undefined);

  return (
    <Page>
      <div className="rise flex flex-wrap items-baseline justify-between gap-3">
        {/* C7: "Welcome back" only for the owner role; anyone else sees the business named. */}
        <RoleHeading
          className="heading text-[30px]"
          owner={fill(m.overview.welcome, { id, name: nameOf(id, locale) })}
          other={fill(m.overview.heading, { id, name: nameOf(id, locale) })}
        />
        <div data-phone="actions" className="flex flex-wrap items-center gap-3">
          <RoleLink href={`${root}?tour=${TOUR_STEPS[0]!.id}${query.replace("?", "&")}`} className="textlink font-semibold" data-tour-start data-print-hide>
            {m.tour.start}
          </RoleLink>
          <RoleLink href={`${root}/sheet${query}`} className="textlink font-semibold" data-print-hide>
            {m.sheet.open}
          </RoleLink>
          <PrintButton label={m.sheet.print} />
        </div>
      </div>
      <ReferenceNote
        businessId={id}
        current={first.ok ? referenceFor(first.data.receipt, id) : null}
        labels={{ opened: m.record.referenceOpened, old: m.record.oldReference }}
      />
      {first.ok ? (
        <VerdictSheet data={first.data} locale={locale} m={m} />
      ) : (
        <Card title={m.credit.title}>
          <ApiError kind={first.kind} detail={first.detail} m={m} />
        </Card>
      )}
      <section aria-labelledby="readouts" className="flex flex-col gap-3.5">
        <h2 id="readouts" className="heading caps text-[15px] text-muted">
          {m.overview.readouts}
        </h2>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(210px,1fr))] gap-4">
          <Lens title={m.nav.credit} result={credit} m={m}>
            {(data) => (
              <ReadoutCard lens={m.nav.credit} href={`${root}/credit${query}`} readout={creditReadout(data, locale, m)} partial={partial(data.status)} index={0} m={m} />
            )}
          </Lens>
          <Lens title={m.nav.sharia} result={credit} m={m}>
            {(data) => (
              <ReadoutCard lens={m.nav.sharia} href={`${root}/sharia${query}`} readout={shariaReadout(data, locale, m)} partial={partial(data.status)} index={1} m={m} />
            )}
          </Lens>
          <Lens title={m.nav.zakat} result={zakat} m={m}>
            {(data) => (
              <ReadoutCard lens={m.nav.zakat} href={`${root}/zakat${query}`} readout={zakatReadout(data, locale, m)} partial={partial(data.status)} index={2} m={m} />
            )}
          </Lens>
          <Lens title={m.nav.forecast} result={forecast} m={m}>
            {(data) => (
              <ReadoutCard lens={m.nav.forecast} href={`${root}/forecast${query}`} readout={forecastReadout(data, locale, m)} partial={partial(data.status)} index={3} m={m} />
            )}
          </Lens>
          <Lens title={m.nav.review} result={anomaly} m={m}>
            {(data) => (
              <ReadoutCard lens={m.nav.review} href={`${root}/review${query}`} readout={reviewReadout(data, locale, m)} partial={partial(data.status)} index={4} m={m} />
            )}
          </Lens>
        </div>
      </section>
      <Lens title={m.dashboard.profileTitle} result={profile} m={m}>
        {(data) => <ProfilePanel data={data} m={m} />}
      </Lens>
    </Page>
  );
}
