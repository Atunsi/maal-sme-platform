// U4: nothing here is composed by the UI. Every value is a field of credit_explanation.compliance_tier,
// credit_decision_detail or the receipt; the only UI text is column and field labels.
import { BackendText, Code, Field, Fields, Num, SubHeading, TableScroll, TD, TH } from "@/components/ui";
import { byAbsoluteContribution, traceLine } from "@/lib/compliance";
import { formatRaw } from "@/lib/format";
import type { Locale, Messages } from "@/lib/i18n";
import type { CreditDetail, CreditExplanation, Receipt } from "@/lib/types";
import { delay } from "@/lib/motion";

/** `words`: the backend's Arabic for each value (DECISIONS 57), shown as text with the key beside it in a Code span. */
function KeyValueTable({ rows, words, keyLabel, valueLabel }: { rows: Record<string, string>; words?: Record<string, string>; keyLabel: string; valueLabel: string }) {
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
            <td className={TD}>{words?.[key] ? <span className="font-sans text-sm">{words[key]}</span> : <Code>{value}</Code>}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

type Props = { explanation: CreditExplanation; detail: CreditDetail; receipt: Receipt; locale: Locale; m: Messages };

/** T4: in Arabic a field's words come first and its raw name follows in a Code span, so the code stays findable. */
function FieldName({ words, code, locale }: { words: string; code: string; locale: Locale }) {
  if (locale !== "ar") return <>{words}</>;
  return (
    <>
      {words} <Code>{code}</Code>
    </>
  );
}

export function ComplianceView({ explanation, detail, receipt, locale, m }: Props) {
  const tier = explanation.compliance_tier;
  const c = m.compliance;
  const contributions = byAbsoluteContribution(tier.contributions);
  const largest = Math.abs(contributions[0]?.contribution_logodds ?? 0) || 1; // the scale comes from the response
  // DECISIONS 57: the backend's Arabic phrases and feature labels; absent on an older object, then the codes alone.
  const phrasesAr = locale === "ar" ? tier.phrases_ar : undefined;
  const labelsAr = locale === "ar" ? tier.feature_labels_ar : undefined;
  return (
    <div data-testid="compliance-view" data-tour="compliance" className="panel slidein flex flex-col gap-1 p-5 font-mono text-[13px] sm:p-9">
      <Fields>
        <Field label={c.units}>
          <BackendText en={tier.units} ar={tier.units_ar} locale={locale} m={m} />
        </Field>
        <Field label={<FieldName words={c.pd} code="pd" locale={locale} />}>
          <Num>{formatRaw(detail.pd, locale)}</Num>
        </Field>
        <Field label={<FieldName words={c.logit} code="logit" locale={locale} />}>
          <Num>{formatRaw(detail.logit, locale)}</Num>
        </Field>
        <Field label={<FieldName words={c.riskTier} code="risk_tier" locale={locale} />}>{detail.risk_tier === null ? m.common.dash : <Code>{detail.risk_tier}</Code>}</Field>
        <Field label={<FieldName words={c.modelVersion} code="model_version" locale={locale} />}>
          <Code>{detail.model_version}</Code>
        </Field>
        <Field label={<FieldName words={c.modelSha} code="model_sha256" locale={locale} />}>
          <Code>{detail.model_sha256}</Code>
        </Field>
        <Field label={<FieldName words={c.cvAuc} code="credit_model_cv_auc" locale={locale} />}>
          <Num>{formatRaw(receipt.credit_model_cv_auc, locale)}</Num>
        </Field>
        <Field label={<FieldName words={c.ceilingAuc} code="credit_model_oracle_ceiling_auc" locale={locale} />}>
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
                  <td className={TD}>
                    {!trace ? m.common.dash : phrasesAr?.[trace.phraseKey] ? <span className="font-sans text-sm">{phrasesAr[trace.phraseKey]}</span> : <Code>{trace.phrase}</Code>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </TableScroll>

      <SubHeading>{c.thresholdTable}</SubHeading>
      <KeyValueTable rows={tier.threshold_table} keyLabel={c.key} valueLabel={c.rule} />

      <SubHeading>{c.phrases}</SubHeading>
      <KeyValueTable rows={tier.phrases} words={phrasesAr} keyLabel={c.key} valueLabel={c.phrase} />

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
                  {labelsAr?.[row.feature] && <span className="block font-sans text-sm">{labelsAr[row.feature]}</span>}
                  <Code>{row.feature}</Code>
                </td>
                <td className={TD}>
                  <Num>{formatRaw(row.contribution_logodds, locale)}</Num>
                  <span
                    aria-hidden="true"
                    className={`bar-grow bar-from-start mt-1 !h-2 ${row.contribution_logodds > 0 ? "bg-bad" : "bg-ok"}`}
                    style={{ width: `${((Math.abs(row.contribution_logodds) / largest) * 100).toFixed(1)}%`, animationDelay: delay(2 + i) }}
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
