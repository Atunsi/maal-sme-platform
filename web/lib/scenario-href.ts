// Where a library scenario's page is. The live app picks the scenario from the query (?s= from the menu,
// ?scenario= from Play all and the tour); the online snapshot has one file per scenario, /scenarios/s/<name>/.
import type { Locale } from "@/lib/i18n";

export const STATIC_SITE = process.env.MAAL_SITE_STATIC === "1";

/** `role` is the demo-role query without its "?" ("as=owner"), or "". */
export function scenarioHref(locale: Locale, name: string, role: string, param: "s" | "scenario" = "s"): string {
  if (STATIC_SITE) return `/${locale}/scenarios/s/${name}/${role ? `?${role}` : ""}`;
  return param === "s" ? `/${locale}/scenarios?s=${name}${role ? `&${role}` : ""}` : `/${locale}/scenarios?${role ? `${role}&` : ""}scenario=${name}`;
}

/** The prefix Play all appends a scenario name to. */
export function scenarioHrefBase(locale: Locale, role: string): string {
  return STATIC_SITE ? `/${locale}/scenarios/s/` : `/${locale}/scenarios?${role ? `${role}&` : ""}scenario=`;
}
