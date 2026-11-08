import Link from "next/link";
import { notFound } from "next/navigation";
import { SectionMark } from "@/components/brand/Logos";
import { ScenarioCompare } from "@/components/ScenarioCompare";
import { ScenarioPlayer } from "@/components/ScenarioPlayer";
import { ApiError, BackendText, Num, Page } from "@/components/ui";
import { roleQuery } from "@/lib/businesses";
import { formatInt } from "@/lib/format";
import { fill, getMessages, isLocale } from "@/lib/i18n";
import { scenarioName } from "@/lib/scenario-label";
import { getScenario, getScenarioIndex } from "@/lib/scenarios";

export const dynamic = "force-dynamic";

const BASELINE = "baseline";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ s?: string | string[]; scenario?: string | string[]; as?: string | string[] }>;
};

export default async function ScenariosPage({ params, searchParams }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const m = getMessages(locale);
  const sc = m.scenarios;
  const index = await getScenarioIndex();
  if (!index.ok) {
    return (
      <Page>
        <ApiError kind={index.kind} detail={index.detail} m={m} />
      </Page>
    );
  }

  const menu = index.data.scenarios;
  const { s, scenario, as } = await searchParams;
  const asked = scenario ?? s; // ?scenario= is what Play all writes (E6); ?s= is the menu's
  const role = roleQuery(as).replace("?", "&");
  const roleFirst = roleQuery(as) ? `${roleQuery(as).slice(1)}&` : "";
  const selected = menu.find((entry) => entry.name === asked) ?? menu.find((entry) => entry.name !== BASELINE) ?? menu[0]!;
  const [baseline, chosen] = await Promise.all([getScenario(BASELINE), getScenario(selected.name)]);

  return (
    <Page>
      <div className="rise">
        <div className="flex items-center gap-2.5 font-mono text-[13px] text-muted">
          <SectionMark />
          <span className="eyebrow">{fill(sc.eyebrow, { id: index.data.base_business, n: formatInt(menu.length, locale) })}</span>
        </div>
        <h1 className="heading mt-2 text-[40px] sm:text-[52px]">{sc.title}</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted">{sc.intro}</p>
      </div>
      <ScenarioPlayer
        names={menu.map((entry) => entry.name)}
        labels={menu.map((entry) => scenarioName(entry.label).name)}
        current={selected.name}
        hrefBase={`/${locale}/scenarios?${roleFirst}scenario=`}
        text={{ play: sc.play, pause: sc.pause, position: sc.position, group: sc.playerGroup }}
      />

      <div className="flex flex-wrap items-start gap-7">
        <nav aria-label={sc.menu} className="clip-box flex min-w-0 flex-[1_1_280px] flex-col border border-ink bg-card">
          {menu.map((entry, i) => {
            const current = entry.name === selected.name;
            const { name, detail } = scenarioName(entry.label);
            return (
              <Link
                key={entry.name}
                href={`/${locale}/scenarios?s=${entry.name}${role}`}
                aria-current={current ? "page" : undefined}
                className={`menu-link square rise flex min-h-11 flex-col gap-0.5 px-4 py-3.5 no-underline ${i ? "border-t border-line" : ""} ${
                  current ? "bg-solid text-white" : "bg-card text-ink"
                }`}
                style={{ animationDelay: `${(0.1 + i * 0.06).toFixed(2)}s` }}
              >
                <span aria-hidden="true" className="font-mono text-xs opacity-75">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span lang="en" dir="ltr" className="text-start font-semibold">
                  {name}
                </span>
                {detail && (
                  <span lang="en" dir="ltr" className="text-start text-[13px] opacity-85">
                    {detail}
                  </span>
                )}
              </Link>
            );
          })}
          {locale === "ar" && <p className="border-t border-line p-3 text-xs text-muted">{m.common.englishTemplate}</p>}
        </nav>

        <section aria-label={sc.resultTitle} className="flex min-w-0 flex-[999_1_640px] flex-col gap-6">
          <BackendText locale={locale} m={m}>
            {selected.story}
          </BackendText>
          {baseline.ok && chosen.ok ? (
            <ScenarioCompare baseline={baseline.data} chosen={chosen.data} locale={locale} m={m} />
          ) : (
            <ApiError kind="contract" detail={(!baseline.ok && baseline.detail) || (!chosen.ok && chosen.detail) || undefined} m={m} />
          )}

          <div className="panel rise flex flex-col gap-4 p-7" style={{ animationDelay: "2.6s" }}>
            <h2 className="heading text-[22px]">{sc.findingsTitle}</h2>
            <ol className="grid grid-cols-1 gap-px sm:grid-cols-2" style={{ background: "var(--panelRule)" }}>
              {sc.findings.map((finding, i) => (
                <li key={finding} className="bg-panel p-4">
                  <span className="block font-mono text-accent">{String(i + 1).padStart(2, "0")}</span>
                  {finding}
                </li>
              ))}
            </ol>
            <p className="text-[13px] text-muted">{sc.caveat}</p>
            <p className="text-[13px] text-muted">
              {sc.library}: <Num>{index.data.library_version}</Num> ({index.data.library_status})
            </p>
          </div>
        </section>
      </div>
    </Page>
  );
}
