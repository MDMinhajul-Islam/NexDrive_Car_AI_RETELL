"use client";

import type { ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatNumber } from "@/lib/format";

/**
 * Chart colours. Categorical slots are used in a fixed order and follow the entity
 * (a status keeps its colour whatever else is on screen). The set passes the palette
 * validator for colour-vision separation on a light surface; three slots sit below
 * 3:1 contrast, so every chart ships visible labels and a table view.
 */
const SERIES = "#2a78d6";
export const STATUS_COLORS: Record<string, string> = {
  Requested: "#2a78d6",
  Confirmed: "#eb6834",
  Completed: "#1baf7a",
  Cancelled: "#eda100",
  "No Show": "#e87ba4",
  Rescheduled: "#008300",
};
const GRID = "#e7e5e4";
const AXIS = { fontSize: 12, fill: "#57534e" } as const;

type TooltipEntry = { name?: string | number; value?: string | number; payload?: Record<string, unknown> };

function ChartTooltip({
  active,
  payload,
  label,
  unit,
  title,
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string | number;
  unit: string;
  title?: (entry: TooltipEntry, label?: string | number) => string;
}) {
  if (!active || !payload?.length) return null;
  const entry = payload[0];
  const value = Number(entry.value ?? 0);
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="font-medium text-foreground">{title ? title(entry, label) : String(label ?? entry.name ?? "")}</p>
      <p className="mt-0.5 text-muted-foreground">
        {formatNumber(value)} {value === 1 ? unit : `${unit}s`}
      </p>
    </div>
  );
}

/** Collapsible data table under each chart: the non-visual and low-contrast fallback. */
export function ChartTable({ headers, rows }: { headers: [string, string]; rows: [string, string][] }) {
  return (
    <details className="mt-3 text-sm">
      <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground">
        View as table
      </summary>
      <div className="mt-2 max-h-56 overflow-y-auto rounded-lg border">
        <table className="w-full text-left text-xs">
          <thead className="bg-muted/60">
            <tr>
              <th scope="col" className="px-3 py-2 font-medium">
                {headers[0]}
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                {headers[1]}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map(([a, b]) => (
              <tr key={a}>
                <td className="px-3 py-1.5">{a}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{b}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="grid h-56 place-items-center text-sm text-muted-foreground">{children}</p>;
}

const shortDate = (iso: string) => {
  const [, m, d] = iso.split("-").map(Number);
  return `${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m - 1]} ${d}`;
};

export function BookingsLineChart({ data }: { data: { day: string; bookings: number }[] }) {
  if (data.every((d) => d.bookings === 0)) return <Empty>No bookings in this period.</Empty>;
  return (
    <>
      <div className="h-64" role="img" aria-label="Line chart of bookings per day. Use the table below for exact values.">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -16 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="day" tickFormatter={shortDate} tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} minTickGap={32} />
            <YAxis allowDecimals={false} tick={AXIS} tickLine={false} axisLine={false} width={48} />
            <Tooltip
              cursor={{ stroke: "#a8a29e", strokeWidth: 1 }}
              content={<ChartTooltip unit="booking" title={(_, label) => shortDate(String(label))} />}
            />
            <Line
              type="monotone"
              dataKey="bookings"
              stroke={SERIES}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              dot={false}
              activeDot={{ r: 5, stroke: "#ffffff", strokeWidth: 2 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <ChartTable headers={["Day", "Bookings"]} rows={data.map((d) => [shortDate(d.day), formatNumber(d.bookings)])} />
    </>
  );
}

export function StatusDonut({ data }: { data: { status: string; bookings: number }[] }) {
  const total = data.reduce((sum, d) => sum + d.bookings, 0);
  if (total === 0) return <Empty>No bookings in this period.</Empty>;
  const slices = data.map((d) => ({ ...d, fill: STATUS_COLORS[d.status] ?? "#78716c" }));
  return (
    <>
      <div className="grid items-center gap-4 sm:grid-cols-[11rem_1fr]">
        <div className="relative mx-auto size-44" role="img" aria-label="Donut chart of bookings by status. Values are listed beside it.">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Tooltip content={<ChartTooltip unit="booking" title={(e) => String(e.payload?.status ?? e.name ?? "")} />} />
              <Pie
                data={slices}
                dataKey="bookings"
                nameKey="status"
                innerRadius="62%"
                outerRadius="100%"
                paddingAngle={1.5}
                stroke="#ffffff"
                strokeWidth={2}
                isAnimationActive={false}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
            <div>
              <p className="text-2xl font-semibold tabular-nums">{formatNumber(total)}</p>
              <p className="text-xs text-muted-foreground">bookings</p>
            </div>
          </div>
        </div>
        {/* Legend with values: identity never depends on colour alone. */}
        <ul className="space-y-2 text-sm">
          {slices.map((s) => (
            <li key={s.status} className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2">
                <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.fill }} aria-hidden="true" />
                {s.status}
              </span>
              <span className="tabular-nums text-muted-foreground">
                {formatNumber(s.bookings)} · {Math.round((s.bookings / total) * 100)}%
              </span>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

/** Horizontal bars for ranked categories with long labels. */
export function RankedBars({
  data,
  unit,
  labelHeader,
  emptyText,
}: {
  data: { label: string; value: number }[];
  unit: string;
  labelHeader: string;
  emptyText: string;
}) {
  if (data.length === 0 || data.every((d) => d.value === 0)) return <Empty>{emptyText}</Empty>;
  const height = Math.max(160, data.length * 34 + 24);
  return (
    <>
      <div style={{ height }} role="img" aria-label={`Bar chart of ${unit}s by ${labelHeader.toLowerCase()}. Use the table below for exact values.`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 0, right: 36, bottom: 0, left: 0 }} barCategoryGap={8}>
            <CartesianGrid stroke={GRID} horizontal={false} />
            <XAxis type="number" allowDecimals={false} tick={AXIS} tickLine={false} axisLine={false} />
            <YAxis
              type="category"
              dataKey="label"
              tick={AXIS}
              tickLine={false}
              axisLine={{ stroke: GRID }}
              width={150}
              tickFormatter={(v: string) => (v.length > 22 ? `${v.slice(0, 21)}…` : v)}
            />
            <Tooltip cursor={{ fill: "#f5f5f4" }} content={<ChartTooltip unit={unit} />} />
            <Bar
              dataKey="value"
              fill={SERIES}
              maxBarSize={20}
              radius={[0, 4, 4, 0]}
              isAnimationActive={false}
              label={{ position: "right", fontSize: 12, fill: "#44403c", formatter: (v: unknown) => formatNumber(Number(v)) }}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ChartTable headers={[labelHeader, `${unit[0].toUpperCase()}${unit.slice(1)}s`]} rows={data.map((d) => [d.label, formatNumber(d.value)])} />
    </>
  );
}

/** Columns for a short ordered axis (weekdays, hours). */
export function ColumnBars({
  data,
  unit,
  labelHeader,
  emptyText,
}: {
  data: { label: string; value: number }[];
  unit: string;
  labelHeader: string;
  emptyText: string;
}) {
  if (data.length === 0 || data.every((d) => d.value === 0)) return <Empty>{emptyText}</Empty>;
  return (
    <>
      <div className="h-56" role="img" aria-label={`Column chart of ${unit}s by ${labelHeader.toLowerCase()}. Use the table below for exact values.`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }} barCategoryGap="20%">
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} interval="preserveStartEnd" minTickGap={8} />
            <YAxis allowDecimals={false} tick={AXIS} tickLine={false} axisLine={false} width={48} />
            <Tooltip cursor={{ fill: "#f5f5f4" }} content={<ChartTooltip unit={unit} />} />
            <Bar dataKey="value" fill={SERIES} maxBarSize={24} radius={[4, 4, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ChartTable headers={[labelHeader, `${unit[0].toUpperCase()}${unit.slice(1)}s`]} rows={data.map((d) => [d.label, formatNumber(d.value)])} />
    </>
  );
}
