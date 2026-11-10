// DECISIONS 58: the plain-language decision record. PR3, PR4, PR5 and PR6 at the catalogue and helper level.
import { describe, expect, it } from "vitest";
import { howKeys, recordLines, type HowKey, type RecordInput } from "@/lib/record";
import { parseReference, referenceFor, referenceMatches } from "@/lib/reference";
import { CreditResponse } from "@/lib/schemas";
import { ar, en, fixture } from "./helpers";

describe("reference number", () => {
  it("reference number matches the output hash", () => {
    const data = fixture("credit_10001", CreditResponse);
    const ref = referenceFor(data.receipt, data.business_id);
    expect(ref).toMatch(/^M-10001-[0-9A-F]{8}$/);
    expect(ref.slice(-8)).toBe(data.receipt.output_sha256.slice(0, 8).toUpperCase());
    const parsed = parseReference(ref.toLowerCase())!;
    expect(parsed.businessId).toBe(10001);
    expect(referenceMatches(parsed.prefix, data.receipt)).toBe(true);
    expect(referenceMatches("00000000", data.receipt)).toBe(data.receipt.output_sha256.startsWith("00000000"));
    for (const bad of ["M-10001-7F3A9C2", "X-10001-7F3A9C2B", "M-abc-7F3A9C2B", "M-10001-7F3A9C2BZ"]) expect(parseReference(bad)).toBeNull();
  });
});

const credit = (name: string): RecordInput => {
  const d = fixture(name, CreditResponse);
  return { lens: "credit", businessId: d.business_id, receipt: d.receipt, asOf: d.as_of, status: d.status, credit: d.credit, detail: d.credit_decision_detail };
};

describe("how it was reached", () => {
  it("every state explains how it was reached", () => {
    const cases: [RecordInput, HowKey[]][] = [
      [credit("credit_10001"), ["credit_approved_unconditional"]],
      [credit("credit_10037"), ["credit_approved_conditional"]],
      [credit("credit_10004"), ["credit_declined"]],
      [credit("credit_hard_flag_synthetic_state"), ["credit_sharia_hard_flag"]],
      [credit("credit_10040"), ["credit_approved_unconditional", "partial_profile"]],
      [credit("credit_10003"), ["insufficient_data"]],
      [{ lens: "zakat", businessId: 1 }, ["zakat"]],
      [{ lens: "review", businessId: 1, status: "partial_profile" }, ["review", "partial_profile"]],
    ];
    for (const [input, keys] of cases) expect(howKeys(input)).toEqual(keys);
    // R1: every key has its own words, in both languages.
    for (const m of [en, ar]) {
      const words = Object.values(m.record.howBy);
      expect(new Set(words).size).toBe(words.length);
    }
    // U8: the review line never says fraud and never gives a score.
    expect(en.record.howBy.review).not.toMatch(/fraud|score/i);
    // The conditional line says a person checks; no other credit line claims a person decided.
    expect(en.record.howBy.credit_approved_conditional).toMatch(/Sharia reviewer/);
    for (const key of ["credit_approved_unconditional", "credit_declined", "zakat", "forecast", "review", "profile"] as const) {
      expect(en.record.howBy[key]).not.toMatch(/person|reviewer|verified|secure|approved by/i);
    }
  });

  it("plain card lines come from the response", () => {
    const full = recordLines(credit("credit_10001"), "en", en);
    expect(full.dataUsed).toContain("30 July 2026");
    expect(full.how).toEqual([en.record.howBy.credit_approved_unconditional]);
    expect(full.same).toBe(en.record.sameBody);
    expect(full.reference).toMatch(/^M-10001-/);
    const input = credit("credit_10001");
    const bare = recordLines({ ...input, asOf: null, receipt: { output_sha256: input.receipt!.output_sha256 } }, "en", en);
    expect(bare.dataUsed).toBeNull(); // no as_of, no data line
    expect(bare.same).toBeNull(); // no scope, no "same result" line (U13: /profile has none)
    const none = recordLines({ ...input, receipt: null, credit: null }, "en", en);
    expect(none.reference).toBeNull();
    expect(none.how).toEqual([]);
    expect(recordLines({ lens: "zakat", businessId: 1, asOf: "2026-07-30" }, "en", en).dataUsed).toBe("Your balance-sheet figures up to 30 July 2026");
  });
});

describe("owner wording", () => {
  it("owner text never says receipt", () => {
    // The technical-record labels are for auditors; everything else in the group is owner-facing.
    const owner = (m: typeof en) => JSON.stringify(Object.entries(m.record).filter(([key]) => !key.startsWith("technical")));
    expect(owner(en)).not.toMatch(/receipt/i);
    expect(owner(ar)).not.toMatch(/إيصال|الإيصال/);
    expect(en.record.title).toBe("How this result was reached");
    expect(ar.record.title).toBe("كيف وصلنا إلى هذه النتيجة");
  });
});
