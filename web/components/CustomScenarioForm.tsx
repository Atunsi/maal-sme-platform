"use client";

import { useState } from "react";
import type { Shock } from "@/lib/custom-scenario";
import { fill, type Messages } from "@/lib/i18n";
import type { ScenarioCatalog } from "@/lib/types";

export type StartFrom = { name: string; label: string; lang?: "en"; shocks: Shock[] };

/**
 * E12: the custom scenario builder, built from GET /scenarios. One fieldset per shock type: a checkbox to
 * include it, and a number input per parameter carrying the API's own min, max and step, so the browser
 * blocks an out-of-range value before the API does. Input names are `<type>.<parameter>`; none can name
 * a term of an offer (U1: a named entry in the input allowlist, with its own test). A server action
 * posts the form; it works without JavaScript.
 *
 * I5 (DECISIONS 45): a "Start from" select fills the form from a library scenario's own shocks; each
 * number has a range slider on the same bounds and step (named `<type>.<parameter>.slider`, which the
 * server action ignores); a line above Run says which shocks are chosen.
 */
export function CustomScenarioForm({
  catalog,
  chosen,
  action,
  hidden,
  starts = [],
  m,
}: {
  catalog: ScenarioCatalog;
  chosen: Shock[];
  action: (form: FormData) => Promise<void>;
  /** Carried to the server action: the page's locale and the demo role. */
  hidden: { locale: string; as: string };
  starts?: StartFrom[];
  m: Messages;
}) {
  const c = m.custom;
  const types = c.types as Record<string, string>;
  const params = c.params as Record<string, string>;
  const units = c.units as Record<string, string>;
  const fromShocks = (list: Shock[]) => ({
    included: new Set(list.map((s) => s.type)),
    values: Object.fromEntries(
      Object.entries(catalog.shock_types).flatMap(([type, spec]) =>
        Object.entries(spec.params).map(([name, b]) => [`${type}.${name}`, list.find((s) => s.type === type)?.params[name] ?? b.min]),
      ),
    ) as Record<string, number>,
  });
  const [state, setState] = useState(() => fromShocks(chosen));
  const [start, setStart] = useState("");

  const setValue = (key: string, raw: string) => setState((s) => ({ ...s, values: { ...s.values, [key]: Number(raw) } }));
  const toggle = (type: string) =>
    setState((s) => {
      const included = new Set(s.included);
      if (included.has(type)) included.delete(type);
      else included.add(type);
      return { ...s, included };
    });

  // The summary, in words: each chosen shock and its values, in the catalogue's order.
  const summary = Object.entries(catalog.shock_types)
    .filter(([type]) => state.included.has(type))
    .map(([type, spec]) => {
      const values = Object.entries(spec.params).map(([name, b]) => `${params[name] ?? name} ${state.values[`${type}.${name}`]} ${units[b.unit] ?? b.unit}`);
      return values.length ? `${types[type] ?? type} (${values.join(", ")})` : (types[type] ?? type);
    });

  return (
    <form action={action} className="flex flex-col gap-4" data-custom-form>
      <input type="hidden" name="locale" value={hidden.locale} />
      {hidden.as && <input type="hidden" name="as" value={hidden.as} />}
      {starts.length > 0 && (
        <label className="flex max-w-md flex-col gap-1.5 text-sm font-medium">
          {c.startFrom}
          <select
            className="field"
            value={start}
            data-start-from
            onChange={(event) => {
              setStart(event.target.value);
              const picked = starts.find((s) => s.name === event.target.value);
              if (picked) setState(fromShocks(picked.shocks));
            }}
          >
            <option value="">{c.startNone}</option>
            {starts.map((s) => (
              <option key={s.name} value={s.name} lang={s.lang}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      )}
      <p className="text-sm text-muted">{fill(c.tooMany, { n: String(catalog.max_shocks) })}</p>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {Object.entries(catalog.shock_types).map(([type, spec]) => (
          <fieldset key={type} className="flex flex-col gap-3 border border-line bg-card p-5">
            <legend className="heading px-1 text-xl">{types[type] ?? type}</legend>
            <label className="flex min-h-11 items-center gap-3 text-sm font-medium">
              <input type="checkbox" name="include" value={type} checked={state.included.has(type)} onChange={() => toggle(type)} className="h-5 w-5" />
              {c.include}
            </label>
            {Object.entries(spec.params).map(([name, b]) => {
              const key = `${type}.${name}`;
              const label = params[name] ?? name;
              return (
                <div key={name} className="flex flex-col gap-1 text-sm font-medium">
                  <label className="flex flex-col gap-1">
                    {label}
                    <input
                      type="number"
                      name={key}
                      min={b.min}
                      max={b.max}
                      step={b.step}
                      required
                      value={state.values[key]}
                      onChange={(event) => setValue(key, event.target.value)}
                      dir="ltr"
                      className="field w-32 font-mono"
                    />
                  </label>
                  {/* The slider edits the same value; the number above is what the form sends. */}
                  <input
                    type="range"
                    name={`${key}.slider`}
                    aria-label={label}
                    min={b.min}
                    max={b.max}
                    step={b.step}
                    value={state.values[key]}
                    onChange={(event) => setValue(key, event.target.value)}
                    className="custom-slider w-full max-w-xs"
                  />
                  <span className="text-xs font-normal text-muted">
                    {fill(c.range, { min: String(b.min), max: String(b.max), unit: units[b.unit] ?? b.unit }).trim()}
                  </span>
                </div>
              );
            })}
            {Object.entries(spec.fixed).map(([name, value]) => (
              <p key={name} className="text-xs text-muted">
                {c.fixed} <bdi className="font-mono">{String(value)}</bdi>
              </p>
            ))}
          </fieldset>
        ))}
      </div>
      <p className="text-sm" data-custom-summary>
        {summary.length ? fill(c.summary, { list: summary.join("; ") }) : c.noneChosen}
      </p>
      <button type="submit" className="solid-btn min-h-12 self-start">
        {c.run}
      </button>
    </form>
  );
}
