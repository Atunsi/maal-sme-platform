"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Term } from "@/components/Term";
import { Num, TableScroll, TD, TH } from "@/components/ui";
import { formatDate, formatInt, formatSar } from "@/lib/format";
import { fill, type Locale, type Messages } from "@/lib/i18n";
import { label, labelWord } from "@/lib/labels";
import { delay } from "@/lib/motion";
import type { AnomalyResponse } from "@/lib/types";

type Computed = Extract<NonNullable<AnomalyResponse["anomaly"]>, { status: "computed" }>;
type Flag = Computed["flags"][number];
type Reason = Flag["flag_reason"];

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

// C5: the table sorts on the client, over the one response; nothing is fetched again. The sort lives in
// ?sort=<column>&dir=asc|desc, written with replaceState, so a shared link opens sorted and Back still leaves.
export const SORT_COLUMNS = ["date", "hour", "direction", "amount", "counterparty", "category", "reason"] as const;
export type SortColumn = (typeof SORT_COLUMNS)[number];
type Sort = { column: SortColumn; dir: "asc" | "desc" };

export function readSort(params: URLSearchParams | null): Sort {
  const column = params?.get("sort") as SortColumn | null;
  return { column: column && SORT_COLUMNS.includes(column) ? column : "date", dir: params?.get("dir") === "desc" ? "desc" : "asc" };
}

/** I2: the reasons a ?reason=a,b list keeps on show, limited to those present; none named means all. */
export function readReasons<R extends string>(params: URLSearchParams | null, present: readonly R[]): ReadonlySet<R> {
  const asked = params?.get("reason");
  if (!asked) return new Set(present);
  const names = asked.split(",");
  return new Set(present.filter((r) => names.includes(r)));
}

/** "03:00" from the hour the API returns. */
export const hourText = (hour: number) => `${String(hour).padStart(2, "0")}:00`;

/** U8: reasons only, placed by date. One mark per listed transaction; a mark and its row select each other. */
export function ReviewBoard({ a, locale, labels }: { a: Computed; locale: Locale; labels: Pick<Messages, "anomaly" | "enums"> }) {
  const [picked, setPicked] = useState<ReadonlySet<number>>(new Set());
  // E5: the mark whose date and reason are showing. Hover, focus or a tap shows it; Esc, leaving or a tap
  // elsewhere hides it. Picking (the highlight) is separate.
  const [shown, setShown] = useState<number | null>(null);
  const params = useSearchParams();
  const [sort, setSort] = useState<Sort>(() => readSort(params));
  // I2: the reasons on show, from ?reason=a,b (every reason present when the URL names none).
  const present = [...new Set(a.flags.map((f) => f.flag_reason))];
  const [shownReasons, setShownReasons] = useState<ReadonlySet<Reason>>(() => readReasons(params, present));
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
  const visible = a.flags.filter((f) => shownReasons.has(f.flag_reason));
  const position = (iso: string) => Math.min(1, Math.max(0, (dayOf(iso) - dayOf(from)) / span));
  const toggleReason = (reason: Reason) => {
    const next = new Set(shownReasons);
    if (next.has(reason)) next.delete(reason);
    else next.add(reason);
    setShownReasons(next);
    const url = new URL(window.location.href);
    if (next.size === present.length) url.searchParams.delete("reason");
    else url.searchParams.set("reason", present.filter((r) => next.has(r)).join(","));
    window.history.replaceState(null, "", url);
  };
  const counts = new Map<Reason, number>();
  for (const flag of a.flags) counts.set(flag.flag_reason, (counts.get(flag.flag_reason) ?? 0) + 1);
  const isPicked = (ids: readonly number[]) => ids.length > 0 && ids.every((id) => picked.has(id));
  // Picking exactly what is already picked clears it; anything else replaces the pick.
  const pick = (ids: readonly number[]) => setPicked(isPicked(ids) && picked.size === ids.length ? new Set() : new Set(ids));
  // I2: a mark brings its first row into view, and a row brings its mark into view.
  const scrollTo = (selector: string) => document.querySelector(selector)?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  const markText = (flag: Flag) => fill(n.markLabel, { date: formatDate(flag.date, locale), reason: labels.enums.flag_reason[flag.flag_reason] });
  const word = (flag: Flag, column: SortColumn): string | number => {
    switch (column) {
      case "date":
        return flag.date;
      case "hour":
        return flag.hour;
      case "amount":
        return flag.amount_sar;
      case "direction":
        return labels.enums.flow[flag.direction];
      case "counterparty":
        return labelWord("counterparty_type", flag.counterparty_type, labels) ?? flag.counterparty_type;
      case "category":
        return labelWord("category", flag.category, labels) ?? flag.category;
      case "reason":
        return labels.enums.flag_reason[flag.flag_reason];
    }
  };
  const compare = (x: string | number, y: string | number) => (typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), locale));
  // Ties fall back to date, then hour, then the transaction, so the order is always the same.
  const rows = [...visible].sort((p, q) => {
    const first = compare(word(p, sort.column), word(q, sort.column)) * (sort.dir === "asc" ? 1 : -1);
    return first || p.date.localeCompare(q.date) || p.hour - q.hour || p.transaction_id - q.transaction_id;
  });
  const sortBy = (column: SortColumn) => {
    const next: Sort = { column, dir: sort.column === column && sort.dir === "asc" ? "desc" : "asc" };
    setSort(next);
    const url = new URL(window.location.href);
    url.searchParams.set("sort", next.column);
    url.searchParams.set("dir", next.dir);
    window.history.replaceState(null, "", url);
  };
  const headings: Record<SortColumn, string> = {
    date: n.date,
    hour: n.hour,
    direction: n.direction,
    amount: n.amount,
    counterparty: n.counterparty,
    category: n.category,
    reason: n.reason,
  };

  return (
    <>
      <section aria-label={n.timeline} data-tour="timeline" className="flex flex-col gap-3 border border-line bg-card px-5 pb-6 pt-9 sm:px-9">
        {/* Time runs left to right in Arabic too, so the track is pinned LTR. */}
        <div dir="ltr" role="group" aria-label={fill(n.timelineAlt, { n: formatInt(a.flags.length, locale), from: formatDate(from, locale), to: formatDate(to, locale) })}>
          <div className="relative h-[120px] border-b-2 border-ink" data-track>
            <div aria-hidden="true" className="scan" />
            {visible.map((flag) => {
              const id = flag.transaction_id;
              const at = position(flag.date);
              const look = LOOK[flag.flag_reason];
              const on = picked.has(id);
              const readout = markText(flag);
              return (
                <button
                  key={id}
                  type="button"
                  className="tick"
                  aria-pressed={on}
                  aria-label={readout}
                  data-ids={id}
                  data-count={1}
                  data-open={shown === id}
                  onClick={() => {
                    pick([id]);
                    setShown(id);
                    scrollTo(`tbody tr[data-id="${id}"]`);
                  }}
                  onFocus={() => setShown(id)}
                  onBlur={() => setShown(null)}
                  onMouseEnter={() => setShown(id)}
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
        <span className="mt-2 text-xs text-muted">
          <Term id="flag-reason" locale={locale}>
            {n.reason}
          </Term>
        </span>
        {/* I2: each legend item turns its reason's marks and rows on and off. U8: reasons only. R3: fixed labels. */}
        <ul className="flex flex-wrap gap-2 text-[13px]">
          {[...counts].map(([reason, count]) => (
            <li key={reason}>
              <button type="button" className="reason-toggle" aria-pressed={shownReasons.has(reason)} data-reason={reason} onClick={() => toggleReason(reason)}>
                <span aria-hidden="true" className="w-1.5" style={{ height: `${LOOK[reason].height * 0.22}px`, background: LOOK[reason].colour }} />
                {labels.enums.flag_reason[reason]}, <Num>{formatInt(count, locale)}</Num>
              </button>
            </li>
          ))}
        </ul>
        {/* The cap's count (E11) is of every flag; with a filter on, the page says how many it shows. */}
        {visible.length !== a.flags.length && (
          <p role="status" className="text-sm text-muted" data-showing>
            {fill(n.showing, { x: formatInt(visible.length, locale), y: formatInt(a.flags.length, locale) })}
          </p>
        )}
      </section>

      <section aria-label={n.title} className="rise border border-line bg-card" style={{ animationDelay: delay(4) }}>
        <TableScroll label={n.title}>
          <table className="stack-sm w-full md:min-w-[860px]">
            <thead>
              <tr>
                {SORT_COLUMNS.map((column) => {
                  const active = sort.column === column;
                  return (
                    <th key={column} scope="col" className={TH} aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : undefined}>
                      <button type="button" className="sort-button" data-sort={column} data-dir={active ? sort.dir : undefined} onClick={() => sortBy(column)}>
                        {headings[column]}
                        <span aria-hidden="true" className="sort-mark" />
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {rows.map((flag) => (
                <tr
                  key={flag.transaction_id}
                  data-id={flag.transaction_id}
                  data-picked={picked.has(flag.transaction_id)}
                  className="row-pick cursor-pointer"
                  onClick={() => {
                    pick([flag.transaction_id]);
                    scrollTo(`button.tick[data-ids~="${flag.transaction_id}"]`);
                  }}
                >
                  <td className={TD} data-label={headings.date}>
                    {/* B8, R4: the row's click has a keyboard path. The button's name is the date and the reason. */}
                    <button
                      type="button"
                      className="row-button"
                      aria-pressed={picked.has(flag.transaction_id)}
                      aria-label={markText(flag)}
                      onClick={(event) => {
                        event.stopPropagation();
                        pick([flag.transaction_id]);
                        scrollTo(`button.tick[data-ids~="${flag.transaction_id}"]`);
                      }}
                    >
                      <bdi>{formatDate(flag.date, locale)}</bdi>
                    </button>
                  </td>
                  <td className={TD} data-label={headings.hour}>
                    <Num>{hourText(flag.hour)}</Num>
                  </td>
                  <td className={TD} data-label={headings.direction}>
                    {labels.enums.flow[flag.direction]}
                  </td>
                  <td className={TD} data-label={headings.amount}>
                    <Num>{formatSar(flag.amount_sar, locale)}</Num>
                  </td>
                  <td className={TD} data-label={headings.counterparty}>
                    {label("counterparty_type", flag.counterparty_type, labels)}
                  </td>
                  <td className={TD} data-label={headings.category}>
                    {label("category", flag.category, labels)}
                  </td>
                  <td className={TD} data-label={headings.reason}>
                    {labels.enums.flag_reason[flag.flag_reason]}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableScroll>
      </section>
    </>
  );
}
