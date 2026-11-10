// B14 (DECISIONS 45): the footer's links keep the demo role.
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FooterLinks } from "@/components/FooterLinks";
import { en } from "./helpers";

vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams("as=owner&tour=verdict") }));

describe("footer", () => {
  it("footer links keep the demo role", () => {
    render(<FooterLinks locale="en" footer={en.footer} />);
    expect(screen.getByRole("link", { name: en.footer.how }).getAttribute("href")).toBe("/en/how-it-works?as=owner");
    expect(screen.getByRole("link", { name: en.footer.glossary }).getAttribute("href")).toBe("/en/glossary?as=owner");
  });
});
