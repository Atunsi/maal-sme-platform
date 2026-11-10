import { LensPage } from "@/components/LensPage";
import { ZakatCard } from "@/components/ZakatCard";
import { getZakat } from "@/lib/api";


export default function ZakatPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  return (
    <LensPage params={params} load={getZakat} title={(m) => m.zakat.title}>
      {(data, { locale, m }) => <ZakatCard data={data} locale={locale} m={m} />}
    </LensPage>
  );
}
