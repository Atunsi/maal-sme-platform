// I3 (DECISIONS 45): expandable credit factors. U4: the factor text stays verbatim. U9: raw named values only.
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CreditCard } from "@/components/CreditCard";
import { CreditResponse, ProfileResponse } from "@/lib/schemas";
import { en, fixture } from "./helpers";

const profile = fixture("profile_10001", ProfileResponse);
const calls: { id: number; names: string[] }[] = [];
vi.mock("@/app/actions", () => ({
  factorValues: async (id: number, names: string[]) => {
    calls.push({ id, names });
    return { ok: true, values: Object.fromEntries(names.map((n) => [n, { value: profile.features[n] ?? null, nullReason: profile.null_reasons[n] ?? null }])) };
  },
}));

const credit = fixture("credit_10001", CreditResponse);
const names = Object.fromEntries(credit.credit_explanation!.compliance_tier.contributions.map((c) => [String(c.feature_id), c.feature]));

describe("credit factors", () => {
  it("credit factor opens its definition and raw value", async () => {
    const { container } = render(<CreditCard data={credit} initialView="public" locale="en" m={en} />);
    const line = credit.credit_explanation!.public_tier[0]!;
    const feature = names[String(line.feature_id)]!;
    expect(screen.getByText(line.text)).toBeTruthy(); // U4, verbatim
    const button = container.querySelector<HTMLButtonElement>(`button[data-factor="${feature}"]`)!;
    expect(button.getAttribute("aria-expanded")).toBe("false");
    await act(async () => fireEvent.click(button));
    expect(button.getAttribute("aria-expanded")).toBe("true");
    const panel = document.getElementById(button.getAttribute("aria-controls")!)!;
    expect(panel.hidden).toBe(false);
    expect(panel.textContent).toContain(feature);
    expect(panel.textContent).toContain(`${en.dashboard.value}: ${String(profile.features[feature])}`);
    expect(panel.querySelector("a")!.getAttribute("href")).toBe("/en/glossary");
    expect(panel.textContent).not.toMatch(/peer|sector average|vs\.? sector|compared (to|with)/i); // U9
  });

  it("credit factor fetches profile once", async () => {
    const { container } = render(<CreditCard data={credit} initialView="public" locale="en" m={en} />);
    const buttons = [...container.querySelectorAll<HTMLButtonElement>("button[data-factor]")];
    expect(buttons.length).toBe(credit.credit_explanation!.public_tier.filter((l) => l.feature_id !== null && l.magnitude && l.direction).length);
    for (const b of buttons) await act(async () => fireEvent.click(b));
    await act(async () => fireEvent.click(buttons[0]!)); // close and open again
    await act(async () => fireEvent.click(buttons[0]!));
    // One request for business 10001 in this whole module: the first test's open made it, and every later
    // open, across rows and renders, reuses it.
    expect(calls).toHaveLength(1);
    expect(calls[0]!.id).toBe(10001);
    expect(calls[0]!.names.sort()).toEqual(Object.values(names).sort());
  });
});
