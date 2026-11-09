// I5 (DECISIONS 45): custom builder upgrades. Values come from the library objects and the API's bounds only.
import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CustomScenarioForm, type StartFrom } from "@/components/CustomScenarioForm";
import { ScenarioCatalog, ScenarioObject } from "@/lib/schemas";
import { libraryShocks } from "@/lib/start-from";
import { en, fixture, readJson } from "./helpers";

const catalog = fixture("scenarios_catalog", ScenarioCatalog);
const object = (name: string) => ScenarioObject.parse(readJson("scenarios-data", `${name}.json`));
const NAMES = ["baseline", "calm_counterfactual", "mild_slowdown", "severe_collapse", "late_sudden_shock", "fraud_pattern", "combined_crisis", "thin_file_newcomer"];

describe("custom builder upgrades", () => {
  it("builder starts from a library scenario", () => {
    const fits = Object.fromEntries(NAMES.map((n) => [n, libraryShocks(object(n).scenario.overrides, catalog)]));
    // No shock, or a type twice: the builder cannot express those, so they are not offered.
    for (const n of ["baseline", "calm_counterfactual", "fraud_pattern", "combined_crisis"]) expect(fits[n]).toBeNull();
    const severe = object("severe_collapse").scenario.overrides as { inject_cash_crunch: { week: number; severity_pct: number } };
    expect(fits.severe_collapse).toEqual([{ type: "cash_crunch", params: severe.inject_cash_crunch }]);
    expect(fits.thin_file_newcomer).toEqual([{ type: "newcomer", params: {} }]);

    const starts: StartFrom[] = NAMES.flatMap((n) => (fits[n] ? [{ name: n, label: n, shocks: fits[n]! }] : []));
    const { container } = render(<CustomScenarioForm catalog={catalog} chosen={[]} action={async () => {}} hidden={{ locale: "en", as: "" }} starts={starts} m={en} />);
    fireEvent.change(container.querySelector("select[data-start-from]")!, { target: { value: "severe_collapse" } });
    expect((container.querySelector('input[name="include"][value="cash_crunch"]') as HTMLInputElement).checked).toBe(true);
    expect((container.querySelector('input[name="cash_crunch.week"]') as HTMLInputElement).value).toBe(String(severe.inject_cash_crunch.week));
    expect((container.querySelector('input[name="cash_crunch.severity_pct"]') as HTMLInputElement).value).toBe(String(severe.inject_cash_crunch.severity_pct));
    expect((container.querySelector('input[name="include"][value="large_transfer"]') as HTMLInputElement).checked).toBe(false);
    // The summary names the chosen shock in words.
    expect(container.querySelector("[data-custom-summary]")!.textContent).toContain(en.custom.types.cash_crunch);
  });

  it("builder slider and number stay in step", () => {
    const { container } = render(<CustomScenarioForm catalog={catalog} chosen={[]} action={async () => {}} hidden={{ locale: "en", as: "" }} m={en} />);
    const b = catalog.shock_types.cash_crunch!.params.severity_pct!;
    const number = container.querySelector('input[name="cash_crunch.severity_pct"]') as HTMLInputElement;
    const slider = container.querySelector('input[name="cash_crunch.severity_pct.slider"]') as HTMLInputElement;
    expect([slider.type, slider.min, slider.max, slider.step]).toEqual(["range", String(b.min), String(b.max), String(b.step)]);
    fireEvent.change(slider, { target: { value: String(b.min + 5) } });
    expect(number.value).toBe(String(b.min + 5));
    fireEvent.change(number, { target: { value: String(b.max) } });
    expect(slider.value).toBe(String(b.max));
    expect(slider.getAttribute("aria-label")).toBe(en.custom.params.severity_pct);
  });
});
