"use client";

import { useSyncExternalStore } from "react";
import { isDark, onThemeChange, setDark } from "@/lib/theme";

export function ThemeToggle({ labels }: { labels: { dark: string; light: string } }) {
  const dark = useSyncExternalStore(onThemeChange, isDark, () => false);
  return (
    <button type="button" className="themebtn" aria-pressed={dark} onClick={() => setDark(!dark)}>
      {dark ? labels.light : labels.dark}
    </button>
  );
}
