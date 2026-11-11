// The scenario library page (E6), shared by /scenarios (live: the query picks the scenario) and
// /scenarios/s/<name> (the online snapshot's one file per scenario).
import Link from "next/link";
import { SectionMark } from "@/components/brand/Logos";
import { ScenarioCompare } from "@/components/ScenarioCompare";
import { ChangedRows, DiffHeading, ScenarioMenu, ScenarioSelect } from "@/components/ScenarioControls";
import { ScenarioPlayer } from "@/components/ScenarioPlayer";
import { ApiError, BackendText, Num, Page } from "@/components/ui";
import { roleQuery } from "@/lib/businesses";
import { label } from "@/lib/labels";
import { formatInt } from "@/lib/format";
import { fill, getMessages, type Locale, pluralForm } from "@/lib/i18n";
import { scenarioHref, scenarioHrefBase } from "@/lib/scenario-href";
import { scenarioNames, scenarioText } from "@/lib/scenario-label";
import { getScenario, getScenarioIndex } from "@/lib/scenarios";
import { delay } from "@/lib/motion";
import { nameOf } from "@/lib/business-names";


const BASELINE = "baseline";

type ViewProps = { locale: Locale; asked?: string; as?: string | string[]; changed?: string | string[] };

export async function ScenariosView({ locale, asked, as, changed }: ViewProps) {
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
  const role = roleQuery(as).slice(1);
  const selected = menu.find((entry) => entry.name === asked) ?? menu.find((entry) => entry.name !== BASELINE) ?? menu[0]!;
  const [baseline, chosen] = await Promise.all([getScenario(BASELINE), getScenario(selected.name)]);

  return (
    <Page>
      <div className="rise">
        <div className="flex items-center gap-2.5 font-mono text-label text-muted">
          <SectionMark />
          <span className="eyebrow">{fill(pluralForm(menu.length, sc.eyebrow, locale), { id: index.data.base_business, name: nameOf(index.data.base_business, locale), n: formatInt(menu.length, locale) })}</span>
        </div>
        <h1 className="heading mt-2 text-[40px] sm:text-[52px]">{sc.title}</h1>
        <p className="mt-2 max-w-3xl text-label text-muted">{sc.intro}</p>
        <Link href={`/${locale}/scenarios/custom${roleQuery(as)}`} className="textlink font-semibold">
          {m.custom.link}
        </Link>
      </div>
      <ScenarioPlayer
        names={menu.map((entry) => entry.name)}
        labels={menu.map((entry) => scenarioText(entry, locale).name)}
        current={selected.name}
        hrefBase={scenarioHrefBase(locale, role)}
        text={{ play: sc.play, pause: sc.pause, position: sc.position, group: sc.playerGroup }}
      />

      <div className="flex flex-wrap items-start gap-7">
        <ScenarioSelect
          label={sc.menu}
          entries={menu.map((entry) => ({
            name: entry.name,
            label: scenarioText(entry, locale).name,
            lang: scenarioText(entry, locale).lang,
            href: scenarioHref(locale, entry.name, role),
            current: entry.name === selected.name,
          }))}
        />
        <ScenarioMenu
          label={sc.menu}
          locale={locale}
          footer={locale === "ar" && menu.some((entry) => !entry.label_ar) ? <p className="border-t border-line p-3 text-label text-muted">{m.common.englishTemplate}</p> : undefined}
          entries={menu.map((entry, i) => {
            const current = entry.name === selected.name;
            const { name, detail, lang } = scenarioText(entry, locale);
            return {
              name: entry.name,
              href: scenarioHref(locale, entry.name, role),
              current,
              className: `menu-link square rise flex min-h-11 flex-col gap-0.5 px-4 py-3.5 no-underline ${i ? "border-t border-line" : ""} ${current ? "bg-solid text-white" : "bg-card text-ink"}`,
              style: { animationDelay: delay(1 + Math.floor(i / 2)) },
              children: (
                <>
                  <span aria-hidden="true" className="font-mono text-label opacity-75">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span lang={lang} dir={lang ? "ltr" : undefined} data-latin className="text-start font-semibold">
                    {name}
                  </span>
                  {detail && (
                    <span lang={lang} dir={lang ? "ltr" : undefined} data-latin className="text-start text-label opacity-85">
                      {detail}
                    </span>
                  )}
                </>
              ),
            };
          })}
        />

        <section aria-label={sc.resultTitle} className="flex min-w-0 flex-[999_1_640px] flex-col gap-6">
          <DiffHeading id="diff-heading">{sc.resultTitle}</DiffHeading>
          <BackendText en={selected.story} ar={selected.story_ar} locale={locale} m={m} />
          {baseline.ok && chosen.ok ? (
            <ChangedRows initial={changed === "1"} label={sc.changedOnly}>
              <ScenarioCompare baseline={baseline.data} chosen={chosen.data} names={scenarioNames(menu, locale)} locale={locale} m={m} />
            </ChangedRows>
          ) : (
            <ApiError kind="contract" detail={(!baseline.ok && baseline.detail) || (!chosen.ok && chosen.detail) || undefined} m={m} />
          )}

          <div className="panel rise flex flex-col gap-4 p-7" style={{ animationDelay: delay(4) }}>
            <h2 className="heading text-heading">{sc.findingsTitle}</h2>
            <ol className="grid grid-cols-1 gap-px sm:grid-cols-2" style={{ background: "var(--panelRule)" }}>
              {sc.findings.map((finding, i) => (
                <li key={finding} className="bg-panel p-4">
                  <span className="block font-mono text-accent">{String(i + 1).padStart(2, "0")}</span>
                  {finding}
                </li>
              ))}
            </ol>
            <p className="text-label text-muted">{sc.caveat}</p>
            <p className="text-label text-muted">
              {sc.library}: <Num>{index.data.library_version}</Num> ({label("library_status", index.data.library_status, m)})
            </p>
          </div>
        </section>
      </div>
    </Page>
  );
}
