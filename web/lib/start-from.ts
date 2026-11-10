// I5 (DECISIONS 45): the builder's "Start from". A library scenario object carries its own shocks in
// scenario.overrides; this turns them into builder shocks, or returns null when the builder cannot express
// them: no shock at all, the same shock type twice, more than the catalogue's cap, a type or parameter the
// catalogue lacks, or a value outside its bounds. Nothing is invented: every value is the object's own.
import type { Shock } from "@/lib/custom-scenario";
import type { ScenarioCatalog } from "@/lib/types";

type Overrides = {
  inject_cash_crunch?: Record<string, number> | null;
  inject_anomalies?: ({ type: string } & Record<string, number | string>)[];
  operating_start_date?: string;
};

export function libraryShocks(overrides: unknown, catalog: ScenarioCatalog): Shock[] | null {
  const o = (overrides ?? {}) as Overrides;
  const shocks: Shock[] = [];
  if (o.inject_cash_crunch) shocks.push({ type: "cash_crunch", params: { ...o.inject_cash_crunch } });
  for (const anomaly of o.inject_anomalies ?? []) {
    const { type, ...rest } = anomaly;
    shocks.push({ type, params: Object.fromEntries(Object.entries(rest).map(([k, v]) => [k, Number(v)])) });
  }
  if (o.operating_start_date !== undefined) {
    // The newcomer shock has no parameter; its start date is fixed, so it fits only at that date.
    if (catalog.shock_types.newcomer?.fixed.operating_start_date !== o.operating_start_date) return null;
    shocks.push({ type: "newcomer", params: {} });
  }
  if (shocks.length === 0 || shocks.length > catalog.max_shocks) return null;
  if (new Set(shocks.map((s) => s.type)).size !== shocks.length) return null;
  for (const shock of shocks) {
    const spec = catalog.shock_types[shock.type];
    if (!spec) return null;
    const names = Object.keys(spec.params);
    if (Object.keys(shock.params).sort().join() !== [...names].sort().join()) return null;
    for (const name of names) {
      const v = shock.params[name]!;
      const b = spec.params[name]!;
      if (!Number.isFinite(v) || v < b.min || v > b.max) return null;
    }
  }
  return shocks;
}
