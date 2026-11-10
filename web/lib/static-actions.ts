// The online demo snapshot's stand-ins for app/actions.ts (next.config.ts aliases that module here when
// MAAL_STATIC=1). A static host runs no server, so these read the captured API responses published beside
// the pages (static-data/, lib/static-data.ts) from the browser, with the same signatures and results.
import { creditPlate } from "@/lib/decision";
import { getMessages, isLocale } from "@/lib/i18n";
import { isServingId } from "@/lib/population";
import { CreditResponse, ProfileResponse } from "@/lib/schemas";
import type { PlateVariant } from "@/components/ui";

export type SwitcherPlate = { id: number; ok: true; variant: PlateVariant; word: string } | { id: number; ok: false; word: string };
export type SwitcherResult = { ok: true; businesses: { business_id: number; sector: string }[] } | { ok: false; word: string };
export type FactorValue = { ok: true; values: Record<string, { value: number | string | boolean | null; nullReason: string | null }> } | { ok: false; word: string };

const BASE = process.env.MAAL_SITE_BASE ?? "";
const fileOf = (path: string) => `${path.replace(/^\//, "").replace(/[^a-zA-Z0-9]+/g, "_")}.json`;

async function snapshot(path: string): Promise<unknown> {
  const res = await fetch(`${BASE}/static-data/${fileOf(path)}`);
  return res.ok ? res.json() : undefined;
}

export async function switcherPlate(id: number, locale: string): Promise<SwitcherPlate> {
  const m = getMessages(isLocale(locale) ? locale : "en");
  const parsed = CreditResponse.safeParse(await snapshot(`/lenses/credit?business_id=${id}`));
  if (!isServingId(id) || !parsed.success) return { id, ok: false, word: m.errors.not_found };
  const plate = creditPlate(parsed.data, m);
  return { id, ok: true, variant: plate.variant, word: plate.word };
}

export async function searchServing(q: string): Promise<SwitcherResult> {
  if (!/^[0-9]{2,9}$/.test(q)) return { ok: true, businesses: [] };
  const all = ((await snapshot("/businesses-snapshot")) as { business_id: number; sector: string }[] | undefined) ?? [];
  return { ok: true, businesses: all.filter((b) => String(b.business_id).startsWith(q)).slice(0, 10) };
}

export async function factorValues(id: number, names: string[], locale: string): Promise<FactorValue> {
  const m = getMessages(isLocale(locale) ? locale : "en");
  const parsed = ProfileResponse.safeParse(await snapshot(`/profile/${id}`));
  if (!parsed.success) return { ok: false, word: m.errors.not_found };
  const features = parsed.data.features as Record<string, number | string | boolean | null>;
  const values: Record<string, { value: number | string | boolean | null; nullReason: string | null }> = {};
  for (const name of names) if (name in features) values[name] = { value: features[name] ?? null, nullReason: parsed.data.null_reasons[name] ?? null };
  return { ok: true, values };
}
