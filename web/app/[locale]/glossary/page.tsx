import { notFound } from "next/navigation";
import { SectionMark } from "@/components/brand/Logos";
import { Page } from "@/components/ui";
import { glossaryFor } from "@/lib/glossary";
import { getMessages, isLocale } from "@/lib/i18n";
import { titleFor } from "@/lib/page-title";

// E3: every glossary entry, alphabetically for the locale. Fixed text; nothing here calls the API.
export const generateMetadata = titleFor((m) => m.glossary.title);

export default async function GlossaryPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const m = getMessages(locale);
  const g = m.glossary;
  return (
    <Page>
      <div className="rise">
        <div className="flex items-center gap-2.5 text-muted">
          <SectionMark />
          <span className="eyebrow">{g.eyebrow}</span>
        </div>
        <h1 className="heading mt-2 text-[40px] sm:text-[52px]">{g.title}</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted">{g.intro}</p>
      </div>
      <dl className="grid grid-cols-1 gap-x-10 gap-y-0 border border-line bg-card px-6 py-2 sm:px-9 md:grid-cols-2">
        {glossaryFor(locale).map((entry) => (
          <div key={entry.id} id={entry.id} className="border-b border-line2 py-4 last:border-b-0 md:[&:nth-last-child(2)]:border-b-0">
            <dt className="heading text-xl">{entry[locale].term}</dt>
            <dd className="mt-1 text-[15px] leading-relaxed text-muted">{entry[locale].definition}</dd>
          </div>
        ))}
      </dl>
    </Page>
  );
}
