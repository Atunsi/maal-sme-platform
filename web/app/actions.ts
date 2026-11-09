"use server";

// Server actions for the header's business switcher (I1) and the credit factor expanders (I3), DECISIONS 45.
// They run on the web server and reach the API through the queue in lib/api.ts, so the browser never calls
// the API and never sees MAAL_API_KEY. Each returns only what the UI shows.
import { getBusinesses, getCredit, getProfile } from "@/lib/api";
import { creditPlate } from "@/lib/decision";
import { getMessages, isLocale } from "@/lib/i18n";
import { isServingId } from "@/lib/population";
import type { PlateVariant } from "@/components/ui";

export type SwitcherPlate = { id: number; ok: true; variant: PlateVariant; word: string } | { id: number; ok: false; word: string };

/** One business's decision plate, for the switcher's list of demo businesses. */
export async function switcherPlate(id: number, locale: string): Promise<SwitcherPlate> {
  const m = getMessages(isLocale(locale) ? locale : "en");
  if (!isServingId(id)) return { id, ok: false, word: m.errors.not_found };
  const r = await getCredit(id);
  if (!r.ok) return { id, ok: false, word: m.errors[r.kind] };
  const plate = creditPlate(r.data, m);
  return { id, ok: true, variant: plate.variant, word: plate.word };
}

export type SwitcherResult = { ok: true; businesses: { business_id: number; sector: string }[] } | { ok: false; word: string };

/** Serving businesses whose ID starts with `q` (two digits or more), at most ten. */
export async function searchServing(q: string, locale: string): Promise<SwitcherResult> {
  const m = getMessages(isLocale(locale) ? locale : "en");
  if (!/^[0-9]{2,9}$/.test(q)) return { ok: true, businesses: [] };
  const r = await getBusinesses({ offset: 0, limit: 10, q });
  if (!r.ok) return { ok: false, word: m.errors[r.kind] };
  return { ok: true, businesses: r.data.businesses.filter((b) => isServingId(b.business_id)) };
}

export type FactorValue = { ok: true; values: Record<string, { value: number | string | boolean | null; nullReason: string | null }> } | { ok: false; word: string };

/** I3: the raw named feature values and null reasons from /profile, for the factors a credit page shows. */
export async function factorValues(id: number, names: string[], locale: string): Promise<FactorValue> {
  const m = getMessages(isLocale(locale) ? locale : "en");
  if (!isServingId(id)) return { ok: false, word: m.errors.not_found };
  const r = await getProfile(id);
  if (!r.ok) return { ok: false, word: m.errors[r.kind] };
  const values: Record<string, { value: number | string | boolean | null; nullReason: string | null }> = {};
  for (const name of names) {
    const features = r.data.features as Record<string, number | string | boolean | null>;
    if (!(name in features)) continue;
    values[name] = { value: features[name] ?? null, nullReason: r.data.null_reasons[name] ?? null };
  }
  return { ok: true, values };
}
