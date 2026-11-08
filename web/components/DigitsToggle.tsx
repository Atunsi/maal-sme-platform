"use client";

import { useEffect, useSyncExternalStore } from "react";
import { digitsChosen, onDigitsChange, setDigits, startDigits, stopDigits } from "@/lib/digits";

/** E8: shown in the Arabic locale only. The label names what a press switches to, like the theme toggle. */
export function DigitsToggle({ labels }: { labels: { arab: string; latn: string } }) {
  const arab = useSyncExternalStore(onDigitsChange, () => digitsChosen() === "arab", () => false);
  return (
    <button type="button" className="themebtn" aria-pressed={arab} data-digits-toggle onClick={() => setDigits(arab ? "latn" : "arab")}>
      {arab ? labels.latn : labels.arab}
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
