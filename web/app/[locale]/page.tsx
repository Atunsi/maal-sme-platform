import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { ArabicLogo, EnglishWordmark, SectionMark } from "@/components/brand/Logos";
import { Flow } from "@/components/Flow";
import { TryBusinesses } from "@/components/TryBusinesses";
import { Plate, Sar } from "@/components/ui";
import { DEMO_BUSINESS } from "@/lib/businesses";
import { decisionWord } from "@/lib/decision";
import { formatInt, formatPct } from "@/lib/format";
import { fill, getMessages, isLocale, type Locale, LOCALES, type Messages, pluralForm } from "@/lib/i18n";
import { getScenario, getScenarioIndex } from "@/lib/scenarios";
import { TOUR_STEPS, tourHref } from "@/lib/tour";
import type { ScenarioObject } from "@/lib/types";
import { nameOf } from "@/lib/business-names";


// The landing page's four lenses. The review queue is a fifth readout, not a lens of its own here.
const LENSES = ["credit", "sharia", "zakat", "forecast"] as const;

const SHARIA_VARIANT = { compliant: "ok", soft_flag_review: "warn", hard_flag: "bad" } as const;
const LEVEL_VARIANT = { none: "ok", watch: "warn", crunch: "bad" } as const;

const pad = (i: number) => String(i + 1).padStart(2, "0");

function SectionHead({ eyebrow, title, id, onDark }: { eyebrow: string; title: string; id: string; onDark?: boolean }) {
  return (
    <div>
      <div className={`eyebrow flex items-center gap-2.5 ${onDark ? "text-gold" : "text-accent"}`}>
        <SectionMark onDark={onDark} />
        {eyebrow}
      </div>
      <h2 id={id} className="heading mt-2 max-w-[820px] text-[36px] sm:text-[48px]">
        {title}
      </h2>
    </div>
  );
}

function Tile({ label, children, first }: { label: string; children: ReactNode; first?: boolean }) {
  return (
    <div className={`square bg-card py-2.5 ${first ? "pe-3" : "px-3"}`}>
      <div className="text-label text-muted">{label}</div>
      {children}
    </div>
  );
}

/** Built from the exported baseline scenario object, so no figure here is typed in (SOP section 2). */
function IllustrativeCard({ o, locale, m }: { o: ScenarioObject; locale: Locale; m: Messages }) {
  const l = m.landing;
  const credit = o.credit;
  const sharia = o.governance.sharia_screen.sharia_screen_status;
  const alert = o.forecast?.status === "computed" ? o.forecast.crunch_alert : null;
  return (
    <div className="rise flex flex-col gap-4 bg-card p-7 text-ink shadow-[18px_18px_0_var(--gold-shadow)] rtl:shadow-[-18px_18px_0_var(--gold-shadow)]" style={{ animationDelay: "0.7s" }}>
      <div className="flex items-center justify-between gap-3 text-label text-muted">
        <span className="font-mono">{fill(l.cardBusiness, { id: o.business_id, name: nameOf(o.business_id, locale), sector: m.enums.sector[o.sector] })}</span>
        <span>{l.illustrative}</span>
      </div>
      {credit && (
        <div>
          <div className={`heading text-[40px] leading-none ${credit.decision === "approved" ? "text-ok" : "text-bad"}`}>{decisionWord(credit, o.credit_decision_detail, m)}</div>
          {credit.amount_sar !== null && (
            <div className="mt-1.5 font-mono text-heading">
              <Sar value={credit.amount_sar} locale={locale} />
            </div>
          )}
          {credit.repayment_months !== null && credit.base_markup_pct !== null && (
            <div className="text-label text-muted">
              {fill(pluralForm(credit.repayment_months, l.cardTerms, locale), { months: formatInt(credit.repayment_months, locale), markup: formatPct(credit.base_markup_pct, locale) })}
            </div>
          )}
        </div>
      )}
      <div className="grid grid-cols-2 gap-px bg-line2">
        <Tile label={m.sharia.title} first>
          <Plate variant={SHARIA_VARIANT[sharia]}>{m.enums.sharia[sharia]}</Plate>
        </Tile>
        <Tile label={m.zakat.title}>
          {o.zakat?.liability_sar != null ? (
            <span className="font-mono">
              <Sar value={o.zakat.liability_sar} locale={locale} />
            </span>
          ) : (
            m.common.dash
          )}
        </Tile>
        <Tile label={m.forecast.title} first>
          {alert ? <Plate variant={LEVEL_VARIANT[alert.level]}>{m.enums.level[alert.level]}</Plate> : m.common.dash}
        </Tile>
        <Tile label={m.anomaly.title}>
          {o.anomaly ? <Plate variant="ink">{fill(pluralForm(o.anomaly.flags.length, m.overview.listed, locale), { n: formatInt(o.anomaly.flags.length, locale) })}</Plate> : m.common.dash}
        </Tile>
      </div>
      <p className="text-label text-muted">{m.sharia.label}</p>
    </div>
  );
}

export default async function LandingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const m = getMessages(locale);
  const l = m.landing;
  const [baseline, index] = await Promise.all([getScenario("baseline"), getScenarioIndex()]);
  const scenarioCount = index.ok ? index.data.scenarios.length : null;
  const facts = [
    { n: LENSES.length, label: l.factLenses },
    ...(scenarioCount === null ? [] : [{ n: scenarioCount, label: l.factScenarios }]),
    { n: 1, label: l.factReceipt }, // one receipt per decision is the design, not a measurement
    { n: LOCALES.length, label: l.factLanguages },
  ];
  const demo = `/${locale}/business/${DEMO_BUSINESS}`;
  return (
    <>
      <section aria-labelledby="hero" data-motion="full" className="on-hero relative overflow-hidden bg-hero text-white">
        <div aria-hidden="true" className="absolute -end-[60px] -top-[60px] opacity-[0.09]">
          <ArabicLogo height={620} color="#ffffff" />
        </div>
        <div className="relative mx-auto flex max-w-[1240px] flex-wrap items-center gap-14 px-6 py-[72px] sm:py-[88px]">
          <div className="flex min-w-0 flex-[999_1_520px] flex-col gap-6">
            <div className="rise eyebrow flex items-center gap-2.5" style={{ color: "var(--hero-muted)" }}>
              <SectionMark onDark />
              {l.eyebrow}
            </div>
            <h1 id="hero" className="heading rise text-[46px] sm:text-[72px]" style={{ animationDelay: "0.15s", lineHeight: 1.05 }}>
              {l.title}
            </h1>
            <span aria-hidden="true" className="verdict-rule w-[140px] text-gold" />
            <p className="rise max-w-[600px] text-value leading-normal" style={{ color: "var(--hero-ink)", animationDelay: "0.4s" }}>
              {l.lead}
            </p>
            <div className="rise flex flex-wrap gap-3.5" style={{ animationDelay: "0.55s" }}>
              <Link href={`/${locale}/sign-in`} className="cta rounded-ctl inline-flex min-h-[52px] items-center bg-white px-6 font-semibold text-solid no-underline">
                {l.ctaSignIn}
              </Link>
              <Link href={`/${locale}/scenarios`} className="rounded-ctl inline-flex min-h-[52px] items-center border-[1.5px] border-white px-6 font-semibold text-white no-underline">
                {fill(pluralForm(scenarioCount ?? 0, l.ctaScenarios, locale), { n: scenarioCount === null ? "" : formatInt(scenarioCount, locale) })}
              </Link>
              <Link
                href={tourHref(locale, TOUR_STEPS[0]!, null)}
                data-tour-start
                className="rounded-ctl inline-flex min-h-[52px] items-center px-2 font-semibold text-white underline underline-offset-4"
              >
                {m.tour.start}
              </Link>
            </div>
          </div>
          {baseline.ok && (
            <div className="relative min-w-0 flex-[1_1_460px]">
              <div className="floaty">
                <IllustrativeCard o={baseline.data} locale={locale} m={m} />
              </div>
            </div>
          )}
        </div>
      </section>
      <TryBusinesses locale={locale} m={m} />

      <section aria-label={l.builtFor} className="bleed border-b border-line bg-card">
        <div className="mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-x-12 gap-y-4 px-6 py-6">
          <span className="heading caps text-label text-muted">{l.builtFor}</span>
          {l.audiences.map((audience) => (
            <span key={audience} className="text-value font-medium">
              {audience}
            </span>
          ))}
        </div>
      </section>

      <section id="how" aria-labelledby="howh" data-phone="band" className="drift mx-auto flex max-w-[1240px] flex-col gap-10 px-6 py-[72px] sm:py-[88px]">
        <SectionHead eyebrow={l.howEyebrow} title={l.howTitle} id="howh" />
        <Flow steps={l.steps} full />
      </section>

      <section id="lenses" aria-labelledby="lensh" className="drift bleed border-y border-line bg-card">
        <div className="mx-auto flex max-w-[1240px] flex-col gap-9 px-6 py-[72px] sm:py-[88px]">
          <SectionHead eyebrow={l.lensEyebrow} title={l.lensTitle} id="lensh" />
          <div className="grid grid-cols-[repeat(auto-fit,minmax(250px,1fr))] gap-5">
            {LENSES.map((lens, i) => (
              <Link
                key={lens}
                href={`${demo}/${lens}`}
                data-phone="lens-card"
                className="lift rise flex min-h-[300px] flex-col gap-2.5 border border-line bg-page p-6 text-ink no-underline"
                style={{ animationDelay: `${(0.1 + i * 0.12).toFixed(2)}s` }}
              >
                <span className="font-mono text-label text-accent">{pad(i)}</span>
                <span className="heading text-heading">{m.nav[lens]}</span>
                {locale === "en" && (
                  <span lang="ar" className="text-value text-muted">
                    {getMessages("ar").nav[lens]}
                  </span>
                )}
                <span className="text-body leading-normal">{l.lensText[lens]}</span>
                <span className="mt-auto font-semibold text-accent">{fill(l.lensOpen, { lens: m.nav[lens] })}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section aria-label={l.countsLabel} data-phone="band" className="drift mx-auto w-full max-w-[1240px] px-6 py-[72px]">
        <div data-phone="counts" className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-px bg-line">
          {facts.map((fact, i) => (
            <div key={fact.label} className="rise flex flex-col gap-2.5 bg-page px-6 py-8" style={{ animationDelay: `${(0.1 + i * 0.12).toFixed(2)}s` }}>
              <span className="heading text-[96px] leading-none text-accent">{formatInt(fact.n, locale)}</span>
              <span>{fact.label}</span>
            </div>
          ))}
        </div>
        <p className="mt-3.5 text-label text-muted">{l.factsNote}</p>
      </section>

      <section id="different" aria-labelledby="diffh" className="on-hero" style={{ background: "var(--night)", color: "var(--night-ink)" }}>
        <div className="mx-auto flex max-w-[1240px] flex-col gap-10 px-6 py-[72px] sm:py-[88px]">
          <SectionHead eyebrow={l.whyEyebrow} title={l.whyTitle} id="diffh" onDark />
          <div className="grid grid-cols-1 gap-px sm:grid-cols-2" style={{ background: "var(--night-rule)" }}>
            {l.why.map((item, i) => (
              <div key={item.title} className="rise flex flex-col gap-2.5 p-8" style={{ background: "var(--night)", animationDelay: `${(0.1 + i * 0.12).toFixed(2)}s` }}>
                <span className="font-mono text-label text-gold">{pad(i)}</span>
                <span className="heading text-heading">{item.title}</span>
                <span className="text-body leading-relaxed" style={{ color: "var(--night-muted)" }}>
                  {item.text}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="faq" aria-labelledby="faqh" data-phone="band" className="drift mx-auto flex max-w-[900px] flex-col gap-5 px-6 py-[72px] sm:py-[88px]">
        <h2 id="faqh" className="heading mb-3 text-[48px]">
          {l.faqTitle}
        </h2>
        {l.faq.map((item) => (
          <details key={item.q} className="faq border-t border-line py-3.5">
            <summary className="text-value font-semibold">
              <span>{item.q}</span>
              {/* B15: the word follows the native open state; screen readers hear that state, not the word. */}
              <span aria-hidden="true" className="flex-none font-mono text-label font-normal text-accent">
                <span className="faq-open">{l.faqOpen}</span>
                <span className="faq-close">{l.faqClose}</span>
              </span>
            </summary>
            <p className="mt-2.5 text-body leading-relaxed text-muted">{item.a}</p>
          </details>
        ))}
        <Link href={`/${locale}/how-it-works`} className="textlink self-start text-body font-semibold">
          {l.howLink}
        </Link>
      </section>

      <section aria-label={l.closeLabel} className="on-hero bg-hero text-white">
        <div className="mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-6 px-6 py-[72px]">
          <div>
            <div className="flex items-end gap-4">
              <ArabicLogo height={84} color="#ffffff" label={getMessages("ar").app.name} />
              <EnglishWordmark height={30} color="#ffffff" label={getMessages("en").app.name} />
            </div>
            <div className="heading mt-2 text-4xl">{l.closeTitle}</div>
          </div>
          <Link href={`/${locale}/sign-in`} className="cta rounded-ctl inline-flex min-h-14 items-center bg-white px-7 text-value font-semibold text-solid no-underline">
            {l.closeCta}
          </Link>
        </div>
      </section>
      <div className="mx-auto flex max-w-[1240px] flex-wrap justify-between gap-x-8 gap-y-3 px-6 pt-7 text-label text-muted">
        <span>{l.project}</span>
        <span>{l.notOffer}</span>
      </div>
    </>
  );
}
