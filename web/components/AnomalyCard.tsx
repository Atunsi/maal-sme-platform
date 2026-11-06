import { LensHead } from "@/components/BusinessHeader";
import { ReceiptPanel } from "@/components/ReceiptPanel";
import { ReviewBoard } from "@/components/ReviewBoard";
import { BackendText, Num, Refusal } from "@/components/ui";
import { formatDate, formatInt } from "@/lib/format";
import { fill, type Locale, type Messages } from "@/lib/i18n";
import type { AnomalyResponse } from "@/lib/types";

/** U8: flag_reason categories only, framed as a review queue, with no severity the API did not send. */
export function AnomalyCard({ data, locale, m }: { data: AnomalyResponse; locale: Locale; m: Messages }) {
  const a = data.anomaly;
  const n = m.anomaly;
  const computed = a?.status === "computed" ? a : null;
  // "N of cap" needs the cap, and no response carries it, so only the count is shown (DECISIONS 42).
  const aside = computed && (
    <div className="sm:text-end">
      <div className="font-mono text-[40px] leading-tight">
        <Num>{formatInt(computed.flags.length, locale)}</Num>
      </div>
      <div className="text-[13px] text-muted">{fill(n.listedOf, { n: formatInt(computed.transactions_scanned, locale) })}</div>
      <div aria-hidden="true" className="ms-auto mt-2 h-1.5 w-[220px] max-w-full bg-line">
        <div className="scan-fill" />
      </div>
    </div>
  );
  return (
    <>
      <LensHead data={data} title={n.title} aside={aside} locale={locale} m={m} />
      {!a ? (
        <Refusal reason={data.lens_not_run_reason} m={m} />
      ) : a.status === "not_computed" ? (
        <p role="status">
          {n.notComputed} {m.enums.lens_status[a.reason]}
        </p>
      ) : (
        <>
          <p className="max-w-[720px] text-base text-muted">{n.queue}</p>
          <p className="text-sm text-muted">
            {n.window}: <bdi>{fill(n.windowValue, { from: formatDate(a.scan_window.from, locale), to: formatDate(a.scan_window.to, locale) })}</bdi>
          </p>
          {a.flags.length === 0 ? <p>{n.noFlags}</p> : <ReviewBoard a={a} locale={locale} labels={{ anomaly: n, enums: m.enums }} />}
          <div className="text-sm">
            <span className="text-muted">{n.method}</span>
            <BackendText locale={locale} m={m}>
              {a.method}
            </BackendText>
          </div>
        </>
      )}
      <ReceiptPanel receipt={data.receipt} lens={n.title} m={m} />
    </>
  );
}
