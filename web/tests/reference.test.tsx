// DECISIONS 58 (P8): the overview shows the reference an admin opened, and says when it is from an earlier result.
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ReferenceNote } from "@/components/ReferenceNote";
import { referenceFor } from "@/lib/reference";
import { CreditResponse } from "@/lib/schemas";
import { asRole, en, fixture } from "./helpers";

const credit = fixture("credit_10001", CreditResponse);
const current = referenceFor(credit.receipt, 10001);
const labels = { opened: en.record.referenceOpened, old: en.record.oldReference };

describe("reference note", () => {
  it("a current reference shows beside the heading, with no plate", () => {
    asRole("admin", `ref=${current.toLowerCase()}`);
    const { container } = render(<ReferenceNote businessId={10001} current={current} labels={labels} />);
    expect(container.textContent).toContain(current);
    expect(container.textContent).not.toContain(en.record.oldReference);
  });

  it("an old reference shows the earlier-result plate", () => {
    asRole("admin", "ref=M-10001-00000000");
    const { container } = render(<ReferenceNote businessId={10001} current={current} labels={labels} />);
    expect(container.textContent).toContain("M-10001-00000000");
    expect(container.textContent).toContain(en.record.oldReference);
    // It never says which changed, data or method.
    expect(en.record.oldReference).toMatch(/data or the method/);
  });

  it("a reference for another business, or no reference, shows nothing", () => {
    asRole("admin", `ref=M-10004-${current.slice(-8)}`);
    expect(render(<ReferenceNote businessId={10001} current={current} labels={labels} />).container.textContent).toBe("");
    asRole("admin");
    expect(render(<ReferenceNote businessId={10001} current={current} labels={labels} />).container.textContent).toBe("");
  });
});
