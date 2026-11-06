import { ReceiptPanel } from "@/components/ReceiptPanel";
import { BackendText, Card, Code, Field, Fields, Num, ProvenanceLine, Refusal, TableScroll, TD, TH } from "@/components/ui";
import { formatDate, formatInt, formatSar } from "@/lib/format";
import type { Locale, Messages } from "@/lib/i18n";
import type { AnomalyResponse } from "@/lib/types";

/** U8: flag_reason categories only, framed as a review queue, with no severity the API did not send. */
export function AnomalyCard({ data, locale, m }: { data: AnomalyResponse; locale: Locale; m: Messages }) {
  const a = data.anomaly;
  const n = m.anomaly;
  return (
    <Card id="anomaly" title={n.title}>
      <ProvenanceLine value={data} locale={locale} m={m} />
      {!a ? (
        <Refusal reason={data.lens_not_run_reason} m={m} />
      ) : a.status === "not_computed" ? (
        <p role="status">
          {n.notComputed} {m.enums.lens_status[a.reason]}
        </p>
      ) : (
        <>
          <p className="mb-3">{n.queue}</p>
          <Fields>
            <Field label={n.window}>
              <bdi>
                {formatDate(a.scan_window.from, locale)} – {formatDate(a.scan_window.to, locale)}
              </bdi>
            </Field>
            <Field label={n.scanned}>
              <Num>{formatInt(a.transactions_scanned, locale)}</Num>
            </Field>
            <Field label={n.listed}>
              <Num>{formatInt(a.flags.length, locale)}</Num>
            </Field>
          </Fields>
          {a.flags.length === 0 ? (
            <p className="mt-3">{n.noFlags}</p>
          ) : (
            <>
              <div className="mt-4" />
              <TableScroll label={n.title}>
                <table className="w-full">
                  <thead>
                    <tr>
                      {[n.date, n.hour, n.direction, n.amount, n.counterparty, n.category, n.reason].map((label) => (
                        <th key={label} scope="col" className={TH}>
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {a.flags.map((flag) => (
                      <tr key={flag.transaction_id}>
                        <td className={TD}>
                          <bdi>{formatDate(flag.date, locale)}</bdi>
                        </td>
                        <td className={TD}>
                          <Num>{flag.hour}</Num>
                        </td>
                        <td className={TD}>{m.enums.flow[flag.direction]}</td>
                        <td className={TD}>
                          <Num>{formatSar(flag.amount_sar, locale)}</Num>
                        </td>
                        <td className={TD}>
                          <Code>{flag.counterparty_type}</Code>
                        </td>
                        <td className={TD}>
                          <Code>{flag.category}</Code>
                        </td>
                        <td className={TD}>{m.enums.flag_reason[flag.flag_reason]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableScroll>
            </>
          )}
          <div className="mt-3 text-sm">
            <span className="text-muted">{n.method}</span>
            <BackendText locale={locale} m={m}>
              {a.method}
            </BackendText>
          </div>
        </>
      )}
      <ReceiptPanel receipt={data.receipt} lens={n.title} m={m} />
    </Card>
  );
}
