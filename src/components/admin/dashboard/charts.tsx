"use client";

import Link from "next/link";
import { useMemo, type ReactNode } from "react";
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

/**
 * One mark in a bar or column chart.
 * `id` is the stable identity (a vehicle_id, "weekday-3", a brand): it is the React key
 * and the chart's category key. `label` is display text and may repeat across rows.
 */
export type ChartDatum = {
  id: string;
  label: string;
  /** Second line that tells same-label rows apart, for example a stock number. */
  sublabel?: string;
  value: number;
  href?: string;
};

export type ChartTableRow = { id: string; label: string; sublabel?: string; value: string; href?: string };

/** Collapsible data table under each chart: the non-visual and low-contrast fallback. */
export function ChartTable({ headers, rows }: { headers: [string, string]; rows: ChartTableRow[] }) {
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
            {rows.map((row) => {
              const text = row.sublabel ? `${row.label} · ${row.sublabel}` : row.label;
              return (
                <tr key={row.id}>
                  <td className="px-3 py-1.5">
                    {row.href ? (
                      <Link href={row.href} className="underline-offset-4 hover:underline">
                        {text}
                      </Link>
                    ) : (
                      text
                    )}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{row.value}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </details>
  );
}

const toTableRows = (data: ChartDatum[]): ChartTableRow[] =>
  data.map((d) => ({ id: d.id, label: d.label, sublabel: d.sublabel, href: d.href, value: formatNumber(d.value) }));

const truncate = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

/** Y-axis tick for ranked bars: label, optional second line, optional link to the record. */
function CategoryTick({
  x = 0,
  y = 0,
  payload,
  byId,
}: {
  x?: number;
  y?: number;
  payload?: { value?: string };
  byId: Map<string, ChartDatum>;
}) {
  const datum = byId.get(String(payload?.value ?? ""));
  if (!datum) return null;
  const text = (
    <text x={x - 8} y={y} textAnchor="end" fontSize={12}>
      <tspan x={x - 8} dy={datum.sublabel ? "-0.25em" : "0.32em"} fill="#44403c">
        {truncate(datum.label, 22)}
      </tspan>
      {datum.sublabel ? (
        <tspan x={x - 8} dy="1.25em" fill="#78716c" fontSize={11}>
          {datum.sublabel}
        </tspan>
      ) : null}
    </text>
  );
  return datum.href ? (
    <a href={datum.href} aria-label={`${datum.label}${datum.sublabel ? `, ${datum.sublabel}` : ""}: open in Cars`}>
      {text}
    </a>
  ) : (
    text
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
      <ChartTable
        headers={["Day", "Bookings"]}
        rows={data.map((d) => ({ id: d.day, label: shortDate(d.day), value: formatNumber(d.bookings) }))}
      />
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

const tooltipTitle = (entry: TooltipEntry) => {
  const label = String(entry.payload?.label ?? "");
  const sub = entry.payload?.sublabel;
  return typeof sub === "string" && sub ? `${label} · ${sub}` : label;
};

/** Horizontal bars for ranked categories with long labels. */
export function RankedBars({
  data,
  unit,
  labelHeader,
  emptyText,
}: {
  data: ChartDatum[];
  unit: string;
  labelHeader: string;
  emptyText: string;
}) {
  const byId = useMemo(() => new Map(data.map((d) => [d.id, d])), [data]);
  if (data.length === 0 || data.every((d) => d.value === 0)) return <Empty>{emptyText}</Empty>;
  const twoLine = data.some((d) => d.sublabel);
  const height = Math.max(160, data.length * (twoLine ? 44 : 34) + 24);
  return (
    <>
      <div style={{ height }} role="img" aria-label={`Bar chart of ${unit}s by ${labelHeader.toLowerCase()}. Use the table below for exact values.`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 0, right: 36, bottom: 0, left: 0 }} barCategoryGap={8}>
            <CartesianGrid stroke={GRID} horizontal={false} />
            <XAxis type="number" allowDecimals={false} tick={AXIS} tickLine={false} axisLine={false} />
            {/* The category axis is keyed by id, never by label: labels can repeat. */}
            <YAxis
              type="category"
              dataKey="id"
              tick={<CategoryTick byId={byId} />}
              tickLine={false}
              axisLine={{ stroke: GRID }}
              width={150}
              interval={0}
            />
            <Tooltip cursor={{ fill: "#f5f5f4" }} content={<ChartTooltip unit={unit} title={tooltipTitle} />} />
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
      <ChartTable headers={[labelHeader, `${unit[0].toUpperCase()}${unit.slice(1)}s`]} rows={toTableRows(data)} />
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
  data: ChartDatum[];
  unit: string;
  labelHeader: string;
  emptyText: string;
}) {
  const byId = useMemo(() => new Map(data.map((d) => [d.id, d])), [data]);
  if (data.length === 0 || data.every((d) => d.value === 0)) return <Empty>{emptyText}</Empty>;
  return (
    <>
      <div className="h-56" role="img" aria-label={`Column chart of ${unit}s by ${labelHeader.toLowerCase()}. Use the table below for exact values.`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }} barCategoryGap="20%">
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis
              dataKey="id"
              tickFormatter={(id: string) => byId.get(id)?.label ?? ""}
              tick={AXIS}
              tickLine={false}
              axisLine={{ stroke: GRID }}
              interval="preserveStartEnd"
              minTickGap={8}
            />
            <YAxis allowDecimals={false} tick={AXIS} tickLine={false} axisLine={false} width={48} />
            <Tooltip cursor={{ fill: "#f5f5f4" }} content={<ChartTooltip unit={unit} title={tooltipTitle} />} />
            <Bar dataKey="value" fill={SERIES} maxBarSize={24} radius={[4, 4, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ChartTable headers={[labelHeader, `${unit[0].toUpperCase()}${unit.slice(1)}s`]} rows={toTableRows(data)} />
    </>
  );
}
