import type { CSSProperties, ReactNode } from "react";
import { LensHead } from "@/components/BusinessHeader";
import { ComplianceView } from "@/components/ComplianceView";
import { FactorDetails } from "@/components/FactorDetails";
import { CreditViewSwitch } from "@/components/CreditViewSwitch";
import { Term as GlossaryTerm } from "@/components/Term";
import { BackendText, figureFont, Num, Plate, Refusal, Sar, SubHeading } from "@/components/ui";
import { decisionPlate } from "@/lib/decision";
import { formatInt, formatPct } from "@/lib/format";
import { fill, type Locale, type Messages, pluralForm } from "@/lib/i18n";
import { label } from "@/lib/labels";
import type { CreditExplanation, CreditResponse } from "@/lib/types";
import { delay } from "@/lib/motion";

type Line = CreditExplanation["public_tier"][number];

// Bar length comes from the magnitude word alone. The word is all the public tier carries (U4).
/** A bar's share of its half of the track: the magnitude word alone sets it, never a number. */
const BAR_SHARE = { strongly: 92, moderately: 58, marginally: 26 } as const;
const DIRECTION_VARIANT = { supports: "ok", against: "bad", either: "ink" } as const;
const BAR_COLOUR = { supports: "bg-ok", against: "bg-bad", either: "bg-ink" } as const;

function Bar({ line, from, index }: { line: Line; from: "start" | "end"; index: number }) {
  const style: CSSProperties = { width: `${BAR_SHARE[line.magnitude!]}%`, animationDelay: delay(3 + index) };
  return <span aria-hidden="true" className={`bar-grow bar-from-${from} ${BAR_COLOUR[line.direction!]}`} style={style} />;
}

/** I3: what a factor row needs to open its feature: the business, and feature_id to feature name. */
type Factors = { businessId: number; names: Record<string, string> };

function LineText({ line, factors, locale, m }: { line: Line; factors: Factors; locale: Locale; m: Messages }) {
  const feature = line.feature_id === null ? undefined : factors.names[String(line.feature_id)];
  return (
    <span className="factor-words block min-w-0 text-body">
      <BackendText en={line.text} ar={line.text_ar} locale={locale} m={m} />
      <span className="mt-1 flex flex-wrap gap-2">
        <Plate variant="ink">{m.enums.magnitude[line.magnitude!]}</Plate>
        <Plate variant={DIRECTION_VARIANT[line.direction!]}>{m.enums.direction[line.direction!]}</Plate>
      </span>
      {feature && (
        <FactorDetails
          businessId={factors.businessId}
          feature={feature}
          features={Object.values(factors.names)}
          locale={locale}
          glossaryHref={`/${locale}/glossary`}
          labels={{ more: m.credit.factorMore, value: m.dashboard.value, nullReason: m.dashboard.nullReason, none: m.common.dash, glossary: m.footer.glossary, loading: m.common.loading }}
        />
      )}
    </span>
  );
}

/**
 * One factor: the reason, and beside it (under it on a phone) a diverging track with the centre axis. Against
 * grows from the axis toward the start side, supports toward the end side, either across both. Every row's
 * track has the same width, so the axis runs straight down the list (globals.css, .factor-*).
 */
function AxisRow({ line, index, factors, locale, m }: { line: Line; index: number; factors: Factors; locale: Locale; m: Messages }) {
  const against = line.direction === "against";
  const either = line.direction === "either";
  return (
    <div className="factor-row" data-factor-row data-side={against ? "against" : either ? "either" : "supports"}>
      <LineText line={line} factors={factors} locale={locale} m={m} />
      <div className="factor-track" aria-hidden="true">
        <span className="factor-half">{(against || either) && <Bar line={line} from="end" index={index} />}</span>
        <span className="factor-half">{!against && <Bar line={line} from="start" index={index} />}</span>
      </div>
    </div>
  );
}

function PublicTier({ lines, factors, locale, m }: { lines: Line[]; factors: Factors; locale: Locale; m: Messages }) {
  const onAxis = lines.filter((line) => line.magnitude && line.direction);
  const plain = lines.filter((line) => !line.magnitude || !line.direction);
  return (
    <section aria-label={m.credit.factors} data-tour="factors" className="slidein flex flex-col border border-line bg-card p-5 sm:p-8">
      {plain.map((line, i) => (
        // A compliance decline has one template line and no factors, so it takes no axis.
        <BackendText key={line.feature_id ?? `line-${i}`} en={line.text} ar={line.text_ar} locale={locale} m={m} />
      ))}
      {onAxis.length > 0 && (
        <>
          {/* The legend sits over the tracks, one label to each side of the axis. */}
          <div className="factor-legend heading caps text-label">
            <span aria-hidden="true" />
            <span className="factor-legend-track">
              <span className="text-end text-bad">{m.credit.against}</span>
              <span className="text-ok">{m.credit.supports}</span>
            </span>
          </div>
          {onAxis.map((line, i) => (
            <AxisRow key={line.feature_id ?? `line-${i}`} line={line} index={i} factors={factors} locale={locale} m={m} />
          ))}
          <p className="mt-4 text-label text-muted">{m.credit.barNote}</p>
        </>
      )}
    </section>
  );
}

function Term({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="min-w-0 py-3 sm:p-5">
      <dt className="text-label text-muted">{label}</dt>
      <dd className={`${figureFont(children)} text-value`}>{children}</dd>
    </div>
  );
}

type Props = { data: CreditResponse; initialView: "public" | "compliance"; locale: Locale; m: Messages };

export function CreditCard({ data, initialView, locale, m }: Props) {
  const { credit, credit_decision_detail: detail, credit_explanation: explanation } = data;
  if (!credit || !detail || !explanation) {
    return (
      <>
        <LensHead transition="credit" data={data} title={m.credit.title} locale={locale} m={m} />
        <Refusal reason={data.lens_not_run_reason} coverage={data.coverage_days_90d} m={m} />
      </>
    );
  }
  const plate = decisionPlate(credit, detail, m);
  // I3: the response's own contributions table maps each feature_id to its feature name.
  const factors: Factors = {
    businessId: data.business_id,
    names: Object.fromEntries(explanation.compliance_tier.contributions.map((c) => [String(c.feature_id), c.feature])),
  };
  const title = { approved_unconditional: m.credit.titleApproved, approved_conditional: m.credit.titleConditional, declined: m.credit.titleDeclined }[plate.state];
  const aside = (
    <div className="flex items-center gap-3">
      <Plate variant={plate.variant}>{plate.word}</Plate>
      {credit.amount_sar !== null && (
        <span className="font-mono text-value">
          <Sar value={credit.amount_sar} locale={locale} />
        </span>
      )}
    </div>
  );
  return (
    <>
      <LensHead transition="credit" data={data} title={title} aside={aside} locale={locale} m={m} />
      <CreditViewSwitch
        initialView={initialView}
        labels={{ group: m.credit.viewLabel, public: m.credit.viewPublic, compliance: m.credit.viewCompliance }}
        publicSlot={<PublicTier lines={explanation.public_tier} factors={factors} locale={locale} m={m} />}
        complianceSlot={<ComplianceView explanation={explanation} detail={detail} receipt={data.receipt} locale={locale} m={m} />}
      />
      <section aria-label={m.credit.terms} className="rise" style={{ animationDelay: delay(3) }}>
        {/* U1: display only. Nothing on this page can change the markup. */}
        <dl data-phone="terms" className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] border border-line bg-card">
          {credit.amount_sar !== null && (
            <Term label={m.credit.amount}>
              <Sar value={credit.amount_sar} locale={locale} />
            </Term>
          )}
          {credit.repayment_months !== null && (
            <Term label={m.credit.months}>{fill(pluralForm(credit.repayment_months, m.overview.monthsValue, locale), { n: formatInt(credit.repayment_months, locale) })}</Term>
          )}
          {credit.base_markup_pct !== null && (
            <Term
              label={
                <GlossaryTerm id="markup-fixed" locale={locale}>
                  {m.credit.markup}
                </GlossaryTerm>
              }
            >
              <Num>{formatPct(credit.base_markup_pct, locale)}</Num>{" "}
              <Plate variant="ink" className="align-middle">
                {m.credit.markupFixed}
              </Plate>
            </Term>
          )}
          {credit.adjusted_markup_pct !== null && (
            <Term label={m.credit.adjustedMarkup}>
              <Num>{formatPct(credit.adjusted_markup_pct, locale)}</Num>
            </Term>
          )}
          <Term label={m.credit.latePolicy}>
            {label("late_penalty_policy", credit.late_penalty_policy, m)}
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
            {detail.conditions.map((condition, i) => (
              <li key={condition}>
                <BackendText en={condition} ar={detail.conditions_ar?.[i]} locale={locale} m={m} />
              </li>
            ))}
          </ul>
        </section>
      )}
      <p className="text-label text-muted">{m.credit.note}</p>
    </>
  );
}
