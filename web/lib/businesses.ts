// The five demo businesses, one per state the API returns. Quick data, serving population.
export const DEMO_BUSINESSES = [10001, 10004, 10037, 10040, 10003] as const;

/** Where the landing page and the Business owner demo role go. */
export const DEMO_BUSINESS = DEMO_BUSINESSES[0];

/** The demo role rides in the URL (?as=), so nothing is stored. It proves nothing and gates nothing. */
export function roleQuery(role: string | string[] | null | undefined): string {
  return role === "owner" || role === "admin" ? `?as=${role}` : "";
}
