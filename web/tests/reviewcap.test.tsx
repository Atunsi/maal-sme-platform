// E11 in the UI: "N of cap" when the response carries limits.max_flags, the count alone when it does not.
// The API side stopped at S9 (DECISIONS 44), so today every response takes the fallback.
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AnomalyCard } from "@/components/AnomalyCard";
import { AnomalyResponse } from "@/lib/schemas";
import { en, fixture, readJson } from "./helpers";

describe("review cap", () => {
  it("review queue shows n of cap when limits present", () => {
    const raw = readJson("fixtures", "anomaly_10001.json") as Record<string, unknown>;
    const data = AnomalyResponse.parse({ ...raw, limits: { max_flags: 10 } });
    const n = data.anomaly?.status === "computed" ? data.anomaly.flags.length : 0;
    const { container } = render(<AnomalyCard data={data} locale="en" m={en} />);
    expect(screen.getByRole("img", { name: `${n} of 10 review slots used` })).toBeTruthy();
    expect(container.querySelectorAll("[data-slot-row] span")).toHaveLength(10);
    expect(container.querySelectorAll('[data-slot-row] span[data-filled="true"]')).toHaveLength(n);
  });

  it("review queue falls back to count when limits absent", () => {
    const data = fixture("anomaly_10001", AnomalyResponse);
    expect(data.limits).toBeUndefined();
    const { container } = render(<AnomalyCard data={data} locale="en" m={en} />);
    expect(container.querySelector("[data-slots]")).toBeNull();
    expect(container.querySelector("[data-slot-row]")).toBeNull();
  });

  it("a limits object of the wrong shape fails the schema", () => {
    const raw = readJson("fixtures", "anomaly_10001.json") as Record<string, unknown>;
    expect(AnomalyResponse.safeParse({ ...raw, limits: { max_flags: 10, extra: 1 } }).success).toBe(false);
  });
});
