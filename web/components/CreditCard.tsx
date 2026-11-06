import { ComplianceView } from "@/components/ComplianceView";
import { CreditViewSwitch } from "@/components/CreditViewSwitch";
import { ReceiptPanel } from "@/components/ReceiptPanel";
import { Plate, BackendText, Card, Code, Field, Fields, Num, ProvenanceLine, Refusal, SubHeading } from "@/components/ui";
import { formatInt, formatRaw, formatSar } from "@/lib/format";
import type { Locale, Messages } from "@/lib/i18n";
import type { CreditExplanation, CreditResponse } from "@/lib/types";

const DIRECTION_TONE = { supports: "ok", against: "warn", either: "ink" } as const;

function PublicTier({ lines, locale, m }: { lines: CreditExplanation["public_tier"]; locale: Locale; m: Messages }) {
  return (
    <ul className="space-y-2">
      {lines.map((line, i) => (
        <li key={line.feature_id ?? `line-${i}`} className="rounded border border-line p-2">
          <BackendText locale={locale} m={m}>
            {line.text}
          </BackendText>
          {line.magnitude && line.direction && (
            <span className="mt-1 flex gap-2">
              <Plate variant="ink">{m.enums.magnitude[line.magnitude]}</Plate>
              <Plate variant={DIRECTION_TONE[line.direction]}>{m.enums.direction[line.direction]}</Plate>
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

type Props = { data: CreditResponse; initialView: "public" | "compliance"; locale: Locale; m: Messages };

export function CreditCard({ data, initialView, locale, m }: Props) {
  const { credit, credit_decision_detail: detail, credit_explanation: explanation } = data;
  return (
    <Card id="credit" title={m.credit.title}>
      <ProvenanceLine value={data} locale={locale} m={m} />
      {!credit || !detail || !explanation ? (
        <Refusal reason={data.lens_not_run_reason} m={m} />
      ) : (
        <>
          <p className="mb-3 text-sm text-muted">{m.credit.note}</p>
          <p className="mb-3">
            <span className="me-2 text-sm text-muted">{m.credit.decision}</span>
            <Plate variant={credit.decision === "approved" ? "ok" : "bad"}>{m.enums.decision[credit.decision]}</Plate>
          </p>
          <Fields>
            {credit.amount_sar !== null && (
              <Field label={m.credit.amount}>
                <Num>{formatSar(credit.amount_sar, locale)}</Num>
              </Field>
            )}
            {credit.base_markup_pct !== null && (
              // U1: display only. Nothing on this page can change the markup.
              <Field label={m.credit.markup}>
                <Num>{formatRaw(credit.base_markup_pct, locale)}%</Num>{" "}
                <Plate variant="ink">{m.credit.markupFixed}</Plate>
              </Field>
            )}
            {credit.adjusted_markup_pct !== null && (
              <Field label={m.credit.adjustedMarkup}>
                <Num>{formatRaw(credit.adjusted_markup_pct, locale)}%</Num>
              </Field>
            )}
            {credit.repayment_months !== null && (
              <Field label={m.credit.months}>
                <Num>{formatInt(credit.repayment_months, locale)}</Num>
              </Field>
            )}
            <Field label={m.credit.latePolicy}>
              <Code>{credit.late_penalty_policy}</Code>
            </Field>
            {detail.offer_status && (
              <Field label={m.credit.offerStatus}>
                <Plate variant={detail.offer_status === "unconditional" ? "ok" : "warn"}>
                  {m.enums.offer_status[detail.offer_status]}
                </Plate>
              </Field>
            )}
            {detail.decline_reason && (
              <Field label={m.credit.declineReason}>{m.enums.decline_reason[detail.decline_reason]}</Field>
            )}
            {detail.decline_origin && (
              <Field label={m.credit.declineOrigin}>{m.enums.decline_origin[detail.decline_origin]}</Field>
            )}
          </Fields>
          {detail.conditions && detail.conditions.length > 0 && (
            <>
              <SubHeading>{m.credit.conditions}</SubHeading>
              <ul className="space-y-1">
                {detail.conditions.map((condition) => (
                  <li key={condition}>
                    <BackendText locale={locale} m={m}>
                      {condition}
                    </BackendText>
                  </li>
                ))}
              </ul>
            </>
          )}
          <SubHeading>{m.credit.explanation}</SubHeading>
          <CreditViewSwitch
            initialView={initialView}
            labels={{ group: m.credit.viewLabel, public: m.credit.viewPublic, compliance: m.credit.viewCompliance }}
            publicSlot={<PublicTier lines={explanation.public_tier} locale={locale} m={m} />}
            complianceSlot={
              <ComplianceView explanation={explanation} detail={detail} receipt={data.receipt} locale={locale} m={m} />
            }
          />
        </>
      )}
      <ReceiptPanel receipt={data.receipt} lens={m.credit.title} m={m} />
    </Card>
  );
}
