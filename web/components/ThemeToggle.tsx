"use client";

import { useSyncExternalStore } from "react";
import { isDark, onThemeChange, setDark } from "@/lib/theme";

/** R3: one fixed label, "Dark theme"; aria-pressed, and the pressed look that follows it, say whether it is on. */
export function ThemeToggle({ label }: { label: string }) {
  const dark = useSyncExternalStore(onThemeChange, isDark, () => false);
  return (
    <button type="button" className="themebtn" aria-pressed={dark} onClick={() => setDark(!dark)}>
      {label}
    </button>
  );
}
