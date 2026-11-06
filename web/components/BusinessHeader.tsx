import type { ReactNode } from "react";
import { SectionMark } from "@/components/brand/Logos";
import { Code, Num, Plate, ProvenanceLine } from "@/components/ui";
import { formatDate, formatInt } from "@/lib/format";
import { fill, type Locale, type Messages } from "@/lib/i18n";
import type { ProfileResponse } from "@/lib/types";

const STATUS_VARIANT = { scored: "ok", partial_profile: "warn", insufficient_data: "warn" } as const;

/** The fields every API response opens with. */
export type Head = Pick<
  ProfileResponse,
  "business_id" | "population" | "data_source" | "sector" | "as_of" | "status" | "coverage_days_90d" | "partial_profile_unavailable_features"
>;

type Base = { data: Head; locale: Locale; m: Messages };

function MetaRow({ data, locale, m }: Base) {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1 font-mono text-[13px] text-muted">
      <SectionMark />
      <span className="uppercase">{fill(m.dashboard.title, { id: data.business_id })}</span>
      <span>{m.enums.sector[data.sector]}</span>
      <span>
        {m.common.asOf} <bdi>{formatDate(data.as_of, locale)}</bdi>
      </span>
    </div>
  );
}

/** U10: a partial profile keeps its explicit state, with the features it lacks, on every page. */
function PartialNote({ data, m }: Pick<Base, "data" | "m">) {
  if (data.status !== "partial_profile") return null;
  return (
    <div>
      <p className="text-sm">{m.partial.body}</p>
      <ul className="mt-1 flex flex-wrap gap-2">
        {(data.partial_profile_unavailable_features ?? []).map((feature) => (
          <li key={feature}>
            <Code>{feature}</Code>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The overview's identity block. */
export function BusinessHeader({ data, locale, m }: Base) {
  return (
    <div className="flex flex-col gap-2">
      <MetaRow data={data} locale={locale} m={m} />
      <div className="flex flex-wrap items-center gap-3 text-sm text-muted">
        <Plate variant={STATUS_VARIANT[data.status]}>{m.enums.status[data.status]}</Plate>
        <span>
          {m.common.coverage}:{" "}
          {data.coverage_days_90d === null ? m.common.dash : <Num>{formatInt(data.coverage_days_90d, locale)}</Num>}
        </span>
      </div>
      <ProvenanceLine value={data} locale={locale} m={m} />
      <PartialNote data={data} m={m} />
    </div>
  );
}

/** The top of a lens page. A scored business needs no status plate; any other state shows its own. */
export function LensHead({ data, title, aside, locale, m }: Base & { title: string; aside?: ReactNode }) {
  return (
    <div className="rise flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <MetaRow data={data} locale={locale} m={m} />
          <h1 className="heading mt-2 text-[40px] sm:text-[52px]">{title}</h1>
        </div>
        {aside}
      </div>
      {data.status !== "scored" && (
        <p>
          <Plate variant={STATUS_VARIANT[data.status]}>{m.enums.status[data.status]}</Plate>
        </p>
      )}
      <ProvenanceLine value={data} locale={locale} m={m} />
      <PartialNote data={data} m={m} />
    </div>
  );
}
