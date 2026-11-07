import { formatInt, formatSar } from "@/lib/format";
import { fill, type Locale } from "@/lib/i18n";

export type ForecastPoint = { day: number; model: number; baseline: number };

type Props = {
  data: ForecastPoint[];
  locale: Locale;
  labels: { model: string; baseline: string; day: string; alt: string; floor: string; below: string; today: string };
};

const W = 700;
const H = 260;
const LEFT = 40;
const RIGHT = 660;
const TOP = 30;
const BOTTOM = 210;
const FLOOR_BOTTOM = 234;

/** Scales come from the response alone: the x axis from the horizons, the y axis from the balances and SAR 0. */
function scales(data: ForecastPoint[]) {
  const values = [0, ...data.flatMap((d) => [d.model, d.baseline])];
  const [min, max] = [Math.min(...values), Math.max(...values)];
  const lastDay = Math.max(...data.map((d) => d.day), 1);
  return {
    x: (day: number) => LEFT + (day / lastDay) * (RIGHT - LEFT),
    y: (value: number) => BOTTOM - ((value - min) / (max - min || 1)) * (BOTTOM - TOP),
  };
}

export function ForecastChart({ data, locale, labels }: Props) {
  const { x, y } = scales(data);
  const zero = y(0);
  const line = (key: "model" | "baseline") => data.map((d) => `${x(d.day).toFixed(1)},${y(d[key]).toFixed(1)}`).join(" ");
  const last = data[data.length - 1]!;
  const first = data[0]!;
  const below = data.some((d) => d.model < 0 || d.baseline < 0);
  const sar = (value: number) => formatSar(value, locale);
  const dayLabel = (day: number) => (day === 0 ? labels.today : fill(labels.day, { n: formatInt(day, locale) }));
  const text = { fontFamily: "var(--font-mono)", fontSize: 11 };
  // The higher line is labelled above its end and the lower line below, clear of both lines.
  const modelHigher = last.model >= last.baseline;
  const labelY = (own: number, upper: boolean) => (upper ? own - 12 : own + 20);
  return (
    // Time runs left to right in Arabic too, so the chart is pinned LTR and never mirrored.
    <div dir="ltr">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={labels.alt} className="h-auto w-full">
        {below && <rect x={LEFT} y={zero} width={RIGHT - LEFT} height={FLOOR_BOTTOM - zero} rx={4} fill="var(--badSoft)" />}
        {data.slice(1, -1).map((d) => (
          <line key={d.day} x1={x(d.day)} x2={x(d.day)} y1={TOP} y2={FLOOR_BOTTOM} stroke="var(--rule)" />
        ))}
        <line x1={LEFT} x2={RIGHT} y1={zero} y2={zero} stroke="var(--ink)" strokeWidth={2} />
        <text x={LEFT + 4} y={zero - 6} fill="var(--ink)" style={text}>
          {labels.floor}
        </text>
        {below && (
          <text x={RIGHT - 4} y={zero + 20} textAnchor="end" fill="var(--bad)" style={text}>
            {labels.below}
          </text>
        )}
        <g className="reveal">
          <polyline points={line("model")} fill="none" stroke="var(--accent)" strokeWidth={3.5} />
          <polyline points={line("baseline")} fill="none" stroke="var(--ochre)" strokeWidth={3.5} strokeDasharray="9 7" />
          {data.slice(1).flatMap((d) => [
            <circle key={`m${d.day}`} cx={x(d.day)} cy={y(d.model)} r={5} fill="var(--accent)">
              <title>{`${labels.model}, ${dayLabel(d.day)}: ${sar(d.model)}`}</title>
            </circle>,
            <circle key={`b${d.day}`} cx={x(d.day)} cy={y(d.baseline)} r={5} fill="var(--ochre)">
              <title>{`${labels.baseline}, ${dayLabel(d.day)}: ${sar(d.baseline)}`}</title>
            </circle>,
          ])}
        </g>
        <circle className="pulse-ring" cx={x(first.day)} cy={y(first.model)} r={6} fill="none" stroke="var(--accent)" strokeWidth={2} />
        <circle cx={x(first.day)} cy={y(first.model)} r={6} fill="var(--accent)">
          <title>{`${labels.today}: ${sar(first.model)}`}</title>
        </circle>
        <g className="fade-late">
          <text x={RIGHT - 12} y={labelY(y(last.model), modelHigher)} textAnchor="end" fill="var(--ink)" style={{ ...text, fontSize: 12 }}>
            {sar(last.model)}
          </text>
          <text x={RIGHT - 12} y={labelY(y(last.baseline), !modelHigher)} textAnchor="end" fill="var(--ink)" style={{ ...text, fontSize: 12 }}>
            {sar(last.baseline)}
          </text>
        </g>
        {data.map((d, i) => (
          <text
            key={d.day}
            x={x(d.day)}
            y={252}
            textAnchor={i === 0 ? "start" : i === data.length - 1 ? "end" : "middle"}
            fill="var(--muted)"
            style={text}
          >
            {dayLabel(d.day)}
          </text>
        ))}
      </svg>
    </div>
  );
}
