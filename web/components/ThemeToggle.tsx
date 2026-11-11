"use client";

import { useSyncExternalStore } from "react";
import { isDark, onThemeChange, setDark } from "@/lib/theme";

/**
 * R3: one fixed label, "Dark theme", kept as the button's hidden text; aria-pressed, and the pressed look that
 * follows it, say whether it is on. On screen it is a moon icon, the same on every page.
 */
/**
 * MT5 (DECISIONS 60): a 0.2 s crossfade between the two themes, through document.startViewTransition (one of the two
 * places 1a.3 allows script for motion). Without the API, or under reduced motion, the theme switches at once.
 */
function toggle(dark: boolean) {
  const doc = document as Document & { startViewTransition?: (update: () => void) => { finished: Promise<void> } };
  if (!doc.startViewTransition || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    setDark(dark);
    return;
  }
  document.documentElement.dataset.vt = "theme";
  doc.startViewTransition(() => setDark(dark)).finished.finally(() => {
    delete document.documentElement.dataset.vt;
  });
}

export function ThemeToggle({ label }: { label: string }) {
  const dark = useSyncExternalStore(onThemeChange, isDark, () => false);
  return (
    <button type="button" className="themebtn icon-btn" aria-pressed={dark} title={label} onClick={() => toggle(!dark)} data-theme-toggle>
      <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z" />
      </svg>
      <span className="sr-only">{label}</span>
    </button>
  );
}
