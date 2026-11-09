// I2 (DECISIONS 45): review queue filters. U8: they carry flag_reason only.
import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { readReasons, ReviewBoard } from "@/components/ReviewBoard";
import { AnomalyResponse } from "@/lib/schemas";
import { en, fixture } from "./helpers";

const body = fixture("anomaly_10001", AnomalyResponse).anomaly!;
if (body.status !== "computed") throw new Error("10001 anomaly fixture did not compute");
const a = body;
const reasons = [...new Set(a.flags.map((f) => f.flag_reason))];

describe("review filters", () => {
  it("review reason filters hide lanes and rows", () => {
    const { container } = render(<ReviewBoard a={a} locale="en" labels={en} />);
    const off = reasons[0]!;
    const toggle = container.querySelector<HTMLButtonElement>(`button[data-reason="${off}"]`)!;
    expect(toggle.getAttribute("aria-pressed")).toBe("true");
    expect(toggle.textContent).toContain(en.enums.flag_reason[off]);
    expect(toggle.textContent).not.toMatch(/fraud|score/i);
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-pressed")).toBe("false");
    expect(container.querySelector(`[data-lane="${off}"]`)).toBeNull();
    const ids = new Set(a.flags.filter((f) => f.flag_reason === off).map((f) => String(f.transaction_id)));
    for (const row of container.querySelectorAll("tbody tr")) expect(ids.has(row.getAttribute("data-id")!)).toBe(false);
    expect(new URL(window.location.href).searchParams.get("reason")).toBe(reasons.slice(1).join(","));
    fireEvent.click(toggle);
    expect(new URL(window.location.href).searchParams.get("reason")).toBeNull();
    expect(container.querySelectorAll("tbody tr")).toHaveLength(a.flags.length);
    window.history.replaceState(null, "", "/");
    // A shared link keeps only reasons the response has.
    expect([...readReasons(new URLSearchParams(`reason=${reasons[0]},not_a_reason`), reasons)]).toEqual([reasons[0]]);
  });

  it("review count states when a filter is on", () => {
    const { container } = render(<ReviewBoard a={a} locale="en" labels={en} />);
    expect(container.querySelector("[data-showing]")).toBeNull();
    const off = reasons[0]!;
    fireEvent.click(container.querySelector(`button[data-reason="${off}"]`)!);
    const left = a.flags.filter((f) => f.flag_reason !== off).length;
    expect(container.querySelector("[data-showing]")!.textContent).toBe(`showing ${left} of ${a.flags.length}`);
    window.history.replaceState(null, "", "/");
  });
});
