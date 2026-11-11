"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Term } from "@/components/Term";
import { Num, Sar, TableScroll, TD, TH } from "@/components/ui";
import { formatDate, formatInt, formatMonth } from "@/lib/format";
import { dirOf, fill, type Locale, type Messages, pluralForm } from "@/lib/i18n";
import { label, labelWord } from "@/lib/labels";
import { delay } from "@/lib/motion";
import type { AnomalyResponse } from "@/lib/types";

type Computed = Extract<NonNullable<AnomalyResponse["anomaly"]>, { status: "computed" }>;
type Flag = Computed["flags"][number];
type Reason = Flag["flag_reason"];

const dayOf = (iso: string) => Date.parse(`${iso}T00:00:00Z`);

/** The first day of each month that starts inside the scan window: the chart's gridlines. */
export function monthStarts(from: string, to: string): string[] {
  const out: string[] = [];
  const d = new Date(`${from.slice(0, 7)}-01T00:00:00Z`);
  if (dayOf(from) > d.getTime()) d.setUTCMonth(d.getUTCMonth() + 1);
  while (d.getTime() <= dayOf(to)) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCMonth(d.getUTCMonth() + 1);
  }
  return out;
}

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

/**
 * U8: reasons only, placed by date. One lane per flag reason, one dot per listed transaction on its lane, and
 * the months as faint lines; a dot and its row select each other. A lane's name turns its dots and rows on
 * and off (I2). Lanes carry the reason, so dots need no colour or height of their own: nothing on the chart
 * looks like a size or a severity the API did not send.
 */
export function ReviewBoard({ a, locale, labels, intro }: { a: Computed; locale: Locale; labels: Pick<Messages, "anomaly" | "enums">; intro?: string }) {
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
  const months = monthStarts(from, to);
  const pct = (at: number) => `${(at * 100).toFixed(2)}%`;
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
      <section aria-label={n.timeline} data-tour="timeline" className="flex flex-col gap-4 border border-line bg-card p-5 sm:p-8">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 className="heading text-heading sm:text-heading">{n.chartTitle}</h2>
            <span className="text-label text-muted">
              <bdi>{fill(n.windowValue, { from: formatDate(from, locale), to: formatDate(to, locale) })}</bdi>
            </span>
          </div>
          {intro && <p className="text-label text-muted">{intro}</p>}
        </div>
        {/* Time runs left to right in Arabic too, so the lanes are pinned LTR; their names keep the page's direction. */}
        <div dir="ltr" role="group" aria-label={fill(pluralForm(a.flags.length, n.timelineAlt, locale), { n: formatInt(a.flags.length, locale), from: formatDate(from, locale), to: formatDate(to, locale) })} className="lanes" data-track>
          <div className="lane lane-head">
            <span dir={dirOf(locale)} className="lane-name text-label text-muted">
              <Term id="flag-reason" locale={locale}>
                {n.reason}
              </Term>
            </span>
          </div>
          {present.map((reason) => {
            const on = shownReasons.has(reason);
            return (
              <div key={reason} className="lane" data-off={!on || undefined}>
                {/* I2: a lane's name turns its reason's dots and rows on and off. R3: fixed labels. */}
                <button type="button" dir={dirOf(locale)} className="reason-toggle lane-name" aria-pressed={on} data-reason={reason} onClick={() => toggleReason(reason)}>
                  <span>{labels.enums.flag_reason[reason]}</span>
                  <span className="lane-count">
                    <Num>{formatInt(counts.get(reason) ?? 0, locale)}</Num>
                  </span>
                </button>
                <div className="lane-track">
                  {months.map((month) => (
                    <span key={month} aria-hidden="true" className="lane-grid" style={{ left: pct(position(month)) }} />
                  ))}
                  {visible
                    .filter((flag) => flag.flag_reason === reason)
                    .map((flag) => {
                      const id = flag.transaction_id;
                      const at = position(flag.date);
                      const readout = markText(flag);
                      return (
                        <button
                          key={id}
                          type="button"
                          className="tick"
                          aria-pressed={picked.has(id)}
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
                          style={{ left: pct(at) }}
                        >
                          <span className="tick-bar" style={{ animationDelay: delay(at * 4) }} />
                          <span aria-hidden="true" className={`tip ${at > 0.6 ? "tip-end" : ""}`}>
                            {readout}
                          </span>
                        </button>
                      );
                    })}
                </div>
              </div>
            );
          })}
          <div className="lane lane-axis" aria-hidden="true">
            <span className="lane-name" />
            <div className="lane-track">
              <div className="scan" />
              {months.map((month) => (
                <span key={month} className="lane-month" style={{ left: pct(position(month)) }}>
                  {formatMonth(month, locale)}
                </span>
              ))}
            </div>
          </div>
        </div>
        {/* The cap's count (E11) is of every flag; with a filter on, the page says how many it shows. */}
        {visible.length !== a.flags.length && (
          <p role="status" className="text-label text-muted" data-showing>
            {fill(n.showing, { x: formatInt(visible.length, locale), y: formatInt(a.flags.length, locale) })}
          </p>
        )}
      </section>

      <section aria-label={n.title} className="rise border border-line bg-card" style={{ animationDelay: delay(4) }}>
        <TableScroll label={n.title}>
          <table data-phone="review-list" className="stack-sm w-full md:min-w-[860px]">
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
                  <td className={TD} data-label={headings.date} data-col="date">
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
                  <td className={TD} data-label={headings.hour} data-col="hour">
                    <Num>{hourText(flag.hour)}</Num>
                  </td>
                  <td className={TD} data-label={headings.direction} data-col="direction">
                    {labels.enums.flow[flag.direction]}
                  </td>
                  <td className={TD} data-label={headings.amount} data-col="amount">
                    <Sar value={flag.amount_sar} locale={locale} />
                  </td>
                  <td className={TD} data-label={headings.counterparty} data-col="counterparty">
                    {label("counterparty_type", flag.counterparty_type, labels)}
                  </td>
                  <td className={TD} data-label={headings.category} data-col="category">
                    {label("category", flag.category, labels)}
                  </td>
                  <td className={TD} data-label={headings.reason} data-col="reason">
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
