import type { ReactNode } from "react";
import { Code } from "@/components/ui";
import { fill, type Messages } from "@/lib/i18n";
import type { Receipt } from "@/lib/types";

/** Every receipt field as returned, `scope` verbatim (U13). Keys stay raw: they are identifiers. */
export function ReceiptPanel({ receipt, lens, m, note }: { receipt: Receipt; lens: string; m: Messages; note?: ReactNode }) {
  const { scope, ...fields } = receipt;
  return (
    <details className="mt-4 rounded border border-line p-3">
      <summary className="text-sm font-medium">{fill(m.receipt.title, { lens })}</summary>
      <div className="mt-2">
        <p className="text-sm font-semibold text-muted">{m.receipt.scope}</p>
        {scope ? (
          <p lang="en" dir="ltr" className="mb-2 text-start text-sm">
            {scope}
          </p>
        ) : (
          <p className="mb-2 text-sm">{m.receipt.noScope}</p>
        )}
        {note}
        <dl>
          {Object.entries(fields).map(([key, value]) => (
            <div key={key} className="border-t border-line py-1">
              <dt>
                <Code>{key}</Code>
              </dt>
              <dd className="text-muted">
                <Code>{String(value)}</Code>
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </details>
  );
}
