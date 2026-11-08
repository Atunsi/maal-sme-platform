import { CreditCard } from "@/components/CreditCard";
import { LensPage } from "@/components/LensPage";
import { ReceiptPanel } from "@/components/ReceiptPanel";
import { getCredit } from "@/lib/api";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ view?: string | string[] }>;
};

export default async function CreditPage({ params, searchParams }: Props) {
  const initialView = (await searchParams).view === "compliance" ? "compliance" : "public";
  return (
    <LensPage params={params} load={getCredit} title={(m) => m.credit.title}>
      {(data, { locale, m }) => (
        <>
          <CreditCard data={data} initialView={initialView} locale={locale} m={m} />
          {/* Outside the card: the card itself holds no input (U1), and the receipt carries the hash check. */}
          <ReceiptPanel receipt={data.receipt} lens={m.credit.title} m={m} />
        </>
      )}
    </LensPage>
  );
}
