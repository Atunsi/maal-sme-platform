"use client";

import { useEffect, useSyncExternalStore } from "react";
import { digitsChosen, onDigitsChange, setDigits, startDigits, stopDigits } from "@/lib/digits";

/** E8: shown in the Arabic locale only. R3: one fixed label, "Arabic-Indic digits"; aria-pressed says whether it is on. */
export function DigitsToggle({ label }: { label: string }) {
  const arab = useSyncExternalStore(onDigitsChange, () => digitsChosen() === "arab", () => false);
  return (
    <button type="button" className="themebtn" aria-pressed={arab} data-digits-toggle onClick={() => setDigits(arab ? "latn" : "arab")}>
      {label}
    </button>
  );
}

/**
 * Starts the rewrite right after hydration: an effect runs once React has hydrated this tree, and the next
 * animation frame comes after the commit, so React never meets a rewritten node while hydrating (no
 * hydration warnings). B20: it no longer waits for window load, so Arabic-Indic digits appear at once.
 */
export function DigitsSync() {
  useEffect(() => {
    const frame = requestAnimationFrame(() => startDigits());
    return () => {
      cancelAnimationFrame(frame);
      stopDigits();
    };
  }, []);
  return null;
}
