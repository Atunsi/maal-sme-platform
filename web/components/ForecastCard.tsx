import type { ReactNode } from "react";
import { LensHead } from "@/components/BusinessHeader";
import { ForecastChart, type ForecastPoint } from "@/components/ForecastChart";
import { Term } from "@/components/Term";
import { BackendText, figureFont, Num, Plate, Probability, Refusal, Sar, SubHeading, TableScroll, TD, TH } from "@/components/ui";
import { formatInt, formatSar } from "@/lib/format";
import { fill, type Locale, type Messages, pluralForm } from "@/lib/i18n";
import type { ForecastResponse } from "@/lib/types";
import { delay } from "@/lib/motion";
import { DecisionRecord } from "@/components/DecisionRecord";
import { recordInput } from "@/lib/record";

const LEVEL_VARIANT = { none: "ok", watch: "warn", crunch: "bad" } as const;
const HORIZONS = ["30d", "60d", "90d"] as const;

type Computed = Extract<NonNullable<ForecastResponse["forecast"]>, { status: "computed" }>;

function points(f: Computed): ForecastPoint[] {
  const rows: ForecastPoint[] = [{ day: 0, model: f.balance_today_sar, baseline: f.balance_today_sar }];
  for (const model of f.model) {
    const baseline = f.naive_baseline.find((b) => b.horizon_days === model.horizon_days);
    if (baseline) {
      rows.push({ day: model.horizon_days, model: model.projected_balance_sar, baseline: baseline.projected_balance_sar });
    }
  }
  return rows;
}

function Figure({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 py-3 sm:p-5">
      <dt className="text-label text-muted">{label}</dt>
      <dd className={`${figureFont(children)} text-heading`}>{children}</dd>
    </div>
  );
}

function Body({ f, locale, m }: { f: Computed; locale: Locale; m: Messages }) {
  const n = m.forecast;
  const alert = f.crunch_alert;
  const series = [
    { label: n.model, rows: f.model },
    { label: n.baseline, rows: f.naive_baseline },
  ];
  // C3: each horizon in catalogue words ("30 days"), the number filled in by the formatter.
  const hazard = HORIZONS.map((key) => ({ key, days: fill(pluralForm(Number.parseInt(key, 10), n.horizonDays, locale), { n: formatInt(Number.parseInt(key, 10), locale) }), value: alert.liquidity_hazard[key] }));
  return (
    <>
      <dl aria-label={n.keyFigures} data-phone="terms" className="rise grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] border border-line bg-card" style={{ animationDelay: delay(1) }}>
        <Figure label={n.balanceToday}>
          <Sar value={f.balance_today_sar} locale={locale} />
        </Figure>
        <Figure label={n.hazard}>
          <ul className="text-body">
            {hazard.map(({ key, days, value }) => (
              <li key={key}>
                <span className="font-sans text-label text-muted">{days}</span> {value === null ? m.common.dash : <Probability value={value} locale={locale} />}
              </li>
            ))}
          </ul>
        </Figure>
        <Figure label={n.daysToNegative}>
          {alert.days_to_projected_negative_balance === null ? (
            n.noneProjected
          ) : (
            <Num>{formatInt(alert.days_to_projected_negative_balance, locale)}</Num>
          )}
        </Figure>
        <Figure label={n.ramadan}>{f.ramadan_adjusted === null ? m.common.dash : f.ramadan_adjusted ? m.common.yes : m.common.no}</Figure>
      </dl>
      {alert.drivers.length > 0 && (
        <section aria-label={n.drivers}>
          <SubHeading>{n.drivers}</SubHeading>
          <ul className="space-y-1">
            {alert.drivers.map((driver, i) => (
              <li key={driver}>
                <BackendText en={driver} ar={alert.drivers_ar?.[i]} locale={locale} m={m} />
              </li>
            ))}
          </ul>
        </section>
      )}
      <section aria-label={n.chartTitle} data-tour="runway" className="flex flex-col gap-4 border border-line bg-card p-5 sm:p-8">
        <ForecastChart
          data={points(f)}
          locale={locale}
          labels={{
            model: n.model,
            baseline: n.baseline,
            day: n.dayN,
            alt: n.chartAlt,
            floor: fill(n.floor, { amount: formatSar(0, locale) }),
            floorName: n.floorName,
            keys: n.chartKeys,
            below: n.below,
            today: n.today,
          }}
        />
        <div className="flex flex-wrap gap-7 text-label">
          <span className="flex items-center gap-2">
            <span aria-hidden="true" className="h-0 w-7 border-t-[3px] border-dotted border-accent" />
            {n.model}
          </span>
          <span className="flex items-center gap-2">
            <span aria-hidden="true" className="h-0 w-7 border-t-[3px] border-dashed border-ochre" />
            {n.baseline}
          </span>
        </div>
        {/* One line: both lines are projections, joined between four points (the API sends no daily history). */}
        <p data-points-note className="text-label text-muted">
          {n.pointsNote}
        </p>
      </section>
      <section aria-label={n.tableLabel} className="rise border border-line bg-card" style={{ animationDelay: delay(3) }}>
        <div className="drift">
        <TableScroll label={n.chartTitle}>
          <table data-phone="forecast-list" className="stack-sm w-full md:min-w-[720px]">
            <thead>
              <tr>
                {[n.series, n.horizon, n.projected, n.minimum, n.netFlow].map((label) => (
                  <th key={label} scope="col" className={TH}>
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="font-mono">
              {series.flatMap(({ label, rows }) =>
                rows.map((row) => (
                  <tr key={`${label}-${row.horizon_days}`}>
                    <td className={`${TD} font-sans`} data-label={n.series} data-col="series">
                      {label}
                    </td>
                    <td className={TD} data-label={n.horizon} data-col="horizon">
                      <Num>{fill(n.dayN, { n: row.horizon_days })}</Num>
                    </td>
                    <td className={TD} data-label={n.projected} data-col="projected">
                      <Sar value={row.projected_balance_sar} locale={locale} />
                    </td>
                    <td className={TD} data-label={n.minimum} data-col="minimum">
                      <Sar value={row.min_projected_balance_sar} locale={locale} />
                    </td>
                    <td className={TD} data-label={n.netFlow} data-col="net">
                      <Sar value={row.projected_net_flow_sar} locale={locale} />
                    </td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </TableScroll>
        </div>
      </section>
    </>
  );
}

export function ForecastCard({ data, locale, m }: { data: ForecastResponse; locale: Locale; m: Messages }) {
  const f = data.forecast;
  const n = m.forecast;
  const computed = f?.status === "computed" ? f : null;
  const lastDay = computed?.model.at(-1)?.horizon_days;
  const aside = computed && (
    <div className="flex items-center gap-2">
      <span className="text-label text-muted">
        <Term id="crunch-alert" locale={locale}>
          {n.alert}
        </Term>
      </span>
      <Plate variant={LEVEL_VARIANT[computed.crunch_alert.level]}>{m.enums.level[computed.crunch_alert.level]}</Plate>
    </div>
  );
  return (
    <>
      <LensHead transition="forecast" data={data} title={lastDay ? fill(n.pageTitle, { n: lastDay }) : n.title} aside={aside} locale={locale} m={m} />
      {!f ? (
        <Refusal reason={data.lens_not_run_reason} coverage={data.coverage_days_90d} m={m} />
      ) : f.status === "not_computed" ? (
        <p role="status">
          {n.notComputed} {m.enums.lens_status[f.reason]} ({n.historyDays}: <Num>{formatInt(f.history_days, locale)}</Num>)
        </p>
      ) : (
        <Body f={f} locale={locale} m={m} />
      )}
      {/* The method sits with the receipt, as on the review queue: there for whoever checks, out of the reader's way. */}
      <DecisionRecord
        input={recordInput("forecast", data)}
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
