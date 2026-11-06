import { Plate, Code, Field, Fields, Num, ProvenanceLine } from "@/components/ui";
import { formatInt } from "@/lib/format";
import { fill, type Locale, type Messages } from "@/lib/i18n";
import type { ProfileResponse } from "@/lib/types";

const STATUS_TONE = { scored: "ok", partial_profile: "warn", insufficient_data: "ink" } as const;

export function BusinessHeader({ data, locale, m }: { data: ProfileResponse; locale: Locale; m: Messages }) {
  return (
    <header className="rounded-lg border border-line bg-card p-5">
      <div className="mb-2 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">{fill(m.dashboard.title, { id: data.business_id })}</h1>
        <Plate variant={STATUS_TONE[data.status]}>{m.enums.status[data.status]}</Plate>
      </div>
      <ProvenanceLine value={data} locale={locale} m={m} />
      <Fields>
        <Field label={m.common.sector}>{m.enums.sector[data.sector]}</Field>
        <Field label={m.common.coverage}>
          {data.coverage_days_90d === null ? m.common.dash : <Num>{formatInt(data.coverage_days_90d, locale)}</Num>}
        </Field>
      </Fields>
      {data.status === "partial_profile" && (
        <div className="mt-3">
          <p className="text-sm">{m.partial.body}</p>
          <ul className="mt-1 flex flex-wrap gap-2">
            {(data.partial_profile_unavailable_features ?? []).map((feature) => (
              <li key={feature}>
                <Code>{feature}</Code>
              </li>
            ))}
          </ul>
        </div>
      )}
    </header>
  );
}
