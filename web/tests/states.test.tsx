// Guard 2: each state in SOP section 5 renders its own explicit output.
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AnomalyCard } from "@/components/AnomalyCard";
import { BusinessHeader } from "@/components/BusinessHeader";
import { CreditCard } from "@/components/CreditCard";
import { ForecastCard } from "@/components/ForecastCard";
import { ProfilePanel } from "@/components/ProfilePanel";
import { ShariaPanel } from "@/components/ShariaPanel";
import { ZakatCard } from "@/components/ZakatCard";
import { AnomalyResponse, CreditResponse, ForecastResponse, ProfileResponse, ZakatResponse } from "@/lib/schemas";
import { ar, en, fixture } from "./helpers";
import { nisabPlate } from "@/lib/nisab";

const credit = (name: string, locale: "en" | "ar" = "en") =>
  render(
    <CreditCard
      data={fixture(name, CreditResponse)}
      initialView="public"
      locale={locale}
      m={locale === "en" ? en : ar}
    />,
  );

describe("credit states", () => {
  it("U1 approved unconditional (10001): amount, fixed markup, offer status", () => {
    credit("credit_10001");
    expect(screen.getByText(en.enums.decision.approved)).toBeTruthy();
    expect(screen.getByText(en.credit.markupFixed)).toBeTruthy();
    expect(screen.getByText(en.enums.offer_status.unconditional)).toBeTruthy();
    expect(screen.queryByText(en.credit.adjustedMarkup)).toBeNull();
  });

  it("U2 late_penalty_policy renders the word for the value returned", () => {
    // C1: the page shows the catalogue word for the response's own value; the schema admits only
    // charity_directed, and the raw code stays in the receipt.
    const data = fixture("credit_10001", CreditResponse);
    const { container } = credit("credit_10001");
    expect(data.credit!.late_penalty_policy).toBe("charity_directed");
    expect(screen.getByText(en.enums.late_penalty_policy[data.credit!.late_penalty_policy])).toBeTruthy();
    expect(en.enums.late_penalty_policy.charity_directed).toMatch(/charity/i);
    expect(container.textContent).not.toMatch(/late fee|interest|penalty rate/i);
  });

  it("declined on affordability (10004): reason shown, no amount or markup", () => {
    credit("credit_10004");
    expect(screen.getByText(en.enums.decision.declined)).toBeTruthy();
    expect(screen.getByText(en.enums.decline_reason.affordability_no_installment_capacity)).toBeTruthy();
    expect(screen.queryByText(en.credit.amount)).toBeNull();
    expect(screen.queryByText(en.credit.markup)).toBeNull();
  });

  it("conditional on Sharia review (10037): offer status and condition", () => {
    const data = fixture("credit_10037", CreditResponse);
    credit("credit_10037");
    expect(screen.getByText(en.enums.offer_status.conditional_on_sharia_review)).toBeTruthy();
    expect(screen.getByText(data.credit_decision_detail!.conditions![0]!)).toBeTruthy();
  });

  it("hard flag (synthetic state): compliance decline, the template the only explanation", () => {
    const data = fixture("credit_hard_flag_synthetic_state", CreditResponse);
    const { container } = credit("credit_hard_flag_synthetic_state");
    expect(screen.getByText(en.enums.decline_reason.sharia_hard_flag)).toBeTruthy();
    expect(screen.getByText(en.enums.decline_origin.compliance)).toBeTruthy();
    expect(within(container).getAllByText(data.credit_explanation!.public_tier[0]!.text).length).toBeGreaterThan(0);
    expect(screen.queryByText(en.enums.magnitude.strongly)).toBeNull();
  });

  it("insufficient_data (10003): refusal, not an empty card", () => {
    credit("credit_10003");
    expect(screen.getByText(en.refusal.title)).toBeTruthy();
    expect(screen.getByText(en.refusal.body)).toBeTruthy();
    expect(screen.getByText("insufficient_data")).toBeTruthy();
  });

  // U4 as amended by DECISIONS 57: in Arabic the backend's own Arabic sibling, verbatim; English stays English.
  it("credit page in arabic shows arabic reasons, conditions and compliance phrases", () => {
    for (const name of ["credit_10001", "credit_10004", "credit_10037"]) {
      const data = fixture(name, CreditResponse);
      const { container, unmount } = credit(name, "ar");
      for (const line of data.credit_explanation!.public_tier) {
        expect(line.text_ar, name).toBeTruthy();
        const shown = screen.getByText(line.text_ar!);
        expect(shown.getAttribute("lang")).toBeNull();
        expect(container.textContent).not.toContain(line.text);
      }
      for (const condition of data.credit_decision_detail!.conditions_ar ?? []) expect(screen.getByText(condition)).toBeTruthy();
      expect(container.textContent).not.toContain(ar.common.englishTemplate);
      unmount();
    }
    const english = fixture("credit_10001", CreditResponse);
    credit("credit_10001", "en");
    expect(screen.getByText(english.credit_explanation!.public_tier[0]!.text)).toBeTruthy();
  });

  it("backend text falls back to english with the pending label when arabic is missing", () => {
    // The synthetic hard-flag state is an edited copy written in English only (scripts/make-synthetic-states.mjs),
    // like an object from before DECISIONS 57: its compliance line has no text_ar.
    const data = fixture("credit_hard_flag_synthetic_state", CreditResponse);
    expect(data.credit_explanation!.public_tier[0]!.text_ar).toBeUndefined();
    credit("credit_hard_flag_synthetic_state", "ar");
    const line = screen.getByText(data.credit_explanation!.public_tier[0]!.text);
    expect(line.getAttribute("lang")).toBe("en");
    expect(line.getAttribute("dir")).toBe("ltr");
    expect(screen.getAllByText(ar.common.englishTemplate).length).toBeGreaterThan(0);
  });
});

describe("header states", () => {
  it("U10 partial_profile (10040): its own label and the unavailable features", () => {
    const data = fixture("profile_10040", ProfileResponse);
    render(<BusinessHeader data={data} locale="en" m={en} />);
    expect(screen.getByText(en.enums.status.partial_profile)).toBeTruthy();
    for (const feature of data.partial_profile_unavailable_features!) expect(screen.getByText(feature)).toBeTruthy();
  });

  it("U10 insufficient_data (10003): its own label", () => {
    render(<BusinessHeader data={fixture("profile_10003", ProfileResponse)} locale="en" m={en} />);
    expect(screen.getByText(en.enums.status.insufficient_data)).toBeTruthy();
  });

  it("U11 population and data source are shown", () => {
    const { container } = render(<BusinessHeader data={fixture("profile_10001", ProfileResponse)} locale="en" m={en} />);
    expect(container.textContent).toContain(`${en.common.population}: ${en.enums.population.serving}`);
    expect(container.textContent).toContain(`${en.common.dataSource}: ${en.enums.data_source.synthetic}`);
  });
});

describe("Sharia panel", () => {
  it("U6 fixed label and rule_table_status on every state", () => {
    for (const name of ["credit_10001", "credit_10003", "credit_10037", "credit_hard_flag_synthetic_state"]) {
      const { unmount } = render(<ShariaPanel data={fixture(name, CreditResponse)} locale="en" m={en} />);
      expect(screen.getByText(en.sharia.label)).toBeTruthy();
      // LG4 (DECISIONS 60): the status is shown in words; the raw code stays in the technical record.
      expect(screen.getByText(en.enums.rule_table_status.proposed_unverified)).toBeTruthy();
      unmount();
    }
  });

  it("10037 shows the owner prompt as display only, with no answer form", () => {
    const data = fixture("credit_10037", CreditResponse);
    const { container } = render(<ShariaPanel data={data} locale="en" m={en} />);
    expect(screen.getByText(data.sharia_screen.owner_prompts[0]!)).toBeTruthy();
    expect(container.querySelector("input, textarea, select, form")).toBeNull();
  });
});

describe("Zakat states", () => {
  const zakat = (name: string) => render(<ZakatCard data={fixture(name, ZakatResponse)} locale="en" m={en} />);

  it("U3 U7 computed (10001): exact liability at 2 decimals, nisab status plate", () => {
    const data = fixture("zakat_10001", ZakatResponse);
    const { container } = zakat("zakat_10001");
    expect(container.textContent).toContain(data.zakat!.liability_sar!.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ","));
    expect(screen.getByText(nisabPlate(data.zakat!.nisab_source_status, en)!.words)).toBeTruthy(); // the fixture's own status (entry 54)
  });

  it("zero_liability, hawl_incomplete (10037): the reason and detail", () => {
    const data = fixture("zakat_10037", ZakatResponse);
    zakat("zakat_10037");
    expect(screen.getByText(en.enums.zakat_status.zero_liability)).toBeTruthy();
    expect(screen.getByText(data.zakat!.detail!)).toBeTruthy();
  });

  it("zero_liability, below_nisab (synthetic state)", () => {
    const { container } = zakat("zakat_below_nisab_synthetic_state");
    expect(container.textContent).toContain(en.enums.zakat_reason.below_nisab);
  });

  it("U10 not_computed (synthetic state): the reason, and no liability amount", () => {
    const { container } = zakat("zakat_not_computed_synthetic_state");
    expect(container.textContent).toContain(en.enums.zakat_reason.no_balance_sheet_snapshot);
    expect(screen.queryByText(en.zakat.liability)).toBeNull();
  });

  it("insufficient_data (10003): refusal", () => {
    zakat("zakat_10003");
    expect(screen.getByText(en.refusal.body)).toBeTruthy();
  });
});

describe("forecast and anomaly states", () => {
  it("forecast computed (10001): alert level, table beside the chart, no actual series", () => {
    const { container } = render(<ForecastCard data={fixture("forecast_10001", ForecastResponse)} locale="en" m={en} />);
    expect(screen.getByText(en.enums.level.watch)).toBeTruthy();
    expect(container.querySelectorAll("tbody tr")).toHaveLength(6);
    expect(screen.getByRole("img").getAttribute("aria-label")).toBe(en.forecast.chartAlt);
  });

  it("forecast not_computed (synthetic state): says so", () => {
    const { container } = render(
      <ForecastCard data={fixture("forecast_not_computed_synthetic_state", ForecastResponse)} locale="en" m={en} />,
    );
    expect(container.textContent).toContain(en.forecast.notComputed);
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("anomaly not_computed (synthetic state): says so", () => {
    const { container } = render(
      <AnomalyCard data={fixture("anomaly_not_computed_synthetic_state", AnomalyResponse)} locale="en" m={en} />,
    );
    expect(container.textContent).toContain(en.anomaly.notComputed);
    expect(container.querySelector("table")).toBeNull();
  });

  it("insufficient_data (10003): both refuse", () => {
    render(<ForecastCard data={fixture("forecast_10003", ForecastResponse)} locale="en" m={en} />);
    render(<AnomalyCard data={fixture("anomaly_10003", AnomalyResponse)} locale="en" m={en} />);
    expect(screen.getAllByText(en.refusal.body)).toHaveLength(2);
  });
});

describe("receipts", () => {
  it("U13 lens receipt shows scope verbatim", () => {
    const data = fixture("zakat_10001", ZakatResponse);
    render(<ZakatCard data={data} locale="en" m={en} />);
    expect(screen.getByText(data.receipt.scope!)).toBeTruthy();
  });

  it("U13 /profile receipt says it has no scope field", () => {
    render(<ProfilePanel data={fixture("profile_10001", ProfileResponse)} m={en} />);
    expect(screen.getByText(en.receipt.noScope)).toBeTruthy();
  });
});
