// IN1 (DECISIONS 62): "what to do next" guidance.
// GD1: every line comes from a rule in the rule table and names its trigger value.
// GD2: guidance never promises an outcome or gives a ruling.
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { NextSteps } from "@/components/NextSteps";
import { formatDate, formatSar } from "@/lib/format";
import { firedSteps, MAX_STEPS, nextSteps, RULES, type GuidanceInput, type RuleId } from "@/lib/guidance";
import type { Messages } from "@/lib/i18n";
import { AnomalyResponse, CreditResponse, ForecastResponse, ZakatResponse } from "@/lib/schemas";
import type { ForecastResponse as Forecast } from "@/lib/types";
import { ar, asRole, en, fixture } from "./helpers";

const DEMO = [10001, 10003, 10004, 10037, 10040];
const inputFor = (id: number): GuidanceInput => ({
  credit: fixture(`credit_${id}`, CreditResponse),
  forecast: fixture(`forecast_${id}`, ForecastResponse),
  zakat: fixture(`zakat_${id}`, ZakatResponse),
  anomaly: fixture(`anomaly_${id}`, AnomalyResponse),
  nisabVerified: en.zakat.nisabVerified,
});
const RULE_IDS = [...RULES.map((r) => r.id), "G-nothing"] as RuleId[];

/** A forecast for 10001 with chosen alert values: the rules read only these fields. */
function forecastWith(change: { level: "none" | "watch" | "crunch"; days: number | null; lowest: number }): Forecast {
  const base = structuredClone(fixture("forecast_10001", ForecastResponse));
  if (!base.forecast || base.forecast.status !== "computed") throw new Error("fixture");
  base.forecast.crunch_alert.level = change.level;
  base.forecast.crunch_alert.days_to_projected_negative_balance = change.days;
  base.forecast.model = base.forecast.model.map((row, i) => ({ ...row, min_projected_balance_sar: i === 0 ? change.lowest : Math.max(change.lowest, row.min_projected_balance_sar) }));
  return base;
}

describe("what to do next", () => {
  it("every guidance line maps to a rule and a value", () => {
    // The rule table and the catalogue name the same rules, in both languages, each with its sentence, its plain
    // reason and the name of the field behind it.
    for (const m of [en, ar]) {
      expect(Object.keys(m.guidance.rules).sort()).toEqual([...RULE_IDS].sort());
      for (const id of RULE_IDS) {
        const rule = (m.guidance.rules as Record<string, { text: string; why: string; field: string; link?: string }>)[id]!;
        for (const key of ["text", "why", "field"] as const) expect(rule[key].length, `${id}.${key}`).toBeGreaterThan(5);
      }
    }
    expect(new Set(RULES.map((r) => r.priority)).size).toBe(RULES.length); // one order, no ties
    for (const rule of RULES) expect(rule.condition, rule.id).toMatch(/[a-z_]+\.[a-z_]+/); // names an API field

    for (const id of DEMO) {
      const input = inputFor(id);
      for (const step of nextSteps(input)) {
        expect(RULE_IDS, `${id}`).toContain(step.rule);
        expect(step.trigger.field.length).toBeGreaterThan(3);
        expect(step.trigger.value).toBeDefined();
        // Every placeholder in the sentence has a value, and every value is used.
        const rule = (en.guidance.rules as Record<string, { text: string; textPast?: string }>)[step.rule]!;
        const template = step.sentence === "textPast" ? rule.textPast! : rule.text;
        expect([...template.matchAll(/\{(\w+)\}/g)].map((x) => x[1]).sort(), `${id} ${step.rule}`).toEqual(Object.keys(step.values).sort());
      }
    }
  });

  it("each line on the page shows its rule's reason and the value that triggered it", () => {
    asRole("owner");
    const steps = nextSteps(inputFor(10001));
    const { container } = render(<NextSteps steps={steps} locale="en" m={en} base="/en/business/10001" />);
    const lines = [...container.querySelectorAll("[data-step]")];
    expect(lines.map((li) => li.getAttribute("data-step"))).toEqual(steps.map((s) => s.rule));
    for (const [i, li] of lines.entries()) {
      const rule = (en.guidance.rules as Record<string, { why: string; field: string }>)[steps[i]!.rule]!;
      expect(li.querySelector("[data-step-why] summary")!.textContent).toBe("Why am I seeing this?");
      expect(li.querySelector("[data-step-why]")!.textContent).toContain(rule.why);
      const trigger = li.querySelector("[data-step-trigger]")!;
      expect(trigger.getAttribute("data-step-trigger")).toBe(steps[i]!.trigger.field);
      expect(trigger.textContent).toContain(rule.field);
      expect(li.querySelector("[data-step-link]")!.getAttribute("href")).toMatch(/^\/en\/business\/10001\/(credit|sharia|zakat|forecast|review)\?as=owner$/);
    }
  });

  it("guidance has no promise or ruling wording", () => {
    const banned = {
      en: [/you will get/i, /guarantee/i, /\bapproved\b/i, /\bhalal\b/i, /\bharam\b/i, /\bpermissible\b/i, /\bpermitted\b/i, /\bforbidden\b/i, /you (should|must) pay/i, /will be (accepted|approved)/i, /\bassured\b/i],
      ar: [/مضمون/, /سيُقبل/, /سيقبل/, /حلال/, /حرام/, /يجوز/, /لا يجوز/, /مباح/, /محرّم|محرم/, /يجب عليك/, /ستحصل/],
    };
    const strings = (m: Messages) => [m.guidance.title, m.guidance.note, m.guidance.why, m.guidance.trigger, ...Object.values(m.guidance.rules).flatMap((r) => Object.values(r as Record<string, string>))];
    for (const text of strings(en)) for (const pattern of banned.en) expect(text, text).not.toMatch(pattern);
    for (const text of strings(ar)) for (const pattern of banned.ar) expect(text, text).not.toMatch(pattern);
    // The block says what it is not.
    expect(en.guidance.note).toBe("From fixed rules over your own results. It is not advice from a bank, and it is not a ruling.");
    // No sentence carries an em or en dash (fixed-text rule).
    for (const text of [...strings(en), ...strings(ar)]) expect(text).not.toMatch(/[–—]/);
  });

  it("at most three next steps", () => {
    expect(MAX_STEPS).toBe(3);
    for (const id of DEMO) {
      const input = inputFor(id);
      const shown = nextSteps(input);
      expect(shown.length, `${id}`).toBeLessThanOrEqual(3);
      // Highest priority first: the first lines of everything that fired.
      expect(shown.map((s) => s.rule)).toEqual(firedSteps(input).slice(0, 3).map((s) => s.rule));
    }
    // A business where every lens speaks still gets three.
    const busy: GuidanceInput = { ...inputFor(10001), forecast: forecastWith({ level: "crunch", days: 12, lowest: -5000 }) };
    expect(firedSteps(busy).length).toBeGreaterThan(3);
    expect(nextSteps(busy)).toHaveLength(3);
  });

  it("next steps amounts match the lens page", () => {
    // The zakat line quotes the liability and the date exactly as the zakat response holds them.
    const input = inputFor(10001);
    const zakat = input.zakat!.zakat!;
    const due = firedSteps(input).find((s) => s.rule === "G-zakat-due")!;
    expect(due.values.amount).toEqual({ kind: "sar", value: zakat.liability_sar });
    expect(due.values.date).toEqual({ kind: "date", value: zakat.hawl_completion_date });
    expect(due.sentence).toBe("textPast"); // the year ended 9 days before the as-of date
    asRole("owner");
    const { container } = render(<NextSteps steps={[due]} locale="en" m={en} base="/en/business/10001" />);
    const text = container.querySelector("[data-step='G-zakat-due'] p")!.textContent!;
    expect(text).toContain(formatSar(zakat.liability_sar!, "en").replace(/^\S+\s/, "")); // the figure, as formatSar gives it
    expect(text).toContain(formatDate(zakat.hawl_completion_date!, "en"));

    // The cash line: the amount is the lowest projected balance the API returned, and the sentence says "about".
    const floor = firedSteps({ forecast: forecastWith({ level: "crunch", days: 12, lowest: -5000 }) })[0]!;
    expect(floor.rule).toBe("G-cash-floor");
    expect(floor.values.amount).toEqual({ kind: "sar", value: 5000 });
    expect(floor.values.date).toEqual({ kind: "date", value: "2026-08-11" }); // as_of 2026-07-30 plus 12 days
    expect(en.guidance.rules["G-cash-floor"].text).toMatch(/around \{date\}.*about \{amount\}/);
  });

  it("the cash rules never contradict each other", () => {
    const rulesFor = (f: Forecast) => firedSteps({ forecast: f }).map((s) => s.rule);
    expect(rulesFor(forecastWith({ level: "crunch", days: 12, lowest: -5000 }))).toEqual(["G-cash-floor"]);
    expect(rulesFor(forecastWith({ level: "watch", days: null, lowest: 100 }))).toEqual(["G-cash-watch"]);
    expect(rulesFor(forecastWith({ level: "none", days: null, lowest: 100 }))).toEqual(["G-cash-ok"]);
    // 10001 today: the alert is at watch and nothing negative is projected, so it is told to watch, not that all is well.
    expect(rulesFor(fixture("forecast_10001", ForecastResponse))).toEqual(["G-cash-watch"]);
    expect(rulesFor(fixture("forecast_not_computed_synthetic_state", ForecastResponse))).toEqual([]);
  });

  it("nothing fires, so the overview says so and a lens page stays quiet", () => {
    // No lens computed (nothing loaded, or 10003, refused as insufficient data): the block says nothing at all.
    expect(nextSteps({})).toEqual([]);
    expect(nextSteps(inputFor(10003))).toEqual([]);
    // Lenses ran and no rule fired: the overview says so.
    const calm: GuidanceInput = { anomaly: { ...fixture("anomaly_10001", AnomalyResponse), anomaly: { ...fixture("anomaly_10001", AnomalyResponse).anomaly!, flags: [] } as never } };
    expect(nextSteps(calm).map((s) => s.rule)).toEqual(["G-nothing"]);
    expect(nextSteps({}, "zakat")).toEqual([]);
    expect(nextSteps({ zakat: fixture("zakat_not_computed_synthetic_state", ZakatResponse) }, "zakat")).toEqual([]);
    // A lens page shows only its own lens's lines.
    for (const lens of ["credit", "sharia", "zakat", "forecast", "review"] as const) {
      for (const step of nextSteps(inputFor(10001), lens)) expect(step.lens).toBe(lens);
    }
  });

  it("no next steps for roles that should not see them", () => {
    const steps = nextSteps(inputFor(10001));
    for (const [role, shown] of [["owner", true], ["admin", false], [null, false]] as const) {
      asRole(role);
      const { container, unmount } = render(<NextSteps steps={steps} locale="en" m={en} base="/en/business/10001" />);
      expect(!!container.querySelector("[data-next-steps]"), String(role)).toBe(shown);
      unmount();
    }
    asRole("owner", "view=compliance");
    // The block is hidden in print, so the decision sheet's page count cannot change.
    const { container } = render(<NextSteps steps={steps} locale="ar" m={ar} base="/ar/business/10001" />);
    expect(container.querySelector("[data-next-steps]")!.hasAttribute("data-print-hide")).toBe(true);
    expect(container.querySelector("h2")!.textContent).toBe(ar.guidance.title);
  });
});
