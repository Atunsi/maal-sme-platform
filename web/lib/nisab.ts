// B22, U7 as widened in DECISIONS 45: the nisab plate shows for every `nisab_source_status` that the
// catalogue does not name as verified. The only place that reads the status; no component compares it
// to a string literal.
import type { Messages } from "@/lib/i18n";

/** The plate's words, and the raw status when the catalogue has no words for it. */
export type NisabPlateText = { words: string; code: string | null };

/** Null only for a status listed in `zakat.nisabVerified`, which is empty today. */
export function nisabPlate(status: string, m: Messages): NisabPlateText | null {
  const verified: readonly string[] = m.zakat.nisabVerified;
  if (verified.includes(status)) return null;
  const known: Record<string, string> = m.zakat.nisabStatus;
  return Object.hasOwn(known, status) ? { words: known[status]!, code: null } : { words: m.zakat.nisabUnknown, code: status };
}
