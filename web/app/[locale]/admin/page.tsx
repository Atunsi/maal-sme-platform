import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { SectionMark } from "@/components/brand/Logos";
import { BusinessPicker } from "@/components/BusinessPicker";
import { AllBusinesses, PAGE_SIZE } from "@/components/AllBusinesses";
import { BusinessSearch } from "@/components/BusinessSearch";
import { Num, Page, Plate, TableScroll } from "@/components/ui";
import { getBusinesses, getCredit } from "@/lib/api";
import { DEMO_BUSINESSES, roleQuery } from "@/lib/businesses";
import { creditPlate } from "@/lib/decision";
import { fill, getMessages, isLocale, type Locale, type Messages } from "@/lib/i18n";
import { nameOf } from "@/lib/business-names";
import { searchOf, STATIC } from "@/lib/static-data";
import { SERVING_ID_MAX, SERVING_ID_MIN } from "@/lib/population";
import type { ApiResult, CreditResponse } from "@/lib/types";
import { delay } from "@/lib/motion";

const STATUS_VARIANT = { scored: "ink", partial_profile: "warn", insufficient_data: "warn" } as const;

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
    <tr className="row-pick rise border-t border-line2" style={{ animationDelay: delay(2 + index) }}>
      {/* The admin sees both: the business's display name, and its ID, which the API, receipts and search use. */}
      <th scope="row" className={`${cell} text-start font-normal`}>
        <span className="block font-semibold">{nameOf(id, locale)}</span>
        <span className="block font-mono text-sm text-muted">
          <Num>{id}</Num>
        </span>
      </th>
      {r.ok ? (
        <>
          <td className={cell} data-label={a.profile}>
            <Plate variant={STATUS_VARIANT[r.data.status]}>{m.enums.status[r.data.status]}</Plate>
          </td>
          <td className={cell} data-label={a.credit}>
            <Plate variant={plate!.variant}>{plate!.word}</Plate>
          </td>
          <td className={`${cell} text-sm text-muted`} data-label={a.shows}>
            {shows(r.data, m)}
          </td>
        </>
      ) : (
        <td colSpan={3} className={`${cell} text-sm text-bad`}>
          {a.error} {m.errors[r.kind]}
        </td>
      )}
      <td className={`${cell} text-end`}>
        <Link href={`/${locale}/business/${id}${query}`} data-latin className="textlink font-semibold">
          {fill(a.open, { id, name: nameOf(id, locale) })}
        </Link>
      </td>
    </tr>
  );
}

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ as?: string | string[]; q?: string | string[]; sector?: string | string[]; page?: string | string[] }>;
};

export default async function AdminPage({ params, searchParams }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const m = getMessages(locale);
  const a = m.admin;
  const p = m.picker;
  const search = await searchOf(searchParams);
  const query = roleQuery(search.as);
  const role = query ? query.replace("?as=", "") : null;
  // E10: search, sector and page live in the URL and are handled here, so the list works without JS.
  const q = /^[0-9]{1,9}$/.test(one(search.q)) ? one(search.q) : "";
  const sector = one(search.sector) in m.enums.sector ? one(search.sector) : "";
  const page = Math.max(1, Number.parseInt(one(search.page), 10) || 1);
  const links = (n: number) => {
    const params = new URLSearchParams();
    if (role) params.set("as", role);
    if (q) params.set("q", q);
    if (sector) params.set("sector", sector);
    if (n > 1) params.set("page", String(n));
    const s = params.toString();
    return `/${locale}/admin${s ? `?${s}` : ""}`;
  };
  // The queue runs in call order. The list goes first and is awaited: it is a quick store read, and a
  // streamed boundary would stay hidden without JavaScript. The five demo rows then stream in. Each row's
  // status and decision come from the API, never from this file.
  // The online snapshot holds a few dozen businesses and cannot search on a server: one page, all of them.
  const list = STATIC ? getBusinesses({ offset: 0, limit: 50 }) : getBusinesses({ offset: (page - 1) * PAGE_SIZE, limit: PAGE_SIZE, sector: sector || undefined, q: q || undefined });
  const rows = DEMO_BUSINESSES.map((id) => ({ id, result: getCredit(id) }));
  const listView = await AllBusinesses({ result: list, locale, m, query, links, page });
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
          <span aria-hidden="true" className="verdict-rule mt-3.5 w-[120px] text-gold" style={{ height: 5, animationDelay: delay(3) }} />
        </div>
        <BusinessPicker
          locale={locale}
          query={query}
          labels={{ input: p.inputLabel, help: fill(p.inputHelp, range), submit: p.submit, invalid: fill(p.invalid, range) }}
        />
      </div>

      <div className="rise border border-line bg-card" style={{ animationDelay: delay(2) }}>
        <TableScroll label={a.tableLabel}>
        <table className="stack-sm w-full border-collapse md:min-w-[820px]">
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

      <section aria-labelledby="all" className="flex flex-col gap-4">
        <h2 id="all" className="heading text-[28px]">
          {a.allTitle}
        </h2>
        {!STATIC && (
          <BusinessSearch
            locale={locale}
            role={role}
            q={q}
            sector={sector}
            sectors={Object.entries(m.enums.sector).map(([value, label]) => ({ value, label }))}
            labels={{ search: a.search, searchLabel: a.searchLabel, searchHelp: a.searchHelp, sectorLabel: a.sectorLabel, anySector: a.anySector, clear: a.clear }}
          />
        )}
        {listView}
      </section>
    </Page>
  );
}
