// CR1, CR2 (DECISIONS 62): the commercial registration number field.
// CR-V1: bad input is refused before any API call, with a message that says what is wrong.
// CR-V2: the UI never presents a demo number as a real registration.
import { fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { registrationMessage } from "@/components/RegistrationField";
import { SignInForm } from "@/components/SignInForm";
import { checkRegistrationNumber, formatProblem, normaliseRegistrationNumber, type RegistrationProblem } from "@/lib/registrationNumber";
import ar from "@/messages/ar.json";
import en from "@/messages/en.json";
import { webRoot } from "./helpers";

const DEMO = { from: 10001, to: 10300 };
const PREVIEW = { from: 10001, to: 11000, only: [10001, 10002, 10037] };

describe("commercial registration number", () => {
  it("registration number validation", () => {
    // The SOP's table: input, what the field says.
    const table: [string, string, RegistrationProblem | "ok"][] = [
      ["empty", "", "empty"],
      ["only spaces", "   ", "empty"],
      ["letters", "abc", "notDigits"],
      ["letters among digits", "10o01", "notDigits"],
      ["spaces inside", "10 001", "ok"],
      ["dashes inside", "10-001", "ok"],
      ["Arabic-Indic digits", "١٠٠٠١", "ok"],
      ["Persian digits", "۱۰۰۰۱", "ok"],
      ["4 digits", "1000", "length"],
      ["5 digits, a demo business", "10001", "ok"],
      ["5 digits, the last demo business", "10300", "ok"],
      ["5 digits, no such demo business", "10301", "unknown"],
      ["5 digits, below the range", "09999", "unknown"],
      ["10 digits starting with 7", "7001234567", "real"],
      ["10 Arabic-Indic digits starting with 7", "٧٠٠١٢٣٤٥٦٧", "real"],
      ["10 digits not starting with 7", "1010123456", "notSeven"],
      ["11 digits", "70012345678", "length"],
    ];
    for (const [name, input, expected] of table) {
      const check = checkRegistrationNumber(input, DEMO);
      expect(check.ok ? "ok" : check.problem, name).toBe(expected);
    }
    expect(checkRegistrationNumber("١٠٠٠١", DEMO)).toEqual({ ok: true, id: 10001 });
    expect(normaliseRegistrationNumber(" 10-0 01 ")).toBe("10001");
    // The online preview: a demo number it did not capture says so, and is not called unknown.
    expect(checkRegistrationNumber("10100", PREVIEW)).toEqual({ ok: false, problem: "notInPreview" });
    expect(checkRegistrationNumber("10037", PREVIEW)).toEqual({ ok: true, id: 10037 });
  });

  it("every problem has a sentence in both languages that says what is wrong", () => {
    const problems: RegistrationProblem[] = ["empty", "notDigits", "real", "notSeven", "length", "unknown", "notInPreview"];
    for (const m of [en, ar]) {
      for (const problem of problems) {
        const text = registrationMessage(problem, m.registration, DEMO, 10001);
        expect(text.length, problem).toBeGreaterThan(8);
        expect(text, problem).not.toMatch(/\{\w+\}/); // every placeholder is filled
        expect(text, problem).not.toMatch(/[—–]/); // no dash characters
      }
    }
    expect(registrationMessage("unknown", en.registration, DEMO, 10001)).toBe("No demo business has this number. Demo numbers run from 10001 to 10300");
    expect(registrationMessage("real", en.registration, DEMO, 10001)).toBe("This looks like a real commercial registration number. This demo holds synthetic businesses only. Try 10001");
    expect(registrationMessage("notSeven", en.registration, DEMO, 10001)).toBe("A commercial registration number is 10 digits and starts with 7");
    expect(registrationMessage("real", ar.registration, DEMO, 10001)).toContain("مصطنعة"); // MO9
  });

  it("no API call is made for input that fails a format step", () => {
    // The validator and the field have no way to call anything: no fetch, no server action, no router.
    for (const file of ["lib/registrationNumber.ts", "components/RegistrationField.tsx"]) {
      const code = readFileSync(join(webRoot, file), "utf8");
      expect(code, file).not.toMatch(/fetch\(|"use server"|@\/lib\/api|@\/app\/actions|useRouter/);
    }
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    render(<SignInForm locale="en" s={en.signIn} r={en.registration} demo={DEMO} />);
    const field = screen.getByLabelText(en.registration.label);
    for (const bad of ["", "abc", "1000", "7001234567", "1010123456", "10301"]) {
      fireEvent.change(field, { target: { value: bad } });
      fireEvent.submit(field.closest("form")!);
      expect(screen.getByRole("alert").textContent!.length, bad).toBeGreaterThan(8);
    }
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("entry field says the number is a demo number", () => {
    for (const m of [en, ar]) {
      const { unmount } = render(<SignInForm locale={m === en ? "en" : "ar"} s={m.signIn} r={m.registration} demo={DEMO} />);
      const hint = document.querySelector("[data-registration-hint]")!;
      expect(hint.textContent).toContain(m.registration.hint);
      expect(hint.textContent).toContain("10001");
      unmount();
    }
    expect(en.registration.hint).toBe("Demo commercial registration number:");
    expect(ar.registration.hint).toContain("تجريبي");
    // No string calls a demo number a real, valid or verified registration.
    for (const text of Object.values(en.registration)) expect(text).not.toMatch(/\b(valid|verified|registered with|official)\b/i);
  });

  it("demo hint fills the field", () => {
    render(<SignInForm locale="en" s={en.signIn} r={en.registration} demo={DEMO} />);
    const field = screen.getByLabelText(en.registration.label) as HTMLInputElement;
    fireEvent.change(field, { target: { value: "abc" } });
    fireEvent.blur(field);
    expect(screen.getByRole("alert").textContent).toBe("Use digits only");
    const button = screen.getByRole("button", { name: "Use the demo number 10001" });
    expect(button.getAttribute("type")).toBe("button");
    fireEvent.click(button);
    expect(field.value).toBe("10001");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(document.activeElement).toBe(field);
  });

  it("entry field error is announced and tied to the field", () => {
    render(<SignInForm locale="en" s={en.signIn} r={en.registration} demo={DEMO} />);
    const field = screen.getByLabelText(en.registration.label) as HTMLInputElement;
    const hint = document.querySelector("[data-registration-hint]")!;
    expect(field.getAttribute("aria-describedby")).toBe(hint.id);
    expect(field.getAttribute("aria-invalid")).toBeNull();
    expect(field.getAttribute("inputmode")).toBe("numeric");
    expect(field.getAttribute("type")).toBe("text");

    // Typing does not validate; leaving the field does; an empty field is only refused on sending.
    fireEvent.change(field, { target: { value: "12" } });
    expect(screen.queryByRole("alert")).toBeNull();
    fireEvent.blur(field);
    const alerts = screen.getAllByRole("alert");
    expect(alerts).toHaveLength(1); // announced once
    expect(alerts[0]!.textContent).toBe("A commercial registration number is 10 digits and starts with 7. Demo commercial registration number: 10001");
    expect(field.getAttribute("aria-invalid")).toBe("true");
    expect(field.getAttribute("aria-describedby")).toBe(`${hint.id} ${alerts[0]!.id}`);

    fireEvent.change(field, { target: { value: "" } });
    expect(screen.queryByRole("alert")).toBeNull();
    fireEvent.blur(field);
    expect(screen.queryByRole("alert")).toBeNull();
    fireEvent.submit(field.closest("form")!);
    expect(screen.getByRole("alert").textContent).toBe("Enter a commercial registration number");
    expect(document.activeElement).toBe(field); // focus returns to the field
    expect(formatProblem("")).toBe("empty");
  });

  it("the demo number can be clicked right after any error", () => {
    // Leaving the field never removes a message, so the hint's button does not move away from the pointer.
    render(<SignInForm locale="en" s={en.signIn} r={en.registration} demo={DEMO} />);
    const field = screen.getByLabelText(en.registration.label) as HTMLInputElement;
    fireEvent.change(field, { target: { value: "10999" } });
    fireEvent.submit(field.closest("form")!);
    expect(screen.getByRole("alert").textContent).toContain("No demo business has this number");
    fireEvent.blur(field);
    expect(screen.getByRole("alert").textContent).toContain("No demo business has this number"); // still there
    fireEvent.click(screen.getByRole("button", { name: "Use the demo number 10001" }));
    expect(field.value).toBe("10001");
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
