import { notFound } from "next/navigation";
import { ScenariosView } from "@/components/ScenariosView";
import { StaticScenarioRedirect } from "@/components/StaticScenarioRedirect";
import { isLocale } from "@/lib/i18n";
import { searchOf, STATIC } from "@/lib/static-data";
import { titleFor } from "@/lib/page-title";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ s?: string | string[]; scenario?: string | string[]; as?: string | string[]; changed?: string | string[] }>;
};

export const generateMetadata = titleFor((m) => m.nav.scenarios);

export default async function ScenariosPage({ params, searchParams }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { s, scenario, as, changed } = await searchOf(searchParams);
  const asked = scenario ?? s; // ?scenario= is what Play all writes (E6); ?s= is the menu's
  return (
    <>
      {/* The snapshot's /scenarios is one file: a ?s= or ?scenario= link moves on to that scenario's own file. */}
      {STATIC && <StaticScenarioRedirect locale={locale} />}
      <ScenariosView locale={locale} asked={typeof asked === "string" ? asked : undefined} as={as} changed={changed} />
    </>
  );
}
