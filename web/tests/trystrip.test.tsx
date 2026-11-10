// I9 (DECISIONS 45): a strip card that fails shows its error alone, as text, not as a link.
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TryCard } from "@/components/TryBusinesses";
import { CreditResponse } from "@/lib/schemas";
import { en, fixture } from "./helpers";

vi.mock("@/lib/api", () => ({
  getCredit: async (id: number) => (id === 10004 ? { ok: false, kind: "server" } : { ok: true, data: fixture(`credit_${id}`, CreditResponse) }),
}));

describe("try a business", () => {
  it("a failing card shows its error and does not block the others", async () => {
    const failed = render(await TryCard({ id: 10004, locale: "en", m: en }));
    const card = failed.container.querySelector('[data-try="10004"]')!;
    expect(card.hasAttribute("data-try-error")).toBe(true);
    expect(card.tagName).not.toBe("A");
    expect(card.textContent).toContain(en.errors.server);
    failed.unmount();
    const ok = render(await TryCard({ id: 10037, locale: "en", m: en }));
    const link = ok.container.querySelector("a[data-try]")!;
    expect(link.getAttribute("href")).toBe("/en/business/10037");
    expect(link.textContent).toContain(en.enums.decision_state.approved_conditional);
    expect(link.textContent).toContain(en.enums.status.scored);
  });
});
