"use client";

import { useLayoutEffect } from "react";
import { applyAppMode } from "@/lib/app-mode";
import { applyStoredTheme } from "@/lib/theme";

/**
 * Keeps the visitor's theme and app mode on <html> across a language change. The root layout renders <html>
 * with its own className, so switching /en and /ar re-renders it and drops the classes the boot scripts added
 * (the page fell back to light). This puts them back after every locale change, before the browser paints.
 */
export function HtmlState({ locale }: { locale: string }) {
  useLayoutEffect(() => {
    applyStoredTheme();
    applyAppMode();
  }, [locale]);
  return null;
}
