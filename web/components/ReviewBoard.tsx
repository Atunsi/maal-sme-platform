"use client";

import { useEffect, useState } from "react";
import { Term } from "@/components/Term";
import { Num, TableScroll, TD, TH } from "@/components/ui";
import { formatDate, formatInt, formatSar } from "@/lib/format";
import { fill, type Locale, type Messages } from "@/lib/i18n";
import { label } from "@/lib/labels";
import type { AnomalyResponse } from "@/lib/types";
import { delay } from "@/lib/motion";

type Computed = Extract<NonNullable<AnomalyResponse["anomaly"]>, { status: "computed" }>;
type Reason = Computed["flags"][number]["flag_reason"];

// Colour and height both mark the reason, and the legend names it, so neither carries it alone.
const LOOK: Record<Reason, { colour: string; height: number }> = {
  amount_outlier: { colour: "var(--ink)", height: 100 },
  new_counterparty_large_amount: { colour: "var(--ochre)", height: 82 },
  multivariate_outlier: { colour: "var(--accent)", height: 64 },
  repeat_payment: { colour: "var(--ok)", height: 74 },
  counterparty_both_directions: { colour: "var(--muted)", height: 56 },
  rare_category: { colour: "var(--warnText)", height: 38 },
  unusual_hour: { colour: "var(--bad)", height: 46 },
};

const dayOf = (iso: string) => Date.parse(`${iso}T00:00:00Z`);

/** U8: reasons only, placed by date. One mark per listed transaction; a mark and its row select each other. */
export function ReviewBoard({ a, locale, labels }: { a: Computed; locale: Locale; labels: Pick<Messages, "anomaly" | "enums"> }) {
  const [picked, setPicked] = useState<number | null>(null);
  // E5: the mark whose date and reason are showing. Hover, focus or a tap shows it; Esc, leaving or a tap
  // elsewhere hides it. Click-to-highlight (picked) is separate and stays as it was.
  const [shown, setShown] = useState<number | null>(null);
  useEffect(() => {
    if (shown === null) return;
    const away = (event: PointerEvent) => {
      if (!(event.target as Element).closest?.(".tick")) setShown(null);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [shown]);
  const n = labels.anomaly;
  const { from, to } = a.scan_window;
  const span = dayOf(to) - dayOf(from) || 1;
  const middle = new Date((dayOf(from) + dayOf(to)) / 2).toISOString().slice(0, 10);
  const position = (iso: string) => Math.min(1, Math.max(0, (dayOf(iso) - dayOf(from)) / span));
  const counts = new Map<Reason, number>();
  for (const flag of a.flags) counts.set(flag.flag_reason, (counts.get(flag.flag_reason) ?? 0) + 1);
  const pick = (id: number) => setPicked((current) => (current === id ? null : id));

  return (
    <>
      <section aria-label={n.timeline} data-tour="timeline" className="flex flex-col gap-3 border border-line bg-card px-5 pb-6 pt-9 sm:px-9">
        {/* Time runs left to right in Arabic too, so the track is pinned LTR. */}
        <div dir="ltr" role="group" aria-label={fill(n.timelineAlt, { n: formatInt(a.flags.length, locale), from: formatDate(from, locale), to: formatDate(to, locale) })}>
          <div className="relative h-[120px] border-b-2 border-ink">
            <div aria-hidden="true" className="scan" />
            {a.flags.map((flag) => {
              const at = position(flag.date);
              const look = LOOK[flag.flag_reason];
              const on = picked === flag.transaction_id;
              const readout = fill(n.markLabel, { date: formatDate(flag.date, locale), reason: labels.enums.flag_reason[flag.flag_reason] });
              return (
                <button
                  key={flag.transaction_id}
                  type="button"
                  className="tick"
                  aria-pressed={on}
                  aria-label={readout}
                  data-open={shown === flag.transaction_id}
                  onClick={() => {
                    pick(flag.transaction_id);
                    setShown(flag.transaction_id);
                  }}
                  onFocus={() => setShown(flag.transaction_id)}
                  onBlur={() => setShown(null)}
                  onMouseEnter={() => setShown(flag.transaction_id)}
                  onMouseLeave={() => setShown(null)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") setShown(null);
                  }}
                  style={{ left: `${(at * 100).toFixed(2)}%` }}
                >
                  <span
                    className="tick-bar"
                    style={{ height: `${on ? Math.min(look.height + 18, 118) : look.height}%`, background: look.colour, animationDelay: delay(at * 4) }}
                  />
                  <span aria-hidden="true" className={`tip ${at > 0.6 ? "tip-end" : ""}`}>
                    {readout}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="mt-2 flex justify-between font-mono text-xs text-muted">
            <span>{formatDate(from, locale)}</span>
            <span>{formatDate(middle, locale)}</span>
            <span>{formatDate(to, locale)}</span>
          </div>
        </div>
        <ul className="mt-2 flex flex-wrap gap-5 text-[13px]">
          {[...counts].map(([reason, count]) => (
            <li key={reason} className="flex items-center gap-2">
              <span aria-hidden="true" className="w-1.5" style={{ height: `${LOOK[reason].height * 0.22}px`, background: LOOK[reason].colour }} />
              {labels.enums.flag_reason[reason]}, <Num>{formatInt(count, locale)}</Num>
            </li>
          ))}
        </ul>
      </section>

      <section aria-label={n.title} className="rise border border-line bg-card" style={{ animationDelay: delay(4) }}>
        <TableScroll label={n.title}>
          <table className="w-full min-w-[860px]">
            <thead>
              <tr>
                {[n.date, n.hour, n.direction, n.amount, n.counterparty, n.category, n.reason].map((heading) => (
                  <th key={heading} scope="col" className={TH}>
                    {heading === n.reason ? (
                      <Term id="flag-reason" locale={locale}>
                        {heading}
                      </Term>
                    ) : (
                      heading
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {a.flags.map((flag) => (
                <tr
                  key={flag.transaction_id}
                  data-picked={picked === flag.transaction_id}
                  className="row-pick cursor-pointer"
                  onClick={() => pick(flag.transaction_id)}
                >
                  <td className={TD}>
                    <bdi>{formatDate(flag.date, locale)}</bdi>
                  </td>
                  <td className={TD}>
                    <Num>{flag.hour}</Num>
                  </td>
                  <td className={TD}>{labels.enums.flow[flag.direction]}</td>
                  <td className={TD}>
                    <Num>{formatSar(flag.amount_sar, locale)}</Num>
                  </td>
                  <td className={TD}>
                    {label("counterparty_type", flag.counterparty_type, labels)}
                  </td>
                  <td className={TD}>
                    {label("category", flag.category, labels)}
                  </td>
                  <td className={TD}>{labels.enums.flag_reason[flag.flag_reason]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableScroll>
      </section>
    </>
  );
}
