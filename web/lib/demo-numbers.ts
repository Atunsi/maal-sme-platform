// CR1 (DECISIONS 62): which demo numbers exist, for the registration number field. Asked of the API on the
// server (GET /businesses, through the request layer, kept 5 minutes), so the range is the store's own and not a
// pair typed here. The config range is only the fallback when the API does not answer.
import "server-only";

import { getBusinesses, type Scope } from "@/lib/api";
import { SERVING_ID_MAX, SERVING_ID_MIN } from "@/lib/population";
import type { DemoNumbers } from "@/lib/registrationNumber";
import { STATIC, staticIds } from "@/lib/static-data";

export async function demoNumbers(scope?: Scope): Promise<DemoNumbers> {
  if (STATIC) {
    // The online preview captured only some businesses: any other number in the demo's range gets the
    // "preview holds only some" message, never "no such business".
    return { from: SERVING_ID_MIN, to: SERVING_ID_MAX, only: staticIds() };
  }
  const first = await getBusinesses({ offset: 0, limit: 1 }, scope);
  if (first.ok && first.data.total > 0 && first.data.businesses[0]) {
    const last = await getBusinesses({ offset: first.data.total - 1, limit: 1 }, scope);
    if (last.ok && last.data.businesses[0]) return { from: first.data.businesses[0].business_id, to: last.data.businesses[0].business_id };
  }
  return { from: SERVING_ID_MIN, to: SERVING_ID_MAX };
}
