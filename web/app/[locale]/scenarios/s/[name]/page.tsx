import { notFound } from "next/navigation";
import { ScenariosView } from "@/components/ScenariosView";
import { isLocale } from "@/lib/i18n";
import { getScenarioIndex } from "@/lib/scenarios";

// One library scenario's page, for the online snapshot (one file per scenario). The live app reaches the
// same view through /scenarios?s=<name>; this route serves it there too.
export async function generateStaticParams() {
  const index = await getScenarioIndex();
  return index.ok ? index.data.scenarios.map((entry) => ({ name: entry.name })) : [];
}

export default async function ScenarioPage({ params }: { params: Promise<{ locale: string; name: string }> }) {
  const { locale, name } = await params;
  if (!isLocale(locale)) notFound();
  const index = await getScenarioIndex();
  if (index.ok && !index.data.scenarios.some((entry) => entry.name === name)) notFound();
  return <ScenariosView locale={locale} asked={name} />;
}
