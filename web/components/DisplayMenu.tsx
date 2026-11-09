"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

/**
 * B12, R8 (DECISIONS 45): from 768 px up, the Arabic digits toggle sits under one "Display" button so the
 * header fits one row. (The theme toggle is an icon in the header row.) Escape or a press outside closes it and
 * focus returns to the button. Below 768 px the button is hidden and the toggle shows inline in the phone menu,
 * as before. The toggle keeps aria-pressed and its fixed label (B7).
 */
export function DisplayMenu({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const away = (event: PointerEvent) => {
      if (!wrap.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);

  return (
    <div
      ref={wrap}
      className="relative flex flex-wrap items-center gap-3"
      onKeyDown={(event) => {
        if (event.key !== "Escape" || !open) return;
        event.stopPropagation(); // the phone menu's own Escape must not also fire
        setOpen(false);
        button.current?.focus();
      }}
    >
      <button ref={button} type="button" className="themebtn hidden md:inline-flex md:items-center" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(!open)}>
        {label}
      </button>
      <div id={panelId} data-display-panel className={`display-panel flex flex-wrap items-center gap-3 ${open ? "md:flex" : "md:hidden"}`}>
        {children}
      </div>
    </div>
  );
}
