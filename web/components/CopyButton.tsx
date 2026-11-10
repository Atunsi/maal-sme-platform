"use client";

import { useEffect, useRef, useState } from "react";

export type CopyLabels = { copy: string; copied: string; fallback: string; announce: string };

const SHOW_COPIED_MS = 2000;

/**
 * Copies the full value, never a shortened one (E4). If the clipboard is blocked or missing, the value
 * appears selected in a read-only field with a hint to press Ctrl+C. Nothing is sent anywhere.
 */
export function CopyButton({ value, name, labels }: { value: string; name: string; labels: CopyLabels }) {
  const [state, setState] = useState<"idle" | "copied" | "fallback">("idle");
  const field = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state === "fallback") field.current?.select();
    if (state !== "copied") return;
    const timer = setTimeout(() => setState("idle"), SHOW_COPIED_MS);
    return () => clearTimeout(timer);
  }, [state]);

  async function copy() {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("no clipboard");
      await navigator.clipboard.writeText(value);
      setState("copied");
    } catch {
      setState("fallback");
    }
  }

  const word = state === "copied" ? labels.copied : labels.copy;
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button type="button" onClick={copy} aria-label={`${word} ${name}`} data-copy={name} className="copy-btn">
        {word}
      </button>
      {state === "fallback" && (
        <span className="inline-flex flex-wrap items-center gap-2">
          <input
            ref={field}
            readOnly
            value={value}
            aria-label={name}
            dir="ltr"
            className="field min-h-9 w-56 max-w-full font-mono text-xs"
            onFocus={(event) => event.currentTarget.select()}
          />
          <span className="text-xs text-muted">{labels.fallback}</span>
        </span>
      )}
      <span role="status" aria-live="polite" className="sr-only">
        {state === "copied" ? labels.announce : ""}
      </span>
    </span>
  );
}
