// E4: receipt panel copy buttons, the re-run command and the hash check (DECISIONS 43).
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ReceiptPanel, verifyCommand } from "@/components/ReceiptPanel";
import { scenarioCommand } from "@/components/ScenarioCompare";
import { CreditResponse, ProfileResponse, ScenarioObject } from "@/lib/schemas";
import { en, fixture, readJson } from "./helpers";

const credit = fixture("credit_10001", CreditResponse);
const profile = fixture("profile_10001", ProfileResponse);

function setClipboard(writeText: ((text: string) => Promise<void>) | undefined) {
  Object.defineProperty(navigator, "clipboard", { value: writeText ? { writeText } : undefined, configurable: true });
}

afterEach(() => {
  setClipboard(undefined);
  vi.useRealTimers();
});

describe("receipt panel", () => {
  it("receipt copy button copies the full output hash", async () => {
    const writeText = vi.fn(() => Promise.resolve());
    setClipboard(writeText);
    render(<ReceiptPanel receipt={credit.receipt} lens="Credit" m={en} />);
    fireEvent.click(screen.getByRole("button", { name: "Copy output_sha256" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(credit.receipt.output_sha256));
    expect(credit.receipt.output_sha256).toHaveLength(64);
    expect(await screen.findByRole("button", { name: "Copied output_sha256" })).toBeTruthy();
    expect(screen.getByText(en.receipt.copiedAnnounce)).toBeTruthy();
  });

  it("every hash field and the commit get a copy button", () => {
    render(<ReceiptPanel receipt={credit.receipt} lens="Credit" m={en} />);
    for (const key of Object.keys(credit.receipt).filter((k) => k.endsWith("_sha256") || k === "code_commit")) {
      expect(screen.getByRole("button", { name: `Copy ${key}` })).toBeTruthy();
    }
  });

  it("copied reverts to copy after two seconds", async () => {
    vi.useFakeTimers();
    setClipboard(() => Promise.resolve());
    render(<ReceiptPanel receipt={credit.receipt} lens="Credit" m={en} />);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Copy output_sha256" })));
    expect(screen.getByRole("button", { name: "Copied output_sha256" })).toBeTruthy();
    act(() => vi.advanceTimersByTime(2000));
    expect(screen.getByRole("button", { name: "Copy output_sha256" })).toBeTruthy();
  });

  it("copy falls back when clipboard is blocked", async () => {
    setClipboard(() => Promise.reject(new Error("blocked")));
    render(<ReceiptPanel receipt={credit.receipt} lens="Credit" m={en} />);
    fireEvent.click(screen.getByRole("button", { name: "Copy output_sha256" }));
    const field = (await screen.findByRole("textbox", { name: "output_sha256" })) as HTMLInputElement;
    expect(field.value).toBe(credit.receipt.output_sha256);
    expect(field.readOnly).toBe(true);
    expect(screen.getByText(en.receipt.copyFallback)).toBeTruthy();
  });

  it("copy falls back when there is no clipboard at all", async () => {
    setClipboard(undefined);
    render(<ReceiptPanel receipt={credit.receipt} lens="Credit" m={en} />);
    fireEvent.click(screen.getByRole("button", { name: "Copy output_sha256" }));
    expect(await screen.findByText(en.receipt.copyFallback)).toBeTruthy();
  });

  it("rerun command is shown verbatim from scope", () => {
    const { container } = render(<ReceiptPanel receipt={credit.receipt} lens="Credit" m={en} />);
    const command = verifyCommand(credit.receipt.scope)!;
    expect(credit.receipt.scope).toContain(`verify: ${command})`);
    expect(command).toBe("python -m pipeline.verify <file>");
    const block = container.querySelector("[data-rerun]") as HTMLElement;
    expect(block.querySelector("code")!.textContent).toBe(command);
    expect(within(block).getByRole("button", { name: `Copy ${en.receipt.rerun}` })).toBeTruthy();
  });

  it("profile receipt shows no rerun command", () => {
    expect(profile.receipt.scope).toBeUndefined();
    const { container } = render(<ReceiptPanel receipt={profile.receipt} lens="profile" m={en} />);
    expect(container.querySelector("[data-rerun]")).toBeNull();
  });

  it("a scenario receipt shows the scenario's own command, not the scope's", () => {
    const o = ScenarioObject.parse(readJson("scenarios-data/severe_collapse.json"));
    const { container } = render(<ReceiptPanel receipt={o.receipt} lens="Chosen" m={en} rerun={scenarioCommand(o)} />);
    expect(container.querySelector("[data-rerun] code")!.textContent).toBe("python -m scenarios.run --scenario severe_collapse");
  });

  it("U8 a scenario whose own name holds a forbidden word gets no command", () => {
    const o = ScenarioObject.parse(readJson("scenarios-data/fraud_pattern.json"));
    expect(scenarioCommand(o)).toBeNull();
    const { container } = render(<ReceiptPanel receipt={o.receipt} lens="Chosen" m={en} rerun={scenarioCommand(o)} />);
    expect(container.querySelector("[data-rerun]")).toBeNull();
  });

  it("hash check runs on Enter and is not a form", () => {
    const { container } = render(<ReceiptPanel receipt={credit.receipt} lens="Credit" m={en} />);
    expect(container.querySelector("form")).toBeNull();
    const field = screen.getByLabelText(en.receipt.hashCheck);
    fireEvent.change(field, { target: { value: credit.receipt.output_sha256 } });
    fireEvent.keyDown(field, { key: "Enter" });
    expect(screen.getByText(en.receipt.match)).toBeTruthy();
  });

  it("hash check reports match and no match", () => {
    render(<ReceiptPanel receipt={credit.receipt} lens="Credit" m={en} />);
    const field = screen.getByLabelText(en.receipt.hashCheck);
    fireEvent.change(field, { target: { value: `  ${credit.receipt.output_sha256.toUpperCase()}  ` } });
    fireEvent.click(screen.getByRole("button", { name: en.receipt.check }));
    expect(screen.getByText(en.receipt.match).className).toContain("plate-ok");
    fireEvent.change(field, { target: { value: "0".repeat(64) } });
    expect(screen.queryByText(en.receipt.match)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: en.receipt.check }));
    expect(screen.getByText(en.receipt.noMatch).className).toContain("plate-bad");
  });

  it("the hash check sends nothing and its field has no name", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    render(<ReceiptPanel receipt={credit.receipt} lens="Credit" m={en} />);
    const field = screen.getByLabelText(en.receipt.hashCheck);
    expect(field.getAttribute("name")).toBeNull();
    fireEvent.change(field, { target: { value: credit.receipt.output_sha256 } });
    fireEvent.click(screen.getByRole("button", { name: en.receipt.check }));
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
