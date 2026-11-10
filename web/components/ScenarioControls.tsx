"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import type { Locale } from "@/lib/i18n";

// I4 (DECISIONS 45): the scenario page's lighter interactions. Every state lives in the URL, never in storage.

/** Sets or drops one query parameter on the current URL without a new history entry. */
function replaceParam(name: string, value: string | null) {
  const url = new URL(window.location.href);
  if (value === null) url.searchParams.delete(name);
  else url.searchParams.set(name, value);
  window.history.replaceState(null, "", url);
}

/** "Changed rows only": hides the diff sheet's Same rows. Kept in ?changed=1. R3: one fixed label. */
export function ChangedRows({ initial, label, children }: { initial: boolean; label: string; children: ReactNode }) {
  const [on, setOn] = useState(initial);
  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        className="themebtn self-start"
        aria-pressed={on}
        data-changed-toggle
        onClick={() => {
          setOn(!on);
          replaceParam("changed", on ? null : "1");
        }}
      >
        {label}
      </button>
      <div data-changed-only={on}>{children}</div>
    </div>
  );
}

export type MenuEntry = { name: string; href: string; current: boolean; children: ReactNode; className: string; style?: React.CSSProperties };

/**
 * The scenario menu with a roving tabindex: Tab reaches the current scenario only, and the arrow keys move
 * to the previous or next one in library order (Left and Right follow the reading direction, Up and Down
 * the list). Keys typed in a text field are left alone.
 */
export function ScenarioMenu({ label, locale, entries, footer }: { label: string; locale: Locale; entries: MenuEntry[]; footer?: ReactNode }) {
  const router = useRouter();
  const links = useRef<(HTMLAnchorElement | null)[]>([]);
  const current = Math.max(0, entries.findIndex((e) => e.current));

  function onKey(event: KeyboardEvent<HTMLElement>) {
    const target = event.target as HTMLElement;
    if (target.closest("input, textarea, select, [contenteditable=true]")) return;
    const forward = locale === "ar" ? "ArrowLeft" : "ArrowRight";
    const back = locale === "ar" ? "ArrowRight" : "ArrowLeft";
    const from = Math.max(0, links.current.indexOf(target as HTMLAnchorElement));
    const step = event.key === forward || event.key === "ArrowDown" ? 1 : event.key === back || event.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    const next = from + step;
    if (next < 0 || next >= entries.length) return;
    event.preventDefault();
    links.current[next]?.focus();
    router.push(entries[next]!.href, { scroll: false });
  }

  return (
    <nav aria-label={label} onKeyDown={onKey} className="clip-box hidden min-w-0 flex-[1_1_280px] flex-col border border-ink bg-card md:flex" data-scenario-menu>
      {entries.map((entry, i) => (
        <Link
          key={entry.name}
          ref={(el) => {
            links.current[i] = el;
          }}
          href={entry.href}
          scroll={false}
          tabIndex={i === current ? 0 : -1}
          aria-current={entry.current ? "page" : undefined}
          className={entry.className}
          style={entry.style}
        >
          {entry.children}
        </Link>
      ))}
      {footer}
    </nav>
  );
}

/**
 * Below 768 px, a native select of the same scenarios in library order. After a choice the page moves to
 * the diff sheet's heading and focuses it (?jump=1 tells the next render to do so, then is removed).
 */
export function ScenarioSelect({ label, entries }: { label: string; entries: { name: string; label: string; href: string; current: boolean }[] }) {
  const router = useRouter();
  const current = entries.find((e) => e.current)?.name ?? entries[0]?.name;
  return (
    <label className="flex flex-col gap-1.5 text-sm font-medium md:hidden">
      {label}
      <select
        className="field"
        value={current}
        data-scenario-select
        onChange={(event) => {
          const entry = entries.find((e) => e.name === event.target.value);
          if (entry) router.push(`${entry.href}${entry.href.includes("?") ? "&" : "?"}jump=1`, { scroll: false });
        }}
      >
        {entries.map((e) => (
          <option key={e.name} value={e.name} lang="en">
            {e.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/** The diff sheet's heading. Focused and scrolled to the top after a choice from the phone select. */
export function DiffHeading({ id, children }: { id: string; children: ReactNode }) {
  // It reads the query, so a pre-built page (the online snapshot) renders the plain heading until it can.
  return (
    <Suspense
      fallback={
        <h2 id={id} tabIndex={-1} className="heading scroll-mt-4 text-[22px] outline-none focus-visible:outline-2">
          {children}
        </h2>
      }
    >
      <DiffHeadingFocus id={id}>{children}</DiffHeadingFocus>
    </Suspense>
  );
}

function DiffHeadingFocus({ id, children }: { id: string; children: ReactNode }) {
  const params = useSearchParams();
  const ref = useRef<HTMLHeadingElement>(null);
  const jump = params?.get("jump") === "1";
  const scenario = params?.get("s") ?? params?.get("scenario");
  useEffect(() => {
    if (!jump || !ref.current) return;
    ref.current.scrollIntoView({ block: "start" });
    ref.current.focus({ preventScroll: true });
    replaceParam("jump", null);
  }, [jump, scenario]);
  return (
    <h2 id={id} ref={ref} tabIndex={-1} className="heading scroll-mt-4 text-[22px] outline-none focus-visible:outline-2">
      {children}
    </h2>
  );
}
