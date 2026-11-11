"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { DEMO_BUSINESS, roleQuery } from "@/lib/businesses";
import { GLOSSARY } from "@/lib/glossary";
import type { Locale, Messages } from "@/lib/i18n";
import { isServingId, SERVING_IDS } from "@/lib/population";
import { findBusinesses, nameOf } from "@/lib/business-names";
import { OPEN_SEARCH } from "@/components/AppTabBar";
import { fill } from "@/lib/i18n";
import { PAGE_TRANSITION } from "@/lib/motion";

export type PaletteScenario = { name: string; label: string; lang?: "en" };
type Item = { id: string; label: string; lang?: "en"; group: string; href: string };

const LENSES = ["credit", "sharia", "zakat", "forecast", "review"] as const;

/** The fixed lists the search covers. No API call: everything is known to the page already. */
export function paletteItems(locale: Locale, m: Pick<Messages, "nav" | "search" | "sheet">, business: string, role: string | null, scenarios: PaletteScenario[]): Item[] {
  const q = roleQuery(role);
  const root = `/${locale}/business/${business}`;
  const g = m.search.groups;
  return [
    { id: "page-overview", label: m.nav.overview, group: g.pages, href: `${root}${q}` },
    ...LENSES.map((lens) => ({ id: `page-${lens}`, label: m.nav[lens], group: g.pages, href: `${root}/${lens}${q}` })),
    { id: "page-sheet", label: m.sheet.open, group: g.pages, href: `${root}/sheet${q}` },
    { id: "page-scenarios", label: m.nav.scenarios, group: g.pages, href: `/${locale}/scenarios${q}` },
    ...scenarios.map((s) => ({ id: `scenario-${s.name}`, label: s.label, lang: s.lang, group: g.scenarios, href: `/${locale}/scenarios?s=${s.name}${q.replace("?", "&")}` })),
    ...GLOSSARY.map((entry) => ({ id: `term-${entry.id}`, label: entry[locale].term, group: g.terms, href: `/${locale}/glossary${q}#${entry.id}` })),
  ];
}

/**
 * Items whose label holds the query, plus "Open <name> (<ID>)" when the query is a serving ID, and businesses
 * whose name holds it, after the pages and terms. `ids` limits the businesses (the online snapshot's few).
 */
export function paletteMatches(items: Item[], query: string, locale: Locale, m: Pick<Messages, "search">, role: string | null, ids: readonly number[] = SERVING_IDS): Item[] {
  const q = query.trim().toLowerCase();
  const found = q ? items.filter((i) => i.label.toLowerCase().includes(q)) : items;
  const business = (id: number): Item => ({ id: `business-${id}`, label: fill(m.search.openBusiness, { id, name: nameOf(id, locale) }), group: m.search.groups.business, href: `/${locale}/business/${id}${roleQuery(role)}` });
  const id = /^[0-9]{5}$/.test(q) ? Number(q) : null;
  const open = id !== null && isServingId(id) && ids.includes(id) ? [business(id)] : [];
  const named = q && !/[0-9]/.test(q) ? findBusinesses(q, ids, 5).map(business) : [];
  return [...open, ...found, ...named];
}

/**
 * I8 (DECISIONS 45): search the page's fixed lists. A "Search" button opens it; Ctrl+K and Cmd+K open it
 * too, never as the only way in. A dialog holding one combobox: focus stays inside while it is open, and
 * Escape closes it and returns focus to what opened it. U1: its one field matches page names, scenarios, terms,
 * serving IDs and the fixed business names; it can reach no term of an offer. The phone tab bar opens it too.
 */
export function CommandPalette({ locale, m, scenarios, businessIds }: { locale: Locale; m: Pick<Messages, "nav" | "search" | "sheet">; scenarios: PaletteScenario[]; businessIds?: readonly number[] }) {
  const s = m.search;
  const router = useRouter();
  const pathname = usePathname();
  const role = useSearchParams().get("as");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const opener = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();
  const titleId = useId();
  const business = /\/business\/(\d+)/.exec(pathname)?.[1] ?? String(DEMO_BUSINESS);
  const matches = paletteMatches(paletteItems(locale, m, business, role, scenarios), query, locale, m, role, businessIds);
  // Focus goes back to whatever opened the dialog: the header button, a tab, or the page under Ctrl+K.
  const returnTo = useRef<HTMLElement | null>(null);
  const show = () => {
    returnTo.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setOpen(true);
  };

  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        show();
      }
    };
    document.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_SEARCH, show);
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_SEARCH, show);
    };
  }, []);

  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);

  const close = () => {
    setOpen(false);
    setQuery("");
    setActive(0);
    const back = returnTo.current;
    (back?.isConnected && back.offsetParent !== null ? back : opener.current)?.focus();
  };
  const go = (item: Item | undefined) => {
    if (!item) return;
    setOpen(false);
    setQuery("");
    router.push(item.href, { transitionTypes: PAGE_TRANSITION });
  };

  const onKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close();
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((i) => Math.min(matches.length - 1, i + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      go(matches[active]);
    } else if (event.key === "Tab") {
      // Focus stays in the dialog: its one field and its listbox are a single stop.
      event.preventDefault();
      input.current?.focus();
    }
  };

  return (
    <>
      <button ref={opener} type="button" className="themebtn" aria-haspopup="dialog" aria-keyshortcuts="Control+K Meta+K" data-search-open onClick={show}>
        {s.button}
      </button>
      {/* In the body, not the header: on a phone the header menu holding the button may be closed. */}
      {open &&
        createPortal(
        <div className="palette-backdrop" onMouseDown={(event) => event.target === event.currentTarget && close()}>
          <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby={titleId} className="palette" onKeyDown={onKey} data-palette>
            <h2 id={titleId} className="heading text-value">
              {s.title}
            </h2>
            <input
              ref={input}
              role="combobox"
              aria-expanded={matches.length > 0}
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={matches[active] ? `${listId}-${matches[active]!.id}` : undefined}
              aria-label={s.label}
              autoComplete="off"
              value={query}
              placeholder={s.hint}
              className="field w-full"
              onChange={(event) => {
                setQuery(event.target.value);
                setActive(0);
              }}
            />
            <ul id={listId} role="listbox" aria-label={s.results} className="flex max-h-80 flex-col overflow-auto">
              {matches.map((item, i) => (
                <li
                  key={item.id}
                  id={`${listId}-${item.id}`}
                  role="option"
                  aria-selected={i === active}
                  data-item={item.id}
                  className={`switcher-option ${i === active ? "is-active" : ""}`}
                  // The keyboard path is the combobox above (R4).
                  onMouseDown={(event) => {
                    event.preventDefault();
                    go(item);
                  }}
                >
                  <span lang={item.lang}>{item.label}</span>
                  <span className="text-label text-muted">{item.group}</span>
                </li>
              ))}
              {matches.length === 0 && <li className="px-2 py-2 text-label text-muted">{s.none}</li>}
            </ul>
          </div>
        </div>,
          document.body,
        )}
    </>
  );
}
