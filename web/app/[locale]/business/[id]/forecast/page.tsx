import { ForecastCard } from "@/components/ForecastCard";
import { LensPage } from "@/components/LensPage";
import { LensNextSteps } from "@/components/NextSteps";
import { getForecast } from "@/lib/api";
import { titleFor } from "@/lib/page-title";


export const generateMetadata = titleFor((m) => m.nav.forecast);

export default function ForecastPage({ params, searchParams }: { params: Promise<{ locale: string; id: string }>; searchParams: Promise<{ as?: string | string[] }> }) {
  return (
    <LensPage params={params} searchParams={searchParams} load={getForecast} title={(m) => m.forecast.title}>
      {(data, { locale, m, base }) => (
        <>
          <ForecastCard data={data} locale={locale} m={m} />
          <LensNextSteps input={{ forecast: data }} lens="forecast" locale={locale} m={m} base={base} />
        </>
      )}
    </LensPage>
  );
}
