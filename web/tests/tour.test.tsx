// E1: the guided tour. DECISIONS 51.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TourPanel } from "@/components/TourPanel";
import { TOUR, TOUR_STEPS, tourHref } from "@/lib/tour";
import { ar, en, webRoot } from "./helpers";

const nav = { params: new URLSearchParams(), push: vi.fn(), replace: vi.fn(), pathname: "/en/business/10001" };
vi.mock("next/navigation", () => ({
  useSearchParams: () => nav.params,
  usePathname: () => nav.pathname,
  useRouter: () => ({ push: nav.push, replace: nav.replace, refresh: vi.fn() }),
}));

const labels = (m: typeof en) => ({ ...m.tour, sheet: m.sheet.open, how: m.footer.how });

beforeEach(() => {
  vi.useFakeTimers();
  nav.push.mockClear();
  nav.replace.mockClear();
});
afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = "";
});

describe("tour definition", () => {
  it("has the nine steps the SOP lists, in order, on the configured business and scenario", () => {
    expect(TOUR_STEPS.map((s) => s.id)).toEqual(["verdict", "factors", "compliance", "pending", "waterfall", "runway", "timeline", "diff", "receipt"]);
    expect(TOUR_STEPS[2]!.query).toBe("view=compliance");
    expect(TOUR_STEPS[7]!.query).toBe(`scenario=${TOUR.scenario}`);
    for (const s of TOUR_STEPS.filter((s) => s.path.startsWith("/business"))) expect(s.path).toContain(`/business/${TOUR.business}`);
  });

  it("every step's target is marked on an existing element", () => {
    const source = readdirSync(join(webRoot, "components"))
      .filter((f) => f.endsWith(".tsx"))
      .map((f) => readFileSync(join(webRoot, "components", f), "utf8"))
      .join("\n");
    for (const s of TOUR_STEPS) expect(source, s.target).toContain(`data-tour="${s.target}"`);
  });

  it("captions name what to look at, in both languages, with Arabic marked draft", () => {
    for (const s of TOUR_STEPS) {
      expect(s.en.caption.length).toBeGreaterThan(20);
      expect(s.ar.draft).toBe(true);
      for (const text of [s.en.title, s.en.caption, s.ar.title, s.ar.caption]) expect(text).not.toMatch(/[0-9٠-٩]/);
    }
  });

  it("links keep the demo role and the step", () => {
    expect(tourHref("en", TOUR_STEPS[2]!, "admin")).toBe(`/en/business/${TOUR.business}/credit?view=compliance&tour=compliance&as=admin`);
    expect(tourHref("ar", TOUR_STEPS[0]!, null)).toBe(`/ar/business/${TOUR.business}?tour=verdict`);
  });
});

describe("tour receipt step", () => {
  // DECISIONS 58: the last step explains the owner's plain card, not hashes; it still points at the record aside.
  it("tour receipt step explains the plain card", () => {
    const step = TOUR_STEPS.find((s) => s.id === "receipt")!;
    expect(step.target).toBe("receipt");
    expect(step.en.title).toBe(en.record.title);
    expect(step.ar.title).toBe(ar.record.title);
    expect(step.en.caption).toMatch(/reference number/);
    expect(step.ar.caption).toContain("رقمًا مرجعيًا");
    for (const text of [step.en.title, step.en.caption]) expect(text).not.toMatch(/hash|receipt|command/i);
    for (const text of [step.ar.title, step.ar.caption]) expect(text).not.toMatch(/بصمة|إيصال|أمر/);
  });
});

describe("tour panel", () => {
  it("shows the step from the URL, moves focus to its title and outlines the target", () => {
    nav.params = new URLSearchParams("tour=verdict");
    const target = document.createElement("section");
    target.setAttribute("data-tour", "verdict");
    document.body.appendChild(target);
    render(<TourPanel locale="en" labels={labels(en)} />);
    const region = screen.getByRole("region", { name: en.tour.region });
    expect(region.textContent).toContain(TOUR_STEPS[0]!.en.title);
    expect(region.textContent).toContain(`Step 1 of ${TOUR_STEPS.length}`);
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: TOUR_STEPS[0]!.en.title }));
    act(() => vi.advanceTimersByTime(10));
    expect(target.classList.contains("tour-target")).toBe(true);
    expect(screen.queryByRole("link", { name: en.tour.back })).toBeNull();
    // Next is a link, so it works before the page's script has taken over.
    expect(screen.getByRole("link", { name: en.tour.next }).getAttribute("href")).toBe(tourHref("en", TOUR_STEPS[1]!, null));
  });

  it("Back, Next and End tour are links that keep the role and the collapsed state", () => {
    nav.params = new URLSearchParams("tour=runway&as=owner&tourMin=1");
    render(<TourPanel locale="en" labels={labels(en)} />);
    expect(screen.getByRole("link", { name: en.tour.next }).getAttribute("href")).toBe(`${tourHref("en", TOUR_STEPS[6]!, "owner")}&tourMin=1`);
    expect(screen.getByRole("link", { name: en.tour.end }).getAttribute("href")).toBe("/en/business/10001?as=owner&tourEnded=runway");
    nav.params = new URLSearchParams("tour=runway");
    render(<TourPanel locale="en" labels={labels(en)} />);
    expect(screen.getAllByRole("link", { name: en.tour.back }).at(-1)!.getAttribute("href")).toBe(tourHref("en", TOUR_STEPS[4]!, null));
  });

  it("tour ends on escape", () => {
    nav.params = new URLSearchParams("tour=runway&as=owner");
    render(<TourPanel locale="en" labels={labels(en)} />);
    fireEvent.keyDown(document.body, { key: "Escape" });
    // I10: the tour ends, the role stays, and the step it ended on rides along for Resume tour.
    expect(nav.replace).toHaveBeenCalledWith("/en/business/10001?as=owner&tourEnded=runway", { scroll: false });
  });

  it("an Escape that closes a glossary term does not end the tour", () => {
    nav.params = new URLSearchParams("tour=runway");
    render(<TourPanel locale="en" labels={labels(en)} />);
    const term = document.createElement("span");
    term.setAttribute("data-term", "hawl");
    document.body.appendChild(term);
    fireEvent.keyDown(term, { key: "Escape" });
    expect(nav.replace).not.toHaveBeenCalled();
  });

  it("tour continues when a target fails to load", () => {
    nav.params = new URLSearchParams("tour=waterfall");
    render(<TourPanel locale="ar" labels={labels(ar)} />);
    expect(screen.queryByText(ar.tour.missing)).toBeNull();
    act(() => vi.advanceTimersByTime(5000));
    expect(screen.getByText(ar.tour.missing)).toBeTruthy();
    expect(screen.getByRole("link", { name: ar.tour.next })).toBeTruthy();
  });

  it("the last step links to the sheet and to how Ma'al decides", () => {
    nav.params = new URLSearchParams("tour=receipt");
    render(<TourPanel locale="en" labels={labels(en)} />);
    expect(screen.queryByRole("link", { name: en.tour.next })).toBeNull();
    expect(screen.getByRole("link", { name: en.sheet.open }).getAttribute("href")).toBe(`/en/business/${TOUR.business}/sheet`);
    expect(screen.getByRole("link", { name: en.footer.how }).getAttribute("href")).toBe("/en/how-it-works");
  });

  it("shows nothing without a tour step", () => {
    nav.params = new URLSearchParams("");
    const { container } = render(<TourPanel locale="en" labels={labels(en)} />);
    expect(container.innerHTML).toBe("");
  });
});
