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
 * Starts the rewrite once the page has loaded and hydrated, so React never meets a rewritten node while
 * hydrating (no hydration warnings). Until then the page shows the Western digits the server sent.
 */
export function DigitsSync() {
  useEffect(() => {
    let cancelled = false;
    const go = () => requestAnimationFrame(() => setTimeout(() => !cancelled && startDigits(), 0));
    if (document.readyState === "complete") go();
    else window.addEventListener("load", go, { once: true });
    return () => {
      cancelled = true;
      window.removeEventListener("load", go);
      stopDigits();
    };
  }, []);
  return null;
}
