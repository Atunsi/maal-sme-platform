import { ReceiptPanel } from "@/components/ReceiptPanel";
import { BackendText, Badge, Card, Code, Field, Fields, Num, ProvenanceLine, Refusal } from "@/components/ui";
import { formatDate, formatRaw, formatSar } from "@/lib/format";
import type { Locale, Messages } from "@/lib/i18n";
import type { ZakatResponse } from "@/lib/types";

const STATUS_TONE = { computed: "good", zero_liability: "neutral", not_computed: "warn" } as const;

export function ZakatCard({ data, locale, m }: { data: ZakatResponse; locale: Locale; m: Messages }) {
  const z = data.zakat;
  const sar = (value: number | undefined) =>
    value === undefined ? m.common.dash : <Num>{formatSar(value, locale)}</Num>;
  const date = (value: string | undefined) =>
    value === undefined ? m.common.dash : <bdi>{formatDate(value, locale)}</bdi>;
  const placeholder = z?.nisab_source_status === "placeholder_unverified";
  return (
    <Card id="zakat" title={m.zakat.title}>
      <ProvenanceLine value={data} locale={locale} m={m} />
      {!z ? (
        <Refusal reason={data.lens_not_run_reason} m={m} />
      ) : (
        <>
          <p className="mb-3 flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted">{m.zakat.statusLabel}</span>
            <Badge tone={STATUS_TONE[z.status]}>{m.enums.zakat_status[z.status]}</Badge>
            {placeholder && <Badge tone="warn">{m.zakat.placeholder}</Badge>}
          </p>
          {z.status !== "computed" && z.reason && (
            <div className="mb-3">
              <p>
                {m.zakat.reason}: {m.enums.zakat_reason[z.reason]}
              </p>
              {z.detail && (
                <BackendText locale={locale} m={m}>
                  {z.detail}
                </BackendText>
              )}
            </div>
          )}
          <Fields>
            {/* U10: a calculation that did not run shows no amount, never a zero. */}
            {z.status !== "not_computed" && z.liability_sar !== null && (
              <Field label={m.zakat.liability}>{sar(z.liability_sar)}</Field>
            )}
            <Field label={m.zakat.base}>{sar(z.zakat_base_sar)}</Field>
            <Field label={m.zakat.assets}>{sar(z.zakatable_assets_sar)}</Field>
            <Field label={m.zakat.liabilities}>{sar(z.deductible_liabilities_sar)}</Field>
            <Field label={m.zakat.nisab}>{sar(z.nisab_value_sar)}</Field>
            <Field label={m.zakat.nisabBasis}>
              <Code>{z.nisab_basis}</Code>
            </Field>
            <Field label={m.zakat.rate}>
              <Num>{formatRaw(z.rate, locale)}</Num>
            </Field>
            <Field label={m.zakat.thresholdMet}>
              {z.nisab_threshold_met === undefined ? m.common.dash : z.nisab_threshold_met ? m.common.yes : m.common.no}
            </Field>
            <Field label={m.zakat.snapshot}>{date(z.snapshot_month_end)}</Field>
            <Field label={m.zakat.hawlStart}>{date(z.hawl_start_date)}</Field>
            <Field label={m.zakat.hawlEnd}>{date(z.hawl_completion_date)}</Field>
            <Field label={m.zakat.hawlSource}>
              {z.hawl_start_source ? <Code>{z.hawl_start_source}</Code> : m.common.dash}
            </Field>
            <Field label={m.zakat.hawlRule}>
              <Code>{z.hawl_rule}</Code>
            </Field>
            <Field label={m.zakat.method}>
              <Code>{z.method}</Code>
            </Field>
          </Fields>
        </>
      )}
      <ReceiptPanel receipt={data.receipt} lens={m.zakat.title} m={m} />
    </Card>
  );
}
