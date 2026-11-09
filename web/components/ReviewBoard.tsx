"use client";

import { useEffect, useRef, useState } from "react";
import { Term } from "@/components/Term";
import { Num, TableScroll, TD, TH } from "@/components/ui";
import { formatDate, formatInt, formatSar } from "@/lib/format";
import { dirOf, fill, type Locale, type Messages } from "@/lib/i18n";
import { label } from "@/lib/labels";
import { delay } from "@/lib/motion";
import { buildLanes, type Cluster } from "@/lib/timeline";
import type { AnomalyResponse } from "@/lib/types";

type Computed = Extract<NonNullable<AnomalyResponse["anomaly"]>, { status: "computed" }>;
type Flag = Computed["flags"][number];
type Reason = Flag["flag_reason"];

// B11: colour is a second cue only. Each reason has its own lane, named at the lane's start and in the
// legend, and every mark has the same height, so nothing reads as a size.
const COLOUR: Record<Reason, string> = {
  amount_outlier: "var(--ink)",
  new_counterparty_large_amount: "var(--ochre)",
  multivariate_outlier: "var(--accent)",
  repeat_payment: "var(--ok)",
  counterparty_both_directions: "var(--muted)",
  rare_category: "var(--warnText)",
  unusual_hour: "var(--bad)",
};

const dayOf = (iso: string) => Date.parse(`${iso}T00:00:00Z`);

/** The width the lanes cluster for, from the track's own size. Unmeasured (server, tests), nothing merges. */
function useTrackWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(Number.POSITIVE_INFINITY);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(entry.contentRect.width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

/** U8: reasons only, placed by date. A mark or a cluster and its rows select each other. */
export function ReviewBoard({ a, locale, labels }: { a: Computed; locale: Locale; labels: Pick<Messages, "anomaly" | "enums"> }) {
  const [picked, setPicked] = useState<ReadonlySet<number>>(new Set());
  // E5: the mark whose dates and reasons are showing. Hover, focus or a tap shows it; Esc, leaving or a tap
  // elsewhere hides it. Picking (the highlight) is separate.
  const [shown, setShown] = useState<string | null>(null);
  const [trackRef, width] = useTrackWidth();
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
  const middle = new Date((dayOf(from) + dayOf(to)) / 2).toISOString().slice(0, 10);
  const lanes = buildLanes(a.flags, from, to, width);
  const counts = new Map<Reason, number>();
  for (const flag of a.flags) counts.set(flag.flag_reason, (counts.get(flag.flag_reason) ?? 0) + 1);
  const isPicked = (ids: readonly number[]) => ids.length > 0 && ids.every((id) => picked.has(id));
  // Picking exactly what is already picked clears it; anything else replaces the pick.
  const pick = (ids: readonly number[]) => setPicked(isPicked(ids) && picked.size === ids.length ? new Set() : new Set(ids));
  const markText = (flag: Flag) => fill(n.markLabel, { date: formatDate(flag.date, locale), reason: labels.enums.flag_reason[flag.flag_reason] });
  const clusterText = (c: Cluster<Flag>) =>
    c.flags.length === 1 ? markText(c.flags[0]!) : fill(n.clusterLabel, { n: formatInt(c.flags.length, locale), list: c.flags.map(markText).join("; ") });

  return (
    <>
      <section aria-label={n.timeline} data-tour="timeline" className="flex flex-col gap-3 border border-line bg-card px-5 pb-6 pt-9 sm:px-9">
        {/* Time runs left to right in Arabic too, so the lanes are pinned LTR. */}
        <div dir="ltr" role="group" aria-label={fill(n.timelineAlt, { n: formatInt(a.flags.length, locale), from: formatDate(from, locale), to: formatDate(to, locale) })}>
          <div ref={trackRef} className="relative flex flex-col border-b-2 border-ink" data-lanes={lanes.length}>
            <div aria-hidden="true" className="scan" />
            {lanes.map((lane) => (
              <div key={lane.reason} className="lane" data-lane={lane.reason}>
                <span dir={dirOf(locale)} className="lane-label block text-start text-xs font-medium text-muted">
                  {labels.enums.flag_reason[lane.reason]}
                </span>
                <div className="relative h-11 border-t border-line2">
                  {lane.clusters.map((c) => {
                    const key = c.ids.join("-");
                    const readout = clusterText(c);
                    return (
                      <button
                        key={key}
                        type="button"
                        className="tick"
                        aria-pressed={isPicked(c.ids) ? true : c.ids.some((id) => picked.has(id)) ? "mixed" : false}
                        aria-label={readout}
                        data-ids={c.ids.join(" ")}
                        data-count={c.flags.length}
                        data-open={shown === key}
                        onClick={() => {
                          pick(c.ids);
                          setShown(key);
                        }}
                        onFocus={() => setShown(key)}
                        onBlur={() => setShown(null)}
                        onMouseEnter={() => setShown(key)}
                        onMouseLeave={() => setShown(null)}
                        onKeyDown={(event) => {
                          if (event.key === "Escape") setShown(null);
                        }}
                        style={{ left: `${(c.at * 100).toFixed(2)}%` }}
                      >
                        {c.flags.length === 1 ? (
                          <span className="tick-bar" style={{ background: COLOUR[lane.reason], animationDelay: delay(c.at * 4) }} />
                        ) : (
                          // A plain count, no symbol. The readout lists every date and reason in the cluster.
                          <span aria-hidden="true" className="tick-count" style={{ borderColor: COLOUR[lane.reason], animationDelay: delay(c.at * 4) }}>
                            {formatInt(c.flags.length, locale)}
                          </span>
                        )}
                        <span aria-hidden="true" className={`tip ${c.at > 0.6 ? "tip-end" : ""}`}>
                          {readout}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-2 flex justify-between font-mono text-xs text-muted">
            <span>{formatDate(from, locale)}</span>
            <span>{formatDate(middle, locale)}</span>
            <span>{formatDate(to, locale)}</span>
          </div>
        </div>
        <ul aria-label={n.lanes} className="mt-2 flex flex-wrap gap-5 text-[13px]">
          {[...counts].map(([reason, count]) => (
            <li key={reason} className="flex items-center gap-2">
              <span aria-hidden="true" className="h-3 w-1.5" style={{ background: COLOUR[reason] }} />
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
                  data-id={flag.transaction_id}
                  data-picked={picked.has(flag.transaction_id)}
                  className="row-pick cursor-pointer"
                  onClick={() => pick([flag.transaction_id])}
                >
                  <td className={TD}>
                    {/* B8, R4: the row's click has a keyboard path. The button's name is the date and the reason. */}
                    <button
                      type="button"
                      className="row-button"
                      aria-pressed={picked.has(flag.transaction_id)}
                      aria-label={markText(flag)}
                      onClick={(event) => {
                        event.stopPropagation();
                        pick([flag.transaction_id]);
                      }}
                    >
                      <bdi>{formatDate(flag.date, locale)}</bdi>
                    </button>
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
