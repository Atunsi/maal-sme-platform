import { searchOf } from "@/lib/static-data";
import { CreditCard } from "@/components/CreditCard";
import { LensPage } from "@/components/LensPage";
import { LensNextSteps } from "@/components/NextSteps";
import { getCredit } from "@/lib/api";
import { titleFor } from "@/lib/page-title";
import { DecisionRecord } from "@/components/DecisionRecord";
import { recordInput } from "@/lib/record";


type Props = {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ view?: string | string[]; as?: string | string[] }>;
};

export const generateMetadata = titleFor((m) => m.nav.credit);

export default async function CreditPage({ params, searchParams }: Props) {
  const initialView = (await searchOf(searchParams)).view === "compliance" ? "compliance" : "public";
  return (
    <LensPage params={params} searchParams={searchParams} load={getCredit} title={(m) => m.credit.title}>
      {(data, { locale, m, base }) => (
        <>
          <CreditCard data={data} initialView={initialView} locale={locale} m={m} />
          {/* Outside the card: the card itself holds no input (U1), and the technical record carries the hash check.
              DECISIONS 58: the plain card by role; the Compliance View shows the technical record, open. */}
          <DecisionRecord input={recordInput("credit", data)} receipt={data.receipt} lens={m.credit.title} locale={locale} m={m} followsView />
          <LensNextSteps input={{ credit: data }} lens="credit" locale={locale} m={m} base={base} />
        </>
      )}
    </LensPage>
  );
}
