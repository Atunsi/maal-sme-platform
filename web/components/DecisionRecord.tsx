import { useId, type ReactNode } from "react";
import { CopyButton } from "@/components/CopyButton";
import { copyLabels, ReceiptPanel } from "@/components/ReceiptPanel";
import { RoleRecord } from "@/components/RoleRecord";
import { Term } from "@/components/Term";
import type { Locale, Messages } from "@/lib/i18n";
import { recordLines, type RecordInput } from "@/lib/record";
import type { Receipt } from "@/lib/types";

/**
 * DECISIONS 58: the plain card, in words an owner can follow: what was looked at, how the result was reached,
 * that the same data gives the same result, and a reference to quote. Built from response fields only (PR3):
 * no amount, no hash, no raw code; the reference is the one identifier, kept Latin (N3).
 */
export function PlainCard({ input, locale, m, className, headless }: { input: RecordInput; locale: Locale; m: Messages; className?: string; headless?: boolean }) {
  const id = useId();
  const r = m.record;
  const lines = recordLines(input, locale, m);
  const rows: [string, ReactNode][] = [];
  if (lines.dataUsed) rows.push([r.dataUsed, lines.dataUsed]);
  if (lines.how.length) rows.push([r.how, lines.how.map((line) => <span key={line} className="block">{line}</span>)]);
  if (lines.same) rows.push([r.same, lines.same]);
  if (lines.reference) {
    rows.push([
      r.questions,
      <span key="ref" className="block">
        {r.questionsBody}{" "}
        <span className="mt-1 inline-flex flex-wrap items-center gap-2">
          <span className="sr-only">{r.reference}: </span>
          <bdi dir="ltr" data-latin data-reference className="font-mono text-sm font-semibold">
            {lines.reference}
          </bdi>
          <CopyButton value={lines.reference} name={r.reference} labels={copyLabels(m)} />
        </span>
        <span className="mt-1 block text-[13px] text-muted">
          <Term id="reference" locale={locale}>
            {r.reference}
          </Term>
        </span>
      </span>,
    ]);
  }
  return (
    // headless: where a heading already names the card (the overview aside), the section takes the title as its label.
    <section
      aria-labelledby={headless ? undefined : id}
      aria-label={headless ? r.title : undefined}
      data-record
      className={className ?? "mt-4 border border-line bg-card p-4 sm:p-5"}
    >
      {!headless && (
        <h2 id={id} className="heading text-lg">
          {r.title}
        </h2>
      )}
      <dl className={`flex flex-col gap-2.5 text-sm ${headless ? "" : "mt-2"}`}>
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt className="font-semibold text-muted">{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

type Props = {
  input: RecordInput;
  receipt: Receipt;
  lens: string;
  locale: Locale;
  m: Messages;
  note?: ReactNode;
  rerun?: string | null;
  /** The credit page: the Compliance View shows the technical record, open, and no card. */
  followsView?: boolean;
};

/**
 * Who sees what (DECISIONS 58, 1a.3): the owner sees the card; the admin the card and the technical record, open;
 * the public demo the card and the record, closed; the Compliance View the record, open. The record itself is the
 * unchanged ReceiptPanel: every field, the verbatim scope (U13), the verify command, Copy and the hash check.
 */
export function DecisionRecord({ input, receipt, lens, locale, m, note, rerun, followsView }: Props) {
  const technical = (open: boolean) => <ReceiptPanel receipt={receipt} lens={lens} m={m} note={note} rerun={rerun} open={open} />;
  return <RoleRecord card={<PlainCard input={input} locale={locale} m={m} />} open={technical(true)} closed={technical(false)} followsView={followsView} />;
}
