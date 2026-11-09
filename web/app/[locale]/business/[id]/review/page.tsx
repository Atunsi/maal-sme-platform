import { AnomalyCard } from "@/components/AnomalyCard";
import { LensPage } from "@/components/LensPage";
import { getAnomaly } from "@/lib/api";


export default function ReviewPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  return (
    <LensPage params={params} load={getAnomaly} title={(m) => m.anomaly.title}>
      {(data, { locale, m }) => <AnomalyCard data={data} locale={locale} m={m} />}
    </LensPage>
  );
}
