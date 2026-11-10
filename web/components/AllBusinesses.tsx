import Link from "next/link";
import { ApiError, Num, TableScroll } from "@/components/ui";
import { formatInt } from "@/lib/format";
import { fill, type Locale, type Messages } from "@/lib/i18n";
import type { ApiResult, BusinessesResponse } from "@/lib/types";
import { nameOf } from "@/lib/business-names";

/** E10: rows per page of the "All businesses" table. */
export const PAGE_SIZE = 25;

type ListProps = { result: Promise<ApiResult<BusinessesResponse>>; locale: Locale; m: Messages; query: string; links: (page: number) => string; page: number };

/** E10: one page of GET /businesses. No lens call per row: ID, sector and a link only. */
export async function AllBusinesses({ result, locale, m, query, links, page }: ListProps) {
  const r = await result;
  const a = m.admin;
  if (!r.ok) return <ApiError kind={r.kind} detail={r.detail} m={m} />;
  const { total, businesses } = r.data;
  // One page when every match is already here (the online snapshot lists all of its few at once).
  const pages = businesses.length >= total ? 1 : Math.max(1, Math.ceil(total / PAGE_SIZE));
  const th = "border-b border-line px-6 py-3 text-start text-[13px] font-medium text-muted";
  return (
    <>
      <p className="text-sm">
        <Num>{formatInt(total, locale)}</Num> {fill(a.total, { n: "" }).trim()}
      </p>
      {businesses.length === 0 ? (
        <p className="text-muted">{a.none}</p>
      ) : (
        <div className="border border-line bg-card">
          <TableScroll label={a.allTable}>
            <table data-phone="link-rows" className="stack-sm w-full border-collapse md:min-w-[480px]">
              <thead>
                <tr>
                  <th scope="col" className={th}>
                    {a.business}
                  </th>
                  <th scope="col" className={th}>
                    {a.sector}
                  </th>
                  <th scope="col" className={th}>
                    <span className="sr-only">{a.openColumn}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {businesses.map((b) => (
                  <tr key={b.business_id} className="row-pick border-t border-line2">
                    <th scope="row" className="px-6 py-2 text-start font-normal">
                      <span className="block font-semibold">{nameOf(b.business_id, locale)}</span>
                      <span className="block font-mono text-sm text-muted">
                        <Num>{b.business_id}</Num>
                      </span>
                    </th>
                    <td className="px-6 py-2 text-sm" data-label={a.sector}>
                      {m.enums.sector[b.sector]}
                    </td>
                    <td className="px-6 py-2 text-end">
                      <Link href={`/${locale}/business/${b.business_id}${query}`} data-latin className="textlink font-semibold">
                        {fill(a.openRow, { id: b.business_id, name: nameOf(b.business_id, locale) })}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        </div>
      )}
      {pages > 1 && (
        <nav aria-label={a.allTable} className="flex flex-wrap items-center gap-4 text-sm">
          {page > 1 && (
            <Link href={links(page - 1)} className="textlink font-semibold" rel="prev">
              {a.prev}
            </Link>
          )}
          <span className="text-muted">{fill(a.page, { x: formatInt(page, locale), y: formatInt(pages, locale) })}</span>
          {page < pages && (
            <Link href={links(page + 1)} className="textlink font-semibold" rel="next">
              {a.next}
            </Link>
          )}
        </nav>
      )}
    </>
  );
}
