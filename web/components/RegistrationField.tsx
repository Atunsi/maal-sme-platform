"use client";

import { useId, type RefObject } from "react";
import { Num } from "@/components/ui";
import { fill, type Messages } from "@/lib/i18n";
import { formatProblem, type DemoNumbers, type RegistrationProblem } from "@/lib/registrationNumber";

type R = Messages["registration"];

/** The fixed sentence for a problem (CR1). The numbers in it are the demo's own, never a real registration. */
export function registrationMessage(problem: RegistrationProblem, r: R, demo: DemoNumbers, demoNumber: number): string {
  return fill(r[problem], { number: demoNumber, from: demo.from, to: demo.to });
}

type Props = {
  r: R;
  demo: DemoNumbers;
  /** The demo number the hint offers (CR2). */
  demoNumber: number;
  value: string;
  onValue: (value: string) => void;
  problem: RegistrationProblem | null;
  onProblem: (problem: RegistrationProblem | null) => void;
  inputRef: RefObject<HTMLInputElement | null>;
};

/**
 * CR1, CR2 (DECISIONS 62): the commercial registration number field. The label and the hint say the number is a
 * demo number (CR-V2). The hint is always visible, and its number is a button that fills the field. The format
 * is checked when the field is left and when the form is sent, not on every key press; the message sits under
 * the field, is tied to it with aria-describedby, sets aria-invalid, and is announced once (role="alert").
 * inputMode="numeric" and type="text": type="number" drops leading zeros and Arabic-Indic digits.
 */
export function RegistrationField({ r, demo, demoNumber, value, onValue, problem, onProblem, inputRef }: Props) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  return (
    <div className="flex flex-col gap-1.5" data-registration>
      <label htmlFor={id} className="text-label font-medium">
        {r.label}
      </label>
      <p id={hintId} data-registration-hint className="text-label text-muted">
        {r.hint}{" "}
        <button
          type="button"
          data-registration-demo
          aria-label={fill(r.useDemo, { number: demoNumber })}
          className="textlink cursor-pointer border-0 bg-transparent p-0 font-mono font-semibold"
          onClick={() => {
            onValue(String(demoNumber));
            onProblem(null);
            inputRef.current?.focus();
          }}
        >
          <Num>{demoNumber}</Num>
        </button>
      </p>
      <input
        id={id}
        ref={inputRef}
        type="text"
        inputMode="numeric"
        dir="ltr"
        autoComplete="off"
        data-latin
        className="field font-mono"
        value={value}
        aria-invalid={problem ? true : undefined}
        aria-describedby={problem ? `${hintId} ${errorId}` : hintId}
        onChange={(event) => {
          onValue(event.currentTarget.value);
          if (problem) onProblem(null);
        }}
        onBlur={() => {
          // Leaving the field checks the format of what was typed. An empty field is only refused on sending.
          if (value.trim() !== "") onProblem(formatProblem(value));
        }}
      />
      {problem && (
        <p id={errorId} role="alert" data-registration-error={problem} className="text-label font-medium text-bad">
          {registrationMessage(problem, r, demo, demoNumber)}
        </p>
      )}
    </div>
  );
}
