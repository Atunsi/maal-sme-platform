// Guard 4 (U4, U12): the Compliance View shows response fields and column labels, nothing composed.
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ComplianceView } from "@/components/ComplianceView";
import { byAbsoluteContribution, traceLine } from "@/lib/compliance";
import { formatRaw } from "@/lib/format";
import { CreditResponse } from "@/lib/schemas";
import { ar, en, fixture } from "./helpers";

const data = fixture("credit_10001", CreditResponse);
const explanation = data.credit_explanation!;
const detail = data.credit_decision_detail!;
const tier = explanation.compliance_tier;

const view = (receipt = data.receipt) =>
  render(<ComplianceView explanation={explanation} detail={detail} receipt={receipt} locale="en" m={en} />);

describe("Compliance View guard", () => {
  // T3, T4 (DECISIONS 57): in Arabic the units, phrases and feature labels are the backend's Arabic, each raw key
  // still beside it in a Code span; field names keep their Code next to the Arabic words.
  it("arabic compliance view shows the backend's arabic phrases and labels beside the codes", () => {
    const { container } = render(<ComplianceView explanation={explanation} detail={detail} receipt={data.receipt} locale="ar" m={ar} />);
    const text = container.textContent!;
    expect(text).toContain(tier.units_ar!);
    expect(text).not.toContain(tier.units);
    for (const [key, phrase] of Object.entries(tier.phrases_ar!)) {
      expect(text).toContain(phrase);
      expect(text).not.toContain(tier.phrases[key]!);
      expect(screen.getAllByText(key, { selector: "code" }).length).toBeGreaterThan(0);
    }
    for (const row of tier.contributions) {
      expect(text).toContain(tier.feature_labels_ar![row.feature]!);
      expect(screen.getAllByText(row.feature, { selector: "code" }).length).toBeGreaterThan(0);
    }
    for (const code of ["pd", "logit", "risk_tier", "model_version", "model_sha256", "credit_model_cv_auc", "credit_model_oracle_ceiling_auc"]) {
      expect(screen.getAllByText(code, { selector: "code" }).length).toBeGreaterThan(0);
    }
    expect(text).toContain(ar.compliance.pd);
  });

  it("U4 snapshot for 10001", () => {
    const { container } = view();
    expect(container.textContent).toMatchSnapshot();
  });

  it("U4 every table cell is a value from the response", () => {
    const allowed = new Set<string>([en.common.dash, en.common.yes, en.common.no]);
    for (const [key, value] of [...Object.entries(tier.threshold_table), ...Object.entries(tier.phrases)]) {
      allowed.add(key);
      allowed.add(value);
    }
    for (const line of explanation.public_tier) {
      allowed.add(String(line.feature_id));
      allowed.add(String(line.magnitude));
      allowed.add(String(line.direction));
    }
    for (const row of tier.contributions) {
      allowed.add(String(row.feature_id));
      allowed.add(row.feature);
      allowed.add(formatRaw(row.contribution_logodds, "en"));
    }
    const { container } = view();
    const cells = [...container.querySelectorAll("td")].map((cell) => cell.textContent ?? "");
    expect(cells.length).toBeGreaterThan(tier.contributions.length);
    expect(cells.filter((text) => !allowed.has(text))).toEqual([]);
  });

  it("U4 contributions are all shown, largest absolute value first", () => {
    const sorted = byAbsoluteContribution(tier.contributions);
    expect(sorted).toHaveLength(tier.contributions.length);
    const sizes = sorted.map((row) => Math.abs(row.contribution_logodds));
    expect(sizes).toEqual([...sizes].sort((a, b) => b - a));
  });

  it("U4 traceLine matches keys, including marginally/either", () => {
    const line = { feature_id: 1, text: "", magnitude: "marginally", direction: "either" } as const;
    expect(traceLine(line, tier)).toEqual({
      thresholdRule: tier.threshold_table.marginally,
      phraseKey: "marginally/either",
      phrase: tier.phrases["marginally/either"],
    });
  });

  it("U4 traceLine gives nothing for a compliance line", () => {
    const line = { feature_id: null, text: "", magnitude: null, direction: null, source: "compliance" } as const;
    expect(traceLine(line, tier)).toBeNull();
  });

  it("U12 AUC and ceiling come from the receipt, not the code", () => {
    view({ ...data.receipt, credit_model_cv_auc: 0.1234, credit_model_oracle_ceiling_auc: 0.5678 });
    expect(screen.getByText("0.1234")).toBeTruthy();
    expect(screen.getByText("0.5678")).toBeTruthy();
  });
});
