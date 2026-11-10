import { LensPage } from "@/components/LensPage";
import { ReceiptPanel } from "@/components/ReceiptPanel";
import { ShariaPanel } from "@/components/ShariaPanel";
import { getCredit } from "@/lib/api";
import { titleFor } from "@/lib/page-title";


// The Sharia screen arrives in the credit response; the API has no route of its own for it.
export const generateMetadata = titleFor((m) => m.nav.sharia);

export default function ShariaPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  return (
    <LensPage params={params} load={getCredit} title={(m) => m.sharia.title}>
      {(data, { locale, m }) => (
        <>
          <ShariaPanel data={data} locale={locale} m={m} />
          {/* Outside the panel: the owner prompt carries no answer form, and the receipt holds the hash check. */}
          <ReceiptPanel receipt={data.receipt} lens={m.sharia.title} m={m} />
        </>
      )}
    </LensPage>
  );
}
