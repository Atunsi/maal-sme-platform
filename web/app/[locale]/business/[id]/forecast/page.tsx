import { ForecastCard } from "@/components/ForecastCard";
import { LensPage } from "@/components/LensPage";
import { getForecast } from "@/lib/api";

export const dynamic = "force-dynamic";

export default function ForecastPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  return (
    <LensPage params={params} load={getForecast} title={(m) => m.forecast.title}>
      {(data, { locale, m }) => <ForecastCard data={data} locale={locale} m={m} />}
    </LensPage>
  );
}
