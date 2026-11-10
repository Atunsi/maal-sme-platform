import Link from "next/link";
import { CustomResultHead } from "@/components/CustomResultHead";
import { copyLabels } from "@/components/ReceiptPanel";
import { ScenarioCompare } from "@/components/ScenarioCompare";
import { ApiError, BackendText, Plate } from "@/components/ui";
import { runCustomScenario } from "@/lib/api";
import type { Shock } from "@/lib/custom-scenario";
import type { Locale, Messages } from "@/lib/i18n";
import { scenarioNames } from "@/lib/scenario-label";
import { getScenario, getScenarioIndex } from "@/lib/scenarios";

/** The result: the custom object against the library's baseline, through the queue (POST /scenarios/run). */
export async function CustomResult({ shocks, locale, m, retry }: { shocks: Shock[]; locale: Locale; m: Messages; retry: string }) {
  const [baseline, custom, index] = await Promise.all([getScenario("baseline"), runCustomScenario(shocks), getScenarioIndex()]);
  const c = m.custom;
  if (!custom.ok) {
    return (
      <div className="flex flex-col gap-3" data-custom-error>
        <ApiError kind={custom.kind} m={m} />
        {custom.kind === "invalid" && custom.detail && (
          <BackendText en={custom.detail} locale={locale} m={m} />
        )}
        {custom.kind !== "invalid" && (
          <Link href={retry} className="textlink self-start font-semibold">
            {c.retry}
          </Link>
        )}
      </div>
    );
  }
  if (!baseline.ok) return <ApiError kind="contract" detail={baseline.detail} m={m} />;
  return (
    <section aria-labelledby="custom-result" className="flex flex-col gap-4" data-custom-result>
      <CustomResultHead title={c.resultTitle} path={retry} copy={copyLabels(m)} />
      <div className="flex flex-wrap gap-2">
        <Plate variant="warn">{c.plate}</Plate>
      </div>
      <ScenarioCompare baseline={baseline.data} chosen={custom.data} names={index.ok ? scenarioNames(index.data.scenarios, locale) : undefined} locale={locale} m={m} />
      <p className="text-[13px] text-muted">{m.scenarios.caveat}</p>
    </section>
  );
}
