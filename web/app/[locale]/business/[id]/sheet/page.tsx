import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { ArabicLogo, EnglishWordmark } from "@/components/brand/Logos";
import { NotServing } from "@/components/LensPage";
import { PrintButton } from "@/components/PrintButton";
import { ShariaLabel } from "@/components/ShariaPanel";
import { ApiError, BackendText, Code, NisabPlate, Num, Plate, ProvenanceLine, Refusal, TableScroll, TD, TH } from "@/components/ui";
import { getAnomaly, getCredit, getForecast, getZakat } from "@/lib/api";
import { decisionPlate } from "@/lib/decision";
import { formatInt, formatRaw, formatSar } from "@/lib/format";
import { fill, getMessages, isLocale, type Locale, type Messages } from "@/lib/i18n";
import { isServingId } from "@/lib/population";
import type { AnomalyResponse, ApiResult, CreditResponse, ForecastResponse, ZakatResponse } from "@/lib/types";

export const dynamic = "force-dynamic";

const STATUS_VARIANT = { scored: "ink", partial_profile: "warn", insufficient_data: "warn" } as const;
const SHARIA_VARIANT = { compliant: "ok", soft_flag_review: "warn", hard_flag: "bad" } as const;

type Props = { params: Promise<{ locale: string; id: string }> };

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="sheet-block flex flex-col gap-2 border-t border-line pt-4">
      <h2 className="heading text-xl">{title}</h2>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(150px,220px)_1fr] gap-x-4 py-0.5">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="break-words">{children}</dd>
    </div>
  );
}

/** A lens that failed to load says so, and the rest of the sheet still prints. */
function Loaded<T>({ result, m, children }: { result: ApiResult<T>; m: Messages; children: (data: T) => ReactNode }) {
  return result.ok ? <>{children(result.data)}</> : <ApiError kind={result.kind} detail={result.detail} m={m} />;
}

function Verdict({ data, locale, m }: { data: CreditResponse; locale: Locale; m: Messages }) {
  const { credit, credit_decision_detail: detail, credit_explanation: explanation } = data;
  const o = m.overview;
  if (!credit || !detail) return <Refusal reason={data.lens_not_run_reason} m={m} />;
  const plate = decisionPlate(credit, detail, m);
  return (
    <>
      <dl>
        <Row label={m.admin.credit}>
          <Plate variant={plate.variant}>{plate.word}</Plate>
        </Row>
        {credit.amount_sar !== null && <Row label={m.credit.amount}>{<Num>{formatSar(credit.amount_sar, locale)}</Num>}</Row>}
        {credit.repayment_months !== null && <Row label={o.repayment}>{fill(o.monthsValue, { n: formatInt(credit.repayment_months, locale) })}</Row>}
        {credit.base_markup_pct !== null && (
          <Row label={o.markupLabel}>
            <Num>{formatRaw(credit.base_markup_pct, locale)}%</Num>
          </Row>
        )}
        <Row label={o.late}>{o.lateValue}</Row>
        {detail.decline_reason && <Row label={m.credit.declineReason}>{m.enums.decline_reason[detail.decline_reason]}</Row>}
      </dl>
      {explanation && explanation.public_tier.length > 0 && (
        <ul className="list-disc ps-5">
          {explanation.public_tier.map((line) => (
            <li key={line.feature_id}>
              <BackendText locale={locale} m={m}>
                {line.text}
              </BackendText>
            </li>
          ))}
        </ul>
      )}
      <p className="text-[13px] text-muted">{m.credit.note}</p>
    </>
  );
}

function Zakat({ data, locale, m }: { data: ZakatResponse; locale: Locale; m: Messages }) {
  const z = data.zakat;
  const n = m.zakat;
  if (!z) return <Refusal reason={data.lens_not_run_reason} m={m} />;
  return (
    <>
      <dl>
        <Row label={m.common.status}>
          <Plate variant={z.status === "computed" ? "ok" : z.status === "zero_liability" ? "ink" : "warn"}>{m.enums.zakat_status[z.status]}</Plate>
        </Row>
        {z.liability_sar != null && (
          <Row label={n.liability}>
            <Num>{formatSar(z.liability_sar, locale)}</Num>
          </Row>
        )}
      </dl>
      <NisabPlate status={z.nisab_source_status} m={m} />
      <p className="text-[13px] text-muted">{n.asReturned}</p>
    </>
  );
}

function Forecast({ data, locale, m }: { data: ForecastResponse; locale: Locale; m: Messages }) {
  const f = data.forecast;
  const n = m.forecast;
  if (!f) return <Refusal reason={data.lens_not_run_reason} m={m} />;
  if (f.status !== "computed") return <p>{n.notComputed} {m.enums.lens_status[f.reason]}</p>;
  const rows = [
    { label: n.model, series: f.model },
    { label: n.baseline, series: f.naive_baseline },
  ];
  return (
    <>
      <dl>
        <Row label={n.balanceToday}>
          <Num>{formatSar(f.balance_today_sar, locale)}</Num>
        </Row>
        <Row label={n.alert}>
          <Plate variant={f.crunch_alert.level === "none" ? "ok" : f.crunch_alert.level === "watch" ? "warn" : "bad"}>{m.enums.level[f.crunch_alert.level]}</Plate>
        </Row>
      </dl>
      <TableScroll label={n.tableLabel}>
      <table className="sheet-table w-full min-w-[560px] text-sm">
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
          {rows.flatMap(({ label, series }) =>
            series.map((row) => (
              <tr key={`${label}${row.horizon_days}`}>
                <td className={TD}>{label}</td>
                <td className={TD}>{fill(n.dayN, { n: formatInt(row.horizon_days, locale) })}</td>
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
    </>
  );
}

function Review({ data, locale, m }: { data: AnomalyResponse; locale: Locale; m: Messages }) {
  const a = data.anomaly;
  if (!a) return <Refusal reason={data.lens_not_run_reason} m={m} />;
  if (a.status !== "computed") return <p>{m.anomaly.notComputed}</p>;
  const counts = new Map<string, number>();
  for (const flag of a.flags) counts.set(flag.flag_reason, (counts.get(flag.flag_reason) ?? 0) + 1);
  return (
    <>
      <dl>
        <Row label={m.anomaly.listed}>
          <Num>{formatInt(a.flags.length, locale)}</Num>
        </Row>
      </dl>
      <ul className="list-disc ps-5">
        {[...counts].map(([reason, count]) => (
          <li key={reason}>
            {m.enums.flag_reason[reason as keyof Messages["enums"]["flag_reason"]]}, <Num>{formatInt(count, locale)}</Num>
          </li>
        ))}
      </ul>
      <p className="text-[13px] text-muted">{m.anomaly.queue}</p>
    </>
  );
}

/** E2: one business on paper. No print timestamp: two prints of the same receipt must not differ. */
export default async function SheetPage({ params }: Props) {
  const { locale, id: rawId } = await params;
  if (!isLocale(locale)) notFound();
  const m = getMessages(locale);
  const id = Number(rawId);
  if (!isServingId(id)) return <NotServing locale={locale} m={m} id={rawId} />;
  const sh = m.sheet;

  // Through the queue, like the overview.
  const credit = getCredit(id);
  const zakat = getZakat(id);
  const forecast = getForecast(id);
  const anomaly = getAnomaly(id);
  const [c, z, f, a] = await Promise.all([credit, zakat, forecast, anomaly]);
  if (!c.ok && c.kind === "not_found") return <NotServing locale={locale} m={m} id={rawId} />;

  return (
    <article aria-label={sh.title} className="sheet mx-auto flex w-full max-w-[860px] flex-col gap-4 px-6 pb-16 pt-8 print:max-w-none print:px-0 print:pt-0">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 text-accent">
          <ArabicLogo height={34} />
          <EnglishWordmark height={14} />
        </div>
        <PrintButton label={sh.print} />
      </div>
      <h1 className="heading text-[30px]">{fill(sh.heading, { id })}</h1>
      {c.ok ? (
        <>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span>
              {m.common.business} <Num>{id}</Num>
            </span>
            <span>
              {m.common.sector}: {m.enums.sector[c.data.sector]}
            </span>
            <Plate variant={STATUS_VARIANT[c.data.status]}>{m.enums.status[c.data.status]}</Plate>
          </div>
          <ProvenanceLine value={c.data} locale={locale} m={m} />
        </>
      ) : (
        <ApiError kind={c.kind} detail={c.detail} m={m} />
      )}

      <Block title={sh.verdict}>
        <Loaded result={c} m={m}>
          {(data) => <Verdict data={data} locale={locale} m={m} />}
        </Loaded>
      </Block>
      <Block title={m.sharia.title}>
        <Loaded result={c} m={m}>
          {(data) => (
            <>
              <ShariaLabel m={m} />
              <dl>
                <Row label={m.common.status}>
                  <Plate variant={SHARIA_VARIANT[data.sharia_screen.sharia_screen_status]}>{m.enums.sharia[data.sharia_screen.sharia_screen_status]}</Plate>
                </Row>
                <Row label={m.sharia.ruleTableStatus}>
                  <Code>{data.sharia_screen.rule_table_status}</Code>
                </Row>
              </dl>
            </>
          )}
        </Loaded>
      </Block>
      <Block title={m.zakat.title}>
        <Loaded result={z} m={m}>
          {(data) => <Zakat data={data} locale={locale} m={m} />}
        </Loaded>
      </Block>
      <Block title={m.forecast.title}>
        <Loaded result={f} m={m}>
          {(data) => <Forecast data={data} locale={locale} m={m} />}
        </Loaded>
      </Block>
      <Block title={m.anomaly.title}>
        <Loaded result={a} m={m}>
          {(data) => <Review data={data} locale={locale} m={m} />}
        </Loaded>
      </Block>
      <Block title={sh.receipt}>
        <Loaded result={c} m={m}>
          {(data) => {
            const { scope, ...fields } = data.receipt;
            return (
              <>
                <dl className="text-xs">
                  {Object.entries(fields).map(([key, value]) => (
                    <Row key={key} label={<Code>{key}</Code>}>
                      <Code>{String(value)}</Code>
                    </Row>
                  ))}
                </dl>
                <p lang="en" dir="ltr" className="text-start text-xs">
                  {scope}
                </p>
              </>
            );
          }}
        </Loaded>
      </Block>
    </article>
  );
}
