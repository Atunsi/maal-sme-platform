// M1, R6 (DECISIONS 45): entrance delays come from five named steps in globals.css, 0 s to 0.4 s, so no
// page but the landing page and sign-in waits more than 0.4 s to show anything. Those two keep their own
// timings and mark themselves with data-motion="full". Reduced motion still shows the final state at once.

export const MAX_STEP = 4;

/**
 * MT1 (DECISIONS 60): the transition type that turns on the page crossfade. Only the header nav, the phone tab
 * bar, the overview's reading cards, the business switcher and search results pass it; every other navigation
 * (Play all, the scenario menu, ?view=, the language link, Back and Forward) changes the page at once.
 */
export const PAGE_TRANSITION = ["page"];

/** An inline animation-delay from a named step, clamped to 0 to 4 (0 s to 0.4 s). */
export function delay(step: number): string {
  return `var(--d-${Math.min(MAX_STEP, Math.max(0, Math.round(step)))})`;
}
