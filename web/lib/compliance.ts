// Lookups behind the Compliance View (U4). These match keys; they write no text.
import type { CreditExplanation } from "@/lib/types";

type Tier = CreditExplanation["compliance_tier"];
type Line = CreditExplanation["public_tier"][number];

export function byAbsoluteContribution(contributions: Tier["contributions"]): Tier["contributions"] {
  return [...contributions].sort((a, b) => Math.abs(b.contribution_logodds) - Math.abs(a.contribution_logodds));
}

/** The threshold row and phrase that produced one public-tier line; null on a compliance line. */
export function traceLine(line: Line, tier: Tier): { thresholdRule: string; phraseKey: string; phrase: string } | null {
  if (!line.magnitude || !line.direction) return null;
  const phraseKey = `${line.magnitude}/${line.direction}`;
  const thresholdRule = tier.threshold_table[line.magnitude];
  const phrase = tier.phrases[phraseKey];
  if (thresholdRule === undefined || phrase === undefined) return null;
  return { thresholdRule, phraseKey, phrase };
}
