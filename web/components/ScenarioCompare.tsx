import type { ReactNode } from "react";
import { ReceiptPanel } from "@/components/ReceiptPanel";
import { ShariaLabel } from "@/components/ShariaPanel";
import { NisabPlate, Num, Plate, ProvenanceLine, Refusal, SubHeading, TableScroll, TH } from "@/components/ui";
import { decisionPlate, decisionState, decisionWord } from "@/lib/decision";
import { formatInt, formatRaw, formatSar } from "@/lib/format";
import type { Locale, Messages } from "@/lib/i18n";
import { scenarioName } from "@/lib/scenario-label";
import type { ScenarioObject } from "@/lib/types";

const LEVEL_VARIANT = { none: "ok", watch: "warn", crunch: "bad" } as const;
const SHARIA_VARIANT = { compliant: "ok", soft_flag_review: "warn", hard_flag: "bad" } as const;

const SHORT = 12;

/** Words U8 keeps off the screen. A scenario whose own name holds one gets no command (DECISIONS 43, S5). */
const U8_WORDS = /fraud|score/i;

/** The command that re-runs a library scenario, built from the object's own scenario name (E4). A custom
 *  scenario (E12) is not in the library, so no library command re-runs it: it shows none. */
export function scenarioCommand(o: ScenarioObject): string | null {
  if (o.scenario.source === "custom") return null;
  return U8_WORDS.test(o.scenario.id) ? null : `python -m scenarios.run --scenario ${o.scenario.id}`;
}

type FlagReason = NonNullable<Extract<ScenarioObject["anomaly"], { status: "computed" }>>["flags"][number]["flag_reason"];

function flagReasons(o: ScenarioObject): Partial<Record<FlagReason, number>> {
  const counts: Partial<Record<FlagReason, number>> = {};
  for (const flag of o.anomaly?.flags ?? []) counts[flag.flag_reason] = (counts[flag.flag_reason] ?? 0) + 1;
  return counts;
}

/** What a row shows, and the raw value that decides whether it changed. */
type Cell = { shown: ReactNode; raw: unknown };

/** One column of values, every one read from the object. A lens that did not run says so (U10). */
function column(o: ScenarioObject, locale: Locale, m: Messages): Record<string, Cell> {
  const notRun = m.refusal.title;
  const s = m.scenarios;
  const detail = o.credit_decision_detail;
  const alert = o.forecast?.status === "computed" ? o.forecast.crunch_alert : null;
  const counts = flagReasons(o);
  const reasons = (Object.entries(counts) as [FlagReason, number][]).sort(([a], [b]) => a.localeCompare(b));
  const sharia = o.governance.sharia_screen.sharia_screen_status;
  // U10: a Zakat calculation that did not run shows no amount.
  const zakatShown = o.zakat && o.zakat.status !== "not_computed" && o.zakat.liability_sar !== null;
  return {
    decision: {
      // The state, so a move between conditional and unconditional approval counts as a change.
      raw: o.credit ? decisionState(o.credit, detail) : null,
      shown: o.credit ? <Plate variant={decisionPlate(o.credit, detail, m).variant}>{decisionWord(o.credit, detail, m)}</Plate> : notRun,
    },
    declineOrigin: {
      raw: o.credit ? (detail?.decline_origin ?? "none") : null,
      shown: !o.credit ? notRun : detail?.decline_origin ? m.enums.decline_origin[detail.decline_origin] : s.notDeclined,
    },
    amount: {
      raw: o.credit ? o.credit.amount_sar : "not_run",
      shown: !o.credit ? notRun : o.credit.amount_sar === null ? s.notOffered : <Num>{formatSar(o.credit.amount_sar, locale)}</Num>,
    },
    pd: { raw: detail?.pd ?? null, shown: detail ? <Num>{formatRaw(detail.pd, locale)}</Num> : notRun },
    alert: { raw: alert?.level ?? null, shown: alert ? <Plate variant={LEVEL_VARIANT[alert.level]}>{m.enums.level[alert.level]}</Plate> : notRun },
    days: {
      raw: alert ? alert.days_to_projected_negative_balance : "not_run",
      shown: !alert ? notRun : alert.days_to_projected_negative_balance === null ? m.forecast.noneProjected : (
        <Num>{formatInt(alert.days_to_projected_negative_balance, locale)}</Num>
      ),
    },
    flags: { raw: o.anomaly?.flags.length ?? null, shown: o.anomaly ? <Num>{formatInt(o.anomaly.flags.length, locale)}</Num> : notRun },
    reasons: {
      raw: o.anomaly ? reasons : null,
      shown: o.anomaly ? (
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
    },
    zakat: {
      raw: zakatShown ? o.zakat!.liability_sar : (o.zakat?.status ?? null),
      shown: !o.zakat ? notRun : zakatShown ? <Num>{formatSar(o.zakat.liability_sar!, locale)}</Num> : m.common.dash,
    },
    zakatStatus: { raw: o.zakat?.status ?? null, shown: o.zakat ? m.enums.zakat_status[o.zakat.status] : notRun },
    sharia: { raw: sharia, shown: <Plate variant={SHARIA_VARIANT[sharia]}>{m.enums.sharia[sharia]}</Plate> },
  };
}

function Head({ object, align }: { object: ScenarioObject; align?: boolean }) {
  return (
    <th scope="col" className={`${TH} !py-5 align-top ${align ? "" : "border-s border-line"}`}>
      <span lang="en" dir="ltr" className="block text-start font-semibold">
        {scenarioName(object.scenario.label).name}
      </span>
      <span dir="ltr" data-latin className="block text-start font-mono text-[11px] font-normal text-muted">
        {object.receipt.output_sha256.slice(0, SHORT)}
      </span>
    </th>
  );
}

type Props = { baseline: ScenarioObject; chosen: ScenarioObject; locale: Locale; m: Messages };

export function ScenarioCompare({ baseline, chosen, locale, m }: Props) {
  const s = m.scenarios;
  const rows: [string, string][] = [
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
  // U7: one plate per distinct status across the two objects, so neither object's status goes unshown.
  const nisabStatuses = [...new Set([baseline, chosen].flatMap((o) => (o.zakat ? [o.zakat.nisab_source_status] : [])))];
  const note = <p className="mb-2 text-sm">{s.receiptNote}</p>;
  return (
    <div data-testid="scenario-compare" data-tour="diff" className="flex flex-col gap-4">
      <ProvenanceLine value={chosen} locale={locale} m={m} />
      {chosen.status === "insufficient_data" && <Refusal reason={chosen.lenses_not_run_reason} m={m} />}
      <div className="border border-line bg-card">
        <TableScroll label={s.compareLabel}>
          <table className="diff-table w-full border-collapse md:min-w-[640px]">
            <thead>
              <tr className="border-b-2 border-ink">
                <th scope="col" className={`${TH} !py-5`}>
                  <span className="heading block text-[22px] text-ink">{s.diff}</span>
                </th>
                <Head object={baseline} />
                <Head object={chosen} />
              </tr>
            </thead>
            <tbody>
              {rows.map(([key, label], i) => {
                const changed = JSON.stringify(left[key]!.raw) !== JSON.stringify(right[key]!.raw);
                const delay = `${(0.9 + i * 0.12).toFixed(2)}s`;
                return (
                  <tr key={key} className={`rise border-t border-line2 ${changed ? "text-ink" : "bg-grey text-muted"}`} style={{ animationDelay: delay }}>
                    <th scope="row" className="px-5 py-3 text-start font-normal">
                      <span className="flex items-center gap-3">
                        <Plate
                          variant={changed ? "accent" : "line"}
                          className={`w-[84px] flex-none !px-0 text-center !text-[11px] ${changed ? "stamp-in" : ""}`}
                          style={changed ? { animationDelay: delay } : undefined}
                        >
                          {changed ? s.changed : s.same}
                        </Plate>
                        <span>{label}</span>
                      </span>
                    </th>
                    <td data-label={scenarioName(baseline.scenario.label).name} className="border-s border-line px-5 py-3 font-mono text-sm">
                      {left[key]!.shown}
                    </td>
                    <td
                      data-label={scenarioName(chosen.scenario.label).name}
                      className={`border-s border-line px-5 py-3 font-mono text-sm ${changed ? "flash bg-accent-soft font-semibold" : ""}`}
                      style={changed ? { animationDelay: delay } : undefined}
                    >
                      {right[key]!.shown}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableScroll>
      </div>
      <div className="flex flex-wrap gap-2">
        <ShariaLabel m={m} />
        {nisabStatuses.map((status) => (
          <NisabPlate key={status} status={status} m={m} />
        ))}
      </div>
      <p className="text-sm">{m.anomaly.queue}</p>
      <SubHeading>{s.receipts}</SubHeading>
      {/* The scope's verify line does not apply to an overlay (DECISIONS 41): show the scenario's own command. */}
      <ReceiptPanel receipt={baseline.receipt} lens={s.baseline} m={m} note={note} rerun={scenarioCommand(baseline)} />
      <ReceiptPanel receipt={chosen.receipt} lens={s.chosen} m={m} note={note} rerun={scenarioCommand(chosen)} />
    </div>
  );
}
