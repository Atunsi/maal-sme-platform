// C1, R5 (DECISIONS 45): words for the codes the API returns. A value the catalogue knows shows its word;
// any other value shows as the raw code in a Code span, so a new backend value is never hidden or guessed.
// Receipts, the Compliance View, BackendText and the profile features table keep raw codes on purpose.
import { createElement, type ReactNode } from "react";
import { Code } from "@/components/ui";
import type { Messages } from "@/lib/i18n";

export const LABEL_GROUPS = ["late_penalty_policy", "hawl_rule", "hawl_start_source", "zakat_method", "counterparty_type", "category"] as const;
export type LabelGroup = (typeof LABEL_GROUPS)[number];

/** The catalogue word, or null when the catalogue has none for this value. */
export function labelWord(group: LabelGroup, value: string, m: Pick<Messages, "enums">): string | null {
  const words: Record<string, string> = m.enums[group];
  return Object.hasOwn(words, value) ? words[value]! : null;
}

export function label(group: LabelGroup, value: string, m: Pick<Messages, "enums">): ReactNode {
  return labelWord(group, value, m) ?? createElement(Code, null, value);
}
