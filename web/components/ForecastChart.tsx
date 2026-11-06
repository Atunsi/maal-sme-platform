"use client";

import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Locale } from "@/lib/i18n";
import { formatInt, formatSar } from "@/lib/format";

export type ForecastPoint = { day: number; model: number; baseline: number };

type Props = {
  data: ForecastPoint[];
  locale: Locale;
  labels: { model: string; baseline: string; day: string; alt: string };
};

const INK = "#57554f";
const GRID = "#dedcd3";

export function ForecastChart({ data, locale, labels }: Props) {
  return (
    // Time runs left to right in Arabic too, so the chart is pinned LTR and never mirrored.
    <div dir="ltr" role="img" aria-label={labels.alt} className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 24, bottom: 4, left: 8 }} accessibilityLayer={false}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis
            dataKey="day"
            type="number"
            domain={[0, "dataMax"]}
            ticks={data.map((d) => d.day)}
            tickFormatter={(day: number) => formatInt(day, locale)}
            stroke={GRID}
            tick={{ fill: INK, fontSize: 12 }}
          />
          <YAxis
            width={72}
            tickFormatter={(value: number) => formatInt(value, locale)}
            stroke={GRID}
            tick={{ fill: INK, fontSize: 12 }}
          />
          <ReferenceLine y={0} stroke={INK} />
          <Tooltip
            formatter={(value) => formatSar(Number(value), locale)}
            labelFormatter={(day) => labels.day.replace("{n}", String(day))}
          />
          <Legend />
          <Line
            dataKey="model"
            name={labels.model}
            stroke="var(--color-series-model)"
            strokeWidth={2}
            dot={{ r: 4 }}
            isAnimationActive={false}
          />
          <Line
            dataKey="baseline"
            name={labels.baseline}
            stroke="var(--color-series-baseline)"
            strokeWidth={2}
            strokeDasharray="6 4"
            dot={{ r: 4 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
