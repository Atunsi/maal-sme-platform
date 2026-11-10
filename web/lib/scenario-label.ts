/**
 * A library label reads "Name — what happens". The dash is a separator, and the design shows the two
 * parts on separate lines, so splitting there drops no word and keeps the symbol off the page.
 */
export function scenarioName(label: string): { name: string; detail: string | null } {
  const at = label.indexOf(" — ");
  if (at === -1) return { name: label, detail: null };
  const detail = label.slice(at + 3);
  return { name: label.slice(0, at), detail: detail.charAt(0).toUpperCase() + detail.slice(1) };
}

type LibraryText = { label: string; story: string; label_ar?: string; story_ar?: string };

/**
 * DECISIONS 57: a scenario's words in the page's language. The Arabic label and story come from
 * scenarios/library_ar.yaml through the export (web/scenarios-data/index.json), never from a translation
 * here; an Arabic label reads "الاسم: ما يحدث". Without them the English stays, marked lang="en".
 */
export function scenarioText(entry: LibraryText, locale: "en" | "ar"): { name: string; detail: string | null; story: string; lang: "en" | undefined } {
  if (locale === "ar" && entry.label_ar && entry.story_ar) {
    const at = entry.label_ar.indexOf(": ");
    return {
      name: at === -1 ? entry.label_ar : entry.label_ar.slice(0, at),
      detail: at === -1 ? null : entry.label_ar.slice(at + 2),
      story: entry.story_ar,
      lang: undefined,
    };
  }
  return { ...scenarioName(entry.label), story: entry.story, lang: "en" };
}

/** The library's names by scenario id, for the compare table's column heads. An id not in it (a custom run) keeps its English label. */
export function scenarioNames(entries: (LibraryText & { name: string })[], locale: "en" | "ar"): Record<string, { name: string; lang: "en" | undefined }> {
  return Object.fromEntries(entries.map((entry) => [entry.name, scenarioText(entry, locale)]));
}
