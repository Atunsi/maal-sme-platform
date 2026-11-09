// E5: chart readouts on hover, keyboard and tap, and the computed cash-floor label (DECISIONS 51).
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AnomalyCard } from "@/components/AnomalyCard";
import { floorLabelPlacement } from "@/components/ForecastChart";
import { ForecastCard } from "@/components/ForecastCard";
import { ZakatCard } from "@/components/ZakatCard";
import { formatSar } from "@/lib/format";
import { fill } from "@/lib/i18n";
import { AnomalyResponse, ForecastResponse, ZakatResponse } from "@/lib/schemas";
import { en, fixture } from "./helpers";

const forecast = fixture("forecast_10001", ForecastResponse);

function chart() {
  const view = render(<ForecastCard data={forecast} locale="en" m={en} />);
  const target = view.container.querySelector("[data-forecast-chart]") as HTMLElement;
  return { ...view, target };
}

const readoutText = (container: HTMLElement) => container.querySelector("[data-readout]")?.textContent ?? null;

describe("forecast readout", () => {
  it("the chart is focusable and its label names the keys", () => {
    const { target } = chart();
    expect(target.tabIndex).toBe(0);
    expect(target.getAttribute("aria-label")).toBe(en.forecast.chartKeys);
  });

  it("forecast readout follows keyboard and matches the table", () => {
    const { container, target } = chart();
    const f = forecast.forecast!;
    if (f.status !== "computed") throw new Error("fixture must be computed");
    const sar = (v: number) => formatSar(v, "en");
    fireEvent.keyDown(target, { key: "Home" });
    expect(readoutText(container)).toContain(en.forecast.today);
    expect(readoutText(container)).toContain(sar(f.balance_today_sar));
    expect(readoutText(container)).toContain(`${en.forecast.floorName}${sar(0)}`);
    // Right steps to each horizon in turn; every value is the table's value for that row.
    for (const row of f.model) {
      fireEvent.keyDown(target, { key: "ArrowRight" });
      const naive = f.naive_baseline.find((b) => b.horizon_days === row.horizon_days)!;
      const text = readoutText(container)!;
      expect(text).toContain(fill(en.forecast.dayN, { n: String(row.horizon_days) }));
      expect(text).toContain(`${en.forecast.model}${sar(row.projected_balance_sar)}`);
      expect(text).toContain(`${en.forecast.baseline}${sar(naive.projected_balance_sar)}`);
      expect(container.querySelector("table")!.textContent).toContain(sar(row.projected_balance_sar));
      expect(container.querySelector("table")!.textContent).toContain(sar(naive.projected_balance_sar));
    }
    fireEvent.keyDown(target, { key: "ArrowRight" });
    expect(readoutText(container)).toContain(fill(en.forecast.dayN, { n: String(f.model.at(-1)!.horizon_days) }));
    fireEvent.keyDown(target, { key: "ArrowLeft" });
    expect(readoutText(container)).toContain(fill(en.forecast.dayN, { n: String(f.model.at(-2)!.horizon_days) }));
    fireEvent.keyDown(target, { key: "End" });
    expect(readoutText(container)).toContain(fill(en.forecast.dayN, { n: String(f.model.at(-1)!.horizon_days) }));
    expect(container.querySelector("[data-guide]")).not.toBeNull();
    fireEvent.keyDown(target, { key: "Escape" });
    expect(readoutText(container)).toBeNull();
    expect(container.querySelector("[data-guide]")).toBeNull();
  });

  it("the live region repeats the readout, throttled", () => {
    vi.useFakeTimers();
    const { container, target } = chart();
    fireEvent.keyDown(target, { key: "Home" });
    const live = container.querySelector("[role=status]")!;
    expect(live.textContent).toBe("");
    act(() => vi.advanceTimersByTime(400));
    expect(live.textContent).toContain(en.forecast.today);
    vi.useRealTimers();
  });

  it("a tap elsewhere hides the readout", () => {
    const { container, target } = chart();
    fireEvent.keyDown(target, { key: "Home" });
    expect(readoutText(container)).not.toBeNull();
    fireEvent.pointerDown(document.body);
    expect(readoutText(container)).toBeNull();
  });
});

describe("cash floor label", () => {
  it("stays above the floor when that side is clear", () => {
    const placed = floorLabelPlacement([[[40, 50], [660, 40]]], [], 200, "SAR 0.00, the cash floor");
    expect(placed.clear).toBe(true);
    expect(placed.y).toBeLessThan(200);
  });

  it("moves below the floor when a line crosses the space above its right end", () => {
    const placed = floorLabelPlacement([[[40, 100], [500, 100], [660, 196]]], [], 200, "SAR 0.00, the cash floor");
    expect(placed.clear).toBe(true);
    expect(placed.y).toBeGreaterThan(200);
  });

  it("is computed for 10001, not typed in, and is clear of both lines", () => {
    const { container } = chart();
    const label = container.querySelector("[data-floor-label]")!;
    expect(label.getAttribute("text-anchor")).toBe("end");
    expect(container.querySelectorAll("polyline[data-series]")).toHaveLength(2);
  });
});

describe("zakat and review readouts", () => {
  it("zakat bars show values on focus", () => {
    const data = fixture("zakat_10001", ZakatResponse);
    render(<ZakatCard data={data} locale="en" m={en} />);
    const z = data.zakat!;
    const label = `${en.zakat.assets}: ${formatSar(z.zakatable_assets_sar!, "en")}`;
    const bar = screen.getByRole("button", { name: label });
    expect(bar.getAttribute("data-open")).toBe("false");
    fireEvent.focus(bar);
    expect(bar.getAttribute("data-open")).toBe("true");
    expect(bar.querySelector(".tip")!.textContent).toBe(label);
    fireEvent.keyDown(bar, { key: "Escape" });
    expect(bar.getAttribute("data-open")).toBe("false");
    for (const name of [en.zakat.less, en.zakat.base]) expect(screen.getByRole("button", { name: new RegExp(`^${name}: `) })).toBeTruthy();
  });

  it("review mark readout shows flag reason only", () => {
    const data = fixture("anomaly_10001", AnomalyResponse);
    const { container } = render(<AnomalyCard data={data} locale="en" m={en} />);
    const mark = container.querySelector(".tick") as HTMLElement;
    fireEvent.mouseEnter(mark);
    expect(mark.getAttribute("data-open")).toBe("true");
    const tip = mark.querySelector(".tip")!.textContent!;
    expect(tip).toBe(mark.getAttribute("aria-label"));
    expect(tip).not.toMatch(/fraud|score|SAR|\d+\.\d+/i);
    fireEvent.mouseLeave(mark);
    expect(mark.getAttribute("data-open")).toBe("false");
  });
});
