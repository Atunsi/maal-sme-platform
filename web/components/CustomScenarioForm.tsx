import type { Shock } from "@/lib/custom-scenario";
import { fill, type Messages } from "@/lib/i18n";
import type { ScenarioCatalog } from "@/lib/types";

/**
 * E12: the custom scenario builder, built from GET /scenarios. One fieldset per shock type: a checkbox to
 * include it, and a number input per parameter carrying the API's own min, max and step, so the browser
 * blocks an out-of-range value before the API does. Input names are `<type>.<parameter>`; none can name
 * a term of an offer (U1: a named entry in the input allowlist, with its own test). A server action
 * posts the form; it works without JavaScript.
 */
export function CustomScenarioForm({
  catalog,
  chosen,
  action,
  hidden,
  m,
}: {
  catalog: ScenarioCatalog;
  chosen: Shock[];
  action: (form: FormData) => Promise<void>;
  /** Carried to the server action: the page's locale and the demo role. */
  hidden: { locale: string; as: string };
  m: Messages;
}) {
  const c = m.custom;
  const types = c.types as Record<string, string>;
  const params = c.params as Record<string, string>;
  const units = c.units as Record<string, string>;
  return (
    <form action={action} className="flex flex-col gap-4" data-custom-form>
      <input type="hidden" name="locale" value={hidden.locale} />
      {hidden.as && <input type="hidden" name="as" value={hidden.as} />}
      <p className="text-sm text-muted">{fill(c.tooMany, { n: String(catalog.max_shocks) })}</p>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {Object.entries(catalog.shock_types).map(([type, spec]) => {
          const current = chosen.find((s) => s.type === type);
          return (
            <fieldset key={type} className="flex flex-col gap-3 border border-line bg-card p-5">
              <legend className="heading px-1 text-xl">{types[type] ?? type}</legend>
              <label className="flex min-h-11 items-center gap-3 text-sm font-medium">
                <input type="checkbox" name="include" value={type} defaultChecked={Boolean(current)} className="h-5 w-5" />
                {c.include}
              </label>
              {Object.entries(spec.params).map(([name, b]) => (
                <label key={name} className="flex flex-col gap-1 text-sm font-medium">
                  {params[name] ?? name}
                  <input
                    type="number"
                    name={`${type}.${name}`}
                    min={b.min}
                    max={b.max}
                    step={b.step}
                    required
                    defaultValue={current?.params[name] ?? b.min}
                    dir="ltr"
                    className="field w-32 font-mono"
                  />
                  <span className="text-xs font-normal text-muted">
                    {fill(c.range, { min: String(b.min), max: String(b.max), unit: units[b.unit] ?? b.unit }).trim()}
                  </span>
                </label>
              ))}
              {Object.entries(spec.fixed).map(([name, value]) => (
                <p key={name} className="text-xs text-muted">
                  {c.fixed} <bdi className="font-mono">{String(value)}</bdi>
                </p>
              ))}
            </fieldset>
          );
        })}
      </div>
      <button type="submit" className="solid-btn min-h-12 self-start">
        {c.run}
      </button>
    </form>
  );
}
