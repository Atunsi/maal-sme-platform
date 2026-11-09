import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { SectionMark } from "@/components/brand/Logos";
import { CustomResult } from "@/components/CustomResult";
import { CustomScenarioForm } from "@/components/CustomScenarioForm";
import { ApiError, Page } from "@/components/ui";
import { getScenarioCatalog } from "@/lib/api";
import { roleQuery } from "@/lib/businesses";
import { decodeShocks, encodeShock, type Shock } from "@/lib/custom-scenario";
import { scenarioName } from "@/lib/scenario-label";
import { getScenario, getScenarioIndex } from "@/lib/scenarios";
import { libraryShocks } from "@/lib/start-from";
import { runCustomScenarioForm } from "./actions";
import { fill, getMessages, isLocale } from "@/lib/i18n";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ shock?: string | string[]; error?: string | string[]; as?: string | string[] }>;
};

export default async function CustomScenarioPage({ params, searchParams }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const m = getMessages(locale);
  const c = m.custom;
  const search = await searchParams;
  const query = roleQuery(search.as);
  const catalog = await getScenarioCatalog();
  if (!catalog.ok) {
    return (
      <Page>
        <ApiError kind={catalog.kind} detail={catalog.detail} m={m} />
      </Page>
    );
  }
  const shocks = decodeShocks(catalog.data, search.shock);
  // I5: library scenarios whose own shocks the builder can express, read from the exported objects.
  const index = await getScenarioIndex();
  const starts = [];
  for (const entry of index.ok ? index.data.scenarios : []) {
    const object = await getScenario(entry.name);
    const list = object.ok ? libraryShocks(object.data.scenario.overrides, catalog.data) : null;
    if (list) starts.push({ name: entry.name, label: scenarioName(entry.label).name, shocks: list });
  }
  const error = Array.isArray(search.error) ? search.error[0] : search.error;
  const here = (list: Shock[]) => {
    const p = new URLSearchParams();
    for (const s of list) p.append("shock", encodeShock(catalog.data, s));
    if (query) p.set("as", query.replace("?as=", ""));
    return `/${locale}/scenarios/custom?${p}`;
  };

  return (
    <Page>
      <div className="rise">
        <div className="flex items-center gap-2.5 text-muted">
          <SectionMark />
          <span className="eyebrow">{fill(c.eyebrow, { id: catalog.data.base_business })}</span>
        </div>
        <h1 className="heading mt-2 text-[40px] sm:text-[52px]">{c.title}</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted">{c.intro}</p>
        <Link href={`/${locale}/scenarios${query}`} className="textlink font-semibold">
          {c.back}
        </Link>
      </div>
      {error === "none" && <p role="alert" className="font-medium text-bad">{c.noneChosen}</p>}
      {error === "many" && <p role="alert" className="font-medium text-bad">{fill(c.tooMany, { n: String(catalog.data.max_shocks) })}</p>}
      <CustomScenarioForm catalog={catalog.data} chosen={shocks} action={runCustomScenarioForm} hidden={{ locale, as: query.replace("?as=", "") }} starts={starts} m={m} />
      {shocks.length > 0 && (
        <Suspense fallback={<p role="status" className="text-muted">{c.running}</p>}>
          <CustomResult shocks={shocks} locale={locale} m={m} retry={here(shocks)} />
        </Suspense>
      )}
    </Page>
  );
}
