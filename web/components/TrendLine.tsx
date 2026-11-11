"use client";

import { useState } from "react";

export type TrendPoint = {
  /** ISO date of the point. */
  iso: string;
  /** The date as the page shows it. */
  date: string;
  /** The value as the page shows it, as plain text, for the readout. */
  text: string;
  /** The value as a screen reader should hear it. */
  spoken: string;
  value: number;
};

const DAY_MS = 86_400_000;

/**
 * IN3 (DECISIONS 62): a small line of a figure's own past values. Every mark is a value the API returned
 * (TR1): a date with no value has no mark, and the line breaks there instead of joining across it. Nothing
 * draws itself through values (MO1): the line is there at once. Each mark is a button with the date and value
 * as its name, a 44 px target, the 14 px dot and the focus ring the review timeline uses (VS3), and a readout
 * on hover, focus and tap. Time runs left to right in both languages. The table under it holds the same values.
 */
export function TrendLine({ points, stepDays, label, pointLabel }: { points: TrendPoint[]; stepDays: number; label: string; pointLabel: string }) {
  const [shown, setShown] = useState<number | null>(null);
  const times = points.map((p) => Date.parse(p.iso));
  const [t0, t1] = [times[0]!, times[times.length - 1]!];
  const values = points.map((p) => p.value);
  const [low, high] = [Math.min(...values), Math.max(...values)];
  const x = (i: number) => (t1 === t0 ? 50 : ((times[i]! - t0) / (t1 - t0)) * 100);
  // A flat series sits on the middle line; otherwise the lowest value is near the bottom and the highest near the top.
  const y = (i: number) => (high === low ? 50 : 85 - ((values[i]! - low) / (high - low)) * 70);
  const name = (p: TrendPoint, value: string) => pointLabel.replace("{date}", p.date).replace("{value}", value);
  return (
    <div dir="ltr" role="group" aria-label={label} data-trend-line className="min-w-[220px]">
      <div className="relative mx-[22px] h-16">
        <svg aria-hidden="true" viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible">
          {points.slice(1).map((p, i) =>
            // Join two marks only when they are one step apart: a missing date is a gap, never a bridge.
            Math.round((times[i + 1]! - times[i]!) / DAY_MS) <= stepDays ? (
              <line key={p.iso} x1={x(i)} y1={y(i)} x2={x(i + 1)} y2={y(i + 1)} stroke="var(--accent)" strokeWidth="2" vectorEffect="non-scaling-stroke" data-trend-segment />
            ) : null,
          )}
        </svg>
        {points.map((p, i) => (
          <button
            key={p.iso}
            type="button"
            className="tick"
            style={{ left: `${x(i)}%` }}
            aria-label={name(p, p.spoken)}
            data-trend-point={p.iso}
            data-value={p.value}
            onMouseEnter={() => setShown(i)}
            onMouseLeave={() => setShown(null)}
            onFocus={() => setShown(i)}
            onBlur={() => setShown(null)}
            onClick={() => setShown(i)}
          >
            <span className="tick-bar" style={{ top: `${y(i)}%`, animation: "none" }} />
          </button>
        ))}
      </div>
      {/* The readout: the buttons already carry it as their names, so it is not read twice. */}
      <p aria-hidden="true" data-trend-readout className="min-h-[1.5em] text-center font-mono text-label text-muted">
        {shown === null ? "" : name(points[shown]!, points[shown]!.text)}
      </p>
    </div>
  );
}
