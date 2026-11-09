// C6 (DECISIONS 45): refusals lead somewhere; a compliant screen with no MCC says why.
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CreditCard } from "@/components/CreditCard";
import { ShariaPanel } from "@/components/ShariaPanel";
import { VerdictSheet } from "@/components/VerdictSheet";
import { DEMO_BUSINESS } from "@/lib/businesses";
import { CreditResponse } from "@/lib/schemas";
import { ar, en, fixture } from "./helpers";

describe("refusals", () => {
  it("refusal shows activity days and a way forward", () => {
    const data = fixture("credit_10003", CreditResponse);
    expect(data.status).toBe("insufficient_data");
    for (const ui of [<VerdictSheet key="v" data={data} locale="en" m={en} />, <CreditCard key="c" data={data} initialView="public" locale="en" m={en} />]) {
      const { container, unmount } = render(ui);
      // U10: still the explicit refusal, with no figure standing in for a result.
      expect(screen.getByText(en.refusal.body)).toBeTruthy();
      const coverage = container.querySelector("[data-refusal-coverage]");
      if (data.coverage_days_90d === null) expect(coverage).toBeNull();
      else expect(coverage!.textContent).toBe(`${en.common.coverage}: ${data.coverage_days_90d}`);
      const link = screen.getByRole("link", { name: en.refusal.example });
      expect(link.getAttribute("href")).toBe(`/en/business/${DEMO_BUSINESS}`);
      unmount();
    }
    render(<VerdictSheet data={data} locale="ar" m={ar} />);
    expect(screen.getByRole("link", { name: ar.refusal.example }).getAttribute("href")).toBe(`/ar/business/${DEMO_BUSINESS}`);
  });

  it("a compliant screen with no MCC says the sector was used", () => {
    const none = fixture("credit_10004", CreditResponse);
    expect(none.sharia_screen.declared_mcc).toBeNull();
    expect(none.sharia_screen.sharia_screen_status).toBe("compliant");
    const { unmount } = render(<ShariaPanel data={none} locale="en" m={en} />);
    expect(screen.getByText(en.sharia.noMccSector)).toBeTruthy();
    unmount();
    // A soft flag with no MCC (10037) already names its rule, and a declared MCC (10001) needs no sentence.
    for (const name of ["credit_10037", "credit_10001"]) {
      const { unmount: u } = render(<ShariaPanel data={fixture(name, CreditResponse)} locale="en" m={en} />);
      expect(screen.queryByText(en.sharia.noMccSector)).toBeNull();
      u();
    }
  });
});
