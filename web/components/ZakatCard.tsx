import { Fragment, type ReactNode } from "react";
import { LensHead } from "@/components/BusinessHeader";
import { Term } from "@/components/Term";
import { TipButton } from "@/components/TipButton";
import { BackendText, Code, Field, Fields, NisabPlate, Plate, Probability, Refusal, Sar } from "@/components/ui";
import { formatDate, formatSar, formatSarSpoken } from "@/lib/format";
import { fill, fillNodes, type Locale, type Messages } from "@/lib/i18n";
import { label } from "@/lib/labels";
import type { ZakatResponse } from "@/lib/types";
import { delay } from "@/lib/motion";
import { DecisionRecord } from "@/components/DecisionRecord";
import { recordInput } from "@/lib/record";

const STATUS_VARIANT = { computed: "ok", zero_liability: "ink", not_computed: "warn" } as const;

type Zakat = NonNullable<ZakatResponse["zakat"]>;

const pct = (part: number, whole: number) => `${Math.min(100, Math.max(0, (part / whole) * 100)).toFixed(2)}%`;

function Step({ label, value, strong, children }: { label: string; value: ReactNode; strong?: boolean; children: ReactNode }) {
  return (
    <>
      <div className={strong ? "font-semibold" : undefined}>
        <div className="text-label">{label}</div>
        <div className="font-mono text-value">{value}</div>
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
  // RS: visible amounts carry the riyal sign (formatSar, Sar); the image's alt text and each bar's accessible name
  // say the currency in words (formatSarSpoken), because screen readers do not know U+20C1 yet.
  const sar = (value: number) => formatSar(value, locale);
  const spoken = (value: number) => formatSarSpoken(value, locale);
  const nisabAt = pct(z.nisab_value_sar, scale);
  const alt = fill(n.buildAlt, { assets: spoken(assets), liabilities: spoken(liabilities), base: spoken(base), nisab: spoken(z.nisab_value_sar) });
  const bars = [
    { label: n.assets, amount: assets, start: "0%", width: pct(assets, scale), strong: false },
    { label: n.less, amount: liabilities, start: pct(Math.max(assets - liabilities, 0), scale), width: pct(Math.min(liabilities, assets), scale), strong: false },
    { label: n.base, amount: base, start: "0%", width: pct(base, scale), strong: true },
  ];
  return (
    <section aria-labelledby="build" data-tour="waterfall" className="flex flex-col gap-5 border border-line bg-card p-5 sm:p-9">
      <h2 id="build" className="heading text-heading">
        {n.buildTitle}
      </h2>
      <div className="relative">
        <div role="img" aria-label={alt} className={GRID}>
          <Step label={n.assets} value={<Sar value={assets} locale={locale} />}>
            <div className="fill-bar fill-from-start start-0 bg-accent" style={{ width: pct(assets, scale), animationDelay: delay(0) }} />
          </Step>
          <Step label={n.less} value={<Sar value={liabilities} locale={locale} />}>
            {/* The deduction hangs from the end of the assets bar and eats back towards the base. */}
            <div
              className="fill-bar fill-from-end stripe"
              style={{ insetInlineStart: bars[1]!.start, width: bars[1]!.width, animationDelay: delay(1) }}
            />
          </Step>
          <Step label={n.base} value={<Sar value={base} locale={locale} />} strong>
            <div className="fill-bar fill-from-start start-0 bg-ink" style={{ width: pct(base, scale), animationDelay: delay(2) }} />
            <div aria-hidden="true" className="drop absolute -inset-y-3.5 w-[3px] bg-ochre" style={{ insetInlineStart: nisabAt, animationDelay: delay(3) }} />
            {/* The label sits on the side of the marker with more room and wraps within it, so it never runs off
                a phone screen. */}
            <div
              className="drop absolute top-[34px] w-max font-mono text-label text-warn"
              style={
                z.nisab_value_sar / scale > 0.5
                  ? { insetInlineEnd: `calc(100% - ${nisabAt} + 10px)`, maxWidth: `calc(${nisabAt} - 10px)`, animationDelay: delay(3) }
                  : { insetInlineStart: `calc(${nisabAt} + 10px)`, maxWidth: `calc(100% - ${nisabAt} - 10px)`, animationDelay: delay(3) }
              }
            >
              {fillNodes(n.nisabLine, { value: <Sar value={z.nisab_value_sar} locale={locale} />, basis: (locale === "ar" && z.nisab_basis_ar) || z.nisab_basis })}
            </div>
          </Step>
        </div>
        {/* E5: one focusable target per bar, laid over the picture in the same grid. Outside the image, because
            an image's children are presentational and cannot hold controls. */}
        <div className={`pointer-events-none absolute inset-0 ${GRID}`}>
          {bars.map((bar) => (
            <Fragment key={bar.label}>
              <div aria-hidden="true" className={`invisible ${bar.strong ? "font-semibold" : ""}`}>
                <div className="text-label">{bar.label}</div>
                <div className="font-mono text-value">{sar(bar.amount)}</div>
              </div>
              <div className="relative h-[30px]">
                <TipButton
                  label={`${bar.label}: ${spoken(bar.amount)}`}
                  tip={`${bar.label}: ${sar(bar.amount)}`}
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
  const share = snapshot ? (at(snapshot) - at(start)) / (at(end) - at(start) || 1) : 0;
  // B18: the snapshot label sits over its marker, kept inside the track. Shifting it back by its own share of the
  // track keeps both edges inside at any width and label length (left edge share x (track - label) >= 0), and the
  // marker always falls within the label. The 14 px scale of DECISIONS 60 made the fixed -50% step overflow at 360 px.
  const snapshotShift = `${(-Math.min(Math.max(share, 0), 1) * 100).toFixed(2)}%`;
  const alt = fill(n.hawlAlt, { start: date(start), end: date(end), snapshot: snapshot ? date(snapshot) : m.common.dash });
  return (
    <section aria-labelledby="hawl" className="rise flex min-w-0 flex-[999_1_560px] flex-col gap-5 border border-line bg-card p-5 sm:p-9" style={{ animationDelay: delay(1) }}>
      <h2 id="hawl" className="heading text-heading">
        <Term id="hawl" locale={locale}>
          {n.hawlTitle}
        </Term>
      </h2>
      <div role="img" aria-label={alt} dir="ltr" className="relative h-[110px] min-[400px]:h-[90px]">
        <div className="absolute inset-x-0 top-9 h-2.5 bg-line2" />
        <div className="fill-bar fill-from-start inset-x-0 !top-9 !bottom-auto h-2.5 bg-accent" style={{ animationDelay: delay(2) }} />
        <div className="absolute left-0 top-7 h-[26px] w-[3px] bg-ink" />
        <div className="absolute right-0 top-7 h-[26px] w-[3px] bg-ink" />
        {marker && (
          <div className="drop absolute top-7 -ml-[7px] box-border h-[26px] w-3.5 border-[3px] border-ink bg-card" style={{ left: marker, animationDelay: delay(3) }} />
        )}
        {/* B18: below 400 px each end label takes two lines, so the start and end labels cannot collide. At 14 px
            (LG3, DECISIONS 60) the labels take tight lines, so a three-line snapshot label still clears them. */}
        <div data-hawl-label="start" className="absolute left-0 top-[62px] max-w-[48%] font-mono text-label leading-tight">
          <span className="block min-[400px]:inline">{n.hawlStart}</span> <span className="block min-[400px]:inline">{date(start)}</span>
        </div>
        <div data-hawl-label="end" className="absolute right-0 top-[62px] max-w-[48%] text-end font-mono text-label leading-tight">
          <span className="block min-[400px]:inline">{n.hawlEnd}</span> <span className="block min-[400px]:inline">{date(end)}</span>
        </div>
        {snapshot && marker && (
          <div data-hawl-label="snapshot" className="absolute top-0 w-max max-w-full" style={{ left: marker, translate: `${snapshotShift} 0` }}>
            <div className="drop font-mono text-label leading-tight" style={{ animationDelay: delay(3) }}>
              {n.snapshot} {date(snapshot)}
            </div>
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
    <section aria-labelledby="amount" className="panel rise flex min-w-0 flex-[1_1_420px] flex-col gap-4 p-5 sm:p-9" style={{ animationDelay: delay(2) }}>
      <h2 id="amount" className="heading text-heading">
        {n.amountTitle}
      </h2>
      <div aria-hidden="true" className="rounded-bar relative h-11 overflow-hidden" style={{ background: "var(--panelRule)" }}>
        <div className="fill-bar fill-from-start start-0 min-w-3" style={{ width: pct(z.rate, 1), background: "var(--gold-amount)", animationDelay: delay(4) }} />
      </div>
      <div className="font-mono text-body leading-relaxed">
        {z.zakat_base_sar !== undefined && (
          <div>
            {n.base} <Sar value={z.zakat_base_sar} locale={locale} />
          </div>
        )}
        <div>
          {n.rate} <Probability value={z.rate} locale={locale} />
        </div>
        {/* U10: a calculation that did not run shows no amount, never a zero. */}
        {z.status !== "not_computed" && z.liability_sar !== null && (
          <div className="text-heading" style={{ color: "var(--gold-amount)" }}>
            <span>{n.liability}</span> <Sar value={z.liability_sar} locale={locale} />
          </div>
        )}
      </div>
      <p className="text-label text-muted">{n.asReturned}</p>
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
          <span className="font-mono text-heading sm:text-[34px]">
            <Sar value={z.liability_sar} locale={locale} />
          </span>
        )}
      </div>
      <NisabPlate status={z.nisab_source_status} m={m} />
    </div>
  );
  return (
    <>
      <LensHead transition="zakat" data={data} title={n.pageTitle} aside={aside} locale={locale} m={m} />
      {!z ? (
        <Refusal reason={data.lens_not_run_reason} coverage={data.coverage_days_90d} m={m} />
      ) : (
        <>
          {z.status !== "computed" && z.reason && (
            <div>
              <p>
                {n.reason}: {m.enums.zakat_reason[z.reason]}
              </p>
              {z.detail && (
                <BackendText en={z.detail} ar={z.detail_ar} locale={locale} m={m} />
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
              {/* DECISIONS 57: the backend's Arabic basis, from the same configured grams; the raw value otherwise. */}
              {locale === "ar" && z.nisab_basis_ar ? z.nisab_basis_ar : <Code>{z.nisab_basis}</Code>}
            </Field>
            <Field label={n.method}>
              {label("zakat_method", z.method, m)}
            </Field>
          </Fields>
        </>
      )}
      <DecisionRecord input={recordInput("zakat", data)} receipt={data.receipt} lens={n.title} locale={locale} m={m} />
    </>
  );
}
