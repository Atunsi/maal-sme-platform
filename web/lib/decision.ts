// B2, R1 (DECISIONS 45): a credit decision shown as a word. An approval that is not unconditional reads
// "Approved, conditional", so the word, not only the plate's colour, tells the two approvals apart. Every
// place that shows a decision as a word or plate reads it from here.
import type { PlateVariant } from "@/components/ui";
import type { Messages } from "@/lib/i18n";
import type { CreditDetail, CreditResponse } from "@/lib/types";

export type DecisionState = "approved_unconditional" | "approved_conditional" | "declined";

export const DECISION_VARIANT: Record<DecisionState, PlateVariant> = {
  approved_unconditional: "ok",
  approved_conditional: "warn",
  declined: "bad",
};

type Credit = NonNullable<CreditResponse["credit"]>;
type Detail = Pick<CreditDetail, "offer_status"> | null | undefined;

export function decisionState(credit: Pick<Credit, "decision">, detail: Detail): DecisionState {
  if (credit.decision === "declined") return "declined";
  return detail?.offer_status === "unconditional" ? "approved_unconditional" : "approved_conditional";
}

/** The word for a decision: the conditional word when approved and the offer is not unconditional. */
export function decisionWord(credit: Pick<Credit, "decision">, detail: Detail, m: Messages): string {
  return m.enums.decision_state[decisionState(credit, detail)];
}

/** The plate for a whole credit response, as the admin list and the landing strip show it. */
export function creditPlate(data: CreditResponse, m: Messages): { variant: PlateVariant; word: string } {
  const { credit, credit_decision_detail: detail } = data;
  if (!credit || !detail) return { variant: "ink", word: m.admin.notRun };
  return decisionPlate(credit, detail, m);
}

export function decisionPlate(credit: Pick<Credit, "decision">, detail: Detail, m: Messages): { state: DecisionState; variant: PlateVariant; word: string } {
  const state = decisionState(credit, detail);
  return { state, variant: DECISION_VARIANT[state], word: m.enums.decision_state[state] };
}
