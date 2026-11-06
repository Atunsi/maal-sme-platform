import { ForecastChart, type ForecastPoint } from "@/components/ForecastChart";
import { ReceiptPanel } from "@/components/ReceiptPanel";
import { BackendText, Badge, Card, Field, Fields, Num, ProvenanceLine, Refusal, SubHeading, TableScroll, TD, TH } from "@/components/ui";
import { formatInt, formatRaw, formatSar } from "@/lib/format";
import { fill, type Locale, type Messages } from "@/lib/i18n";
import type { ForecastResponse } from "@/lib/types";

const LEVEL_TONE = { none: "good", watch: "warn", crunch: "bad" } as const;

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

function Body({ f, locale, m }: { f: Computed; locale: Locale; m: Messages }) {
  const n = m.forecast;
  const alert = f.crunch_alert;
  const series = [
    { label: n.model, rows: f.model },
    { label: n.baseline, rows: f.naive_baseline },
  ];
  const hazard = (["30d", "60d", "90d"] as const).map((key) => {
    const value = alert.liquidity_hazard[key];
    return `${key}: ${value === null ? m.common.dash : formatRaw(value, locale)}`;
  });
  return (
    <>
      <p className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted">{n.alert}</span>
        <Badge tone={LEVEL_TONE[alert.level]}>{m.enums.level[alert.level]}</Badge>
      </p>
      <Fields>
        <Field label={n.balanceToday}>
          <Num>{formatSar(f.balance_today_sar, locale)}</Num>
        </Field>
        <Field label={n.daysToNegative}>
          {alert.days_to_projected_negative_balance === null ? (
            m.common.dash
          ) : (
            <Num>{formatInt(alert.days_to_projected_negative_balance, locale)}</Num>
          )}
        </Field>
        <Field label={n.hazard}>
          <Num>{hazard.join(" · ")}</Num>
        </Field>
        <Field label={n.ramadan}>
          {f.ramadan_adjusted === null ? m.common.dash : f.ramadan_adjusted ? m.common.yes : m.common.no}
        </Field>
      </Fields>
      {alert.drivers.length > 0 && (
        <>
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
        </>
      )}
      <SubHeading>{n.chartTitle}</SubHeading>
      <ForecastChart
        data={points(f)}
        locale={locale}
        labels={{ model: n.model, baseline: n.baseline, day: n.dayN, alt: n.chartAlt }}
      />
      <p className="mt-1 text-sm text-muted">{n.chartNote}</p>
      <div className="mt-3">
        <TableScroll label={n.chartTitle}>
          <table className="w-full">
            <thead>
              <tr>
                {[n.series, n.horizon, n.projected, n.minimum, n.netFlow].map((label) => (
                  <th key={label} scope="col" className={TH}>
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {series.flatMap(({ label, rows }) =>
                rows.map((row) => (
                  <tr key={`${label}-${row.horizon_days}`}>
                    <td className={TD}>{label}</td>
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
      </div>
      <div className="mt-3 text-sm">
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
  return (
    <Card id="forecast" title={m.forecast.title}>
      <ProvenanceLine value={data} locale={locale} m={m} />
      {!f ? (
        <Refusal reason={data.lens_not_run_reason} m={m} />
      ) : f.status === "not_computed" ? (
        <p role="status">
          {m.forecast.notComputed} {m.enums.lens_status[f.reason]} ({m.forecast.historyDays}:{" "}
          <Num>{formatInt(f.history_days, locale)}</Num>)
        </p>
      ) : (
        <Body f={f} locale={locale} m={m} />
      )}
      <ReceiptPanel receipt={data.receipt} lens={m.forecast.title} m={m} />
    </Card>
  );
}
