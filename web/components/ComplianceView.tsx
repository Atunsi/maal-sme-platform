// U4: nothing here is composed by the UI. Every value is a field of credit_explanation.compliance_tier,
// credit_decision_detail or the receipt; the only UI text is column and field labels.
import { BackendText, Code, Field, Fields, Num, SubHeading, TableScroll, TD, TH } from "@/components/ui";
import { byAbsoluteContribution, traceLine } from "@/lib/compliance";
import { formatRaw } from "@/lib/format";
import type { Locale, Messages } from "@/lib/i18n";
import type { CreditDetail, CreditExplanation, Receipt } from "@/lib/types";

function KeyValueTable({ rows, keyLabel, valueLabel }: { rows: Record<string, string>; keyLabel: string; valueLabel: string }) {
  return (
    <table className="w-full">
      <thead>
        <tr>
          <th scope="col" className={TH}>
            {keyLabel}
          </th>
          <th scope="col" className={TH}>
            {valueLabel}
          </th>
        </tr>
      </thead>
      <tbody>
        {Object.entries(rows).map(([key, value]) => (
          <tr key={key}>
            <td className={TD}>
              <Code>{key}</Code>
            </td>
            <td className={TD}>
              <Code>{value}</Code>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

type Props = { explanation: CreditExplanation; detail: CreditDetail; receipt: Receipt; locale: Locale; m: Messages };

export function ComplianceView({ explanation, detail, receipt, locale, m }: Props) {
  const tier = explanation.compliance_tier;
  const c = m.compliance;
  const contributions = byAbsoluteContribution(tier.contributions);
  const largest = Math.abs(contributions[0]?.contribution_logodds ?? 0) || 1; // the scale comes from the response
  return (
    <div data-testid="compliance-view" data-tour="compliance" className="panel slidein flex flex-col gap-1 p-5 font-mono text-[13px] sm:p-9">
      <Fields>
        <Field label={c.units}>
          <BackendText locale={locale} m={m}>
            {tier.units}
          </BackendText>
        </Field>
        <Field label={c.pd}>
          <Num>{formatRaw(detail.pd, locale)}</Num>
        </Field>
        <Field label={c.logit}>
          <Num>{formatRaw(detail.logit, locale)}</Num>
        </Field>
        <Field label={c.riskTier}>{detail.risk_tier === null ? m.common.dash : <Code>{detail.risk_tier}</Code>}</Field>
        <Field label={c.modelVersion}>
          <Code>{detail.model_version}</Code>
        </Field>
        <Field label={c.modelSha}>
          <Code>{detail.model_sha256}</Code>
        </Field>
        <Field label={c.cvAuc}>
          <Num>{formatRaw(receipt.credit_model_cv_auc, locale)}</Num>
        </Field>
        <Field label={c.ceilingAuc}>
          <Num>{formatRaw(receipt.credit_model_oracle_ceiling_auc, locale)}</Num>
        </Field>
      </Fields>

      <SubHeading>{c.trace}</SubHeading>
      <TableScroll label={c.trace}>
        <table className="w-full">
          <thead>
            <tr>
              {[c.featureId, c.magnitude, c.direction, c.thresholdRow, c.phraseKey, c.phrase].map((label) => (
                <th key={label} scope="col" className={TH}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {explanation.public_tier.map((line, i) => {
              const trace = traceLine(line, tier);
              return (
                <tr key={line.feature_id ?? `line-${i}`}>
                  <td className={TD}>{line.feature_id === null ? m.common.dash : <Num>{line.feature_id}</Num>}</td>
                  <td className={TD}>{line.magnitude ? <Code>{line.magnitude}</Code> : m.common.dash}</td>
                  <td className={TD}>{line.direction ? <Code>{line.direction}</Code> : m.common.dash}</td>
                  <td className={TD}>{trace ? <Code>{trace.thresholdRule}</Code> : m.common.dash}</td>
                  <td className={TD}>{trace ? <Code>{trace.phraseKey}</Code> : m.common.dash}</td>
                  <td className={TD}>{trace ? <Code>{trace.phrase}</Code> : m.common.dash}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </TableScroll>

      <SubHeading>{c.thresholdTable}</SubHeading>
      <KeyValueTable rows={tier.threshold_table} keyLabel={c.key} valueLabel={c.rule} />

      <SubHeading>{c.phrases}</SubHeading>
      <KeyValueTable rows={tier.phrases} keyLabel={c.key} valueLabel={c.phrase} />

      <SubHeading>{c.contributions}</SubHeading>
      <TableScroll label={c.contributions} tall>
        <table className="w-full">
          <thead>
            <tr>
              {[c.featureId, c.feature, c.contribution, c.imputed].map((label) => (
                <th key={label} scope="col" className={`${TH} sticky top-0 bg-panel`}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {contributions.map((row, i) => (
              <tr key={row.feature_id}>
                <td className={TD}>
                  <Num>{row.feature_id}</Num>
                </td>
                <td className={TD}>
                  <Code>{row.feature}</Code>
                </td>
                <td className={TD}>
                  <Num>{formatRaw(row.contribution_logodds, locale)}</Num>
                  <span
                    aria-hidden="true"
                    className={`bar-grow bar-from-start mt-1 !h-2 ${row.contribution_logodds > 0 ? "bg-bad" : "bg-ok"}`}
                    style={{ width: `${((Math.abs(row.contribution_logodds) / largest) * 100).toFixed(1)}%`, animationDelay: `${Math.min(0.2 + i * 0.1, 1.2).toFixed(2)}s` }}
                  />
                </td>
                <td className={TD}>{row.imputed ? m.common.yes : m.common.no}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableScroll>
    </div>
  );
}
