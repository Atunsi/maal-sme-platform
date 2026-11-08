import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { SectionMark } from "@/components/brand/Logos";
import { BusinessPicker } from "@/components/BusinessPicker";
import { Num, Page, Plate, TableScroll, type PlateVariant } from "@/components/ui";
import { getCredit, getHealth } from "@/lib/api";
import { DEMO_BUSINESSES, roleQuery } from "@/lib/businesses";
import { formatInt } from "@/lib/format";
import { fill, getMessages, isLocale, type Locale, type Messages } from "@/lib/i18n";
import { SERVING_ID_MAX, SERVING_ID_MIN } from "@/lib/population";
import type { ApiResult, CreditResponse } from "@/lib/types";

export const dynamic = "force-dynamic";

const STATUS_VARIANT = { scored: "ink", partial_profile: "warn", insufficient_data: "warn" } as const;

function creditPlate(data: CreditResponse, m: Messages): { variant: PlateVariant; word: string } {
  const { credit, credit_decision_detail: detail } = data;
  if (!credit || !detail) return { variant: "ink", word: m.admin.notRun };
  if (credit.decision === "declined") return { variant: "bad", word: m.enums.decision.declined };
  return { variant: detail.offer_status === "unconditional" ? "ok" : "warn", word: m.enums.decision.approved };
}

/** What each row demonstrates, read from the response. Nothing here is typed per business. */
function shows(data: CreditResponse, m: Messages): string {
  const a = m.admin;
  const detail = data.credit_decision_detail;
  if (!data.credit || !detail) return a.showsRefused;
  if (data.status === "partial_profile") return a.showsPartial;
  if (detail.decline_reason) return fill(a.showsDeclined, { reason: m.enums.decline_reason[detail.decline_reason] });
  return detail.offer_status === "conditional_on_sharia_review" ? a.showsConditional : a.showsUnconditional;
}

type RowProps = { id: number; result: Promise<ApiResult<CreditResponse>>; locale: Locale; m: Messages; index: number; query: string };

async function Row({ id, result, locale, m, index, query }: RowProps) {
  const r = await result;
  const a = m.admin;
  const cell = "px-6 py-4.5";
  const plate = r.ok ? creditPlate(r.data, m) : null;
  return (
    <tr className="row-pick rise border-t border-line2" style={{ animationDelay: `${(0.3 + index * 0.1).toFixed(2)}s` }}>
      <th scope="row" className={`${cell} text-start font-mono text-lg font-normal`}>
        <Num>{id}</Num>
      </th>
      {r.ok ? (
        <>
          <td className={cell}>
            <Plate variant={STATUS_VARIANT[r.data.status]}>{m.enums.status[r.data.status]}</Plate>
          </td>
          <td className={cell}>
            <Plate variant={plate!.variant}>{plate!.word}</Plate>
          </td>
          <td className={`${cell} text-sm text-muted`}>{shows(r.data, m)}</td>
        </>
      ) : (
        <td colSpan={3} className={`${cell} text-sm text-bad`}>
          {a.error} {m.errors[r.kind]}
        </td>
      )}
      <td className={`${cell} text-end`}>
        <Link href={`/${locale}/business/${id}${query}`} className="textlink font-semibold">
          {fill(a.open, { id })}
        </Link>
      </td>
    </tr>
  );
}

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ as?: string | string[] }>;
};

export default async function AdminPage({ params, searchParams }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const m = getMessages(locale);
  const a = m.admin;
  const p = m.picker;
  const query = roleQuery((await searchParams).as);
  // The queue runs in call order, so the quick health check goes first and the page need not wait
  // for the rows. Each row's status and decision come from the API, never from this file.
  const healthResult = getHealth();
  const rows = DEMO_BUSINESSES.map((id) => ({ id, result: getCredit(id) }));
  const health = await healthResult;
  const range = { min: String(SERVING_ID_MIN), max: String(SERVING_ID_MAX) };
  const th = "px-6 py-4 font-medium";
  return (
    <Page>
      <div className="rise flex flex-wrap items-end justify-between gap-5">
        <div>
          <div className="flex items-center gap-2.5 text-muted">
            <SectionMark />
            <span className="eyebrow">{a.eyebrow}</span>
          </div>
          <h1 className="heading mt-2 text-[40px] sm:text-[52px]">{a.title}</h1>
          <span aria-hidden="true" className="verdict-rule mt-3.5 w-[120px] text-gold" style={{ height: 5, animationDelay: "0.3s" }} />
        </div>
        <BusinessPicker
          locale={locale}
          query={query}
          labels={{ input: p.inputLabel, help: fill(p.inputHelp, range), submit: p.submit, invalid: fill(p.invalid, range) }}
        />
      </div>

      <div className="rise border border-line bg-card" style={{ animationDelay: "0.2s" }}>
        <TableScroll label={a.tableLabel}>
        <table className="w-full min-w-[820px] border-collapse">
          <thead>
            <tr className="text-start text-[13px] text-muted">
              <th scope="col" className={`${th} text-start`}>
                {a.business}
              </th>
              <th scope="col" className={`${th} text-start`}>
                {a.profile}
              </th>
              <th scope="col" className={`${th} text-start`}>
                {a.credit}
              </th>
              <th scope="col" className={`${th} text-start`}>
                {a.shows}
              </th>
              <th scope="col" className={th}>
                <span className="sr-only">{a.openColumn}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ id, result }, index) => (
              <Suspense
                key={id}
                fallback={
                  <tr>
                    <td colSpan={5} className="px-6 py-4 text-muted">
                      {m.common.loading}
                    </td>
                  </tr>
                }
              >
                <Row id={id} result={result} locale={locale} m={m} index={index} query={query} />
              </Suspense>
            ))}
          </tbody>
        </table>
        </TableScroll>
      </div>
      <p className="text-[13px] text-muted">
        {health.ok ? fill(a.note, { n: formatInt(health.data.serving_businesses, locale) }) : p.unavailable}
      </p>
    </Page>
  );
}
