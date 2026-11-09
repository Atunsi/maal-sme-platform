import type { CSSProperties, ReactNode } from "react";
import { LensHead } from "@/components/BusinessHeader";
import { ComplianceView } from "@/components/ComplianceView";
import { CreditViewSwitch } from "@/components/CreditViewSwitch";
import { Term as GlossaryTerm } from "@/components/Term";
import { BackendText, Code, Num, Plate, Refusal, SubHeading } from "@/components/ui";
import { decisionPlate } from "@/lib/decision";
import { formatInt, formatRaw, formatSar } from "@/lib/format";
import { fill, type Locale, type Messages } from "@/lib/i18n";
import type { CreditExplanation, CreditResponse } from "@/lib/types";

type Line = CreditExplanation["public_tier"][number];

// Bar length comes from the magnitude word alone. The word is all the public tier carries (U4).
const BAR_PX = { strongly: 220, moderately: 132, marginally: 56 } as const;
const DIRECTION_VARIANT = { supports: "ok", against: "bad", either: "ink" } as const;
const BAR_COLOUR = { supports: "bg-ok", against: "bg-bad", either: "bg-ink" } as const;

function Bar({ line, from, index }: { line: Line; from: "start" | "end"; index: number }) {
  const style: CSSProperties = { width: `min(${BAR_PX[line.magnitude!]}px, 45%)`, animationDelay: `${(0.35 + index * 0.18).toFixed(2)}s` };
  return <span aria-hidden="true" className={`bar-grow bar-from-${from} ${BAR_COLOUR[line.direction!]}`} style={style} />;
}

function LineText({ line, locale, m }: { line: Line; locale: Locale; m: Messages }) {
  return (
    <span className="block min-w-0 text-base">
      <BackendText locale={locale} m={m}>
        {line.text}
      </BackendText>
      <span className="mt-1 flex flex-wrap gap-2">
        <Plate variant="ink">{m.enums.magnitude[line.magnitude!]}</Plate>
        <Plate variant={DIRECTION_VARIANT[line.direction!]}>{m.enums.direction[line.direction!]}</Plate>
      </span>
    </span>
  );
}

/** One row on the centre axis: against on one side, supports on the other, either across both. */
function AxisRow({ line, index, locale, m }: { line: Line; index: number; locale: Locale; m: Messages }) {
  const words = <LineText line={line} locale={locale} m={m} />;
  const against = line.direction === "against";
  const either = line.direction === "either";
  return (
    <div className="grid min-h-[88px] grid-cols-2 items-stretch border-t border-line2">
      <div className="flex items-center justify-end gap-4 border-e-[3px] border-ink py-3 pe-0 ps-2">
        {against && words}
        {(against || either) && <Bar line={line} from="end" index={index} />}
      </div>
      <div className="flex items-center gap-4 py-3 pe-2">
        {!against && <Bar line={line} from="start" index={index} />}
        {!against && words}
      </div>
    </div>
  );
}

function PublicTier({ lines, locale, m }: { lines: Line[]; locale: Locale; m: Messages }) {
  const onAxis = lines.filter((line) => line.magnitude && line.direction);
  const plain = lines.filter((line) => !line.magnitude || !line.direction);
  return (
    <section aria-label={m.credit.factors} data-tour="factors" className="slidein flex flex-col gap-1.5 border border-line bg-card p-5 sm:p-9">
      {plain.map((line, i) => (
        // A compliance decline has one template line and no factors, so it takes no axis.
        <BackendText key={line.feature_id ?? `line-${i}`} locale={locale} m={m}>
          {line.text}
        </BackendText>
      ))}
      {onAxis.length > 0 && (
        <>
          <div className="heading caps grid grid-cols-2 pb-2.5 text-sm">
            <span className="pe-5 text-end text-bad">{m.credit.against}</span>
            <span className="ps-5 text-ok">{m.credit.supports}</span>
          </div>
          {onAxis.map((line, i) => (
            <AxisRow key={line.feature_id ?? `line-${i}`} line={line} index={i} locale={locale} m={m} />
          ))}
          <p className="mt-4 text-[13px] text-muted">{m.credit.barNote}</p>
        </>
      )}
    </section>
  );
}

function Term({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="min-w-0 p-5">
      <dt className="text-[13px] text-muted">{label}</dt>
      <dd className="font-mono text-xl">{children}</dd>
    </div>
  );
}

type Props = { data: CreditResponse; initialView: "public" | "compliance"; locale: Locale; m: Messages };

export function CreditCard({ data, initialView, locale, m }: Props) {
  const { credit, credit_decision_detail: detail, credit_explanation: explanation } = data;
  if (!credit || !detail || !explanation) {
    return (
      <>
        <LensHead data={data} title={m.credit.title} locale={locale} m={m} />
        <Refusal reason={data.lens_not_run_reason} m={m} />
      </>
    );
  }
  const plate = decisionPlate(credit, detail, m);
  const title = { approved_unconditional: m.credit.titleApproved, approved_conditional: m.credit.titleConditional, declined: m.credit.titleDeclined }[plate.state];
  const aside = (
    <div className="flex items-center gap-3">
      <Plate variant={plate.variant}>{plate.word}</Plate>
      {credit.amount_sar !== null && (
        <span className="font-mono text-xl">
          <Num>{formatSar(credit.amount_sar, locale)}</Num>
        </span>
      )}
    </div>
  );
  return (
    <>
      <LensHead data={data} title={title} aside={aside} locale={locale} m={m} />
      <CreditViewSwitch
        initialView={initialView}
        labels={{ group: m.credit.viewLabel, public: m.credit.viewPublic, compliance: m.credit.viewCompliance }}
        publicSlot={<PublicTier lines={explanation.public_tier} locale={locale} m={m} />}
        complianceSlot={<ComplianceView explanation={explanation} detail={detail} receipt={data.receipt} locale={locale} m={m} />}
      />
      <section aria-label={m.credit.terms} className="rise" style={{ animationDelay: "0.3s" }}>
        {/* U1: display only. Nothing on this page can change the markup. */}
        <dl className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] border border-line bg-card">
          {credit.amount_sar !== null && (
            <Term label={m.credit.amount}>
              <Num>{formatSar(credit.amount_sar, locale)}</Num>
            </Term>
          )}
          {credit.repayment_months !== null && (
            <Term label={m.credit.months}>{fill(m.overview.monthsValue, { n: formatInt(credit.repayment_months, locale) })}</Term>
          )}
          {credit.base_markup_pct !== null && (
            <Term
              label={
                <GlossaryTerm id="markup-fixed" locale={locale}>
                  {m.credit.markup}
                </GlossaryTerm>
              }
            >
              <Num>{formatRaw(credit.base_markup_pct, locale)}%</Num>{" "}
              <Plate variant="ink" className="align-middle">
                {m.credit.markupFixed}
              </Plate>
            </Term>
          )}
          {credit.adjusted_markup_pct !== null && (
            <Term label={m.credit.adjustedMarkup}>
              <Num>{formatRaw(credit.adjusted_markup_pct, locale)}%</Num>
            </Term>
          )}
          <Term label={m.credit.latePolicy}>
            <Code>{credit.late_penalty_policy}</Code>
          </Term>
          {detail.offer_status && (
            <Term label={m.credit.offerStatus}>
              <Plate variant={detail.offer_status === "unconditional" ? "ok" : "warn"}>{m.enums.offer_status[detail.offer_status]}</Plate>
            </Term>
          )}
          {detail.decline_reason && <Term label={m.credit.declineReason}>{m.enums.decline_reason[detail.decline_reason]}</Term>}
          {detail.decline_origin && <Term label={m.credit.declineOrigin}>{m.enums.decline_origin[detail.decline_origin]}</Term>}
        </dl>
      </section>
      {detail.conditions && detail.conditions.length > 0 && (
        <section aria-label={m.credit.conditions}>
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
        </section>
      )}
      <p className="text-[13px] text-muted">{m.credit.note}</p>
    </>
  );
}
