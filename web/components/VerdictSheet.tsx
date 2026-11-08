import { BusinessHeader } from "@/components/BusinessHeader";
import { CopyButton } from "@/components/CopyButton";
import { Term } from "@/components/Term";
import { copyLabels, ReceiptPanel } from "@/components/ReceiptPanel";
import { Num, Refusal } from "@/components/ui";
import { formatInt, formatRaw, formatSar } from "@/lib/format";
import { fill, type Locale, type Messages } from "@/lib/i18n";
import type { CreditResponse, Receipt } from "@/lib/types";

const SHORT = 12;

function Cell({ label, children, first }: { label: React.ReactNode; children: React.ReactNode; first?: boolean }) {
  return (
    <div className={`pt-3.5 ${first ? "pe-4" : "border-s border-line px-4"}`}>
      <div className="text-[13px] text-muted">{label}</div>
      {children}
    </div>
  );
}

/** Plain text: output hash, model and commit, with the full receipt and scope on expand (U13). */
function ReceiptAside({ receipt, lens, m }: { receipt: Receipt; lens: string; m: Messages }) {
  const o = m.overview;
  const rows = [
    [o.output, receipt.output_sha256.slice(0, SHORT)],
    [o.model, `${receipt.credit_model_version} ${receipt.credit_model_sha256.slice(0, SHORT)}`],
    [o.commit, receipt.code_commit.replace(/^([0-9a-f]{7})[0-9a-f]*/, "$1")],
  ];
  return (
    <aside aria-label={o.receiptEyebrow} data-tour="receipt" className="panel square flex min-w-0 flex-[1_1_320px] flex-col gap-4 p-8">
      <div className="rise" style={{ animationDelay: "1.2s" }}>
        <div className="eyebrow text-gold">{o.receiptEyebrow}</div>
        <div className="heading mt-1.5 text-[26px]">{o.receiptTitle}</div>
        <p className="mt-1.5 text-sm text-muted">{o.receiptBody}</p>
      </div>
      <dl data-latin className="rise grid grid-cols-[auto_1fr] gap-x-3.5 gap-y-1.5 font-mono text-xs" style={{ animationDelay: "1.5s" }}>
        {rows.map(([key, value]) => (
          <div key={key} className="contents">
            <dt className="text-muted">{key}</dt>
            <dd dir="ltr" className="flex flex-wrap items-center gap-x-3 break-all text-start">
              {value}
              {key === o.output && <CopyButton value={receipt.output_sha256} name="output_sha256" labels={copyLabels(m)} />}
            </dd>
          </div>
        ))}
      </dl>
      <ReceiptPanel receipt={receipt} lens={lens} m={m} />
    </aside>
  );
}

export function VerdictSheet({ data, locale, m }: { data: CreditResponse; locale: Locale; m: Messages }) {
  const { credit, credit_decision_detail: detail } = data;
  const o = m.overview;
  const approved = credit?.decision === "approved";
  return (
    <section aria-labelledby="verdict" data-tour="verdict" className="clip-box flex flex-wrap border border-ink bg-card">
      <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-4 p-6 sm:p-9">
        <BusinessHeader data={data} locale={locale} m={m} />
        {!credit || !detail ? (
          <>
            <h2 id="verdict" className="heading text-[52px]">
              {o.notRun}
            </h2>
            <Refusal reason={data.lens_not_run_reason} m={m} />
          </>
        ) : (
          <>
            <h2 id="verdict" className={`flex flex-col gap-2.5 ${approved ? "text-ok" : "text-bad"}`}>
              <span className="heading stamp self-start text-[60px] leading-none sm:text-[76px]">{m.enums.decision[credit.decision]}</span>
              <span className="verdict-rule" aria-hidden="true" />
              {credit.amount_sar !== null && (
                <span className="rise font-mono text-[34px] font-medium text-ink sm:text-[52px]" style={{ animationDelay: "0.8s" }}>
                  <Num>{formatSar(credit.amount_sar, locale)}</Num>
                </span>
              )}
            </h2>
            {detail.decline_reason && (
              <p className="rise" style={{ animationDelay: "0.8s" }}>
                {m.credit.declineReason}: {m.enums.decline_reason[detail.decline_reason]}
              </p>
            )}
            <div className="rise grid grid-cols-1 border-t border-line sm:grid-cols-3" style={{ animationDelay: "1s" }}>
              {credit.repayment_months !== null && (
                <Cell label={o.repayment} first>
                  <div className="font-mono text-xl">{fill(o.monthsValue, { n: formatInt(credit.repayment_months, locale) })}</div>
                </Cell>
              )}
              {credit.base_markup_pct !== null && (
                <Cell label={<Term id="markup-fixed" locale={locale}>{o.markupLabel}</Term>}>
                  <div className="font-mono text-xl">
                    <Num>{formatRaw(credit.base_markup_pct, locale)}%</Num>
                  </div>
                </Cell>
              )}
              <Cell label={<Term id="charity-late" locale={locale}>{o.late}</Term>} first={credit.repayment_months === null && credit.base_markup_pct === null}>
                <div className="text-lg">{o.lateValue}</div>
              </Cell>
            </div>
            <p className="rise text-sm text-muted" style={{ animationDelay: "1.1s" }}>
              {m.credit.note} {detail.offer_status ? m.enums.offer_status[detail.offer_status] : null}
            </p>
          </>
        )}
      </div>
      <ReceiptAside receipt={data.receipt} lens={m.credit.title} m={m} />
    </section>
  );
}
