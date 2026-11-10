import { BusinessHeader } from "@/components/BusinessHeader";
import { Term } from "@/components/Term";
import { PlainCard } from "@/components/DecisionRecord";
import { ReceiptPanel } from "@/components/ReceiptPanel";
import { RoleRecord } from "@/components/RoleRecord";
import { PhoneFold } from "@/components/PhoneFold";
import { Num, Plate, Refusal, Sar } from "@/components/ui";
import { decisionPlate, decisionWord } from "@/lib/decision";
import { formatInt, formatPct } from "@/lib/format";
import { fill, type Locale, type Messages, pluralForm } from "@/lib/i18n";
import { recordInput } from "@/lib/record";
import type { CreditResponse } from "@/lib/types";
import { delay } from "@/lib/motion";

function Cell({ label, children, first }: { label: React.ReactNode; children: React.ReactNode; first?: boolean }) {
  return (
    <div data-phone="term" className={`pt-3.5 ${first ? "pe-4" : "border-s border-line px-4"}`}>
      <div className="text-[13px] text-muted">{label}</div>
      {children}
    </div>
  );
}

/**
 * DECISIONS 58 (P4): the overview's record, in plain words for the credit result: what was looked at, how it was
 * reached, same data same result, and the reference. The short hashes are gone from here for every role; their
 * full values stay in the technical record under it (admin open, public demo closed, owner none).
 */
function RecordAside({ data, locale, m }: { data: CreditResponse; locale: Locale; m: Messages }) {
  const title = m.record.title;
  const technical = (open: boolean) => <ReceiptPanel receipt={data.receipt} lens={m.credit.title} m={m} open={open} />;
  return (
    <aside aria-label={title} data-tour="receipt" data-phone="receipt" className="panel square flex min-w-0 flex-[1_1_320px] flex-col gap-4 p-8">
      {/* Phones show the record folded under the verdict (app/phone.css); larger screens show it in full. */}
      <PhoneFold
        className="mt-1.5 flex flex-col gap-4"
        summary={
          <span className="rise block" style={{ animationDelay: delay(2) }}>
            <span className="heading block text-[26px]">{title}</span>
          </span>
        }
      >
        <RoleRecord
          card={<PlainCard input={recordInput("credit", data)} locale={locale} m={m} headless className="rise" />}
          open={technical(true)}
          closed={technical(false)}
        />
      </PhoneFold>
    </aside>
  );
}

export function VerdictSheet({ data, locale, m }: { data: CreditResponse; locale: Locale; m: Messages }) {
  const { credit, credit_decision_detail: detail } = data;
  const o = m.overview;
  const approved = credit?.decision === "approved";
  return (
    <section aria-labelledby="verdict" data-tour="verdict" data-phone="verdict" className="clip-box flex flex-wrap border border-ink bg-card">
      <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-4 p-6 sm:p-9">
        <BusinessHeader data={data} locale={locale} m={m} />
        {!credit || !detail ? (
          <>
            <h2 id="verdict" className="heading text-[52px]">
              {o.notRun}
            </h2>
            <Refusal reason={data.lens_not_run_reason} coverage={data.coverage_days_90d} m={m} />
          </>
        ) : (
          <>
            <h2 id="verdict" className={`flex flex-col gap-2.5 ${approved ? "text-ok" : "text-bad"}`}>
              <span className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <span className="heading stamp text-[60px] leading-none sm:text-[76px]">{decisionWord(credit, detail, m)}</span>
                {/* B6: the offer status is its own plate, never glued to the disclaimer. */}
                {detail.offer_status && (
                  <Plate variant={decisionPlate(credit, detail, m).variant} className="text-base">
                    {m.enums.offer_status[detail.offer_status]}
                  </Plate>
                )}
              </span>
              <span className="verdict-rule" aria-hidden="true" />
              {credit.amount_sar !== null && (
                <span className="rise font-mono text-[34px] font-medium text-ink sm:text-[52px]" style={{ animationDelay: delay(1) }}>
                  <Sar value={credit.amount_sar} locale={locale} />
                </span>
              )}
            </h2>
            {detail.decline_reason && (
              <p className="rise" style={{ animationDelay: delay(1) }}>
                {m.credit.declineReason}: {m.enums.decline_reason[detail.decline_reason]}
              </p>
            )}
            <div className="rise grid grid-cols-1 border-t border-line sm:grid-cols-3" style={{ animationDelay: delay(2) }}>
              {credit.repayment_months !== null && (
                <Cell label={o.repayment} first>
                  <div className="font-mono text-xl">{fill(pluralForm(credit.repayment_months, o.monthsValue, locale), { n: formatInt(credit.repayment_months, locale) })}</div>
                </Cell>
              )}
              {credit.base_markup_pct !== null && (
                <Cell label={<Term id="markup-fixed" locale={locale}>{o.markupLabel}</Term>}>
                  <div className="font-mono text-xl">
                    <Num>{formatPct(credit.base_markup_pct, locale)}</Num>
                  </div>
                </Cell>
              )}
              <Cell label={<Term id="charity-late" locale={locale}>{o.late}</Term>} first={credit.repayment_months === null && credit.base_markup_pct === null}>
                <div className="text-lg">{o.lateValue}</div>
              </Cell>
            </div>
            <p className="rise text-sm text-muted" style={{ animationDelay: delay(2) }}>
              {m.credit.note}
            </p>
          </>
        )}
      </div>
      <RecordAside data={data} locale={locale} m={m} />
    </section>
  );
}
