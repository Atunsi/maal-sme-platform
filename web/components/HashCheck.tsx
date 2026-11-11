"use client";

import { useId, useState } from "react";
import { Plate } from "@/components/ui";

export type HashCheckLabels = { label: string; help: string; check: string; match: string; noMatch: string };

/**
 * Compares a pasted hash with this receipt's output_sha256, in the browser only (E4). Nothing is sent.
 * Deliberately not a <form>: pages that must carry no answer form (the owner prompt, U5) can hold a receipt.
 */
export function HashCheck({ expected, labels }: { expected: string; labels: HashCheckLabels }) {
  const id = useId();
  const [typed, setTyped] = useState("");
  const [result, setResult] = useState<boolean | null>(null);
  const check = () => setResult(typed.trim().toLowerCase() === expected.toLowerCase());

  return (
    <div className="mt-3 flex flex-col gap-1.5" data-hash-check>
      <label htmlFor={`${id}-hash`} className="text-label font-semibold text-muted">
        {labels.label}
      </label>
      <span id={`${id}-help`} className="text-label text-muted">
        {labels.help}
      </span>
      <span className="flex flex-wrap items-center gap-2">
        <input
          id={`${id}-hash`}
          aria-describedby={`${id}-help`}
          dir="ltr"
          autoComplete="off"
          spellCheck={false}
          value={typed}
          onChange={(event) => {
            setTyped(event.currentTarget.value);
            setResult(null);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") check();
          }}
          className="field min-h-11 w-full max-w-md font-mono text-label"
        />
        <button type="button" onClick={check} className="copy-btn min-h-11">
          {labels.check}
        </button>
        <span role="status" aria-live="polite">
          {result !== null && <Plate variant={result ? "ok" : "bad"}>{result ? labels.match : labels.noMatch}</Plate>}
        </span>
      </span>
    </div>
  );
}
