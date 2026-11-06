import { BackendText, Badge, Card, Code, Field, Fields, ProvenanceLine, SubHeading, TableScroll, TD, TH } from "@/components/ui";
import type { Locale, Messages } from "@/lib/i18n";
import type { CreditResponse } from "@/lib/types";

const STATUS_TONE = { compliant: "good", soft_flag_review: "warn", hard_flag: "bad" } as const;

/** U6: this is the fixed label for every Sharia display. It is not a Sharia determination. */
export function ShariaLabel({ m }: { m: Messages }) {
  return <Badge tone="warn">{m.sharia.label}</Badge>;
}

export function ShariaPanel({ data, locale, m }: { data: CreditResponse; locale: Locale; m: Messages }) {
  const s = data.sharia_screen;
  const questions = [...s.owner_prompts, ...s.disclosures.map((d) => d.prompt)];
  return (
    <Card id="sharia" title={m.sharia.title}>
      <ProvenanceLine value={data} locale={locale} m={m} />
      <p className="mb-3">
        <ShariaLabel m={m} />
      </p>
      <Fields>
        <Field label={m.common.status}>
          <Badge tone={STATUS_TONE[s.sharia_screen_status]}>{m.enums.sharia[s.sharia_screen_status]}</Badge>
        </Field>
        <Field label={m.sharia.ruleTableStatus}>
          <Code>{s.rule_table_status}</Code>
        </Field>
        <Field label={m.sharia.evidence}>{m.enums.evidence[s.evidence_basis]}</Field>
        <Field label={m.sharia.declaredMcc}>{s.declared_mcc === null ? m.common.dash : <Code>{s.declared_mcc}</Code>}</Field>
        <Field label={m.sharia.ruleTableVersion}>
          <Code>{s.rule_table_version}</Code>
        </Field>
      </Fields>

      {s.rules_triggered.length > 0 && (
        <>
          <SubHeading>{m.sharia.rules}</SubHeading>
          <TableScroll label={m.sharia.rules}>
            <table className="w-full">
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
                    <td className={TD}>
                      <Code>{rule.rule_id}</Code>
                    </td>
                    <td className={TD}>
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
        </>
      )}

      {questions.length > 0 && (
        <>
          <SubHeading>{m.sharia.questions}</SubHeading>
          <p className="mb-2 text-sm text-muted">{m.sharia.questionsNote}</p>
          <ul className="space-y-2">
            {questions.map((question) => (
              <li key={question} className="rounded border border-line p-2">
                <BackendText locale={locale} m={m}>
                  {question}
                </BackendText>
              </li>
            ))}
          </ul>
        </>
      )}

      {s.compliance_explanation && (
        <>
          <SubHeading>{m.sharia.explanation}</SubHeading>
          <BackendText locale={locale} m={m}>
            {s.compliance_explanation}
          </BackendText>
        </>
      )}
    </Card>
  );
}
