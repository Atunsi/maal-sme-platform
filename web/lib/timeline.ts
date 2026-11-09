// B10, B11 (DECISIONS 45): the review timeline in lanes. Each flag reason present gets its own lane, so a
// mark's lane and its legend word carry the reason (colour stays a second cue, height carries nothing). In a
// lane, marks closer than one 44 px target at the current width merge into one cluster, so no two buttons
// ever overlap. Pure arithmetic, recomputed whenever the width changes.

/** The touch target the marks keep (E7). Cluster centres in a lane are never closer than this. */
export const MIN_GAP_PX = 44;

export type TimelineFlag = { transaction_id: number; date: string; flag_reason: string };

export type Cluster<F extends TimelineFlag> = { ids: number[]; flags: F[]; at: number };
export type Lane<F extends TimelineFlag> = { reason: F["flag_reason"]; clusters: Cluster<F>[] };

const dayOf = (iso: string) => Date.parse(`${iso}T00:00:00Z`);

/** Where a date sits in the scan window, from 0 (first day) to 1 (last). */
export function positionIn(from: string, to: string): (iso: string) => number {
  const span = dayOf(to) - dayOf(from) || 1;
  return (iso) => Math.min(1, Math.max(0, (dayOf(iso) - dayOf(from)) / span));
}

/**
 * One lane per reason, in the order the reasons first appear in the response. Within a lane, a mark joins
 * the cluster before it when it sits less than MIN_GAP_PX from that cluster's last mark. A cluster sits at
 * the mean of its marks, so the gap between neighbouring cluster centres is at least MIN_GAP_PX.
 */
export function buildLanes<F extends TimelineFlag>(flags: readonly F[], from: string, to: string, widthPx: number): Lane<F>[] {
  const at = positionIn(from, to);
  const order: F["flag_reason"][] = [];
  for (const flag of flags) if (!order.includes(flag.flag_reason)) order.push(flag.flag_reason);
  return order.map((reason) => {
    const inLane = flags.filter((f) => f.flag_reason === reason).sort((a, b) => at(a.date) - at(b.date) || a.transaction_id - b.transaction_id);
    const clusters: Cluster<F>[] = [];
    let lastPx = Number.NEGATIVE_INFINITY;
    for (const flag of inLane) {
      const px = at(flag.date) * widthPx;
      const current = clusters.at(-1);
      if (current && px - lastPx < MIN_GAP_PX) current.flags.push(flag);
      else clusters.push({ ids: [], flags: [flag], at: 0 });
      lastPx = px;
    }
    for (const c of clusters) {
      c.ids = c.flags.map((f) => f.transaction_id);
      c.at = c.flags.reduce((sum, f) => sum + at(f.date), 0) / c.flags.length;
    }
    return { reason, clusters };
  });
}
