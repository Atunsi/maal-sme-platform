// R5 (DECISIONS 45): no raw enum code in user-facing text outside receipts, the Compliance View,
// BackendText and the profile features table. C1: lib/labels.ts gives the word, or the code when unknown.
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CreditCard } from "@/components/CreditCard";
import { ReviewBoard } from "@/components/ReviewBoard";
import { ZakatCard } from "@/components/ZakatCard";
import { LABEL_GROUPS, label, labelWord } from "@/lib/labels";
import { AnomalyResponse, CreditResponse, ZakatResponse } from "@/lib/schemas";
import { ar, en, fixture } from "./helpers";
import { ShariaPanel } from "@/components/ShariaPanel";

const ALLOWED = "[data-receipt], [data-testid=compliance-view], [data-backend]";

/** Every code the catalogue groups know, plus every value the 10001 fixtures carry. */
function codes(): Set<string> {
  const all = new Set<string>();
  for (const group of LABEL_GROUPS) for (const key of Object.keys(en.enums[group])) all.add(key);
  const z = fixture("zakat_10001", ZakatResponse).zakat!;
  [z.hawl_rule, z.method, z.hawl_start_source].forEach((v) => v && all.add(v));
  const a = fixture("anomaly_10001", AnomalyResponse).anomaly!;
  if (a.status === "computed") for (const f of a.flags) [f.counterparty_type, f.category].forEach((v) => all.add(v));
  all.add(fixture("credit_10001", CreditResponse).credit!.late_penalty_policy);
  // LG4 (DECISIONS 60): the nisab status and the rule table status are covered too.
  all.add(z.nisab_source_status);
  all.add(fixture("credit_10001", CreditResponse).sharia_screen.rule_table_status);
  return all;
}

/** Visible text nodes outside the allowed places that are, or hold, a raw code. */
function rawCodesShown(root: Element): string[] {
  const known = codes();
  const found: string[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.parentElement?.closest(ALLOWED)) continue;
    const text = (node.nodeValue ?? "").trim();
    for (const code of known) {
      // A code with an underscore cannot be ordinary prose; a one-word code counts only as a whole node.
      if (text === code || (code.includes("_") && new RegExp(`\\b${code}\\b`).test(text))) found.push(`${code} in "${text}"`);
    }
  }
  return found;
}

describe("labels", () => {
  it("no raw codes outside receipts", () => {
    for (const [locale, m] of [["en", en], ["ar", ar]] as const) {
      const anomaly = fixture("anomaly_10001", AnomalyResponse).anomaly!;
      if (anomaly.status !== "computed") throw new Error("10001 anomaly fixture did not compute");
      for (const ui of [
        <CreditCard key="c" data={fixture("credit_10001", CreditResponse)} initialView="public" locale={locale} m={m} />,
        <ZakatCard key="z" data={fixture("zakat_10001", ZakatResponse)} locale={locale} m={m} />,
        <ReviewBoard key="r" a={anomaly} locale={locale} labels={m} />,
        <ShariaPanel key="s" data={fixture("credit_10001", CreditResponse)} locale={locale} m={m} />,
      ]) {
        const { container, unmount } = render(<main>{ui}</main>);
        expect(rawCodesShown(container)).toEqual([]);
        unmount();
      }
    }
  });

  it("every group has a word in both locales, and an unknown value shows as its code", () => {
    for (const group of LABEL_GROUPS) {
      expect(Object.keys(ar.enums[group]).sort()).toEqual(Object.keys(en.enums[group]).sort());
      for (const key of Object.keys(en.enums[group])) expect(labelWord(group, key, en)).toBeTruthy();
    }
    expect(labelWord("category", "something_new", en)).toBeNull();
    const { container } = render(<p>{label("category", "something_new", en)}</p>);
    expect(container.querySelector("code")!.textContent).toBe("something_new");
  });
});
