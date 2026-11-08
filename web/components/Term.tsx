"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { glossaryEntry, type GlossaryId } from "@/lib/glossary";
import type { Locale } from "@/lib/i18n";

/**
 * E3: a glossary term, for the first appearance of the term on a page only. Hover, focus or a tap opens a
 * small definition below it (never over the term itself, so it cannot cover the control that opened it);
 * Escape, blur, the pointer leaving, a second tap or a tap elsewhere closes it. The definition stays in
 * the page, linked with aria-describedby, so a screen reader hears it on focus whether or not it shows.
 */
export function Term({ id, locale, children }: { id: GlossaryId; locale: Locale; children?: ReactNode }) {
  const entry = glossaryEntry(id)[locale];
  const tipId = useId();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  // Focus on pointer-down opens it; the click that follows must not shut it again. A second tap does.
  const openAtPointerDown = useRef(false);

  useEffect(() => {
    if (!open) return;
    const away = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);

  // Keep an open definition inside the screen, so it never makes a phone page scroll sideways.
  const tip = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = tip.current;
    if (!el) return;
    el.style.translate = "";
    if (!open) return;
    const { left, right } = el.getBoundingClientRect();
    const room = document.documentElement.clientWidth - 8;
    if (right > room) el.style.translate = `${room - right}px 0`;
    else if (left < 8) el.style.translate = `${8 - left}px 0`;
  }, [open]);

  return (
    <span ref={ref} className="term-wrap" data-term={id}>
      <button
        type="button"
        className="term"
        aria-describedby={tipId}
        aria-expanded={open}
        onPointerDown={() => {
          openAtPointerDown.current = open;
        }}
        onClick={(event) => (event.detail === 0 ? setOpen((current) => !current) : setOpen(!openAtPointerDown.current))}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onKeyDown={(event) => {
          if (event.key === "Escape") setOpen(false);
        }}
      >
        {children ?? entry.term}
      </button>
      <span ref={tip} id={tipId} role="tooltip" data-open={open} className="term-tip">
        {entry.definition}
      </span>
    </span>
  );
}
