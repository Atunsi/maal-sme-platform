import Link from "next/link";
import { notFound } from "next/navigation";
import { ScenarioCompare } from "@/components/ScenarioCompare";
import { ApiError, BackendText, Card, Num } from "@/components/ui";
import { fill, getMessages, isLocale } from "@/lib/i18n";
import { getScenario, getScenarioIndex } from "@/lib/scenarios";

export const dynamic = "force-dynamic";

const BASELINE = "baseline";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ s?: string | string[] }>;
};

export default async function ScenariosPage({ params, searchParams }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const m = getMessages(locale);
  const s = m.scenarios;
  const index = await getScenarioIndex();
  if (!index.ok) return <ApiError kind={index.kind} detail={index.detail} m={m} />;

  const menu = index.data.scenarios;
  const asked = (await searchParams).s;
  const selected = menu.find((entry) => entry.name === asked) ?? menu.find((entry) => entry.name !== BASELINE) ?? menu[0]!;
  const [baseline, chosen] = await Promise.all([getScenario(BASELINE), getScenario(selected.name)]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">{fill(s.title, { id: index.data.base_business })}</h1>
        <p className="mt-1 max-w-3xl">{s.intro}</p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <nav aria-label={s.menu} className="min-w-0 rounded-lg border border-line bg-card p-4">
          <h2 className="mb-2 font-semibold">{s.menu}</h2>
          {locale === "ar" && <p className="mb-2 text-xs text-muted">{m.common.englishTemplate}</p>}
          <ul className="space-y-1">
            {menu.map((entry) => (
              <li key={entry.name}>
                <Link
                  href={`/${locale}/scenarios?s=${entry.name}`}
                  aria-current={entry.name === selected.name ? "page" : undefined}
                  lang="en"
                  dir="ltr"
                  className={`block rounded p-2 text-start text-sm ${
                    entry.name === selected.name ? "bg-brand text-white" : "hover:bg-neutral-soft"
                  }`}
                >
                  {entry.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="min-w-0 space-y-5">
          <Card title={s.resultTitle}>
            <p className="mb-1 font-medium">
              <BackendText locale={locale} m={m}>
                {selected.label}
              </BackendText>
            </p>
            <div className="mb-3">
              <BackendText locale={locale} m={m}>
                {selected.story}
              </BackendText>
            </div>
            {baseline.ok && chosen.ok ? (
              <ScenarioCompare baseline={baseline.data} chosen={chosen.data} locale={locale} m={m} />
            ) : (
              <ApiError kind="contract" detail={(!baseline.ok && baseline.detail) || (!chosen.ok && chosen.detail) || undefined} m={m} />
            )}
          </Card>

          <Card title={s.findingsTitle}>
            <ul className="list-disc space-y-1 ps-5">
              {s.findings.map((finding) => (
                <li key={finding}>{finding}</li>
              ))}
            </ul>
            <p className="mt-3 text-sm text-muted">{s.caveat}</p>
            <p className="mt-2 text-sm text-muted">
              {s.library}: <Num>{index.data.library_version}</Num> ({index.data.library_status})
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
