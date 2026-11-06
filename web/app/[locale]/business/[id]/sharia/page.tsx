import { LensPage } from "@/components/LensPage";
import { ShariaPanel } from "@/components/ShariaPanel";
import { getCredit } from "@/lib/api";

export const dynamic = "force-dynamic";

// The Sharia screen arrives in the credit response; the API has no route of its own for it.
export default function ShariaPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  return (
    <LensPage params={params} load={getCredit} title={(m) => m.sharia.title}>
      {(data, { locale, m }) => <ShariaPanel data={data} locale={locale} m={m} />}
    </LensPage>
  );
}
