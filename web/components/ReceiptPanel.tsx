import type { ReactNode } from "react";
import { CopyButton, type CopyLabels } from "@/components/CopyButton";
import { HashCheck } from "@/components/HashCheck";
import { Code } from "@/components/ui";
import { fill, type Messages } from "@/lib/i18n";
import type { Receipt } from "@/lib/types";

/** Receipt fields that hold a full hash or commit: each gets a Copy button (E4). */
const COPYABLE = /(_sha256|^code_commit)$/;

/** The command after "verify:" in the scope, exactly as written. Null when the scope has none. */
export function verifyCommand(scope: string | undefined): string | null {
  const found = scope ? /verify:\s*([^)\n]+?)\s*(?:\)|$)/m.exec(scope) : null;
  return found ? found[1]! : null;
}

export function copyLabels(m: Messages): CopyLabels {
  const r = m.receipt;
  return { copy: r.copy, copied: r.copied, fallback: r.copyFallback, announce: r.copiedAnnounce };
}

type Props = {
  receipt: Receipt;
  lens: string;
  m: Messages;
  note?: ReactNode;
  /** Replaces the scope's verify command, for objects it cannot re-run (scenario overlays); null shows none. */
  rerun?: string | null;
};

/** Every receipt field as returned, `scope` verbatim (U13). Keys stay raw: they are identifiers. */
export function ReceiptPanel({ receipt, lens, m, note, rerun }: Props) {
  const { scope, ...fields } = receipt;
  const r = m.receipt;
  const labels = copyLabels(m);
  const command = rerun !== undefined ? rerun : verifyCommand(scope);
  return (
    <details className="mt-4 border border-line p-3" data-receipt>
      <summary className="text-sm font-medium">{fill(r.title, { lens })}</summary>
      <div className="mt-2">
        <p className="text-sm font-semibold text-muted">{r.scope}</p>
        {scope ? (
          <p lang="en" dir="ltr" className="mb-2 text-start text-sm">
            {scope}
          </p>
        ) : (
          <p className="mb-2 text-sm">{r.noScope}</p>
        )}
        {note}
        {command && (
          <div className="mb-2" data-rerun>
            <p className="text-sm font-semibold text-muted">{r.rerun}</p>
            <div className="flex flex-wrap items-center gap-2">
              <pre lang="en" dir="ltr" className="rounded-ctl min-w-0 whitespace-pre-wrap break-all bg-page px-3 py-2 text-start font-mono text-xs">
                <code>{command}</code>
              </pre>
              <CopyButton value={command} name={r.rerun} labels={labels} />
            </div>
          </div>
        )}
        <dl>
          {Object.entries(fields).map(([key, value]) => (
            <div key={key} className="border-t border-line py-1">
              <dt>
                <Code>{key}</Code>
              </dt>
              <dd className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted">
                <Code>{String(value)}</Code>
                {COPYABLE.test(key) && value != null && <CopyButton value={String(value)} name={key} labels={labels} />}
              </dd>
            </div>
          ))}
        </dl>
        {receipt.output_sha256 && (
          <HashCheck
            expected={receipt.output_sha256}
            labels={{ label: r.hashCheck, help: r.hashCheckHelp, check: r.check, match: r.match, noMatch: r.noMatch }}
          />
        )}
      </div>
    </details>
  );
}
