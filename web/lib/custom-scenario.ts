// E12: the custom scenario's shocks in the URL, so a result can be shared and re-run (DECISIONS 51).
// One ?shock= per shock: the type, then each parameter's value in the catalogue's order, joined by dots,
// for example ?shock=cash_crunch.16.40&shock=large_transfer.10. Nothing is stored anywhere.
import type { ScenarioCatalog } from "@/lib/types";

export type Shock = { type: string; params: Record<string, number> };

export function paramNames(catalog: ScenarioCatalog, type: string): string[] {
  return Object.keys(catalog.shock_types[type]?.params ?? {});
}

export function encodeShock(catalog: ScenarioCatalog, shock: Shock): string {
  return [shock.type, ...paramNames(catalog, shock.type).map((p) => String(shock.params[p]))].join(".");
}

/** Shocks from the URL. A malformed one is dropped here; the API checks the bounds (422). */
export function decodeShocks(catalog: ScenarioCatalog, raw: string | string[] | undefined): Shock[] {
  const list = raw === undefined ? [] : Array.isArray(raw) ? raw : [raw];
  const out: Shock[] = [];
  for (const item of list) {
    const [type, ...values] = item.split(".");
    if (!type || !(type in catalog.shock_types)) continue;
    const names = paramNames(catalog, type);
    if (values.length !== names.length || !values.every((v) => /^[0-9]{1,4}$/.test(v))) continue;
    out.push({ type, params: Object.fromEntries(names.map((n, i) => [n, Number(values[i])])) });
  }
  return out;
}
