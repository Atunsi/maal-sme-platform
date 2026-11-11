import { Card, Code, Num, TableScroll, TD, TH } from "@/components/ui";
import { localeOf, type Messages } from "@/lib/i18n";
import type { ProfileResponse } from "@/lib/types";
import { DecisionRecord } from "@/components/DecisionRecord";
import { recordInput } from "@/lib/record";

/**
 * Raw names and values only. U9: the sector-relative z-scores (features 55-59) are listed like any
 * other feature and are never framed as a comparison with peers or a sector average (§36.4).
 */
export function ProfilePanel({ data, m }: { data: ProfileResponse; m: Messages }) {
  const d = m.dashboard;
  return (
    <Card id="profile" title={d.profileTitle} className="drift">
      <details>
        <summary className="text-label font-medium">{d.profileIntro}</summary>
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
        {/* LG5 (DECISIONS 60): the profile's record sits inside the figures it describes, so the overview shows one
            record card (the verdict's) until the figures are opened. Who sees what (DECISIONS 58) is unchanged. */}
        <DecisionRecord input={recordInput("profile", data)} receipt={data.receipt} lens={m.receipt.profile} locale={localeOf(m)} m={m} />
      </details>
    </Card>
  );
}
