"use client";

import { useRouter } from "next/navigation";
import { useId, useState, type KeyboardEvent } from "react";
import { findBusinesses, nameOf } from "@/lib/business-names";
import { isServingId, SERVING_IDS } from "@/lib/population";
import { withRole } from "@/components/RoleLink";
import { Num } from "@/components/ui";
import { PAGE_TRANSITION } from "@/lib/motion";
import { registrationMessage } from "@/components/RegistrationField";
import { DEMO_BUSINESS } from "@/lib/businesses";
import type { Messages } from "@/lib/i18n";
import { checkRegistrationNumber, formatProblem, normaliseRegistrationNumber, type DemoNumbers } from "@/lib/registrationNumber";

type Props = {
  locale: "en" | "ar";
  /** Carried onto the opened page, so the demo role stays in the URL. */
  query?: string;
  /** The businesses it can open: every serving ID live, the captured few in the online snapshot. */
  ids?: readonly number[];
  labels: { input: string; submit: string; invalid: string; results: string };
  /** CR1 (DECISIONS 62): typed digits are checked as a registration number, with its own messages. */
  registration?: { r: Messages["registration"]; demo: DemoNumbers };
};

/**
 * Find a business by name or ID and open it. Matches show as you type (a combobox: arrow keys move, Enter
 * opens); Enter or Open with a full ID opens that business, and anything that matches nothing says so before
 * any call. U1: it matches the fixed business names and serving IDs only, and only navigates.
 */
export function BusinessPicker({ locale, query = "", ids = SERVING_IDS, labels, registration }: Props) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [invalid, setInvalid] = useState(false);
  const [message, setMessage] = useState(labels.invalid);
  const [active, setActive] = useState(0);
  const listId = useId();
  const matches = findBusinesses(value, ids, 6);
  const listed = matches.length > 0;

  // The role is read from the address at the moment of opening: the online snapshot renders this page with none.
  const go = (id: number) => router.push(withRole(`/${locale}/business/${id}${query}`, new URLSearchParams(window.location.search).get("as")), { transitionTypes: PAGE_TRANSITION });
  function open(event: React.FormEvent) {
    event.preventDefault();
    // CR1: spaces, dashes and Arabic-Indic digits are read as the number they spell.
    const text = normaliseRegistrationNumber(value);
    const id = /^[0-9]+$/.test(text) ? Number(text) : NaN;
    if (isServingId(id) && ids.includes(id)) return go(id);
    if (listed) return go(matches[Math.min(active, matches.length - 1)]!);
    // Digits that open nothing get the registration number's own message; a name that matches nothing keeps
    // the finder's. Either way nothing is called.
    const problem = registration && formatProblem(value) !== "notDigits" ? checkRegistrationNumber(value, registration.demo) : null;
    setMessage(problem && !problem.ok && registration ? registrationMessage(problem.problem, registration.r, registration.demo, DEMO_BUSINESS) : labels.invalid);
    setInvalid(true);
  }
  const onKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!listed) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((i) => Math.min(matches.length - 1, i + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (event.key === "Escape") {
      setValue("");
    }
  };

  return (
    <form role="search" onSubmit={open} noValidate className="finder w-full max-w-md">
      <label htmlFor="business-id" className="block text-label font-medium">
        {labels.input}
      </label>
      <div className="relative mt-1.5 flex gap-2.5">
        <input
          id="business-id"
          role="combobox"
          aria-expanded={listed}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={listed ? `${listId}-${matches[Math.min(active, matches.length - 1)]}` : undefined}
          aria-describedby={invalid ? "business-id-error" : undefined}
          aria-invalid={invalid}
          autoComplete="off"
          enterKeyHint="go"
          value={value}
          onKeyDown={onKey}
          onChange={(e) => {
            setValue(e.target.value);
            setActive(0);
            setInvalid(false);
          }}
          className="field min-w-0 flex-1"
        />
        <button type="submit" className="solid-btn">
          {labels.submit}
        </button>
        {listed && (
          <ul id={listId} role="listbox" aria-label={labels.results} className="finder-list">
            {matches.map((id, i) => (
              <li
                key={id}
                id={`${listId}-${id}`}
                role="option"
                aria-selected={i === active}
                className={`switcher-option ${i === active ? "is-active" : ""}`}
                // The keyboard path is the combobox above (R4).
                onMouseDown={(event) => {
                  event.preventDefault();
                  go(id);
                }}
              >
                <span className="font-semibold">{nameOf(id, locale)}</span>
                <span className="ms-auto font-mono text-label text-muted">
                  <Num>{id}</Num>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
      {invalid && (
        <p id="business-id-error" role="alert" className="mt-2 text-label text-bad">
          {message}
        </p>
      )}
    </form>
  );
}
