// IN1 (DECISIONS 62): "what to do next" guidance. Rule-based and fixed.
//
// GD1: every line comes from one rule in RULES, picks a fixed catalogue sentence (messages `guidance.rules.<id>`),
//      and names the API value that triggered it.
// GD2: no line promises an outcome or gives a ruling. Zakat and Sharia lines point to the page and the status;
//      they never say what is permitted.
//
// A rule reads only values the API returned. The one figure worked out here is a date: the as-of date plus the
// returned number of days (G-cash-floor), and its sentence says "around". Nothing else is computed.
import type { AnomalyResponse, CreditResponse, ForecastResponse, ZakatResponse } from "@/lib/types";

export type Lens = "credit" | "sharia" | "zakat" | "forecast" | "review";

export type RuleId =
  | "G-cash-floor"
  | "G-sharia-flag"
  | "G-cash-watch"
  | "G-credit-top"
  | "G-zakat-due"
  | "G-sharia-question"
  | "G-review"
  | "G-zakat-pending"
  | "G-cash-ok"
  | "G-nothing";

/** What the page knows: any lens may be missing (not loaded, failed, or not run). */
export type GuidanceInput = {
  credit?: CreditResponse | null;
  forecast?: ForecastResponse | null;
  zakat?: ZakatResponse | null;
  anomaly?: AnomalyResponse | null;
  /** Statuses listed in the catalogue as verified nisab sources (`zakat.nisabVerified`). */
  nisabVerified?: readonly string[];
};

/** A value a sentence quotes. `kind` says how the page formats it; the raw value is what the API returned. */
export type Quoted =
  | { kind: "sar"; value: number }
  | { kind: "date"; value: string }
  | { kind: "count"; value: number }
  | { kind: "days"; value: number }
  | { kind: "pct"; value: number }
  | { kind: "backend"; en: string; ar?: string | null }
  | { kind: "code"; group: string; value: string };

export type Step = {
  rule: RuleId;
  lens: Lens | null;
  /** The catalogue sentence under `guidance.rules[rule]`: most rules have one, G-zakat-due has two tenses. */
  sentence: "text" | "textPast";
  /** The values the sentence quotes, by placeholder name. */
  values: Record<string, Quoted>;
  /** GD1: the API field that fired the rule and the value it held. */
  trigger: { field: string; value: Quoted };
  /** Where the line links to: a lens page (and an anchor on it), relative to the business. */
  href: string;
};

type Rule = {
  id: RuleId;
  lens: Lens | null;
  /** Lower fires first. */
  priority: number;
  /** In plain words, for the DECISIONS table and the README. */
  condition: string;
  /** The step if the rule fires, otherwise null. */
  fire: (input: GuidanceInput) => Omit<Step, "rule" | "lens"> | null;
};

export const MAX_STEPS = 3;
/** G-zakat-due: how close the end of the zakat year must be, either side of the as-of date. */
export const ZAKAT_DUE_WINDOW_DAYS = 60;

const DAY_MS = 86_400_000;
const daysBetween = (fromIso: string, toIso: string) => Math.round((Date.parse(toIso) - Date.parse(fromIso)) / DAY_MS);
const addDays = (iso: string, days: number) => new Date(Date.parse(iso) + days * DAY_MS).toISOString().slice(0, 10);

export const RULES: readonly Rule[] = [
  {
    id: "G-cash-floor",
    lens: "forecast",
    priority: 1,
    condition: "forecast.crunch_alert.days_to_projected_negative_balance is a number: the forecast goes below the cash floor (0) inside the horizon",
    fire: ({ forecast }) => {
      const f = forecast?.forecast;
      if (!f || f.status !== "computed") return null;
      const days = f.crunch_alert.days_to_projected_negative_balance;
      if (days === null) return null;
      // The amount is the lowest balance the model projects, as returned: the shortfall below the floor of 0.
      const lowest = Math.min(...f.model.map((row) => row.min_projected_balance_sar));
      if (!(lowest < 0)) return null;
      return {
        sentence: "text",
        values: { date: { kind: "date", value: addDays(f.as_of, days) }, amount: { kind: "sar", value: Math.abs(lowest) } },
        trigger: { field: "forecast.crunch_alert.days_to_projected_negative_balance", value: { kind: "days", value: days } },
        href: "/forecast",
      };
    },
  },
  {
    id: "G-sharia-flag",
    lens: "sharia",
    priority: 2,
    condition: "sharia_screen.rules_triggered has at least one rule",
    fire: ({ credit }) => {
      const count = credit?.sharia_screen.rules_triggered.length ?? 0;
      if (count === 0) return null;
      const quoted: Quoted = { kind: "count", value: count };
      return { sentence: "text", values: { count: quoted }, trigger: { field: "sharia_screen.rules_triggered", value: quoted }, href: "/sharia" };
    },
  },
  {
    id: "G-cash-watch",
    lens: "forecast",
    priority: 3,
    condition: "forecast.crunch_alert.level is watch or crunch, and no negative balance is projected (else G-cash-floor speaks)",
    fire: ({ forecast }) => {
      const f = forecast?.forecast;
      if (!f || f.status !== "computed" || f.crunch_alert.level === "none" || f.crunch_alert.days_to_projected_negative_balance !== null) return null;
      const hazard = f.crunch_alert.liquidity_hazard?.["30d"];
      if (hazard === null || hazard === undefined) return null;
      return {
        sentence: "text",
        values: { pct: { kind: "pct", value: hazard }, level: { kind: "code", group: "crunch_level", value: f.crunch_alert.level } },
        trigger: { field: "forecast.crunch_alert.level", value: { kind: "code", group: "crunch_level", value: f.crunch_alert.level } },
        href: "/forecast",
      };
    },
  },
  {
    id: "G-credit-top",
    lens: "credit",
    priority: 4,
    condition: "credit_explanation.public_tier has a line whose direction is against: the first one, which the API lists first",
    fire: ({ credit }) => {
      const line = credit?.credit_explanation?.public_tier.find((l) => l.direction === "against" && l.feature_id !== null);
      if (!line) return null;
      const quoted: Quoted = { kind: "backend", en: line.text, ar: line.text_ar };
      return { sentence: "text", values: { factor: quoted }, trigger: { field: "credit_explanation.public_tier[].direction", value: quoted }, href: "/credit" };
    },
  },
  {
    id: "G-zakat-due",
    lens: "zakat",
    priority: 5,
    condition: `zakat.status is computed, zakat.liability_sar is above 0, and zakat.hawl_completion_date is within ${ZAKAT_DUE_WINDOW_DAYS} days of as_of, before or after`,
    fire: ({ zakat }) => {
      const z = zakat?.zakat;
      if (!zakat || !z || z.status !== "computed" || !(z.liability_sar !== null && z.liability_sar > 0) || !z.hawl_completion_date) return null;
      const gap = daysBetween(zakat.as_of, z.hawl_completion_date);
      if (Math.abs(gap) > ZAKAT_DUE_WINDOW_DAYS) return null;
      const date: Quoted = { kind: "date", value: z.hawl_completion_date };
      return {
        sentence: gap < 0 ? "textPast" : "text",
        values: { date, amount: { kind: "sar", value: z.liability_sar } },
        trigger: { field: "zakat.hawl_completion_date", value: date },
        href: "/zakat",
      };
    },
  },
  {
    id: "G-sharia-question",
    lens: "sharia",
    priority: 6,
    condition: "sharia_screen.disclosures has at least one question for the owner",
    fire: ({ credit }) => {
      const count = credit?.sharia_screen.disclosures.length ?? 0;
      if (count === 0) return null;
      const quoted: Quoted = { kind: "count", value: count };
      return { sentence: "text", values: { count: quoted }, trigger: { field: "sharia_screen.disclosures", value: quoted }, href: "/sharia" };
    },
  },
  {
    id: "G-review",
    lens: "review",
    priority: 7,
    condition: "anomaly.flags has at least one transaction",
    fire: ({ anomaly }) => {
      const a = anomaly?.anomaly;
      const count = a && a.status === "computed" ? a.flags.length : 0;
      if (count === 0) return null;
      const quoted: Quoted = { kind: "count", value: count };
      return { sentence: "text", values: { count: quoted }, trigger: { field: "anomaly.flags", value: quoted }, href: "/review" };
    },
  },
  {
    id: "G-zakat-pending",
    lens: "zakat",
    priority: 8,
    condition: "zakat.status is computed and zakat.nisab_source_status is not in the catalogue's verified list",
    fire: ({ zakat, nisabVerified = [] }) => {
      const z = zakat?.zakat;
      if (!z || z.status !== "computed" || nisabVerified.includes(z.nisab_source_status)) return null;
      const quoted: Quoted = { kind: "code", group: "nisab_status", value: z.nisab_source_status };
      return { sentence: "text", values: {}, trigger: { field: "zakat.nisab_source_status", value: quoted }, href: "/zakat" };
    },
  },
  {
    id: "G-cash-ok",
    lens: "forecast",
    priority: 9,
    condition: "forecast.crunch_alert.level is none and every projected minimum balance is at or above the floor (0)",
    fire: ({ forecast }) => {
      const f = forecast?.forecast;
      if (!f || f.status !== "computed" || f.crunch_alert.level !== "none" || f.model.length === 0) return null;
      if (f.model.some((row) => row.min_projected_balance_sar < 0)) return null;
      const days: Quoted = { kind: "days", value: Math.max(...f.model.map((row) => row.horizon_days)) };
      return { sentence: "text", values: { days }, trigger: { field: "forecast.crunch_alert.level", value: { kind: "code", group: "crunch_level", value: "none" } }, href: "/forecast" };
    },
  },
];

/** Every rule that fires, highest priority first. */
export function firedSteps(input: GuidanceInput): Step[] {
  return [...RULES]
    .sort((a, b) => a.priority - b.priority)
    .flatMap((rule) => {
      const fired = rule.fire(input);
      return fired ? [{ rule: rule.id, lens: rule.lens, ...fired }] : [];
    });
}

/**
 * The lines a page shows: at most MAX_STEPS, highest priority first. With `lens`, only that lens's own lines.
 * When no rule fires on a business whose lenses ran, the overview says so with G-nothing; a lens page shows nothing.
 */
export function nextSteps(input: GuidanceInput, lens?: Lens): Step[] {
  const fired = firedSteps(input).filter((step) => !lens || step.lens === lens);
  // "Nothing needs your attention" is only true when something was looked at: with no lens computed (not loaded,
  // failed, or refused as insufficient data) the block says nothing at all.
  const looked =
    !!input.credit?.credit || input.forecast?.forecast?.status === "computed" || input.zakat?.zakat?.status === "computed" || input.anomaly?.anomaly?.status === "computed";
  if (fired.length === 0 && !lens && !looked) return [];
  if (fired.length === 0 && !lens) {
    return [{ rule: "G-nothing", lens: null, sentence: "text", values: {}, trigger: { field: "(no rule fired)", value: { kind: "count", value: 0 } }, href: "" }];
  }
  return fired.slice(0, MAX_STEPS);
}
