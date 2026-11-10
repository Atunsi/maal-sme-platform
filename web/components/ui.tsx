import type { CSSProperties, ReactNode } from "react";
import { RefusalLink } from "@/components/RefusalLink";
import { RetryButton } from "@/components/RetryButton";
import { localeOf, type Locale, type Messages } from "@/lib/i18n";
import { formatDate, formatInt, formatProbability } from "@/lib/format";
import { nisabPlate } from "@/lib/nisab";
import type { ApiErrorKind, Provenance } from "@/lib/types";

export type PlateVariant = "ok" | "bad" | "warn" | "ink" | "accent" | "line";

/** Status is always a word on a plate, so it never depends on colour or a symbol (U14). */
export function Plate({ variant, className, style, children }: { variant: PlateVariant; className?: string; style?: CSSProperties; children: ReactNode }) {
  return (
    <span className={`plate plate-${variant}${className ? ` ${className}` : ""}`} style={style}>
      {children}
    </span>
  );
}

/** U7: the nisab price's verification status, beside the raw code when the catalogue has no words for it. */
export function NisabPlate({ status, m }: { status: string; m: Messages }) {
  const plate = nisabPlate(status, m);
  if (!plate) return null;
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <Plate variant="warn">{plate.words}</Plate>
      {plate.code && <Code>{plate.code}</Code>}
    </span>
  );
}

/** The page column: the design's 1240 px sheet, used by every page but the landing and sign-in. */
export function Page({ children }: { children: ReactNode }) {
  // Phones get a 16 px margin and tighter rhythm; the same column from a tablet up.
  return <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-6 px-4 pb-12 pt-6 sm:gap-8 sm:px-6 sm:pb-16 sm:pt-10">{children}</div>;
}

export function Card({ id, title, children }: { id?: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-label={title} className="min-w-0 border border-line bg-card p-6">
      <h2 className="heading mb-3 text-2xl">{title}</h2>
      {children}
    </section>
  );
}

export function SubHeading({ children }: { children: ReactNode }) {
  return <h3 className="heading caps mb-2 mt-5 text-sm text-muted">{children}</h3>;
}

export function Fields({ children }: { children: ReactNode }) {
  return (
    <dl data-phone="fields" className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
      {children}
    </dl>
  );
}

export function Field({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="break-words font-medium">{children}</dd>
    </div>
  );
}

/** A figure's font: monospace for numbers and IDs (the design's figure style), the text face for words such
 * as "None projected" or "Yes", so a sentence never reads as code. */
export function figureFont(children: ReactNode): string {
  return typeof children === "string" && !/[0-9٠-٩]/.test(children) ? "font-sans font-semibold" : "font-mono";
}

/** Numbers and identifiers stay left-to-right inside Arabic text. */
export function Num({ children }: { children: ReactNode }) {
  return <bdi dir="ltr">{children}</bdi>;
}

/** C3: a percentage with one decimal, then the exact value in brackets in a smaller mono span. Not used in the Compliance View or receipts. */
export function Probability({ value, locale }: { value: number; locale: Locale }) {
  const { pct, exact } = formatProbability(value, locale);
  return (
    <bdi dir="ltr" data-probability>
      {pct} <span className="font-mono text-[0.8em] text-muted">({exact})</span>
    </bdi>
  );
}

/**
 * Text produced by the backend: templates, prompts, method strings. It is deterministic and owned by
 * the credit and compliance owners, so the UI never translates or rewrites it (DECISIONS 41). Since
 * DECISIONS 57 the backend sends its own Arabic sibling (`text_ar` and the like): in Arabic that is
 * shown verbatim as Arabic text. When it is absent (an older fixture, a template the backend does not
 * cover yet) the English stays in an LTR block with the pending label, as before (1a.10).
 */
export function BackendText({ en, ar, locale, m }: { en: string; ar?: string | null; locale: Locale; m: Messages }) {
  if (locale === "ar" && ar) {
    return (
      <span data-backend data-backend-ar className="block">
        {ar}
      </span>
    );
  }
  return (
    <span className="block">
      <span lang="en" dir="ltr" data-backend className="block text-start">
        {en}
      </span>
      {locale === "ar" && <span className="text-xs text-muted">{m.common.englishTemplate}</span>}
    </span>
  );
}

/** Raw identifiers and hashes as returned. */
export function Code({ children }: { children: ReactNode }) {
  return (
    <code lang="en" dir="ltr" className="break-all font-mono text-sm">
      {children}
    </code>
  );
}

export function ProvenanceLine({ value, locale, m }: { value: Provenance; locale: Locale; m: Messages }) {
  return (
    <p className="mb-3 text-sm text-muted">
      {m.common.population}: {m.enums.population[value.population]}, {m.common.dataSource}:{" "}
      {m.enums.data_source[value.data_source]}, {m.common.asOf}: <bdi>{formatDate(value.as_of, locale)}</bdi>
    </p>
  );
}

/**
 * U10: the explicit refusal. C6: it also says how much recent activity the response counted (the threshold is
 * not in the response, so none is printed) and links to a business with enough data.
 */
export function Refusal({ reason, coverage, m }: { reason: "insufficient_data" | undefined; coverage?: number | null; m: Messages }) {
  const locale = localeOf(m);
  return (
    <div role="status" className="border border-line bg-grey p-4">
      <p className="font-semibold">
        <Plate variant="warn">{m.refusal.title}</Plate>
      </p>
      <p className="mt-2">{m.refusal.body}</p>
      {reason && (
        <p className="mt-1 text-sm">
          {m.refusal.reason}: {m.enums.lens_status[reason]} (<Code>{reason}</Code>)
        </p>
      )}
      {coverage !== undefined && coverage !== null && (
        <p className="mt-1 text-sm" data-refusal-coverage>
          {m.common.coverage}: <Num>{formatInt(coverage, locale)}</Num>
        </p>
      )}
      <RefusalLink locale={locale} label={m.refusal.example} />
    </div>
  );
}

/** X4: the detail comes from the API, so it is backend text: in Arabic it carries the English-template note. */
export function ApiError({ kind, detail, m }: { kind: ApiErrorKind; detail?: string; m: Messages }) {
  return (
    <div role="alert" className="border border-bad bg-bad-soft p-4 text-bad">
      <p>{m.errors[kind]}</p>
      {detail && (
        <div className="mt-1 font-mono text-sm">
          <BackendText en={detail} locale={localeOf(m)} m={m} />
        </div>
      )}
      {(kind === "rate_limited" || kind === "server" || kind === "network") && <RetryButton label={m.common.retry} />}
    </div>
  );
}

/**
 * I7: a loading card the size of the card it stands for (title bar, plate, figure line, note line), drawn
 * from tokens, so nothing jumps when the real card arrives. Screen readers still hear "Loading". U10: only
 * ever a loading state, never a stand-in for insufficient_data or partial_profile, which keep their words.
 */
export function CardLoading({ title, m, tall }: { title: string; m: Messages; tall?: boolean }) {
  return (
    <section aria-label={title} aria-busy="true" data-skeleton className={`flex min-w-0 flex-col gap-3 border border-line bg-card p-5 ${tall ? "min-h-[420px]" : "min-h-[200px]"}`}>
      <span className="text-[13px] text-muted">{title}</span>
      <span aria-hidden="true" className="skeleton h-6 w-24" />
      <span aria-hidden="true" className="skeleton h-5 w-40" />
      <span aria-hidden="true" className="skeleton h-3.5 w-3/4" />
      {tall && <span aria-hidden="true" className="skeleton mt-2 flex-1" />}
      <p role="status" className="sr-only">
        {m.common.loading}
      </p>
    </section>
  );
}

/** A table that may be wider than the card scrolls inside a keyboard-focusable region. */
export function TableScroll({ label, tall, children }: { label: string; tall?: boolean; children: ReactNode }) {
  return (
    <div role="region" aria-label={label} tabIndex={0} className={`relative overflow-auto ${tall ? "max-h-96" : ""}`}>
      {children}
    </div>
  );
}

export const TH = "border-b border-line px-4 py-3 text-start text-sm font-medium text-muted";
export const TD = "border-b border-line2 px-4 py-2.5 text-sm";
