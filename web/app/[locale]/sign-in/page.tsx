import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArabicLogo, EnglishWordmark, LogoBand } from "@/components/brand/Logos";
import { DigitsToggle } from "@/components/DigitsToggle";
import { LanguageToggle } from "@/components/LanguageToggle";
import { SignInForm } from "@/components/SignInForm";
import { ThemeToggle } from "@/components/ThemeToggle";
import { getMessages, isLocale } from "@/lib/i18n";

export default async function SignInPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const m = getMessages(locale);
  const s = m.signIn;
  const arName = getMessages("ar").app.name;
  const lenses = [m.nav.credit, m.nav.sharia, m.nav.zakat, m.nav.forecast, m.nav.review];
  return (
    <div data-motion="full" data-phone="signin" className="flex min-h-[860px] flex-wrap">
      <section aria-label={s.about} data-phone="signin-brand" className="on-hero relative flex min-w-0 flex-[1_1_560px] flex-col justify-between gap-10 overflow-hidden bg-hero px-8 pb-14 pt-[76px] text-white sm:px-14">
        <div className="absolute inset-x-0 top-0">
          <LogoBand onDark />
        </div>
        <div aria-hidden="true" className="absolute -bottom-40 -end-[120px] opacity-[0.08]">
          <ArabicLogo height={700} color="#ffffff" />
        </div>
        <Link href={`/${locale}`} aria-label={m.nav.home} className="rise relative inline-flex min-h-11 min-w-11 items-center self-start text-white">
          <EnglishWordmark height={20} />
        </Link>
        <div className="relative flex flex-col gap-6">
          <h1 className="flex flex-col gap-5">
            <ArabicLogo height={250} color="#ffffff" label={arName} animate />
            <EnglishWordmark height={44} color="#ffffff" label={getMessages("en").app.name} animate />
          </h1>
          <span aria-hidden="true" className="verdict-rule w-[120px] text-gold" style={{ height: 5, animationDelay: "1.8s" }} />
          <p className="rise max-w-[520px] text-xl leading-normal" style={{ animationDelay: "2s" }}>
            <span lang="ar">{arName}</span> {s.meaning}
          </p>
          <p className="rise max-w-[520px] text-[15px]" style={{ color: "var(--hero-muted)", animationDelay: "2.2s" }}>
            {s.receiptLine}
          </p>
        </div>
        <div className="rise eyebrow relative flex flex-wrap gap-6 !text-xs" style={{ color: "var(--hero-muted)", animationDelay: "2.4s" }}>
          {lenses.map((lens) => (
            <span key={lens}>{lens}</span>
          ))}
        </div>
      </section>

      <section aria-labelledby="signin" className="flex min-w-0 flex-[1_1_480px] flex-col px-8 py-8 sm:px-14">
        <div className="flex justify-end gap-3">
          <Suspense>
            <LanguageToggle locale={locale} label={m.nav.language} />
          </Suspense>
          <ThemeToggle label={m.nav.themeDark} />
          {locale === "ar" && <DigitsToggle label={m.nav.digitsArab} />}
        </div>
        <div className="mx-auto flex w-full max-w-[440px] flex-1 flex-col justify-center gap-6">
          <div className="rise" style={{ animationDelay: "0.3s" }}>
            <h2 id="signin" className="heading text-[44px]">
              {s.title}
            </h2>
            <p className="mt-1.5 text-muted">{s.intro}</p>
          </div>
          <SignInForm locale={locale} s={s} />
          <div className="rise text-[13px] text-muted" style={{ animationDelay: "0.75s" }}>
            <p className="font-medium text-ink">{s.demo}</p>
            <p className="mt-1">{s.synthetic}</p>
          </div>
        </div>
      </section>
    </div>
  );
}
