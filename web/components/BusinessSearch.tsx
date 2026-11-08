import Link from "next/link";
import type { Locale } from "@/lib/i18n";

type Labels = { search: string; searchLabel: string; searchHelp: string; sectorLabel: string; anySector: string; clear: string };

/**
 * E10: search the admin list by the start of a business ID and by sector. A plain GET form, so the page
 * works without JavaScript; the server reads ?q= and ?sector= and asks GET /businesses. Nothing here can
 * reach a term (U1: a named entry in the input allowlist).
 */
export function BusinessSearch({ locale, role, q, sector, sectors, labels }: { locale: Locale; role: string | null; q: string; sector: string; sectors: { value: string; label: string }[]; labels: Labels }) {
  return (
    <form method="get" action={`/${locale}/admin`} className="flex flex-wrap items-end gap-3" role="search">
      {role && <input type="hidden" name="as" value={role} />}
      <label className="flex flex-col gap-1 self-start text-sm font-medium">
        {labels.searchLabel}
        <input
          name="q"
          defaultValue={q}
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={9}
          dir="ltr"
          aria-describedby="search-help"
          autoComplete="off"
          className="field w-44 font-mono"
        />
        <span id="search-help" className="text-xs font-normal text-muted">
          {labels.searchHelp}
        </span>
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        {labels.sectorLabel}
        <select name="sector" defaultValue={sector} className="field min-w-48">
          <option value="">{labels.anySector}</option>
          {sectors.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </label>
      <div className="flex items-center gap-3">
        <button type="submit" className="solid-btn min-h-12">
          {labels.search}
        </button>
        {(q || sector) && (
          <Link href={`/${locale}/admin${role ? `?as=${role}` : ""}`} className="textlink">
            {labels.clear}
          </Link>
        )}
      </div>
    </form>
  );
}
