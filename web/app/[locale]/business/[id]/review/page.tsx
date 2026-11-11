import { AnomalyCard } from "@/components/AnomalyCard";
import { LensPage } from "@/components/LensPage";
import { getAnomaly } from "@/lib/api";
import { titleFor } from "@/lib/page-title";


export const generateMetadata = titleFor((m) => m.nav.review);

export default function ReviewPage({ params, searchParams }: { params: Promise<{ locale: string; id: string }>; searchParams: Promise<{ as?: string | string[] }> }) {
  return (
    <LensPage params={params} searchParams={searchParams} load={getAnomaly} title={(m) => m.anomaly.title}>
      {(data, { locale, m }) => <AnomalyCard data={data} locale={locale} m={m} />}
    </LensPage>
  );
}
