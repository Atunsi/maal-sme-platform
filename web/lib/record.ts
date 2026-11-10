// DECISIONS 58: the plain-language decision record an owner sees. Every line comes from a response field; a line
// whose field is missing is left out, never guessed (PR3). The words for "how it was reached" are keyed by the
// same state helpers the plates use (decisionState), so two states never share them (PR5, R1).
import { decisionState } from "@/lib/decision";
import { fill, type Messages } from "@/lib/i18n";
import { formatDate } from "@/lib/format";
import { referenceFor } from "@/lib/reference";
import type { CreditDetail, CreditResponse, Receipt } from "@/lib/types";
import type { Locale } from "@/lib/i18n";

export type RecordLens = "credit" | "sharia" | "zakat" | "forecast" | "review" | "profile";
export type HowKey = keyof Messages["record"]["howBy"];

export type RecordInput = {
  lens: RecordLens;
  businessId: number;
  receipt?: Partial<Pick<Receipt, "output_sha256" | "scope">> | null;
  asOf?: string | null;
  status?: "scored" | "partial_profile" | "insufficient_data" | null;
  credit?: Pick<NonNullable<CreditResponse["credit"]>, "decision"> | null;
  detail?: Pick<CreditDetail, "offer_status" | "decline_origin"> | null;
};

export type RecordLines = { dataUsed: string | null; how: string[]; same: string | null; reference: string | null };

/** The "how it was reached" keys for one result, in order: the lens's line, then the partial-profile line. */
export function howKeys(input: RecordInput): HowKey[] {
  if (input.status === "insufficient_data") return ["insufficient_data"];
  let lens: HowKey | null;
  if (input.lens === "credit") {
    if (!input.credit) lens = null;
    else if (input.detail?.decline_origin === "compliance") lens = "credit_sharia_hard_flag";
    else lens = `credit_${decisionState(input.credit, input.detail)}`;
  } else {
    lens = input.lens;
  }
  const keys: HowKey[] = lens ? [lens] : [];
  if (input.status === "partial_profile") keys.push("partial_profile");
  return keys;
}

const DATA_KEY: Record<RecordLens, "dataUpTo" | "dataUpToSharia" | "dataUpToZakat"> = {
  credit: "dataUpTo",
  sharia: "dataUpToSharia",
  zakat: "dataUpToZakat", // Zakat reads the balance sheet, not the transactions (lenses/zakat/zakat.py)
  forecast: "dataUpTo",
  review: "dataUpTo",
  profile: "dataUpTo",
};

export function recordLines(input: RecordInput, locale: Locale, m: Messages): RecordLines {
  const r = m.record;
  return {
    dataUsed: input.asOf ? fill(r[DATA_KEY[input.lens]], { date: formatDate(input.asOf, locale) }) : null,
    how: howKeys(input).map((key) => r.howBy[key]),
    // Only where the receipt states its scope: the lens routes do, /profile does not (U13).
    same: input.receipt?.scope ? r.sameBody : null,
    reference: input.receipt?.output_sha256 ? referenceFor({ output_sha256: input.receipt.output_sha256 }, input.businessId) : null,
  };
}
