// C5 (DECISIONS 45): a scannable review table. Sorting is client-side over the one response.
import { fireEvent, render, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { hourText, readSort, ReviewBoard } from "@/components/ReviewBoard";
import { AnomalyResponse } from "@/lib/schemas";
import { en, fixture } from "./helpers";

const body = fixture("anomaly_10001", AnomalyResponse).anomaly!;
if (body.status !== "computed") throw new Error("10001 anomaly fixture did not compute");
const a = body;
const byId = new Map(a.flags.map((f) => [String(f.transaction_id), f]));
const order = (container: HTMLElement) => [...container.querySelectorAll("tbody tr")].map((r) => byId.get(r.getAttribute("data-id")!)!);

describe("review table", () => {
  it("review table sorts by date by default", () => {
    const { container } = render(<ReviewBoard a={a} locale="en" labels={en} />);
    const flags = order(container);
    expect(flags).toHaveLength(a.flags.length);
    for (let i = 1; i < flags.length; i++) expect(flags[i - 1]!.date <= flags[i]!.date).toBe(true); // oldest first
    expect(container.querySelector('th[aria-sort="ascending"] [data-sort="date"]')).not.toBeNull();
    expect(readSort(new URLSearchParams("sort=amount&dir=desc"))).toEqual({ column: "amount", dir: "desc" });
    expect(readSort(new URLSearchParams("sort=score"))).toEqual({ column: "date", dir: "asc" }); // unknown column ignored
  });

  it("review headers sort and announce aria-sort", () => {
    const { container } = render(<ReviewBoard a={a} locale="en" labels={en} />);
    const head = container.querySelector("thead")!;
    const amount = within(head as HTMLElement).getByRole("button", { name: en.anomaly.amount });
    fireEvent.click(amount);
    expect(amount.closest("th")!.getAttribute("aria-sort")).toBe("ascending");
    expect(head.querySelectorAll("th[aria-sort]")).toHaveLength(1);
    let amounts = order(container).map((f) => f.amount_sar);
    expect(amounts).toEqual([...amounts].sort((x, y) => x - y));
    fireEvent.click(amount);
    expect(amount.closest("th")!.getAttribute("aria-sort")).toBe("descending");
    amounts = order(container).map((f) => f.amount_sar);
    expect(amounts).toEqual([...amounts].sort((x, y) => y - x));
    expect(new URL(window.location.href).searchParams.get("sort")).toBe("amount");
    expect(new URL(window.location.href).searchParams.get("dir")).toBe("desc");
    window.history.replaceState(null, "", "/");
  });

  it("review hour shows two digits and minutes", () => {
    expect(hourText(3)).toBe("03:00");
    expect(hourText(23)).toBe("23:00");
    const { container } = render(<ReviewBoard a={a} locale="en" labels={en} />);
    const cells = [...container.querySelectorAll("tbody tr")].map((r) => r.children[1]!.textContent);
    for (const cell of cells) expect(cell).toMatch(/^\d{2}:00$/);
  });
});
