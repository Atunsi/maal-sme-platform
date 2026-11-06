import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { AnomalyCard } from "@/components/AnomalyCard";
import { BusinessHeader } from "@/components/BusinessHeader";
import { CreditCard } from "@/components/CreditCard";
import { ForecastCard } from "@/components/ForecastCard";
import { ProfilePanel } from "@/components/ProfilePanel";
import { ShariaPanel } from "@/components/ShariaPanel";
import { ApiError, Card, CardLoading } from "@/components/ui";
import { ZakatCard } from "@/components/ZakatCard";
import { getAnomaly, getCredit, getForecast, getProfile, getZakat } from "@/lib/api";
import { fill, getMessages, isLocale, type Messages } from "@/lib/i18n";
import { isServingId } from "@/lib/population";
import type { ApiResult } from "@/lib/types";

export const dynamic = "force-dynamic";

/** One lens: its own loading state and its own error, so a slow or failed lens blocks no other (§8). */
function Lens<T>({ title, result, m, children }: { title: string; result: Promise<ApiResult<T>>; m: Messages; children: (data: T) => ReactNode }) {
  return (
    <Suspense fallback={<CardLoading title={title} m={m} />}>
      <Resolved title={title} result={result} m={m}>
        {children}
      </Resolved>
    </Suspense>
  );
}

async function Resolved<T>({ title, result, m, children }: { title: string; result: Promise<ApiResult<T>>; m: Messages; children: (data: T) => ReactNode }) {
  const r = await result;
  if (r.ok) return children(r.data);
  return (
    <Card title={title}>
      <ApiError kind={r.kind} detail={r.detail} m={m} />
    </Card>
  );
}

function NotServing({ locale, m, id }: { locale: string; m: Messages; id: string }) {
  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-semibold">{fill(m.dashboard.title, { id })}</h1>
      <ApiError kind="not_found" m={m} />
      <Link href={`/${locale}`} className="underline">
        {m.common.back}
      </Link>
    </div>
  );
}

type Props = {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ view?: string | string[] }>;
};

export default async function DashboardPage({ params, searchParams }: Props) {
  const { locale, id: rawId } = await params;
  if (!isLocale(locale)) notFound();
  const m = getMessages(locale);
  const id = Number(rawId);
  if (!isServingId(id)) return <NotServing locale={locale} m={m} id={rawId} />;
  const initialView = (await searchParams).view === "compliance" ? "compliance" : "public";

  // All five start here and never reject. lib/api.ts runs them one at a time for now, so the order
  // matters: the anomaly route is the slowest, and last it delays no other card.
  const profile = getProfile(id);
  const credit = getCredit(id);
  const zakat = getZakat(id);
  const forecast = getForecast(id);
  const anomaly = getAnomaly(id);

  const first = await profile;
  if (!first.ok && first.kind === "not_found") return <NotServing locale={locale} m={m} id={rawId} />;

  return (
    <div className="space-y-5">
      {first.ok ? (
        <BusinessHeader data={first.data} locale={locale} m={m} />
      ) : (
        <Card title={fill(m.dashboard.title, { id })}>
          <ApiError kind={first.kind} detail={first.detail} m={m} />
        </Card>
      )}
      <Lens title={m.credit.title} result={credit} m={m}>
        {(data) => <CreditCard data={data} initialView={initialView} locale={locale} m={m} />}
      </Lens>
      <div className="grid gap-5 lg:grid-cols-2">
        <Lens title={m.sharia.title} result={credit} m={m}>
          {(data) => <ShariaPanel data={data} locale={locale} m={m} />}
        </Lens>
        <Lens title={m.zakat.title} result={zakat} m={m}>
          {(data) => <ZakatCard data={data} locale={locale} m={m} />}
        </Lens>
      </div>
      <Lens title={m.forecast.title} result={forecast} m={m}>
        {(data) => <ForecastCard data={data} locale={locale} m={m} />}
      </Lens>
      <Lens title={m.anomaly.title} result={anomaly} m={m}>
        {(data) => <AnomalyCard data={data} locale={locale} m={m} />}
      </Lens>
      {first.ok && <ProfilePanel data={first.data} m={m} />}
    </div>
  );
}
