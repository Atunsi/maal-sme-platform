import type { ReactNode } from "react";
import { TrendLine, type TrendPoint } from "@/components/TrendLine";
import { ApiError, Num, Sar, TD, TH } from "@/components/ui";
import { formatDate, formatFixed, formatSar, formatSarSpoken } from "@/lib/format";
import { fill, fillNodes, type Locale, type Messages } from "@/lib/i18n";
import type { ApiResult, HistoryResponse } from "@/lib/types";

/** A trend needs at least this many dated values; fewer shows the sentence instead of a line. */
export const MIN_TREND_POINTS = 3;

/** How each figure is written. Amounts as every amount in the app; the ratio to two decimals. */
const UNIT: Record<string, "sar" | "ratio"> = { avg_monthly_inflow: "sar", inflow_outflow_ratio: "ratio", avg_daily_balance: "sar", cash_flow_volatility: "sar" };

type Shown = { node: ReactNode; text: string; spoken: string };

function show(metric: string, value: number, locale: Locale): Shown {
  if (UNIT[metric] === "ratio") {
    const text = formatFixed(value, locale, 2);
    return { node: <Num>{text}</Num>, text, spoken: text };
  }
  return { node: <Sar value={value} locale={locale} />, text: formatSar(value, locale), spoken: formatSarSpoken(value, locale) };
}

/** One figure: where it is, how it has moved since the date before, the line of its dates, and the same values as a table. */
function Row({ metric, history, locale, m }: { metric: string; history: NonNullable<HistoryResponse["history"]>; locale: Locale; m: Messages }) {
  const t = m.trend;
  const label = (t.metrics as Record<string, string>)[metric] ?? metric;
  // TR1: only the dates the API returned a value for. Nothing is filled in.
  const dated = history.points.filter((p) => typeof p.metrics[metric] === "number").map((p) => ({ iso: p.as_of, value: p.metrics[metric]! }));
  const last = dated.at(-1);
  if (!last) return null;
  const current = show(metric, last.value, locale);
  const enough = dated.length >= MIN_TREND_POINTS;
  const previous = dated.at(-2);
  const points: TrendPoint[] = dated.map((p) => ({ iso: p.iso, date: formatDate(p.iso, locale), value: p.value, text: show(metric, p.value, locale).text, spoken: show(metric, p.value, locale).spoken }));
  return (
    <div data-trend={metric} className="flex flex-wrap items-start gap-x-8 gap-y-2 border-t border-line pt-4 first:border-t-0 first:pt-0">
      <div className="flex min-w-[220px] flex-[1_1_260px] flex-col gap-1">
        <span className="text-label font-medium text-muted">{label}</span>
        <span className="font-mono text-value" data-trend-current>
          {current.node}
        </span>
        {enough && previous ? (
          <p className="text-label" data-trend-change={last.value > previous.value ? "up" : last.value < previous.value ? "down" : "same"}>
            {/* The direction is a word, never a colour, and both figures are the API's own: no difference is worked out. */}
            <span className="font-semibold">{fill(last.value > previous.value ? t.up : last.value < previous.value ? t.down : t.same, { date: formatDate(previous.iso, locale) })}</span>
            {": "}
            {fillNodes(t.thenNow, { previous: show(metric, previous.value, locale).node, current: show(metric, last.value, locale).node })}
          </p>
        ) : (
          <p className="text-label text-muted" data-trend-short>
            {t.short}
          </p>
        )}
      </div>
      {enough && (
        <div className="flex flex-[1_1_260px] flex-col gap-1">
          <TrendLine points={points} stepDays={history.step_days} label={fill(t.chart, { metric: label, from: points[0]!.date, to: points.at(-1)!.date })} pointLabel={t.point} />
          <details data-trend-table>
            <summary className="cursor-pointer text-label text-muted">{t.values}</summary>
            <table className="mt-1 w-full">
              <caption className="sr-only">{label}</caption>
              <thead>
                <tr>
                  <th scope="col" className={TH}>
                    {t.date}
                  </th>
                  <th scope="col" className={TH}>
                    {t.value}
                  </th>
                </tr>
              </thead>
              <tbody>
                {dated.map((p) => (
                  <tr key={p.iso} data-trend-row={p.iso}>
                    <td className={TD}>{formatDate(p.iso, locale)}</td>
                    <td className={`${TD} font-mono`}>{show(metric, p.value, locale).node}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </div>
      )}
    </div>
  );
}

/** OV1 (DECISIONS 63): its own section on the overview, with a heading at the readouts' level, open without a click. */
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section id="trends" aria-labelledby="trends-title" data-trends className="drift min-w-0 border border-line bg-card p-6">
      <h2 id="trends-title" className="heading mb-3 text-heading">
        {title}
      </h2>
      {children}
    </section>
  );
}

/**
 * IN3 (DECISIONS 62): change over time. OV1 (DECISIONS 63): its own section between the readouts and the profile
 * figures, no longer inside them. A business beside its own past (schema §36.2); it is compared with no other
 * business (§36.4, U9), and the intro says so. Only dates the API returned are shown; a business whose profile did
 * not run gets no block at all (the overview passes the profile result in for that).
 */
export async function Trends({ result, profile, locale, m }: { result: Promise<ApiResult<HistoryResponse>>; profile?: Promise<ApiResult<unknown>>; locale: Locale; m: Messages }) {
  if (profile && !(await profile).ok) return null;
  const r = await result;
  const t = m.trend;
  if (!r.ok) {
    return (
      <Section title={t.title}>
        <ApiError kind={r.kind} detail={r.detail} m={m} />
      </Section>
    );
  }
  const history = r.data.history;
  if (!history) return null;
  return (
    <Section title={t.title}>
      <p className="mb-4 text-label text-muted">{t.intro}</p>
      {history.points.length === 0 ? (
        <p className="text-label text-muted" data-trend-short>
          {t.short}
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {history.metrics.map((metric) => (
            <Row key={metric} metric={metric} history={history} locale={locale} m={m} />
          ))}
        </div>
      )}
    </Section>
  );
}
