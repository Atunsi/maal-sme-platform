"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

/**
 * A focusable target over part of a chart that shows its value in a small tip (E5). Hover, keyboard focus
 * or a tap opens it; Escape, blur, the pointer leaving or a tap anywhere else closes it. The tip repeats
 * the accessible name, so it is hidden from assistive technology.
 */
export function TipButton({ label, tip, className, style, children }: { label: string; tip: ReactNode; className?: string; style?: CSSProperties; children?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);

  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      data-open={open}
      className={`tipped ${className ?? ""}`}
      style={style}
      onClick={() => setOpen(true)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onKeyDown={(event) => {
        if (event.key === "Escape") setOpen(false);
      }}
    >
      {children}
      <span aria-hidden="true" className="tip">
        {tip}
      </span>
    </button>
  );
}
