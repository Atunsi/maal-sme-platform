import { LensPage } from "@/components/LensPage";
import { LensNextSteps } from "@/components/NextSteps";
import { ShariaPanel } from "@/components/ShariaPanel";
import { getCredit } from "@/lib/api";
import { titleFor } from "@/lib/page-title";
import { DecisionRecord } from "@/components/DecisionRecord";
import { recordInput } from "@/lib/record";


// The Sharia screen arrives in the credit response; the API has no route of its own for it.
export const generateMetadata = titleFor((m) => m.nav.sharia);

export default function ShariaPage({ params, searchParams }: { params: Promise<{ locale: string; id: string }>; searchParams: Promise<{ as?: string | string[] }> }) {
  return (
    <LensPage params={params} searchParams={searchParams} load={getCredit} title={(m) => m.sharia.title}>
      {(data, { locale, m, base }) => (
        <>
          <ShariaPanel data={data} locale={locale} m={m} />
          {/* Outside the panel: the owner prompt carries no answer form, and the technical record holds the hash check. */}
          <DecisionRecord input={recordInput("sharia", data)} receipt={data.receipt} lens={m.sharia.title} locale={locale} m={m} />
          <LensNextSteps input={{ credit: data }} lens="sharia" locale={locale} m={m} base={base} />
        </>
      )}
    </LensPage>
  );
}
