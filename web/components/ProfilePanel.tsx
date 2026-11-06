import { ReceiptPanel } from "@/components/ReceiptPanel";
import { Card, Code, Num, TableScroll, TD, TH } from "@/components/ui";
import type { Messages } from "@/lib/i18n";
import type { ProfileResponse } from "@/lib/types";

/**
 * Raw names and values only. U9: the sector-relative z-scores (features 55-59) are listed like any
 * other feature and are never framed as a comparison with peers or a sector average (§36.4).
 */
export function ProfilePanel({ data, m }: { data: ProfileResponse; m: Messages }) {
  const d = m.dashboard;
  return (
    <Card id="profile" title={d.profileTitle}>
      <details>
        <summary className="text-sm font-medium">{d.profileIntro}</summary>
        <div className="mt-2">
          <TableScroll label={d.profileTitle} tall>
            <table className="w-full">
              <thead>
                <tr>
                  {[d.feature, d.value, d.nullReason].map((label) => (
                    <th key={label} scope="col" className={`${TH} sticky top-0 bg-card`}>
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.entries(data.features).map(([name, value]) => (
                  <tr key={name}>
                    <td className={TD}>
                      <Code>{name}</Code>
                    </td>
                    <td className={TD}>{value === null ? m.common.dash : <Num>{String(value)}</Num>}</td>
                    <td className={TD}>{data.null_reasons[name] ? <Code>{data.null_reasons[name]}</Code> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        </div>
      </details>
      <ReceiptPanel receipt={data.receipt} lens={m.receipt.profile} m={m} />
    </Card>
  );
}
