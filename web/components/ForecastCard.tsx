import type { ReactNode } from "react";
import { LensHead } from "@/components/BusinessHeader";
import { ForecastChart, type ForecastPoint } from "@/components/ForecastChart";
import { ReceiptPanel } from "@/components/ReceiptPanel";
import { Term } from "@/components/Term";
import { BackendText, Num, Plate, Probability, Refusal, SubHeading, TableScroll, TD, TH } from "@/components/ui";
import { formatInt, formatSar } from "@/lib/format";
import { fill, type Locale, type Messages } from "@/lib/i18n";
import type { ForecastResponse } from "@/lib/types";

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
    <div className="min-w-0 p-5">
      <dt className="text-[13px] text-muted">{label}</dt>
      <dd className="font-mono text-[22px]">{children}</dd>
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
  const hazard = HORIZONS.map((key) => ({ key, days: fill(n.horizonDays, { n: formatInt(Number.parseInt(key, 10), locale) }), value: alert.liquidity_hazard[key] }));
  return (
    <>
      <dl aria-label={n.keyFigures} className="rise grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] border border-line bg-card" style={{ animationDelay: "0.1s" }}>
        <Figure label={n.balanceToday}>
          <Num>{formatSar(f.balance_today_sar, locale)}</Num>
        </Figure>
        <Figure label={n.hazard}>
          <ul className="text-base">
            {hazard.map(({ key, days, value }) => (
              <li key={key}>
                <span className="font-sans text-[13px] text-muted">{days}</span> {value === null ? m.common.dash : <Probability value={value} locale={locale} />}
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
            {alert.drivers.map((driver) => (
              <li key={driver}>
                <BackendText locale={locale} m={m}>
                  {driver}
                </BackendText>
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
        <div className="flex flex-wrap gap-7 text-sm">
          <span className="flex items-center gap-2">
            <span aria-hidden="true" className="h-[3px] w-7 bg-accent" />
            {n.model}
          </span>
          <span className="flex items-center gap-2">
            <span aria-hidden="true" className="h-0 w-7 border-t-[3px] border-dashed border-ochre" />
            {n.baseline}
          </span>
        </div>
        <p className="text-[13px] text-muted">{n.chartNote}</p>
      </section>
      <section aria-label={n.tableLabel} className="rise border border-line bg-card" style={{ animationDelay: "0.3s" }}>
        <TableScroll label={n.chartTitle}>
          <table className="w-full min-w-[720px]">
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
                    <td className={`${TD} font-sans`}>{label}</td>
                    <td className={TD}>
                      <Num>{fill(n.dayN, { n: row.horizon_days })}</Num>
                    </td>
                    <td className={TD}>
                      <Num>{formatSar(row.projected_balance_sar, locale)}</Num>
                    </td>
                    <td className={TD}>
                      <Num>{formatSar(row.min_projected_balance_sar, locale)}</Num>
                    </td>
                    <td className={TD}>
                      <Num>{formatSar(row.projected_net_flow_sar, locale)}</Num>
                    </td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </TableScroll>
      </section>
      <div className="text-sm">
        <span className="text-muted">{n.method}</span>
        <BackendText locale={locale} m={m}>
          {f.method}
        </BackendText>
      </div>
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
      <span className="text-sm text-muted">
        <Term id="crunch-alert" locale={locale}>
          {n.alert}
        </Term>
      </span>
      <Plate variant={LEVEL_VARIANT[computed.crunch_alert.level]}>{m.enums.level[computed.crunch_alert.level]}</Plate>
    </div>
  );
  return (
    <>
      <LensHead data={data} title={lastDay ? fill(n.pageTitle, { n: lastDay }) : n.title} aside={aside} locale={locale} m={m} />
      {!f ? (
        <Refusal reason={data.lens_not_run_reason} m={m} />
      ) : f.status === "not_computed" ? (
        <p role="status">
          {n.notComputed} {m.enums.lens_status[f.reason]} ({n.historyDays}: <Num>{formatInt(f.history_days, locale)}</Num>)
        </p>
      ) : (
        <Body f={f} locale={locale} m={m} />
      )}
      <ReceiptPanel receipt={data.receipt} lens={n.title} m={m} />
    </>
  );
}
