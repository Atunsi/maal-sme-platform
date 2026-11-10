"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { fill } from "@/lib/i18n";

/** E6: one scenario every this many milliseconds. */
export const PLAY_STEP_MS = 8000;

type Props = {
  names: string[];
  labels: string[];
  current: string;
  /** Builds the scenario page URL for a name, keeping the locale and the demo role. */
  hrefBase: string;
  text: { play: string; pause: string; position: string; group: string };
};

/**
 * E6: steps through the library in order. It stops at the last scenario, on Pause, when the visitor picks
 * a scenario themselves, and when the page is hidden (WCAG 2.2.2). The URL follows with replace, so a
 * pause leaves a link to the scenario on screen. Under reduced motion the steps still change on the timer;
 * the page's own CSS already stops the row and plate animations.
 */
export function ScenarioPlayer({ names, labels, current, hrefBase, text }: Props) {
  const router = useRouter();
  const [on, setOn] = useState(false);
  const [expected, setExpected] = useState<string | null>(null); // the scenario this player last asked for
  const index = Math.max(0, names.indexOf(current));
  const last = names.length - 1;
  // Playing only while the page shows what the player asked for (a visitor's own pick stops it) and the
  // last scenario has not been reached.
  const playing = on && expected === current && index < last;
  // What the player itself moved to, while it is on: every step, the last one included.
  const announced = on && expected === current;

  useEffect(() => {
    if (!playing) return;
    const timer = setTimeout(() => {
      const next = names[index + 1]!;
      setExpected(next);
      router.replace(`${hrefBase}${next}`, { scroll: false });
    }, PLAY_STEP_MS);
    return () => clearTimeout(timer);
  }, [playing, index, names, hrefBase, router]);

  useEffect(() => {
    const hidden = () => {
      if (document.hidden) setOn(false);
    };
    document.addEventListener("visibilitychange", hidden);
    return () => document.removeEventListener("visibilitychange", hidden);
  }, []);

  function toggle() {
    if (playing) return setOn(false);
    if (index >= last) {
      // Played to the end before: start again from the first scenario.
      setExpected(names[0]!);
      router.replace(`${hrefBase}${names[0]}`, { scroll: false });
    } else setExpected(current);
    setOn(true);
  }

  return (
    <div role="group" aria-label={text.group} className="flex flex-wrap items-center gap-3" data-player>
      {/* R3: the label says what a press does (Play all or Pause), so the button carries no aria-pressed. */}
      <button type="button" className="solid-btn min-h-11" onClick={toggle}>
        {playing ? text.pause : text.play}
      </button>
      <span className="text-sm text-muted" data-position>
        {fill(text.position, { x: String(index + 1), y: String(names.length) })}
      </span>
      {/* I4: a thin bar fills over each step while playing and starts again on the next one (keyed by the
          scenario). Its length is a timer, not an entrance. Under reduced motion it stands still. */}
      {playing && (
        <span aria-hidden="true" className="play-progress" data-play-progress>
          <span key={current} className="play-progress-fill" />
        </span>
      )}
      <span role="status" aria-live="polite" className="sr-only">
        {/* B13: the last scenario the player moved to is announced too, after playback stops at the end. */}
        {announced ? labels[index] : ""}
      </span>
    </div>
  );
}
