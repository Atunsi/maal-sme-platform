// The review timeline: one track, one mark per queued transaction. U8: marks carry the flag reason only.
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ReviewBoard } from "@/components/ReviewBoard";
import { AnomalyResponse } from "@/lib/schemas";
import { ar, fixture } from "./helpers";

const body = fixture("anomaly_10001", AnomalyResponse).anomaly!;
if (body.status !== "computed") throw new Error("10001 anomaly fixture did not compute");
const a = body;

describe("review timeline", () => {
  it("the time axis stays left to right in Arabic", () => {
    const { container } = render(<ReviewBoard a={a} locale="ar" labels={ar} />);
    expect(container.querySelector("[data-track]")!.closest("[dir]")!.getAttribute("dir")).toBe("ltr");
  });
});
