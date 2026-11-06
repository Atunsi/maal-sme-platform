import Link from "next/link";
import { notFound } from "next/navigation";
import { BusinessPicker } from "@/components/BusinessPicker";
import { Card, Field, Fields, Num } from "@/components/ui";
import { getHealth } from "@/lib/api";
import demo from "@/lib/demo-businesses.json"; // ids and English names written from config.yaml demo_businesses
import { formatInt } from "@/lib/format";
import { fill, getMessages, isLocale } from "@/lib/i18n";
import { SERVING_ID_MAX, SERVING_ID_MIN } from "@/lib/population";

export const dynamic = "force-dynamic";

export default async function PickerPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const m = getMessages(locale);
  const p = m.picker;
  const health = await getHealth();
  const range = { min: String(SERVING_ID_MIN), max: String(SERVING_ID_MAX) };
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{m.landing.title}</h1>
        <p className="mt-1 max-w-2xl">{m.landing.lead}</p>
      </div>
      <Card title={p.inputLabel}>
        <BusinessPicker
          locale={locale}
          labels={{ input: p.inputLabel, help: fill(p.inputHelp, range), submit: p.submit, invalid: fill(p.invalid, range) }}
        />
        <div className="mt-4">
          <Fields>
            <Field label={m.common.population}>{m.enums.population.serving}</Field>
            <Field label={m.common.dataSource}>{m.enums.data_source.synthetic}</Field>
            <Field label={p.available}>
              {health.ok ? <Num>{formatInt(health.data.serving_businesses, locale)}</Num> : p.unavailable}
            </Field>
          </Fields>
        </div>
      </Card>
      <section aria-labelledby="demo-heading">
        <h2 id="demo-heading" className="mb-3 text-lg font-semibold">
          {m.admin.title}
        </h2>
        <ul className="grid gap-4 sm:grid-cols-3">
          {demo.businesses.map((business) => (
            <li key={business.id}>
              <Link
                href={`/${locale}/business/${business.id}`}
                className="block h-full rounded-lg border border-line bg-card p-4 hover:border-brand"
              >
                <span className="block font-semibold text-brand">
                  <Num>{business.id}</Num>
                </span>
                <span className="mt-1 block text-sm">{locale === "ar" ? business.name_ar : business.name_en}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
