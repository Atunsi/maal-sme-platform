import { LensPage } from "@/components/LensPage";
import { LensNextSteps } from "@/components/NextSteps";
import { ZakatCard } from "@/components/ZakatCard";
import { getZakat } from "@/lib/api";
import { titleFor } from "@/lib/page-title";


export const generateMetadata = titleFor((m) => m.nav.zakat);

export default function ZakatPage({ params, searchParams }: { params: Promise<{ locale: string; id: string }>; searchParams: Promise<{ as?: string | string[] }> }) {
  return (
    <LensPage params={params} searchParams={searchParams} load={getZakat} title={(m) => m.zakat.title}>
      {(data, { locale, m, base }) => (
        <>
          <ZakatCard data={data} locale={locale} m={m} />
          <LensNextSteps input={{ zakat: data }} lens="zakat" locale={locale} m={m} base={base} />
        </>
      )}
    </LensPage>
  );
}
