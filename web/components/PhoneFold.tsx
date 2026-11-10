"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";

/** The phone breakpoint, the same as app/phone.css. */
export const PHONE_QUERY = "(max-width: 767.98px)";

/**
 * Detail that a phone shows folded and a larger screen shows in full (app/phone.css). It is a real <details>,
 * open in the HTML, so a laptop, print and a page without script see everything. On a phone, CSS hides the
 * body until this has closed it, so the fold never flashes open; the visitor opens it with a tap.
 */
export function PhoneFold({ summary, children, className = "", ...rest }: { summary: ReactNode; children: ReactNode; className?: string } & Record<`data-${string}`, string>) {
  const ref = useRef<HTMLDetailsElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    // No media queries to ask (an old embedded browser, a test DOM): leave it open, as the HTML has it.
    if (typeof window.matchMedia !== "function") {
      el.dataset.ready = "";
      return;
    }
    const phone = window.matchMedia(PHONE_QUERY);
    if (phone.matches) el.open = false;
    el.dataset.ready = "";
    // Widened past phone size (a rotated tablet, a resized window): the full view shows everything again.
    const widen = () => {
      if (!phone.matches) el.open = true;
    };
    phone.addEventListener("change", widen);
    return () => phone.removeEventListener("change", widen);
  }, []);
  return (
    // The body sits in its own box: a <details> does not lay its children out reliably as a flex column.
    <details ref={ref} open className="phone-fold" {...rest}>
      <summary className="phone-fold-summary">{summary}</summary>
      <div className={className}>{children}</div>
    </details>
  );
}
