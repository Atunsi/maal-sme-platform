import { Fragment, type ReactNode } from "react";
import { LensHead } from "@/components/BusinessHeader";
import { ReceiptPanel } from "@/components/ReceiptPanel";
import { Term } from "@/components/Term";
import { TipButton } from "@/components/TipButton";
import { BackendText, Code, Field, Fields, NisabPlate, Num, Plate, Probability, Refusal } from "@/components/ui";
import { formatDate, formatSar } from "@/lib/format";
import { fill, type Locale, type Messages } from "@/lib/i18n";
import { label } from "@/lib/labels";
import type { ZakatResponse } from "@/lib/types";

const STATUS_VARIANT = { computed: "ok", zero_liability: "ink", not_computed: "warn" } as const;

type Zakat = NonNullable<ZakatResponse["zakat"]>;

const pct = (part: number, whole: number) => `${Math.min(100, Math.max(0, (part / whole) * 100)).toFixed(2)}%`;

function Step({ label, value, strong, children }: { label: string; value: string; strong?: boolean; children: ReactNode }) {
  return (
    <>
      <div className={strong ? "font-semibold" : undefined}>
        <div className="text-sm">{label}</div>
        <div className="font-mono text-lg">
          <Num>{value}</Num>
        </div>
      </div>
      <div className="relative h-[30px]">{children}</div>
    </>
  );
}

const GRID = "grid grid-cols-1 items-center gap-x-6 gap-y-4 pb-5 sm:grid-cols-[240px_1fr]";

/** Assets, less liabilities, the base and the nisab marker, all on one scale taken from the response. */
function Waterfall({ z, locale, m }: { z: Zakat; locale: Locale; m: Messages }) {
  const { zakatable_assets_sar: assets, deductible_liabilities_sar: liabilities, zakat_base_sar: base } = z;
  if (assets === undefined || liabilities === undefined || base === undefined) return null;
  const n = m.zakat;
  const scale = Math.max(assets, liabilities, base, z.nisab_value_sar) || 1;
  const sar = (value: number) => formatSar(value, locale);
  const nisabAt = pct(z.nisab_value_sar, scale);
  const alt = fill(n.buildAlt, { assets: sar(assets), liabilities: sar(liabilities), base: sar(base), nisab: sar(z.nisab_value_sar) });
  const bars = [
    { label: n.assets, value: sar(assets), start: "0%", width: pct(assets, scale), strong: false },
    { label: n.less, value: sar(liabilities), start: pct(Math.max(assets - liabilities, 0), scale), width: pct(Math.min(liabilities, assets), scale), strong: false },
    { label: n.base, value: sar(base), start: "0%", width: pct(base, scale), strong: true },
  ];
  return (
    <section aria-labelledby="build" data-tour="waterfall" className="flex flex-col gap-5 border border-line bg-card p-5 sm:p-9">
      <h2 id="build" className="heading text-2xl">
        {n.buildTitle}
      </h2>
      <div className="relative">
        <div role="img" aria-label={alt} className={GRID}>
          <Step label={n.assets} value={sar(assets)}>
            <div className="fill-bar fill-from-start start-0 bg-accent" style={{ width: pct(assets, scale), animationDelay: "0.2s" }} />
          </Step>
          <Step label={n.less} value={sar(liabilities)}>
            {/* The deduction hangs from the end of the assets bar and eats back towards the base. */}
            <div
              className="fill-bar fill-from-end stripe"
              style={{ insetInlineStart: bars[1]!.start, width: bars[1]!.width, animationDelay: "1s" }}
            />
          </Step>
          <Step label={n.base} value={sar(base)} strong>
            <div className="fill-bar fill-from-start start-0 bg-ink" style={{ width: pct(base, scale), animationDelay: "1.8s" }} />
            <div aria-hidden="true" className="drop absolute -inset-y-3.5 w-[3px] bg-ochre" style={{ insetInlineStart: nisabAt, animationDelay: "2.6s" }} />
            {/* The label sits on the side of the marker with more room and wraps within it, so it never runs off
                a phone screen. */}
            <div
              className="drop absolute top-[34px] w-max font-mono text-xs text-warn"
              style={
                z.nisab_value_sar / scale > 0.5
                  ? { insetInlineEnd: `calc(100% - ${nisabAt} + 10px)`, maxWidth: `calc(${nisabAt} - 10px)`, animationDelay: "2.7s" }
                  : { insetInlineStart: `calc(${nisabAt} + 10px)`, maxWidth: `calc(100% - ${nisabAt} - 10px)`, animationDelay: "2.7s" }
              }
            >
              {fill(n.nisabLine, { value: sar(z.nisab_value_sar), basis: z.nisab_basis })}
            </div>
          </Step>
        </div>
        {/* E5: one focusable target per bar, laid over the picture in the same grid. Outside the image, because
            an image's children are presentational and cannot hold controls. */}
        <div className={`pointer-events-none absolute inset-0 ${GRID}`}>
          {bars.map((bar) => (
            <Fragment key={bar.label}>
              <div aria-hidden="true" className={`invisible ${bar.strong ? "font-semibold" : ""}`}>
                <div className="text-sm">{bar.label}</div>
                <div className="font-mono text-lg">{bar.value}</div>
              </div>
              <div className="relative h-[30px]">
                <TipButton
                  label={`${bar.label}: ${bar.value}`}
                  tip={`${bar.label}: ${bar.value}`}
                  className="pointer-events-auto absolute -inset-y-[7px]"
                  style={{ insetInlineStart: bar.start, width: bar.width }}
                />
              </div>
            </Fragment>
          ))}
        </div>
      </div>
    </section>
  );
}

/** Time runs left to right in Arabic too, so the track is pinned LTR like the other time axes. */
function Hawl({ z, locale, m }: { z: Zakat; locale: Locale; m: Messages }) {
  const { hawl_start_date: start, hawl_completion_date: end, snapshot_month_end: snapshot } = z;
  const n = m.zakat;
  if (!start || !end) return null;
  const at = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
  const date = (iso: string) => formatDate(iso, locale);
  const marker = snapshot ? pct(at(snapshot) - at(start), at(end) - at(start)) : null;
  const alt = fill(n.hawlAlt, { start: date(start), end: date(end), snapshot: snapshot ? date(snapshot) : m.common.dash });
  return (
    <section aria-labelledby="hawl" className="rise flex min-w-0 flex-[999_1_560px] flex-col gap-5 border border-line bg-card p-5 sm:p-9" style={{ animationDelay: "0.4s" }}>
      <h2 id="hawl" className="heading text-2xl">
        <Term id="hawl" locale={locale}>
          {n.hawlTitle}
        </Term>
      </h2>
      <div role="img" aria-label={alt} dir="ltr" className="relative h-[90px]">
        <div className="absolute inset-x-0 top-9 h-2.5 bg-line2" />
        <div className="fill-bar fill-from-start inset-x-0 !top-9 !bottom-auto h-2.5 bg-accent" style={{ animationDuration: "2.4s", animationDelay: "0.6s" }} />
        <div className="absolute left-0 top-7 h-[26px] w-[3px] bg-ink" />
        <div className="absolute right-0 top-7 h-[26px] w-[3px] bg-ink" />
        {marker && (
          <div className="drop absolute top-7 -ml-[7px] box-border h-[26px] w-3.5 border-[3px] border-ink bg-card" style={{ left: marker, animationDelay: "2.4s" }} />
        )}
        <div className="absolute left-0 top-[62px] font-mono text-xs">
          {n.hawlStart} {date(start)}
        </div>
        <div className="absolute right-0 top-[62px] font-mono text-xs">
          {n.hawlEnd} {date(end)}
        </div>
        {snapshot && (
          <div className="drop absolute right-0 top-0 font-mono text-xs" style={{ animationDelay: "2.5s" }}>
            {n.snapshot} {date(snapshot)}
          </div>
        )}
      </div>
      <Fields>
        <Field label={n.hawlRule}>
          {label("hawl_rule", z.hawl_rule, m)}
        </Field>
        <Field label={n.hawlSource}>{z.hawl_start_source ? label("hawl_start_source", z.hawl_start_source, m) : m.common.dash}</Field>
      </Fields>
    </section>
  );
}

function Amount({ z, locale, m }: { z: Zakat; locale: Locale; m: Messages }) {
  const n = m.zakat;
  return (
    <section aria-labelledby="amount" className="panel rise flex min-w-0 flex-[1_1_420px] flex-col gap-4 p-5 sm:p-9" style={{ animationDelay: "2.8s" }}>
      <h2 id="amount" className="heading text-2xl">
        {n.amountTitle}
      </h2>
      <div aria-hidden="true" className="rounded-bar relative h-11 overflow-hidden" style={{ background: "var(--panelRule)" }}>
        <div className="fill-bar fill-from-start start-0 min-w-3" style={{ width: pct(z.rate, 1), background: "#e0b05c", animationDelay: "3.2s" }} />
      </div>
      <div className="font-mono text-base leading-relaxed">
        {z.zakat_base_sar !== undefined && (
          <div>
            {n.base} <Num>{formatSar(z.zakat_base_sar, locale)}</Num>
          </div>
        )}
        <div>
          {n.rate} <Probability value={z.rate} locale={locale} />
        </div>
        {/* U10: a calculation that did not run shows no amount, never a zero. */}
        {z.status !== "not_computed" && z.liability_sar !== null && (
          <div className="text-[26px]" style={{ color: "#e0b05c" }}>
            <span>{n.liability}</span> <Num>{formatSar(z.liability_sar, locale)}</Num>
          </div>
        )}
      </div>
      <p className="text-[13px] text-muted">{n.asReturned}</p>
    </section>
  );
}

export function ZakatCard({ data, locale, m }: { data: ZakatResponse; locale: Locale; m: Messages }) {
  const z = data.zakat;
  const n = m.zakat;
  const aside = z && (
    <div className="flex flex-col gap-2 sm:items-end">
      <div className="flex items-center gap-3">
        <Plate variant={STATUS_VARIANT[z.status]}>{m.enums.zakat_status[z.status]}</Plate>
        {z.status !== "not_computed" && z.liability_sar !== null && (
          <span className="font-mono text-[26px] sm:text-[34px]">
            <Num>{formatSar(z.liability_sar, locale)}</Num>
          </span>
        )}
      </div>
      <NisabPlate status={z.nisab_source_status} m={m} />
    </div>
  );
  return (
    <>
      <LensHead data={data} title={n.pageTitle} aside={aside} locale={locale} m={m} />
      {!z ? (
        <Refusal reason={data.lens_not_run_reason} m={m} />
      ) : (
        <>
          {z.status !== "computed" && z.reason && (
            <div>
              <p>
                {n.reason}: {m.enums.zakat_reason[z.reason]}
              </p>
              {z.detail && (
                <BackendText locale={locale} m={m}>
                  {z.detail}
                </BackendText>
              )}
            </div>
          )}
          <Waterfall z={z} locale={locale} m={m} />
          <div className="flex flex-wrap gap-7">
            <Amount z={z} locale={locale} m={m} />
            <Hawl z={z} locale={locale} m={m} />
          </div>
          <Fields>
            <Field label={n.thresholdMet}>{z.nisab_threshold_met === undefined ? m.common.dash : z.nisab_threshold_met ? m.common.yes : m.common.no}</Field>
            <Field label={<Term id="nisab" locale={locale}>{n.nisabBasis}</Term>}>
              <Code>{z.nisab_basis}</Code>
            </Field>
            <Field label={n.method}>
              {label("zakat_method", z.method, m)}
            </Field>
          </Fields>
        </>
      )}
      <ReceiptPanel receipt={data.receipt} lens={n.title} m={m} />
    </>
  );
}
