// E6: scenario "Play all". DECISIONS 43.
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PLAY_STEP_MS, ScenarioPlayer } from "@/components/ScenarioPlayer";
import index from "../scenarios-data/index.json";
import { en } from "./helpers";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, push: vi.fn(), refresh: vi.fn() }) }));

const names = index.scenarios.map((s) => s.name);
const labels = index.scenarios.map((s) => s.label);
const text = { play: en.scenarios.play, pause: en.scenarios.pause, position: en.scenarios.position, group: en.scenarios.playerGroup };
const base = "/en/scenarios?scenario=";
const player = (current: string) => <ScenarioPlayer names={names} labels={labels} current={current} hrefBase={base} text={text} />;

beforeEach(() => {
  vi.useFakeTimers();
  replace.mockClear();
});
afterEach(() => {
  vi.useRealTimers();
  Object.defineProperty(document, "hidden", { value: false, configurable: true });
});

describe("play all", () => {
  it("play all steps through every scenario, in library order, then stops", () => {
    const view = render(player(names[0]!));
    expect(screen.getByText(`Scenario 1 of ${names.length}`)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: text.play }));
    // R3: the label says the state (Pause while playing), so there is no aria-pressed.
    expect(screen.getByRole("button", { name: text.pause }).hasAttribute("aria-pressed")).toBe(false);
    for (let i = 1; i < names.length; i++) {
      act(() => vi.advanceTimersByTime(PLAY_STEP_MS - 1));
      expect(replace).toHaveBeenCalledTimes(i - 1);
      act(() => vi.advanceTimersByTime(1));
      expect(replace).toHaveBeenLastCalledWith(`${base}${names[i]}`, { scroll: false });
      view.rerender(player(names[i]!)); // the router brings the next scenario
      expect(screen.getByText(`Scenario ${i + 1} of ${names.length}`)).toBeTruthy();
    }
    expect(screen.getByRole("button", { name: text.play })).toBeTruthy(); // stopped at the last
    expect(screen.queryByRole("button", { name: text.pause })).toBeNull();
    act(() => vi.advanceTimersByTime(PLAY_STEP_MS * 3));
    expect(replace).toHaveBeenCalledTimes(names.length - 1);
  });

  it("announces each scenario while playing", () => {
    const view = render(player(names[0]!));
    fireEvent.click(screen.getByRole("button", { name: text.play }));
    expect(screen.getByRole("status").textContent).toBe(labels[0]);
    act(() => vi.advanceTimersByTime(PLAY_STEP_MS));
    view.rerender(player(names[1]!));
    expect(screen.getByRole("status").textContent).toBe(labels[1]);
  });

  it("play all announces the last scenario", () => {
    // B13: playback stops at the end, and the last scenario it moved to is still announced.
    const view = render(player(names[0]!));
    fireEvent.click(screen.getByRole("button", { name: text.play }));
    for (let i = 1; i < names.length; i++) {
      act(() => vi.advanceTimersByTime(PLAY_STEP_MS));
      view.rerender(player(names[i]!));
    }
    expect(screen.getByRole("button", { name: text.play })).toBeTruthy(); // stopped
    expect(screen.getByRole("status").textContent).toBe(labels[names.length - 1]);
    // A pick of the visitor's own is not announced as the player's.
    view.rerender(player(names[2]!));
    expect(screen.getByRole("status").textContent).toBe("");
  });

  it("play all pauses and stops on user choice", () => {
    const view = render(player(names[0]!));
    fireEvent.click(screen.getByRole("button", { name: text.play }));
    fireEvent.click(screen.getByRole("button", { name: text.pause }));
    act(() => vi.advanceTimersByTime(PLAY_STEP_MS * 2));
    expect(replace).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: text.play }));
    view.rerender(player(names[4]!)); // the visitor picked one from the menu
    expect(screen.getByRole("button", { name: text.play })).toBeTruthy();
    act(() => vi.advanceTimersByTime(PLAY_STEP_MS * 2));
    expect(replace).not.toHaveBeenCalled();
  });

  it("play all stops when the tab is hidden", () => {
    render(player(names[0]!));
    fireEvent.click(screen.getByRole("button", { name: text.play }));
    Object.defineProperty(document, "hidden", { value: true, configurable: true });
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(screen.getByRole("button", { name: text.play })).toBeTruthy();
    act(() => vi.advanceTimersByTime(PLAY_STEP_MS * 2));
    expect(replace).not.toHaveBeenCalled();
  });

  it("from the last scenario, Play starts again at the first", () => {
    render(player(names.at(-1)!));
    fireEvent.click(screen.getByRole("button", { name: text.play }));
    expect(replace).toHaveBeenCalledWith(`${base}${names[0]}`, { scroll: false });
  });
});
