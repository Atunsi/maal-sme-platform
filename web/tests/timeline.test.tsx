// B10, B11 (DECISIONS 45): review lanes and clusters. U8 still holds: lanes, clusters and readouts carry the
// flag reason only.
import { act, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ReviewBoard } from "@/components/ReviewBoard";
import { buildLanes, MIN_GAP_PX, positionIn } from "@/lib/timeline";
import { formatDate } from "@/lib/format";
import { AnomalyResponse } from "@/lib/schemas";
import { ar, en, fixture } from "./helpers";

const body = fixture("anomaly_10001", AnomalyResponse).anomaly!;
if (body.status !== "computed") throw new Error("10001 anomaly fixture did not compute");
const a = body;

afterEach(() => vi.unstubAllGlobals());

/** Renders the board as if its track were `width` pixels wide. */
function renderAt(width: number, locale: "en" | "ar" = "en") {
  let callback: ResizeObserverCallback | null = null;
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(cb: ResizeObserverCallback) {
        callback = cb;
      }
      observe() {}
      disconnect() {}
    },
  );
  const view = render(<ReviewBoard a={a} locale={locale} labels={locale === "en" ? en : ar} />);
  act(() => callback!([{ contentRect: { width } } as ResizeObserverEntry], {} as ResizeObserver));
  return view;
}

describe("review lanes", () => {
  it("review marks never overlap at any width", () => {
    const at = positionIn(a.scan_window.from, a.scan_window.to);
    for (const width of [240, 360, 390, 768, 1280]) {
      const lanes = buildLanes(a.flags, a.scan_window.from, a.scan_window.to, width);
      // Every flag is in exactly one cluster.
      expect(lanes.flatMap((l) => l.clusters.flatMap((c) => c.ids)).sort()).toEqual(a.flags.map((f) => f.transaction_id).sort());
      for (const lane of lanes) {
        const centres = lane.clusters.map((c) => c.at * width);
        for (let i = 1; i < centres.length; i++) expect(centres[i]! - centres[i - 1]!).toBeGreaterThanOrEqual(MIN_GAP_PX - 1e-9);
        for (const c of lane.clusters) for (const f of c.flags) expect(f.flag_reason).toBe(lane.reason);
      }
      // A cluster sits at the mean position of its marks.
      for (const c of lanes.flatMap((l) => l.clusters)) expect(c.at).toBeCloseTo(c.flags.reduce((s, f) => s + at(f.date), 0) / c.flags.length, 10);
    }
    // Narrower screens never get more buttons than wider ones.
    const buttons = (w: number) => buildLanes(a.flags, a.scan_window.from, a.scan_window.to, w).reduce((n, l) => n + l.clusters.length, 0);
    expect(buttons(360)).toBeLessThanOrEqual(buttons(1280));
  });

  it("review lanes name their reason", () => {
    const { container } = renderAt(1280);
    const reasons = [...new Set(a.flags.map((f) => f.flag_reason))];
    const lanes = [...container.querySelectorAll("[data-lane]")];
    expect(lanes.map((l) => l.getAttribute("data-lane"))).toEqual(reasons);
    for (const lane of lanes) expect(lane.querySelector(".lane-label")!.textContent).toBe(en.enums.flag_reason[lane.getAttribute("data-lane") as keyof typeof en.enums.flag_reason]);
    // B11: no mark sets its own height, so size carries nothing.
    for (const bar of container.querySelectorAll<HTMLElement>(".tick-bar")) expect(bar.style.height).toBe("");
  });

  it("review cluster lists every date and reason", () => {
    const { container } = renderAt(240);
    const clusters = [...container.querySelectorAll<HTMLElement>('button.tick:not([data-count="1"])')];
    expect(clusters.length).toBeGreaterThan(0);
    for (const cluster of clusters) {
      const ids = cluster.getAttribute("data-ids")!.split(" ").map(Number);
      expect(cluster.querySelector(".tick-count")!.textContent).toBe(String(ids.length)); // a plain number
      const readout = cluster.getAttribute("aria-label")!;
      expect(cluster.querySelector(".tip")!.textContent).toBe(readout);
      for (const id of ids) {
        const flag = a.flags.find((f) => f.transaction_id === id)!;
        expect(readout).toContain(`${formatDate(flag.date, "en")}, ${en.enums.flag_reason[flag.flag_reason]}`);
      }
      expect(readout).not.toMatch(/fraud|score|SAR/i); // U8
    }
    // Clicking a cluster picks all of its rows.
    const cluster = clusters[0]!;
    const ids = cluster.getAttribute("data-ids")!.split(" ");
    fireEvent.click(cluster);
    const picked = [...container.querySelectorAll('tbody tr[data-picked="true"]')].map((r) => r.getAttribute("data-id"));
    expect(picked.sort()).toEqual([...ids].sort());
    expect(cluster.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(cluster);
    expect(container.querySelectorAll('tbody tr[data-picked="true"]')).toHaveLength(0);
  });

  it("the time axis stays left to right in Arabic", () => {
    const { container } = renderAt(390, "ar");
    expect(container.querySelector("[data-lanes]")!.closest("[dir]")!.getAttribute("dir")).toBe("ltr");
    expect(container.querySelector(".lane-label")!.getAttribute("dir")).toBe("rtl");
  });
});
