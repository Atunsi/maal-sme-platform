import { LensHead } from "@/components/BusinessHeader";
import { ReviewBoard } from "@/components/ReviewBoard";
import { BackendText, Num, Refusal } from "@/components/ui";
import { formatDate, formatInt } from "@/lib/format";
import { fill, type Locale, type Messages, pluralForm } from "@/lib/i18n";
import type { AnomalyResponse } from "@/lib/types";
import { DecisionRecord } from "@/components/DecisionRecord";
import { recordInput } from "@/lib/record";

/** U8: flag_reason categories only, framed as a review queue, with no severity the API did not send. */
export function AnomalyCard({ data, locale, m }: { data: AnomalyResponse; locale: Locale; m: Messages }) {
  const a = data.anomaly;
  const n = m.anomaly;
  const computed = a?.status === "computed" ? a : null;
  // E11: "N of cap" when the response carries the cap (limits.max_flags). E11 stopped at S9 (DECISIONS 44),
  // so no response carries it yet, and the count alone is shown, as before.
  const cap = data.limits?.max_flags;
  const aside = computed && (
    <div className="sm:text-end">
      <div className="font-mono text-[40px] leading-tight">
        {cap ? (
          <span role="img" aria-label={fill(pluralForm(cap, n.slots, locale), { n: formatInt(computed.flags.length, locale), cap: formatInt(cap, locale) })} data-slots>
            <span aria-hidden="true">
              <Num>{fill(n.slotsShort, { n: formatInt(computed.flags.length, locale), cap: formatInt(cap, locale) })}</Num>
            </span>
          </span>
        ) : (
          <Num>{formatInt(computed.flags.length, locale)}</Num>
        )}
      </div>
      {cap ? (
        <div aria-hidden="true" className="mt-1 flex flex-wrap gap-1 sm:justify-end" data-slot-row>
          {Array.from({ length: cap }, (_, i) => (
            <span key={i} data-filled={i < computed.flags.length} className={`h-3 w-3 rounded-[3px] border border-ink ${i < computed.flags.length ? "bg-ink" : ""}`} />
          ))}
        </div>
      ) : null}
      <div className="text-label text-muted">{fill(pluralForm(computed.transactions_scanned, n.listedOf, locale), { n: formatInt(computed.transactions_scanned, locale) })}</div>
      <div aria-hidden="true" className="ms-auto mt-2 h-1.5 w-[220px] max-w-full bg-line">
        <div className="scan-fill" />
      </div>
    </div>
  );
  return (
    <>
      <LensHead transition="review" data={data} title={n.title} aside={aside} locale={locale} m={m} />
      {!a ? (
        <Refusal reason={data.lens_not_run_reason} coverage={data.coverage_days_90d} m={m} />
      ) : a.status === "not_computed" ? (
        <p role="status">
          {n.notComputed} {m.enums.lens_status[a.reason]}
        </p>
      ) : (
        <>
          {/* The chart card carries the framing (U8) and the scan window; the method sits with the receipt. */}
          {a.flags.length === 0 ? (
            <>
              <p className="text-label text-muted">{n.queue}</p>
              <p className="text-label text-muted">
                {n.window}: <bdi>{fill(n.windowValue, { from: formatDate(a.scan_window.from, locale), to: formatDate(a.scan_window.to, locale) })}</bdi>
              </p>
              <p>{n.noFlags}</p>
            </>
          ) : (
            <ReviewBoard a={a} locale={locale} labels={{ anomaly: n, enums: m.enums }} intro={n.queue} />
          )}
        </>
      )}
      <DecisionRecord
        input={recordInput("review", data)}
        receipt={data.receipt}
        lens={n.title}
        locale={locale}
        m={m}
        note={
          computed && (
            <div className="mb-2 text-label">
              <p className="font-semibold text-muted">{n.method}</p>
              <BackendText en={computed.method} ar={computed.method_ar} locale={locale} m={m} />
            </div>
          )
        }
      />
    </>
  );
}
