import type { ReactNode } from "react";
import { LensHead } from "@/components/BusinessHeader";
import { Term } from "@/components/Term";
import { BackendText, Code, Plate, SubHeading, TableScroll, TD, TH } from "@/components/ui";
import type { Locale, Messages } from "@/lib/i18n";
import type { CreditResponse } from "@/lib/types";
import { delay } from "@/lib/motion";

const STATUS_VARIANT = { compliant: "ok", soft_flag_review: "warn", hard_flag: "bad" } as const;

/** U6: this is the fixed label for every Sharia display. It is not a Sharia determination. */
export function ShariaLabel({ m }: { m: Messages }) {
  return <Plate variant="warn">{m.sharia.label}</Plate>;
}

/** U6 on the Sharia page: the same fixed label, in a frame that stands with or without its motion. */
function PendingFrame({ m }: { m: Messages }) {
  return (
    <div className="frame" data-tour="pending">
      <svg aria-hidden="true" className="frame-line">
        <rect className="frame-path" pathLength={1} />
      </svg>
      <p className="heading text-2xl text-warn">{m.sharia.label}</p>
      <p className="mt-1 text-sm text-muted">{m.sharia.frameNote}</p>
    </div>
  );
}

function Checked({ label, value, result, index }: { label: ReactNode; value: ReactNode; result: ReactNode; index: number }) {
  return (
    <div
      className="rise grid grid-cols-1 items-center gap-x-4 gap-y-1 border-t border-line2 px-7 py-4 sm:grid-cols-3"
      style={{ animationDelay: delay(1 + index) }}
    >
      <span className="text-[13px] text-muted">{label}</span>
      <span className="font-mono text-base">{value}</span>
      <span className="text-sm text-muted sm:justify-self-end">{result}</span>
    </div>
  );
}

export function ShariaPanel({ data, locale, m }: { data: CreditResponse; locale: Locale; m: Messages }) {
  const s = data.sharia_screen;
  const questions = [...s.owner_prompts, ...s.disclosures.map((d) => d.prompt)];
  const status = <Plate variant={STATUS_VARIANT[s.sharia_screen_status]}>{m.enums.sharia[s.sharia_screen_status]}</Plate>;
  return (
    <>
      <LensHead data={data} title={m.sharia.title} aside={status} locale={locale} m={m} />
      <PendingFrame m={m} />

      <section aria-labelledby="checked" data-phone="checked" className="border border-line bg-card">
        <h2 id="checked" className="heading border-b-2 border-ink px-7 py-5 text-[22px]">
          {m.sharia.checked}
        </h2>
        <Checked label={m.sharia.evidence} value={m.enums.evidence[s.evidence_basis]} result={m.sharia.used} index={0} />
        <Checked
          label={m.sharia.declaredMcc}
          value={s.declared_mcc === null ? m.common.dash : <Code>{s.declared_mcc}</Code>}
          result={<Plate variant={STATUS_VARIANT[s.sharia_screen_status]}>{m.enums.sharia[s.sharia_screen_status]}</Plate>}
          index={1}
        />
        {/* C6: compliance/sharia.py, screen(), branch (a): with no MCC the screen falls back to the registered
            sector, and a sector the rule table's no_mcc_by_sector marks compliant triggers no rule. */}
        {s.declared_mcc === null && s.evidence_basis === "registered_sector" && s.sharia_screen_status === "compliant" && (
          <p data-no-mcc className="border-t border-line2 px-7 py-4 text-sm">
            {m.sharia.noMccSector}
          </p>
        )}
        <Checked label={m.sharia.ruleTableVersion} value={<Code>{s.rule_table_version}</Code>} result={m.sharia.recorded} index={2} />
        <Checked label={<Term id="rule-table-status" locale={locale}>{m.sharia.ruleTableStatus}</Term>} value={<Code>{s.rule_table_status}</Code>} result={m.sharia.notConfirmed} index={3} />
      </section>

      {s.rules_triggered.length > 0 && (
        <section aria-label={m.sharia.rules} className="border border-line bg-card p-6">
          <SubHeading>{m.sharia.rules}</SubHeading>
          <TableScroll label={m.sharia.rules}>
            <table className="stack-sm w-full">
              <thead>
                <tr>
                  {[m.sharia.ruleId, m.sharia.severity, m.sharia.detail].map((label) => (
                    <th key={label} scope="col" className={TH}>
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {s.rules_triggered.map((rule) => (
                  <tr key={rule.rule_id}>
                    <td className={TD} data-label={m.sharia.ruleId}>
                      <Code>{rule.rule_id}</Code>
                    </td>
                    <td className={TD} data-label={m.sharia.severity}>
                      <Code>{rule.severity}</Code>
                    </td>
                    <td className={TD}>
                      <BackendText locale={locale} m={m}>
                        {rule.detail}
                      </BackendText>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        </section>
      )}

      {questions.length > 0 && (
        <section aria-labelledby="ask" data-phone="ask" className="panel rise flex flex-col gap-3 p-8" style={{ animationDelay: delay(4) }}>
          <h2 id="ask" className="heading caps text-sm text-muted">
            {m.sharia.questions}
          </h2>
          <p className="text-sm text-muted">{m.sharia.questionsNote}</p>
          <ul className="flex flex-col gap-3">
            {questions.map((question) => (
              <li key={question} className="max-w-[860px] text-[22px] leading-snug">
                <BackendText locale={locale} m={m}>
                  {question}
                </BackendText>
              </li>
            ))}
          </ul>
        </section>
      )}

      {s.compliance_explanation && (
        <section aria-label={m.sharia.explanation}>
          <SubHeading>{m.sharia.explanation}</SubHeading>
          <BackendText locale={locale} m={m}>
            {s.compliance_explanation}
          </BackendText>
        </section>
      )}

    </>
  );
}
