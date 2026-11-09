"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { fill, type Locale } from "@/lib/i18n";
import { TOUR, TOUR_STEPS, tourHref, tourStep } from "@/lib/tour";

export type TourLabels = {
  region: string;
  back: string;
  next: string;
  end: string;
  position: string;
  missing: string;
  sheet: string;
  how: string;
};

/** Elements whose own Escape key must not also end the tour. */
const OWN_ESCAPE = "[data-term], .tipped, .tick, [data-forecast-chart], details";

/**
 * E1: the guided tour. The step lives in the URL (?tour=<step>), so a reload or Back keeps the place; the
 * tour changes nothing else and stores nothing. A non-modal region fixed to the bottom of the screen; focus
 * moves to the step title on each step; Escape or End tour ends it. The target gets a thick outline and is
 * scrolled into view above the panel; the caption names the part too, so the outline is never the only cue.
 */
export function TourPanel({ locale, labels }: { locale: Locale; labels: TourLabels }) {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const found = tourStep(params.get("tour"));
  const role = params.get("as");
  const titleId = useId();
  const title = useRef<HTMLHeadingElement>(null);
  const panel = useRef<HTMLElement>(null);
  const [missingStep, setMissingStep] = useState<string | null>(null);
  const stepId = found?.step.id ?? null;
  const target = found?.step.target ?? null;

  // Keep the page's end clear of the panel while the tour runs.
  useEffect(() => {
    const html = document.documentElement;
    if (!stepId || !panel.current) {
      html.style.removeProperty("--tour-h");
      return;
    }
    html.style.setProperty("--tour-h", `${panel.current.offsetHeight + 16}px`);
    return () => {
      html.style.removeProperty("--tour-h");
    };
  }, [stepId, missingStep]);

  // Outline the target and bring it into view above the panel. It may still be loading: look for a while.
  useEffect(() => {
    if (!stepId || !target) return;
    // X2: focus that a step change moves here gets a thin underline, not the full focus box.
    if (title.current) title.current.dataset.stepFocus = "";
    title.current?.focus({ preventScroll: true });
    let el: Element | null = null;
    let tries = 0;
    let timer: ReturnType<typeof setTimeout>;
    const look = () => {
      el = document.querySelector(`[data-tour="${target}"]`);
      if (el) {
        el.classList.add("tour-target");
        setMissingStep(null);
        const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
        const top = window.scrollY + el.getBoundingClientRect().top - 96;
        window.scrollTo({ top: Math.max(0, top), behavior: reduce ? "auto" : "smooth" });
      } else if (tries++ < 30) timer = setTimeout(look, 100);
      else setMissingStep(stepId);
    };
    timer = setTimeout(look, 0);
    return () => {
      clearTimeout(timer);
      el?.classList.remove("tour-target");
    };
  }, [stepId, target, pathname]);

  const end = () => {
    const rest = new URLSearchParams(params.toString());
    rest.delete("tour");
    const query = rest.toString();
    router.replace(`${pathname}${query ? `?${query}` : ""}`, { scroll: false });
    // Focus returns to where a tour starts, or to the page heading.
    setTimeout(() => (document.querySelector<HTMLElement>("[data-tour-start]") ?? document.querySelector<HTMLElement>("main h1"))?.focus(), 50);
  };

  useEffect(() => {
    if (!stepId) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      if ((event.target as Element | null)?.closest?.(OWN_ESCAPE)) return;
      end();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  if (!found) return null;
  const { step, index } = found;
  const text = step[locale];
  const last = index === TOUR_STEPS.length - 1;
  const go = (i: number) => router.push(tourHref(locale, TOUR_STEPS[i]!, role), { scroll: false });

  return (
    <section ref={panel} role="region" aria-label={labels.region} data-tour-panel className="tour-panel">
      <div className="mx-auto flex max-w-[1240px] flex-col gap-2 px-5 py-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="eyebrow text-accent">{labels.region}</span>
          <span className="text-sm text-muted" data-tour-position>
            {fill(labels.position, { x: String(index + 1), y: String(TOUR_STEPS.length) })}
          </span>
        </div>
        <h2
          id={titleId}
          ref={title}
          tabIndex={-1}
          className="tour-title heading text-2xl outline-none focus-visible:outline-2"
          onBlur={(event) => delete event.currentTarget.dataset.stepFocus}
        >
          {text.title}
        </h2>
        <p className="max-w-3xl text-[15px]">{text.caption}</p>
        {missingStep === step.id && (
          <p role="status" className="text-sm font-medium text-warn">
            {labels.missing}
          </p>
        )}
        {last && (
          <div className="flex flex-wrap gap-x-5">
            <Link href={`/${locale}/business/${TOUR.business}/sheet${role ? `?as=${role}` : ""}`} className="textlink font-semibold">
              {labels.sheet}
            </Link>
            <Link href={`/${locale}/how-it-works${role ? `?as=${role}` : ""}`} className="textlink font-semibold">
              {labels.how}
            </Link>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-3">
          {index > 0 && (
            <button type="button" className="themebtn" onClick={() => go(index - 1)}>
              {labels.back}
            </button>
          )}
          {!last && (
            <button type="button" className="solid-btn min-h-11" onClick={() => go(index + 1)}>
              {labels.next}
            </button>
          )}
          <button type="button" className="themebtn" onClick={end}>
            {labels.end}
          </button>
        </div>
      </div>
    </section>
  );
}
