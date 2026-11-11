"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { formatInt, formatSar, formatSarSpoken } from "@/lib/format";
import { fill, type Locale } from "@/lib/i18n";

export type ForecastPoint = { day: number; model: number; baseline: number };

export type ForecastLabels = {
  model: string;
  baseline: string;
  day: string;
  alt: string;
  floor: string;
  floorName: string;
  below: string;
  today: string;
  keys: string;
};

type Props = { data: ForecastPoint[]; locale: Locale; labels: ForecastLabels };

const W = 700;
const LEFT = 40;
const RIGHT = 660;
const TOP = 30;
const BOTTOM = 210;
const FLOOR_BOTTOM = 234;
const FONT = 11;
const END_FONT = 12;
const MONO_EM = 0.6; // IBM Plex Mono advance, in em
const ANNOUNCE_MS = 400;

/** Scales come from the response alone: the x axis from the horizons, the y axis from the balances and SAR 0. */
function scales(data: ForecastPoint[], bottom = BOTTOM) {
  const values = [0, ...data.flatMap((d) => [d.model, d.baseline])];
  const [min, max] = [Math.min(...values), Math.max(...values)];
  const lastDay = Math.max(...data.map((d) => d.day), 1);
  return {
    x: (day: number) => LEFT + (day / lastDay) * (RIGHT - LEFT),
    y: (value: number) => bottom - ((value - min) / (max - min || 1)) * (bottom - TOP),
  };
}

type Box = { x1: number; x2: number; y1: number; y2: number };
type Pt = [number, number];

/** The box a one-line monospace label covers, for a label anchored at its end. */
function endBox(xEnd: number, baseline: number, text: string, size: number): Box {
  return { x1: xEnd - text.length * size * MONO_EM, x2: xEnd, y1: baseline - size, y2: baseline + size * 0.25 };
}

/** True if the segment a-b passes within `pad` of the box. Sampled finely: a 700-unit chart needs no more. */
function crosses(a: Pt, b: Pt, box: Box, pad: number): boolean {
  for (let i = 0; i <= 200; i++) {
    const t = i / 200;
    const px = a[0] + (b[0] - a[0]) * t;
    const py = a[1] + (b[1] - a[1]) * t;
    if (px >= box.x1 - pad && px <= box.x2 + pad && py >= box.y1 - pad && py <= box.y2 + pad) return true;
  }
  return false;
}

function overlaps(a: Box, b: Box): boolean {
  return a.x1 < b.x2 && b.x1 < a.x2 && a.y1 < b.y2 && b.y1 < a.y2;
}

/**
 * Where the cash-floor label goes (E5): at the right end of the floor line, above it, or below it if
 * above is not clear of both data lines and the end-value labels. Computed from the response every time;
 * no position is typed in for any business.
 */
export function floorLabelPlacement(lines: Pt[][], others: Box[], zero: number, text: string, font = FONT): { y: number; box: Box; clear: boolean } {
  const xEnd = RIGHT - 4;
  const candidates = [zero - 6, zero + font + 6];
  let best: { y: number; box: Box; clear: boolean; hits: number } | null = null;
  for (const y of candidates) {
    const box = endBox(xEnd, y, text, font);
    let hits = 0;
    for (const line of lines) for (let i = 1; i < line.length; i++) if (crosses(line[i - 1]!, line[i]!, box, 3)) hits += 1;
    for (const other of others) if (overlaps(box, other)) hits += 1;
    if (hits === 0) return { y, box, clear: true };
    if (!best || hits < best.hits) best = { y, box, clear: false, hits };
  }
  return { y: best!.y, box: best!.box, clear: false };
}

/** One mark size for every point on a chart, the review timeline's dots included (globals.css .tick-bar). */
const MARK_PX = 14;

export function ForecastChart({ data, locale, labels }: Props) {
  // How much smaller than its 700 units the chart renders (1 on a laptop, about 2 on a phone).
  const [k, setK] = useState(1);
  // VS3 (DECISIONS 60): drawing units per screen pixel, so the points are drawn at the review marks' 14 px.
  const [unitsPerPx, setUnitsPerPx] = useState(1);
  const floorFill = `floor-${useId().replace(/[^a-zA-Z0-9-]/g, "")}`;
  // Phones also get a taller plot (by the same factor), so the larger labels have room between the lines.
  const plotBottom = TOP + (BOTTOM - TOP) * k;
  const floorBottom = plotBottom + (FLOOR_BOTTOM - BOTTOM) * k;
  const { x, y } = scales(data, plotBottom);
  const zero = y(0);
  const pts = (key: "model" | "baseline"): Pt[] => data.map((d) => [x(d.day), y(d[key])]);
  const line = (key: "model" | "baseline") => pts(key).map(([px, py]) => `${px.toFixed(1)},${py.toFixed(1)}`).join(" ");
  const last = data[data.length - 1]!;
  const first = data[0]!;
  const below = data.some((d) => d.model < 0 || d.baseline < 0);
  const sar = (value: number) => formatSar(value, locale);
  const floorValue = sar(0);
  const dayLabel = (day: number) => (day === 0 ? labels.today : fill(labels.day, { n: formatInt(day, locale) }));
  // Phones: the 700-unit drawing renders at half size or less, so labels and dots are drawn larger by the same
  // factor and stay about 11 px on screen. The label row and the space above the lines grow to fit them.
  const font = FONT * k;
  const endFont = END_FONT * k;
  const padTop = (k - 1) * END_FONT * 1.6;
  const dayY = floorBottom + 6 + font;
  const height = dayY + 8;
  const dot = (MARK_PX / 2) * unitsPerPx;
  const text = { fontFamily: "var(--font-mono)", fontSize: font };
  // The higher line is labelled above its end and the lower line below, clear of both lines.
  const modelHigher = last.model >= last.baseline;
  const labelY = (own: number, upper: boolean) => (upper ? own - 12 * k : own + 20 * k);
  const endLabels = [
    { value: sar(last.model), y: labelY(y(last.model), modelHigher) },
    { value: sar(last.baseline), y: labelY(y(last.baseline), !modelHigher) },
  ];
  const floor = floorLabelPlacement(
    [pts("model"), pts("baseline")],
    endLabels.map((l) => endBox(RIGHT - 12, l.y, l.value, endFont)),
    zero,
    labels.floor,
    font,
  );

  // The readout steps between the points the response holds: today and each horizon (no values in between).
  const [index, setIndex] = useState<number | null>(null);
  const [announced, setAnnounced] = useState("");
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = box.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      const width = entry?.contentRect.width ?? 0;
      if (width > 0) {
        setK(Math.min(2.2, Math.max(1, W / width)));
        setUnitsPerPx(W / width);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const readout = (i: number) => {
    const d = data[i]!;
    return {
      title: dayLabel(d.day),
      rows: [
        [labels.model, sar(d.model)],
        [labels.baseline, sar(d.baseline)],
        [labels.floorName, floorValue],
      ] as const,
    };
  };
  // RS: the live region says the currency in words; the readout box beside it is aria-hidden and shows the sign.
  const spoken = (i: number) => {
    const d = data[i]!;
    const rows = [
      [labels.model, formatSarSpoken(d.model, locale)],
      [labels.baseline, formatSarSpoken(d.baseline, locale)],
      [labels.floorName, formatSarSpoken(0, locale)],
    ];
    return [dayLabel(d.day), ...rows.map(([k, v]) => `${k} ${v}`)].join(", ");
  };

  // The live region repeats the readout, throttled so pointer moves do not flood it.
  useEffect(() => {
    if (index === null) return;
    const timer = setTimeout(() => setAnnounced(spoken(index)), ANNOUNCE_MS);
    return () => clearTimeout(timer);
    // spoken depends only on data, labels and locale, which do not change while the chart is shown.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  // A tap anywhere else hides the readout.
  useEffect(() => {
    if (index === null) return;
    const away = (event: globalThis.PointerEvent) => {
      if (!box.current?.contains(event.target as Node)) setIndex(null);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [index]);

  const nearest = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const svgX = ((event.clientX - rect.left) / (rect.width || 1)) * W;
    let best = 0;
    data.forEach((d, i) => {
      if (Math.abs(x(d.day) - svgX) < Math.abs(x(data[best]!.day) - svgX)) best = i;
    });
    return best;
  };

  const onKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const lastIndex = data.length - 1;
    const step: Record<string, (i: number | null) => number | null> = {
      ArrowRight: (i) => (i === null ? 0 : Math.min(lastIndex, i + 1)),
      ArrowLeft: (i) => (i === null ? 0 : Math.max(0, i - 1)),
      Home: () => 0,
      End: () => lastIndex,
      Escape: () => null,
    };
    const move = step[event.key];
    if (!move) return;
    event.preventDefault();
    setIndex((i) => move(i));
  };

  const shown = index === null ? null : readout(index);
  const at = index === null ? 0 : x(data[index]!.day) / W;
  return (
    // Time runs left to right in Arabic too, so the chart is pinned LTR and never mirrored.
    <div dir="ltr" className="relative">
      <div
        ref={box}
        tabIndex={0}
        role="group"
        aria-label={labels.keys}
        data-forecast-chart
        className="rounded-ctl touch-pan-y outline-offset-4"
        onKeyDown={onKey}
        onPointerMove={(event) => setIndex(nearest(event))}
        onPointerDown={(event) => setIndex(nearest(event))}
        onPointerLeave={(event) => {
          if (event.pointerType === "mouse") setIndex(null);
        }}
      >
        <svg viewBox={`0 ${-padTop} ${W} ${height + padTop}`} role="img" aria-label={labels.alt} className="h-auto w-full">
          {/* VS3: the zone below the cash floor fades from the floor line down, so the line reads as the edge. */}
          <defs>
            <linearGradient id={floorFill} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--badSoft)" />
              <stop offset="1" stopColor="var(--badSoft)" stopOpacity={0} />
            </linearGradient>
          </defs>
          {below && <rect x={LEFT} y={zero} width={RIGHT - LEFT} height={floorBottom - zero} rx={4} fill={`url(#${floorFill})`} />}
          {data.slice(1, -1).map((d) => (
            <line key={d.day} x1={x(d.day)} x2={x(d.day)} y1={TOP} y2={floorBottom} stroke="var(--rule)" />
          ))}
          <line x1={LEFT} x2={RIGHT} y1={zero} y2={zero} stroke="var(--ink)" strokeWidth={2} />
          <text data-floor-label x={RIGHT - 4} y={floor.y} textAnchor="end" fill="var(--ink)" style={text}>
            {labels.floor}
          </text>
          {below && (
            <text x={LEFT + 6} y={Math.min(floorBottom - 6, zero + 20 * k)} fill="var(--bad)" style={text}>
              {labels.below}
            </text>
          )}
          <g className="reveal">
            {/* C8: the response holds today and three horizons only, so each series is points joined by broken
                segments, never a solid line that reads as daily values. The two keep different dash patterns. */}
            <polyline data-series="model" points={line("model")} fill="none" stroke="var(--accent)" strokeWidth={3.5} strokeDasharray="1 7" strokeLinecap="round" />
            <polyline data-series="baseline" points={line("baseline")} fill="none" stroke="var(--ochre)" strokeWidth={3.5} strokeDasharray="9 7" />
            {data.slice(1).flatMap((d) => [
              <circle key={`m${d.day}`} cx={x(d.day)} cy={y(d.model)} r={dot} fill="var(--accent)" />,
              <circle key={`b${d.day}`} cx={x(d.day)} cy={y(d.baseline)} r={dot} fill="var(--ochre)" />,
            ])}
          </g>
          <circle className="pulse-ring" cx={x(first.day)} cy={y(first.model)} r={dot} fill="none" stroke="var(--accent)" strokeWidth={2} />
          <circle cx={x(first.day)} cy={y(first.model)} r={dot} fill="var(--accent)" />
          <g className="fade-late">
            {endLabels.map((l) => (
              <text key={l.value + l.y} x={RIGHT - 12} y={l.y} textAnchor="end" fill="var(--ink)" style={{ ...text, fontSize: endFont }}>
                {l.value}
              </text>
            ))}
          </g>
          {index !== null && (
            <line data-guide x1={x(data[index]!.day)} x2={x(data[index]!.day)} y1={TOP - 12} y2={floorBottom} stroke="var(--accent)" strokeWidth={1.5} strokeDasharray="4 4" />
          )}
          {data.map((d, i) => (
            <text
              key={d.day}
              x={x(d.day)}
              y={dayY}
              textAnchor={i === 0 ? "start" : i === data.length - 1 ? "end" : "middle"}
              fill="var(--muted)"
              style={text}
            >
              {dayLabel(d.day)}
            </text>
          ))}
        </svg>
      </div>
      {shown && (
        // Kept inside the chart: anchored to the guide's side that has room.
        <div
          data-readout
          dir={locale === "ar" ? "rtl" : "ltr"}
          aria-hidden="true"
          className="rounded-ctl pointer-events-none absolute top-1 z-10 min-w-[180px] max-w-[calc(100%-8px)] border border-line bg-card px-3 py-2 text-label shadow-md"
          style={at > 0.5 ? { right: `${((1 - at) * 100).toFixed(2)}%`, marginRight: 8 } : { left: `${(at * 100).toFixed(2)}%`, marginLeft: 8 }}
        >
          <div className="font-semibold">{shown.title}</div>
          <dl className="mt-1 grid grid-cols-[auto_auto] gap-x-4 gap-y-0.5">
            {shown.rows.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-muted">{k}</dt>
                <dd dir="ltr" className="text-end font-mono">
                  {v}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}
      <span role="status" aria-live="polite" className="sr-only">
        {announced}
      </span>
    </div>
  );
}
