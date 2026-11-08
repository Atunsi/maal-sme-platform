// E12: the custom scenario builder. DECISIONS 43.
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CustomResult } from "@/components/CustomResult";
import { CustomScenarioForm } from "@/components/CustomScenarioForm";
import { decodeShocks, encodeShock, type Shock } from "@/lib/custom-scenario";
import { ScenarioCatalog, ScenarioObject } from "@/lib/schemas";
import type { ApiResult } from "@/lib/types";
import { en, fixture, readJson } from "./helpers";

const catalog = fixture("scenarios_catalog", ScenarioCatalog);
const custom = fixture("custom_scenario", ScenarioObject);
const baseline = ScenarioObject.parse(readJson("scenarios-data", "baseline.json"));
const TERMS = /markup|amount|month|term|rate|price|repay/i;

const api = vi.hoisted(() => ({ result: null as unknown }));
vi.mock("@/lib/api", () => ({ runCustomScenario: async () => api.result }));
vi.mock("@/lib/scenarios", () => ({ getScenario: async () => ({ ok: true, data: baseline }) }));

describe("custom builder form", () => {
  it("custom builder renders bounds from the api", () => {
    const { container } = render(<CustomScenarioForm catalog={catalog} chosen={[]} action={async () => {}} hidden={{ locale: "en", as: "" }} m={en} />);
    for (const [type, spec] of Object.entries(catalog.shock_types)) {
      for (const [name, b] of Object.entries(spec.params)) {
        const input = container.querySelector(`input[name="${type}.${name}"]`) as HTMLInputElement;
        expect(input.type).toBe("number");
        expect([input.min, input.max, input.step]).toEqual([String(b.min), String(b.max), String(b.step)]);
        expect(input.value).toBe(String(b.min));
      }
    }
  });

  it("custom builder blocks out of bound values", () => {
    const { container } = render(<CustomScenarioForm catalog={catalog} chosen={[]} action={async () => {}} hidden={{ locale: "en", as: "" }} m={en} />);
    const input = container.querySelector('input[name="cash_crunch.severity_pct"]') as HTMLInputElement;
    input.value = String(catalog.shock_types.cash_crunch!.params.severity_pct!.max + 1);
    expect(input.validity.rangeOverflow).toBe(true);
    input.value = String(catalog.shock_types.cash_crunch!.params.severity_pct!.min - 1);
    expect(input.validity.rangeUnderflow).toBe(true);
  });

  it("U1 the builder's inputs are only shock parameters and checkboxes, none naming a term", () => {
    const { container } = render(<CustomScenarioForm catalog={catalog} chosen={[]} action={async () => {}} hidden={{ locale: "en", as: "" }} m={en} />);
    // The two hidden fields carry the page's locale and the demo role to the server action.
    const allowed = new Set(["include", "locale", "as", ...Object.entries(catalog.shock_types).flatMap(([t, s]) => Object.keys(s.params).map((p) => `${t}.${p}`))]);
    const names = [...container.querySelectorAll("input")].map((i) => i.getAttribute("name")!);
    expect(names.every((n) => allowed.has(n))).toBe(true);
    expect(names.filter((n) => TERMS.test(n))).toEqual([]);
  });

  it("chosen shocks come back from the URL", () => {
    const shocks: Shock[] = [
      { type: "cash_crunch", params: { week: 16, severity_pct: 40 } },
      { type: "large_transfer", params: { week: 10 } },
    ];
    const encoded = shocks.map((s) => encodeShock(catalog, s));
    expect(encoded).toEqual(["cash_crunch.16.40", "large_transfer.10"]);
    expect(decodeShocks(catalog, encoded)).toEqual(shocks);
    expect(decodeShocks(catalog, ["set_markup.1", "cash_crunch.16", "cash_crunch.x.1"])).toEqual([]);
  });
});

describe("custom result", () => {
  const result = async (r: ApiResult<unknown>) => {
    api.result = r;
    return render(await CustomResult({ shocks: [{ type: "large_transfer", params: { week: 10 } }], locale: "en", m: en, retry: "/en/scenarios/custom?shock=x" }));
  };

  it("custom builder shows the custom plate and receipt", async () => {
    const { container } = await result({ ok: true, data: custom });
    expect(custom.scenario.source).toBe("custom");
    expect(screen.getByText(en.custom.plate).className).toContain("plate-warn");
    expect(container.textContent).toContain(en.scenarios.caveat);
    expect(container.querySelectorAll("details[data-receipt]")).toHaveLength(2);
    expect(container.querySelector("[data-hash-check]")).not.toBeNull();
    // A custom object is not in the library, so no library command is offered for it.
    expect([...container.querySelectorAll("[data-rerun] code")].map((c) => c.textContent)).toEqual(["python -m scenarios.run --scenario baseline"]);
  });

  it("custom builder handles 422 and 503", async () => {
    const refused = await result({ ok: false, kind: "invalid", detail: "shock 0: week must be a whole number from 6 to 23" });
    expect(refused.container.textContent).toContain(en.errors.invalid);
    expect(refused.container.textContent).toContain("shock 0: week must be a whole number from 6 to 23");
    expect(screen.queryByRole("link", { name: en.custom.retry })).toBeNull(); // the same request would be refused again
    refused.unmount();
    await result({ ok: false, kind: "unavailable", detail: "the custom scenario took longer than the 30 s budget" });
    expect(screen.getByText(en.errors.unavailable)).toBeTruthy();
    expect(screen.getByRole("link", { name: en.custom.retry }).getAttribute("href")).toBe("/en/scenarios/custom?shock=x");
  });
});
