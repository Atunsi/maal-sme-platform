import type { ReactNode } from "react";
import { OwnerOnly } from "@/components/OwnerOnly";
import { RoleLink } from "@/components/RoleLink";
import { BackendText, Num, Sar } from "@/components/ui";
import { formatDate, formatInt, formatProbability } from "@/lib/format";
import { nextSteps, type GuidanceInput, type Lens, type Quoted, type Step } from "@/lib/guidance";
import { fillNodes, type Locale, type Messages } from "@/lib/i18n";
import { nisabPlate } from "@/lib/nisab";
import type { ApiResult } from "@/lib/types";

/** A quoted value as the rest of the app shows it: the same helpers, so a figure here equals its lens page. */
function Value({ quoted, locale, m }: { quoted: Quoted; locale: Locale; m: Messages }): ReactNode {
  switch (quoted.kind) {
    case "sar":
      return <Sar value={quoted.value} locale={locale} />;
    case "date":
      return <span data-step-date={quoted.value}>{formatDate(quoted.value, locale)}</span>;
    case "count":
    case "days":
      return <Num>{formatInt(quoted.value, locale)}</Num>;
    case "pct":
      return <Num>{formatProbability(quoted.value, locale).pct}</Num>;
    case "backend":
      return <BackendText en={quoted.en} ar={quoted.ar} locale={locale} m={m} />;
    case "code":
      if (quoted.group === "crunch_level") return (m.enums.level as Record<string, string>)[quoted.value] ?? quoted.value;
      return nisabPlate(quoted.value, m)?.words ?? quoted.value;
  }
}

function Line({ step, locale, m, base }: { step: Step; locale: Locale; m: Messages; base: string }) {
  const g = m.guidance;
  const rule = g.rules[step.rule] as { text: string; textPast?: string; link?: string; why: string; field: string };
  const template = step.sentence === "textPast" && rule.textPast ? rule.textPast : rule.text;
  const values = Object.fromEntries(Object.entries(step.values).map(([name, quoted]) => [name, <Value key={name} quoted={quoted} locale={locale} m={m} />]));
  return (
    <li data-step={step.rule} className="flex flex-col gap-1.5 border-t border-line pt-3 first:border-t-0 first:pt-0">
      <p className="text-body">{fillNodes(template, values)}</p>
      {step.href && rule.link && (
        <RoleLink href={`${base}${step.href}`} className="textlink self-start text-label font-semibold" data-step-link>
          {rule.link}
        </RoleLink>
      )}
      {/* GD1: the rule in plain words and the value that triggered it. */}
      <details className="text-label text-muted" data-step-why>
        <summary className="cursor-pointer">{g.why}</summary>
        <p className="mt-1">{rule.why}</p>
        <p className="mt-1" data-step-trigger={step.trigger.field}>
          {g.trigger}: {rule.field}, <Value quoted={step.trigger.value} locale={locale} m={m} />
        </p>
      </details>
    </li>
  );
}

type Props = { steps: Step[]; locale: Locale; m: Messages; /** `/<locale>/business/<id>` */ base: string };

/**
 * IN1 (DECISIONS 62): "what to do next", at most three lines, highest priority first. Each line is one rule of
 * lib/guidance.ts and a fixed catalogue sentence. Owner only (OwnerOnly); hidden in print, so the decision
 * sheet's page count is unchanged. Nothing here animates a value (MO1).
 */
export function NextSteps({ steps, locale, m, base }: Props) {
  if (steps.length === 0) return null;
  const g = m.guidance;
  return (
    <OwnerOnly>
      <section aria-labelledby="next-steps" data-next-steps data-print-hide className="min-w-0 border border-line bg-card p-6">
        <h2 id="next-steps" className="heading mb-1 text-heading">
          {g.title}
        </h2>
        <p className="mb-4 text-label text-muted">{g.note}</p>
        <ol className="flex list-none flex-col gap-3 p-0">
          {steps.map((step) => (
            <Line key={step.rule} step={step} locale={locale} m={m} base={base} />
          ))}
        </ol>
      </section>
    </OwnerOnly>
  );
}

const dataOf = <T,>(result: ApiResult<T>): T | null => (result.ok ? result.data : null);

/** The overview's block: it waits for the four lenses the page already asked for, then applies the rules. */
export async function OverviewNextSteps({
  results,
  locale,
  m,
  base,
}: {
  results: { credit: Promise<ApiResult<GuidanceInput["credit"]>>; forecast: Promise<ApiResult<GuidanceInput["forecast"]>>; zakat: Promise<ApiResult<GuidanceInput["zakat"]>>; anomaly: Promise<ApiResult<GuidanceInput["anomaly"]>> };
  locale: Locale;
  m: Messages;
  base: string;
}) {
  const [credit, forecast, zakat, anomaly] = await Promise.all([results.credit, results.forecast, results.zakat, results.anomaly]);
  // A lens that failed or was not run has nothing to say; the block never guesses for it.
  if (!credit.ok && !forecast.ok && !zakat.ok && !anomaly.ok) return null;
  const input: GuidanceInput = { credit: dataOf(credit), forecast: dataOf(forecast), zakat: dataOf(zakat), anomaly: dataOf(anomaly), nisabVerified: m.zakat.nisabVerified };
  return <NextSteps steps={nextSteps(input)} locale={locale} m={m} base={base} />;
}

/** A lens page's block: that lens's own lines. */
export function LensNextSteps({ input, lens, locale, m, base }: { input: GuidanceInput; lens: Lens; locale: Locale; m: Messages; base: string }) {
  return <NextSteps steps={nextSteps({ ...input, nisabVerified: m.zakat.nisabVerified }, lens)} locale={locale} m={m} base={base} />;
}
