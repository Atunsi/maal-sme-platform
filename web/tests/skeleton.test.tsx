// I7 (DECISIONS 45): card-shaped loading skeletons; lens pages show their title before the lens answers.
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LensPage } from "@/components/LensPage";
import { CardLoading } from "@/components/ui";
import { nameOf } from "@/lib/business-names";
import { en } from "./helpers";

describe("loading", () => {
  it("the skeleton is card-shaped and still says Loading", () => {
    const { container } = render(<CardLoading title="Credit" m={en} />);
    const card = container.querySelector("[data-skeleton]")!;
    expect(card.className).toContain("min-h-[200px]");
    expect(card.querySelectorAll(".skeleton")).toHaveLength(3);
    expect(screen.getByRole("status").textContent).toBe(en.common.loading);
    expect(card.getAttribute("aria-busy")).toBe("true");
  });

  it("lens title shows before the lens loads", async () => {
    const never = new Promise<never>(() => {});
    const ui = await LensPage({ params: Promise.resolve({ locale: "en", id: "10001" }), load: () => never, title: (m) => m.credit.title, children: () => null });
    const { container } = render(ui);
    const head = container.querySelector("[data-lens-fallback]")!;
    expect(head.querySelector("h1")!.textContent).toBe(en.credit.title);
    expect(head.textContent).toContain(nameOf(10001, "en"));
    expect(container.querySelector("[data-skeleton]")).not.toBeNull();
  });
});
