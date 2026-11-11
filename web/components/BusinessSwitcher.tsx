"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { searchServing, switcherPlate, type SwitcherPlate } from "@/app/actions";
import { Plate } from "@/components/ui";
import { nameOf } from "@/lib/business-names";
import { DEMO_BUSINESSES, roleQuery } from "@/lib/businesses";
import type { Locale, Messages } from "@/lib/i18n";

type Option = { id: number; sector?: string };

/** The current page for another business: the same lens path with the other ID, role kept. */
export function switchHref(pathname: string, id: number, role: string | null): string {
  return `${pathname.replace(/\/business\/\d+/, `/business/${id}`)}${roleQuery(role)}`;
}

/**
 * I1 (DECISIONS 45): the header's business switcher. A short "Business" button opens a small panel with an
 * ARIA 1.2 combobox and its listbox, so the header still fits one row (R8). Opened, it lists the five demo
 * businesses with each one's decision plate as it arrives; two or more digits search the serving
 * population (GET /businesses?q=, debounced 300 ms, at most ten). Every call is a server action, so the API
 * is reached from the server through the queue. Choosing keeps the lens page and the demo role. Escape
 * closes and returns focus to the button. U1: its one field names a business and can reach no term.
 */
export function BusinessSwitcher({ locale, m }: { locale: Locale; m: Pick<Messages, "switcher" | "enums" | "errors"> }) {
  const s = m.switcher;
  const router = useRouter();
  const pathname = usePathname();
  const role = useSearchParams().get("as");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [plates, setPlates] = useState<Record<number, SwitcherPlate>>({});
  const [found, setFound] = useState<Option[] | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const button = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const listId = useId();
  const optionId = (i: number) => `${listId}-o${i}`;

  const searching = /^[0-9]{2,9}$/.test(query.trim());
  const options: Option[] = searching ? (found ?? []) : DEMO_BUSINESSES.map((id) => ({ id }));

  // The demo businesses' plates, one request at a time, each shown as it arrives.
  useEffect(() => {
    if (!open) return;
    let stopped = false;
    (async () => {
      for (const id of DEMO_BUSINESSES) {
        if (stopped || plates[id]) continue;
        const plate = await switcherPlate(id, locale);
        if (!stopped) setPlates((p) => ({ ...p, [id]: plate }));
      }
    })();
    return () => {
      stopped = true;
    };
    // Plates already fetched stay; reopening fetches only what is missing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, locale]);

  // Search, 300 ms after the last keystroke.
  useEffect(() => {
    if (!open || !searching) return;
    const q = query.trim();
    const timer = setTimeout(async () => {
      const r = await searchServing(q, locale);
      if (r.ok) {
        setFound(r.businesses.map((b) => ({ id: b.business_id, sector: b.sector })));
        setFailed(null);
      } else setFailed(r.word);
      setActive(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [open, searching, query, locale]);

  useEffect(() => {
    if (!open) return;
    input.current?.focus();
    const away = (event: PointerEvent) => {
      if (!wrap.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);

  const close = () => {
    setOpen(false);
    button.current?.focus();
  };
  const choose = (id: number) => {
    setOpen(false);
    router.push(switchHref(pathname, id, role));
  };

  const onKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close();
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((i) => Math.min(options.length - 1, i + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (event.key === "Enter" && options[active]) {
      event.preventDefault();
      choose(options[active]!.id);
    }
  };

  const current = /\/business\/(\d+)/.exec(pathname)?.[1];
  return (
    <div ref={wrap} className="relative" data-switcher>
      <button ref={button} type="button" className="themebtn" aria-expanded={open} aria-haspopup="dialog" onClick={() => (open ? close() : setOpen(true))}>
        {s.button}
      </button>
      {open && (
        <div role="dialog" aria-label={s.label} className="switcher-panel flex w-[min(320px,calc(100vw-32px))] flex-col gap-2 p-3">
          <label className="flex flex-col gap-1 text-label font-medium">
            {s.label}
            <span className="text-label font-normal text-muted">{s.help}</span>
            <input
              ref={input}
              role="combobox"
              aria-expanded={options.length > 0}
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={options.length ? optionId(active) : undefined}
              inputMode="numeric"
              dir="ltr"
              autoComplete="off"
              value={query}
              placeholder={current}
              className="field font-mono"
              onChange={(event) => {
                setQuery(event.target.value);
                setActive(0);
                if (!/^[0-9]{2,9}$/.test(event.target.value.trim())) setFound(null);
              }}
              onKeyDown={onKey}
            />
          </label>
          {failed && searching && <p className="text-label text-bad">{failed}</p>}
          <ul id={listId} role="listbox" aria-label={searching ? s.results : s.demo} className="flex max-h-72 flex-col overflow-auto">
            {options.map((option, i) => {
              const plate = plates[option.id];
              return (
                <li
                  key={option.id}
                  id={optionId(i)}
                  role="option"
                  aria-selected={i === active}
                  data-business={option.id}
                  className={`switcher-option ${i === active ? "is-active" : ""}`}
                  // A click on an option chooses it; the keyboard path is the combobox above (R4).
                  onMouseDown={(event) => {
                    event.preventDefault();
                    choose(option.id);
                  }}
                >
                  {/* The name to read, the ID to search by (the field above takes digits). */}
                  <span className="flex flex-col">
                    <span className="font-semibold">{nameOf(option.id, locale)}</span>
                    <span data-latin className="font-mono text-label text-muted">
                      {option.id}
                    </span>
                  </span>
                  {option.sector && <span className="text-label text-muted">{m.enums.sector[option.sector as keyof Messages["enums"]["sector"]]}</span>}
                  {!searching && plate && (plate.ok ? <Plate variant={plate.variant}>{plate.word}</Plate> : <span className="text-label text-bad">{plate.word}</span>)}
                </li>
              );
            })}
            {searching && found !== null && options.length === 0 && <li className="px-2 py-2 text-label text-muted">{s.none}</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
