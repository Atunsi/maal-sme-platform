import type { CSSProperties, ReactNode } from "react";
import { RetryButton } from "@/components/RetryButton";
import type { Locale, Messages } from "@/lib/i18n";
import { formatDate } from "@/lib/format";
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

/** The page column: the design's 1240 px sheet, used by every page but the landing and sign-in. */
export function Page({ children }: { children: ReactNode }) {
  return <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-8 px-6 pb-16 pt-10">{children}</div>;
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
  return <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">{children}</dl>;
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="break-words font-medium">{children}</dd>
    </div>
  );
}

/** Numbers and identifiers stay left-to-right inside Arabic text. */
export function Num({ children }: { children: ReactNode }) {
  return <bdi dir="ltr">{children}</bdi>;
}

/**
 * Text produced by the backend: templates, prompts, method strings. It is deterministic and owned by
 * the credit and compliance owners, so the UI never translates or rewrites it. In Arabic it stays
 * English in an LTR block with a label, so no second, unreviewed version of a template exists.
 */
export function BackendText({ locale, m, children }: { locale: Locale; m: Messages; children: string }) {
  return (
    <span className="block">
      <span lang="en" dir="ltr" className="block text-start">
        {children}
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

export function Refusal({ reason, m }: { reason: "insufficient_data" | undefined; m: Messages }) {
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
    </div>
  );
}

export function ApiError({ kind, detail, m }: { kind: ApiErrorKind; detail?: string; m: Messages }) {
  return (
    <div role="alert" className="border border-bad bg-bad-soft p-4 text-bad">
      <p>{m.errors[kind]}</p>
      {detail && (
        <p className="mt-1">
          <Code>{detail}</Code>
        </p>
      )}
      {(kind === "rate_limited" || kind === "server" || kind === "network") && <RetryButton label={m.common.retry} />}
    </div>
  );
}

export function CardLoading({ title, m }: { title: string; m: Messages }) {
  return (
    <Card title={title}>
      <p role="status" className="text-muted">
        {m.common.loading}
      </p>
    </Card>
  );
}

/** A table that may be wider than the card scrolls inside a keyboard-focusable region. */
export function TableScroll({ label, tall, children }: { label: string; tall?: boolean; children: ReactNode }) {
  return (
    <div role="region" aria-label={label} tabIndex={0} className={`overflow-auto ${tall ? "max-h-96" : ""}`}>
      {children}
    </div>
  );
}

export const TH = "border-b border-line px-4 py-3 text-start text-sm font-medium text-muted";
export const TD = "border-b border-line2 px-4 py-2.5 text-sm";
