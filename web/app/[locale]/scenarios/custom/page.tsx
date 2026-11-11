import { searchOf, STATIC } from "@/lib/static-data";
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
import { scenarioText } from "@/lib/scenario-label";
import { getScenario, getScenarioIndex } from "@/lib/scenarios";
import { libraryShocks } from "@/lib/start-from";
import { runCustomScenarioForm } from "@/app/[locale]/scenarios/custom/actions";
import { fill, getMessages, isLocale, pluralForm } from "@/lib/i18n";
import { nameOf } from "@/lib/business-names";
import { formatInt } from "@/lib/format";
import { titleFor } from "@/lib/page-title";


type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ shock?: string | string[]; error?: string | string[]; as?: string | string[] }>;
};

export const generateMetadata = titleFor((m) => m.custom.title);

export default async function CustomScenarioPage({ params, searchParams }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const m = getMessages(locale);
  const c = m.custom;
  const search = await searchOf(searchParams);
  const query = roleQuery(search.as);
  if (STATIC) {
    // The online snapshot runs no engine: say so, and send the visitor to the library, which works there.
    return (
      <Page>
        <h1 className="heading text-[40px]">{c.title}</h1>
        <p className="max-w-3xl">{c.staticNote}</p>
        <Link href={`/${locale}/scenarios${query}`} className="textlink self-start font-semibold">
          {c.back}
        </Link>
      </Page>
    );
  }
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
    if (list) {
      const text = scenarioText(entry, locale);
      starts.push({ name: entry.name, label: text.name, lang: text.lang, shocks: list });
    }
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
          <span className="eyebrow">{fill(c.eyebrow, { id: catalog.data.base_business, name: nameOf(catalog.data.base_business, locale) })}</span>
        </div>
        <h1 className="heading mt-2 text-[40px] sm:text-[52px]">{c.title}</h1>
        <p className="mt-2 max-w-3xl text-label text-muted">{c.intro}</p>
        <Link href={`/${locale}/scenarios${query}`} className="textlink font-semibold">
          {c.back}
        </Link>
      </div>
      {error === "none" && <p role="alert" className="font-medium text-bad">{c.noneChosen}</p>}
      {error === "many" && <p role="alert" className="font-medium text-bad">{fill(pluralForm(catalog.data.max_shocks, c.tooMany, locale), { n: formatInt(catalog.data.max_shocks, locale) })}</p>}
      <CustomScenarioForm catalog={catalog.data} chosen={shocks} action={runCustomScenarioForm} hidden={{ locale, as: query.replace("?as=", "") }} starts={starts} m={m} />
      {shocks.length > 0 && (
        <Suspense fallback={<p role="status" className="text-muted">{c.running}</p>}>
          <CustomResult shocks={shocks} locale={locale} m={m} retry={here(shocks)} />
        </Suspense>
      )}
    </Page>
  );
}
