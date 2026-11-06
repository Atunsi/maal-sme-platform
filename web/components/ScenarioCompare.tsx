import type { ReactNode } from "react";
import { ReceiptPanel } from "@/components/ReceiptPanel";
import { ShariaLabel } from "@/components/ShariaPanel";
import { Badge, Num, ProvenanceLine, Refusal, SubHeading, TableScroll, TD, TH } from "@/components/ui";
import { formatInt, formatRaw, formatSar } from "@/lib/format";
import type { Locale, Messages } from "@/lib/i18n";
import type { ScenarioObject } from "@/lib/types";

const DECISION_TONE = { approved: "good", declined: "bad" } as const;
const LEVEL_TONE = { none: "good", watch: "warn", crunch: "bad" } as const;
const SHARIA_TONE = { compliant: "good", soft_flag_review: "warn", hard_flag: "bad" } as const;

type FlagReason = NonNullable<Extract<ScenarioObject["anomaly"], { status: "computed" }>>["flags"][number]["flag_reason"];

function flagReasons(o: ScenarioObject): Partial<Record<FlagReason, number>> {
  const counts: Partial<Record<FlagReason, number>> = {};
  for (const flag of o.anomaly?.flags ?? []) counts[flag.flag_reason] = (counts[flag.flag_reason] ?? 0) + 1;
  return counts;
}

/** One column of values, every one read from the object. A lens that did not run says so (U10). */
function column(o: ScenarioObject, locale: Locale, m: Messages): Record<string, ReactNode> {
  const notRun = m.refusal.title;
  const detail = o.credit_decision_detail;
  const alert = o.forecast?.status === "computed" ? o.forecast.crunch_alert : null;
  const reasons = Object.entries(flagReasons(o)) as [FlagReason, number][];
  return {
    decision: o.credit ? <Badge tone={DECISION_TONE[o.credit.decision]}>{m.enums.decision[o.credit.decision]}</Badge> : notRun,
    declineOrigin: detail?.decline_origin ? m.enums.decline_origin[detail.decline_origin] : o.credit ? m.common.dash : notRun,
    amount: !o.credit ? notRun : o.credit.amount_sar === null ? m.common.dash : <Num>{formatSar(o.credit.amount_sar, locale)}</Num>,
    pd: detail ? <Num>{formatRaw(detail.pd, locale)}</Num> : notRun,
    alert: alert ? <Badge tone={LEVEL_TONE[alert.level]}>{m.enums.level[alert.level]}</Badge> : notRun,
    days: !alert ? notRun : alert.days_to_projected_negative_balance === null ? m.common.dash : (
      <Num>{formatInt(alert.days_to_projected_negative_balance, locale)}</Num>
    ),
    flags: o.anomaly ? <Num>{formatInt(o.anomaly.flags.length, locale)}</Num> : notRun,
    reasons: o.anomaly ? (
      <ul>
        {reasons.map(([reason, count]) => (
          <li key={reason}>
            {m.enums.flag_reason[reason]}: <Num>{formatInt(count, locale)}</Num>
          </li>
        ))}
      </ul>
    ) : (
      notRun
    ),
    // U10: a Zakat calculation that did not run shows no amount.
    zakat: !o.zakat ? notRun : o.zakat.status === "not_computed" || o.zakat.liability_sar === null ? m.common.dash : (
      <Num>{formatSar(o.zakat.liability_sar, locale)}</Num>
    ),
    zakatStatus: o.zakat ? m.enums.zakat_status[o.zakat.status] : notRun,
    sharia: (
      <Badge tone={SHARIA_TONE[o.governance.sharia_screen.sharia_screen_status]}>
        {m.enums.sharia[o.governance.sharia_screen.sharia_screen_status]}
      </Badge>
    ),
  };
}

type Props = { baseline: ScenarioObject; chosen: ScenarioObject; locale: Locale; m: Messages };

export function ScenarioCompare({ baseline, chosen, locale, m }: Props) {
  const s = m.scenarios;
  const rows: [keyof ReturnType<typeof column> & string, string][] = [
    ["decision", m.credit.decision],
    ["declineOrigin", m.credit.declineOrigin],
    ["amount", m.credit.amount],
    ["pd", s.pd],
    ["alert", m.forecast.alert],
    ["days", m.forecast.daysToNegative],
    ["flags", m.anomaly.listed],
    ["reasons", m.anomaly.reason],
    ["zakat", m.zakat.liability],
    ["zakatStatus", m.zakat.statusLabel],
    ["sharia", m.sharia.title],
  ];
  const left = column(baseline, locale, m);
  const right = column(chosen, locale, m);
  const placeholder = [baseline, chosen].some((o) => o.zakat?.nisab_source_status === "placeholder_unverified");
  const note = <p className="mb-2 text-sm">{s.receiptNote}</p>;
  return (
    <div data-testid="scenario-compare">
      <ProvenanceLine value={chosen} locale={locale} m={m} />
      {chosen.status === "insufficient_data" && (
        <div className="mb-3">
          <Refusal reason={chosen.lenses_not_run_reason} m={m} />
        </div>
      )}
      <TableScroll label={s.compareLabel}>
        <table className="w-full">
          <thead>
            <tr>
              <th scope="col" className={TH}>
                {s.measure}
              </th>
              <th scope="col" className={TH}>
                {s.baseline}
              </th>
              <th scope="col" className={TH}>
                {s.chosen}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([key, label]) => (
              <tr key={key}>
                <th scope="row" className={`${TD} text-start font-medium`}>
                  {label}
                </th>
                <td className={TD}>{left[key]}</td>
                <td className={TD}>{right[key]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableScroll>
      <div className="mt-3 flex flex-wrap gap-2">
        <ShariaLabel m={m} />
        {placeholder && <Badge tone="warn">{m.zakat.placeholder}</Badge>}
      </div>
      <p className="mt-3 text-sm">{m.anomaly.queue}</p>
      <SubHeading>{s.receipts}</SubHeading>
      <ReceiptPanel receipt={baseline.receipt} lens={s.baseline} m={m} note={note} />
      <ReceiptPanel receipt={chosen.receipt} lens={s.chosen} m={m} note={note} />
    </div>
  );
}
