import Link from "next/link";
import type { ReactNode } from "react";
import { Num, Plate, type PlateVariant } from "@/components/ui";
import { decisionPlate } from "@/lib/decision";
import { formatInt, formatRaw, formatSar } from "@/lib/format";
import { fill, type Locale, type Messages } from "@/lib/i18n";
import { nisabPlate } from "@/lib/nisab";
import type { AnomalyResponse, CreditResponse, ForecastResponse, ZakatResponse } from "@/lib/types";

const SHARIA_VARIANT = { compliant: "ok", soft_flag_review: "warn", hard_flag: "bad" } as const;
const LEVEL_VARIANT = { none: "ok", watch: "warn", crunch: "bad" } as const;
const ZAKAT_VARIANT = { computed: "ok", zero_liability: "ink", not_computed: "warn" } as const;

/** What one card shows: a word on a plate, one figure and one line, all read from the response. */
type Readout = { variant: PlateVariant; state: string; figure: ReactNode; note: string };

type Fn<T> = (data: T, locale: Locale, m: Messages) => Readout;

// U10: a lens that did not run says so on its card, and no figure stands in for it.
const refused = (m: Messages): Readout => ({ variant: "warn", state: m.refusal.title, figure: m.common.dash, note: m.enums.lens_status.insufficient_data });

export const creditReadout: Fn<CreditResponse> = (data, locale, m) => {
  const { credit, credit_decision_detail: detail } = data;
  if (!credit || !detail) return refused(m);
  const plate = decisionPlate(credit, detail, m);
  return {
    variant: plate.variant,
    state: plate.word,
    figure: credit.amount_sar === null ? m.common.dash : <Num>{formatSar(credit.amount_sar, locale)}</Num>,
    note: detail.offer_status ? m.enums.offer_status[detail.offer_status] : detail.decline_reason ? m.enums.decline_reason[detail.decline_reason] : m.common.dash,
  };
};

export const shariaReadout: Fn<CreditResponse> = (data, _locale, m) => {
  const s = data.sharia_screen;
  return {
    variant: SHARIA_VARIANT[s.sharia_screen_status],
    state: m.enums.sharia[s.sharia_screen_status],
    figure: s.declared_mcc === null ? m.overview.noMcc : <Num>{fill(m.overview.mcc, { v: s.declared_mcc })}</Num>,
    note: m.sharia.label, // U6: the fixed label, on every Sharia display
  };
};

export const zakatReadout: Fn<ZakatResponse> = (data, locale, m) => {
  const z = data.zakat;
  if (!z) return refused(m);
  const shown = z.status !== "not_computed" && z.liability_sar !== null;
  return {
    variant: ZAKAT_VARIANT[z.status],
    state: m.enums.zakat_status[z.status],
    figure: shown ? <Num>{formatSar(z.liability_sar!, locale)}</Num> : m.common.dash,
    note: nisabPlate(z.nisab_source_status, m)?.words ?? m.zakat.nisab,
  };
};

export const forecastReadout: Fn<ForecastResponse> = (data, locale, m) => {
  const f = data.forecast;
  if (!f) return refused(m);
  if (f.status === "not_computed") return { variant: "warn", state: m.enums.zakat_status.not_computed, figure: m.common.dash, note: m.enums.lens_status[f.reason] };
  const alert = f.crunch_alert;
  const hazard = alert.liquidity_hazard["30d"];
  const days = alert.days_to_projected_negative_balance;
  return {
    variant: LEVEL_VARIANT[alert.level],
    state: m.enums.level[alert.level],
    figure: hazard === null ? m.common.dash : <Num>{fill(m.overview.hazard30, { v: formatRaw(hazard, locale) })}</Num>,
    note: days === null ? m.overview.noNegative : fill(m.overview.negativeIn, { n: formatInt(days, locale) }),
  };
};

export const reviewReadout: Fn<AnomalyResponse> = (data, locale, m) => {
  const a = data.anomaly;
  if (!a) return refused(m);
  if (a.status === "not_computed") return { variant: "warn", state: m.enums.zakat_status.not_computed, figure: m.common.dash, note: m.enums.lens_status[a.reason] };
  return {
    variant: "ink",
    state: fill(m.overview.listed, { n: formatInt(a.flags.length, locale) }),
    figure: fill(m.overview.scanned, { n: formatInt(a.transactions_scanned, locale) }),
    note: m.overview.queueNote,
  };
};

type CardProps = { lens: string; href: string; readout: Readout; partial?: string; index: number; m: Messages };

export function ReadoutCard({ lens, href, readout, partial, index, m }: CardProps) {
  return (
    <Link
      href={href}
      className="lift rise flex min-h-[200px] flex-col gap-2.5 border border-line bg-card p-5 text-ink no-underline"
      style={{ animationDelay: `${(1.2 + index * 0.12).toFixed(2)}s` }}
    >
      <span className="text-[13px] text-muted">{lens}</span>
      <span>
        <Plate variant={readout.variant}>{readout.state}</Plate>
      </span>
      <span className="font-mono text-[17px]">{readout.figure}</span>
      <span className="text-[13px] text-muted">{readout.note}</span>
      {partial && <span className="text-[13px] text-warn">{partial}</span>}
      <span className="mt-auto text-sm font-semibold text-accent">{fill(m.overview.open, { lens })}</span>
    </Link>
  );
}
