// DECISIONS 58 (1a.3): who sees what. The role rides in ?as= (mocked here with asRole); the record reads it in the
// browser, so the static snapshot switches too.
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DecisionRecord } from "@/components/DecisionRecord";
import { recordInput } from "@/lib/record";
import { referenceFor } from "@/lib/reference";
import { CreditResponse, ProfileResponse, ZakatResponse } from "@/lib/schemas";
import { ar, asRole, en, fixture } from "./helpers";

const zakat = fixture("zakat_10001", ZakatResponse);
const credit = fixture("credit_10037", CreditResponse);
const zakatRecord = (locale: "en" | "ar" = "en") =>
  render(<DecisionRecord input={recordInput("zakat", zakat)} receipt={zakat.receipt} lens="Zakat" locale={locale} m={locale === "en" ? en : ar} />).container;

describe("decision record by role", () => {
  it("owner sees no technical record", () => {
    for (const locale of ["en", "ar"] as const) {
      asRole("owner");
      const page = zakatRecord(locale);
      const text = page.textContent!;
      expect(page.querySelector("[data-record]")).toBeTruthy();
      expect(page.querySelector("details[data-receipt]")).toBeNull();
      expect(text).not.toMatch(/[0-9a-f]{12}/); // no hash or commit
      expect(text).not.toContain(zakat.receipt.scope!);
      expect(text).not.toMatch(/_sha256|code_commit|python -m/);
      expect(page.querySelector("[data-reference]")!.textContent).toBe(referenceFor(zakat.receipt, 10001));
      expect(text).not.toMatch(/receipt|إيصال/i);
    }
  });

  it("technical record stays for admin, public and compliance", () => {
    asRole("admin");
    let page = zakatRecord();
    expect(page.querySelector("details[data-receipt]")!.hasAttribute("open")).toBe(true);
    expect(page.textContent).toContain(zakat.receipt.scope!); // U13, verbatim
    asRole(null);
    page = render(<DecisionRecord input={recordInput("zakat", zakat)} receipt={zakat.receipt} lens="Zakat" locale="en" m={en} />).container;
    expect(page.querySelectorAll("details[data-receipt]")).toHaveLength(1);
    const closed = page.querySelector("details[data-receipt]")!;
    expect(closed.hasAttribute("open")).toBe(false);
    expect(closed.textContent).toContain(zakat.receipt.scope!);
    expect(page.querySelectorAll("[data-record]").length).toBeGreaterThan(0);
    // The Compliance View: the record, open, and no card; even for the owner role.
    asRole("owner", "view=compliance");
    page = render(
      <DecisionRecord input={recordInput("credit", credit)} receipt={credit.receipt} lens="Credit" locale="en" m={en} followsView />,
    ).container;
    expect(page.querySelector("[data-record]")).toBeNull();
    expect(page.querySelector("details[data-receipt]")!.hasAttribute("open")).toBe(true);
    expect(page.textContent).toContain(credit.receipt.scope!);
  });

  it("profile has no same-result line: its receipt carries no scope (U13)", () => {
    const profile = fixture("profile_10001", ProfileResponse);
    asRole("owner");
    const page = render(<DecisionRecord input={recordInput("profile", profile)} receipt={profile.receipt} lens="profile" locale="en" m={en} />).container;
    expect(page.textContent).not.toContain(en.record.sameBody);
    expect(page.textContent).toContain(en.record.howBy.profile);
  });
});
