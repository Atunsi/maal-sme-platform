import { searchOf } from "@/lib/static-data";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SectionMark } from "@/components/brand/Logos";
import { Flow } from "@/components/Flow";
import { Term } from "@/components/Term";
import { Page } from "@/components/ui";
import { DEMO_BUSINESS, roleQuery } from "@/lib/businesses";
import type { GlossaryId } from "@/lib/glossary";
import { HOW_INTRO, HOW_SECTIONS, segments } from "@/lib/howItWorks";
import { getMessages, isLocale } from "@/lib/i18n";
import { delay } from "@/lib/motion";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ as?: string | string[] }>;
};

// E9: fixed text from lib/howItWorks.ts, each section linking to the same part for the demo business.
export default async function HowItWorksPage({ params, searchParams }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const m = getMessages(locale);
  const query = roleQuery((await searchOf(searchParams)).as);
  const intro = HOW_INTRO[locale];
  const seen = new Set<GlossaryId>(); // a term is a button at its first appearance on the page only
  return (
    <Page>
      <div className="rise">
        <div className="flex items-center gap-2.5 text-muted">
          <SectionMark />
          <span className="eyebrow">{intro.eyebrow}</span>
        </div>
        <h1 className="heading mt-2 text-[40px] sm:text-[52px]">{intro.title}</h1>
        <p className="mt-2 max-w-3xl text-[15px] text-muted">{intro.intro}</p>
      </div>
      <Flow steps={m.landing.steps} />
      <div className="flex flex-col gap-5">
        {HOW_SECTIONS.map((section, i) => {
          const s = section[locale];
          return (
            <section
              key={section.id}
              id={section.id}
              aria-labelledby={`${section.id}-title`}
              className="rise flex flex-col gap-3 border border-line bg-card p-6 sm:p-8"
              style={{ animationDelay: delay(2 + i) }}
            >
              <h2 id={`${section.id}-title`} className="heading text-[26px]">
                {s.title}
              </h2>
              {s.body.map((paragraph) => (
                <p key={paragraph} className="max-w-3xl text-[15px] leading-relaxed">
                  {segments(paragraph).map((part, j) => {
                    if (typeof part === "string") return part;
                    if (seen.has(part.term)) return part.text;
                    seen.add(part.term);
                    return (
                      <Term key={j} id={part.term} locale={locale}>
                        {part.text}
                      </Term>
                    );
                  })}
                </p>
              ))}
              <Link href={`/${locale}${section.link.replace("{id}", String(DEMO_BUSINESS))}${query}`} className="textlink self-start font-semibold">
                {s.linkLabel}
              </Link>
            </section>
          );
        })}
      </div>
    </Page>
  );
}
