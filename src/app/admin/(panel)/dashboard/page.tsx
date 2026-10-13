import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowDownRight, ArrowRight, ArrowUpRight, Minus, TriangleAlert } from "lucide-react";
import { BookingsLineChart, ColumnBars, RankedBars, StatusDonut } from "@/components/admin/dashboard/charts";
import { ParamToggle, RangeFilter } from "@/components/admin/dashboard/range-filter";
import { AdminPageHeader } from "@/components/admin/page-header";
import { AppointmentStatusBadge } from "@/components/admin/status-badges";
import { first, type RawParams } from "@/lib/admin/table-params";
import { listRecentBookings, listUpcomingTestDrives, type BookingRow } from "@/lib/data/admin/bookings";
import { getDashboardData, parseDashboardRange } from "@/lib/data/admin/dashboard";
import { addDays, formatCurrency, formatDate, formatDateTime, formatNumber, formatTime } from "@/lib/format";

export const metadata: Metadata = { title: "Dashboard" };

type Props = { searchParams: Promise<RawParams> };

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const hourLabel = (h: number) => `${h % 12 === 0 ? 12 : h % 12}${h < 12 ? "a" : "p"}`;

function Card({
  title,
  description,
  action,
  children,
  className = "",
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-xl border bg-card p-5 ${className}`}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          {description ? <p className="mt-0.5 text-xs text-muted-foreground">{description}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function Kpi({ label, value, hint, delta }: { label: string; value: string; hint?: string; delta?: ReactNode }) {
  return (
    <div className="rounded-xl border bg-card p-5">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
      {delta}
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

/** Month-over-month change. Direction is carried by the icon and the words, not colour alone. */
function Delta({ current, previous }: { current: number; previous: number }) {
  if (previous === 0) {
    return (
      <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
        <Minus className="size-3.5" aria-hidden="true" />
        {current === 0 ? "No bookings in either month" : "No bookings last month to compare"}
      </p>
    );
  }
  const pct = Math.round(((current - previous) / previous) * 100);
  const Icon = pct > 0 ? ArrowUpRight : pct < 0 ? ArrowDownRight : Minus;
  const tone = pct > 0 ? "text-emerald-700" : pct < 0 ? "text-rose-700" : "text-muted-foreground";
  return (
    <p className={`mt-1 flex items-center gap-1 text-xs font-medium ${tone}`}>
      <Icon className="size-3.5" aria-hidden="true" />
      {pct === 0 ? "Same as" : `${Math.abs(pct)}% ${pct > 0 ? "up on" : "down on"}`} last month ({formatNumber(previous)})
    </p>
  );
}

function BookingList({ rows, empty, showCreated }: { rows: BookingRow[]; empty: string; showCreated?: boolean }) {
  if (rows.length === 0) return <p className="py-8 text-center text-sm text-muted-foreground">{empty}</p>;
  return (
    <ul className="divide-y">
      {rows.map((b) => (
        <li key={b.appointment_id} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">
              {b.customer ? `${b.customer.first_name} ${b.customer.last_name}` : b.customer_id}
            </p>
            <p className="truncate text-xs text-muted-foreground">{b.vehicle?.name ?? b.vehicle_id}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {showCreated
                ? `Booked ${formatDateTime(b.created_at)} via ${b.created_by}`
                : `${formatDate(b.appointment_date, { weekday: "short", month: "short", day: "numeric" })} at ${formatTime(b.appointment_time)}${b.salesperson ? ` with ${b.salesperson.name}` : ""}`}
            </p>
          </div>
          <AppointmentStatusBadge status={b.status} />
        </li>
      ))}
    </ul>
  );
}

export default async function AdminDashboardPage({ searchParams }: Props) {
  const sp = await searchParams;
  const range = parseDashboardRange(sp);
  const timeView = first(sp.time) === "hour" ? "hour" : "weekday";
  const inventoryView = first(sp.inv) === "body" ? "body" : "make";

  const [data, recent, upcoming] = await Promise.all([
    getDashboardData(range),
    listRecentBookings(6),
    listUpcomingTestDrives(range.today, addDays(range.today, 7), 8),
  ]);
  const k = data.kpis;
  const conversion = k && k.totalBookings > 0 ? Math.round((k.completedBookings / k.totalBookings) * 1000) / 10 : null;
  const rangeLabel = `${formatDate(range.from, { month: "short", day: "numeric", year: "numeric" })} to ${formatDate(range.to, { month: "short", day: "numeric", year: "numeric" })}`;

  const hours = data.byHour.length
    ? Array.from(
        { length: Math.max(...data.byHour.map((h) => h.hour)) - Math.min(...data.byHour.map((h) => h.hour)) + 1 },
        (_, i) => {
          const hour = Math.min(...data.byHour.map((h) => h.hour)) + i;
          return { id: `hour-${hour}`, label: hourLabel(hour), value: data.byHour.find((h) => h.hour === hour)?.bookings ?? 0 };
        },
      )
    : [];
  const inventory = (inventoryView === "body" ? data.inventoryByBody : data.inventoryByMake).slice(0, 10);

  return (
    <>
      <AdminPageHeader
        title="Dashboard"
        description={`Bookings made ${rangeLabel}. All dates are US Central.`}
        actions={<RangeFilter from={range.from} to={range.to} preset={range.preset} today={range.today} />}
      />

      {data.failed.length > 0 ? (
        <p role="alert" className="mb-6 flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          Some widgets could not load: {data.failed.join(", ")}. Check that the dashboard functions are installed and
          that this account has admin access.
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Total bookings" value={k ? formatNumber(k.totalBookings) : "N/A"} hint="In the selected range" />
        <Kpi
          label="Bookings this month"
          value={k ? formatNumber(k.bookingsThisMonth) : "N/A"}
          delta={k ? <Delta current={k.bookingsThisMonth} previous={k.bookingsLastMonth} /> : null}
        />
        <Kpi
          label="Pending bookings"
          value={k ? formatNumber(k.pendingBookings) : "N/A"}
          hint="Status Requested, awaiting confirmation"
        />
        <Kpi
          label="Conversion rate"
          value={conversion != null ? `${conversion}%` : "N/A"}
          hint={k ? `${formatNumber(k.completedBookings)} completed of ${formatNumber(k.totalBookings)}` : undefined}
        />
        <Kpi
          label="Cars in stock"
          value={k ? formatNumber(k.carsInStock) : "N/A"}
          hint={k ? `${formatNumber(k.carsAvailable)} available now` : undefined}
        />
        <Kpi label="Cars sold" value={k ? formatNumber(k.carsSold) : "N/A"} hint={k ? `Of ${formatNumber(k.carsTotal)} records` : undefined} />
        <Kpi label="Inventory value" value={k ? formatCurrency(k.inventoryValue) : "N/A"} hint="Sale price of cars in stock" />
        <Kpi
          label="Cancelled or no-show"
          value={k ? formatNumber(k.cancelledBookings + k.noShowBookings) : "N/A"}
          hint={k ? `${formatNumber(k.cancelledBookings)} cancelled, ${formatNumber(k.noShowBookings)} no-show` : undefined}
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card
          title="Bookings over time"
          description={`Bookings created per day, last ${range.trend} days to ${formatDate(range.to, { month: "short", day: "numeric" })}`}
          className="xl:col-span-2"
          action={
            <ParamToggle
              param="trend"
              label="Trend window"
              value={String(range.trend)}
              options={[
                { value: "7", label: "7 days" },
                { value: "30", label: "30 days" },
                { value: "90", label: "90 days" },
              ]}
            />
          }
        >
          <BookingsLineChart data={data.overTime} />
        </Card>

        <Card title="Bookings by status" description="Share of bookings in the selected range">
          <StatusDonut data={data.byStatus} />
        </Card>

        <Card title="Most booked cars" description="Vehicles with the most bookings in the selected range. Select a name to open it in Cars." className="xl:col-span-2">
          <RankedBars
            // Keyed by vehicle_id: two different cars can both be a "2016 Toyota RAV4".
            data={data.topVehicles.map((v) => ({
              id: v.vehicleId,
              label: v.name,
              sublabel: v.stockNumber,
              value: v.bookings,
              href: `/admin/cars?q=${v.vehicleId}`,
            }))}
            unit="booking"
            labelHeader="Vehicle"
            emptyText="No bookings in this period."
          />
        </Card>

        <Card
          title={timeView === "hour" ? "Bookings by hour" : "Bookings by weekday"}
          description="When appointments take place (US Central)"
          action={
            <ParamToggle
              param="time"
              label="Group appointments by"
              value={timeView}
              options={[
                { value: "weekday", label: "Weekday" },
                { value: "hour", label: "Hour" },
              ]}
            />
          }
        >
          <ColumnBars
            data={
              timeView === "hour"
                ? hours
                : data.byWeekday.map((d) => ({
                    id: `weekday-${d.weekday}`,
                    label: WEEKDAYS[d.weekday] ?? String(d.weekday),
                    value: d.bookings,
                  }))
            }
            unit="booking"
            labelHeader={timeView === "hour" ? "Hour" : "Weekday"}
            emptyText="No bookings in this period."
          />
        </Card>

        <Card
          title={inventoryView === "body" ? "Inventory by body type" : "Inventory by brand"}
          description={inventoryView === "body" ? "Cars in stock today" : "Top 10 brands by cars in stock today"}
          className="xl:col-span-3"
          action={
            <ParamToggle
              param="inv"
              label="Group inventory by"
              value={inventoryView}
              options={[
                { value: "make", label: "Brand" },
                { value: "body", label: "Body type" },
              ]}
            />
          }
        >
          <RankedBars
            data={inventory.map((r) => ({
              id: `${inventoryView}-${r.label}`,
              label: r.label,
              value: r.vehicles,
              href: `/admin/cars?${inventoryView === "body" ? `body=${encodeURIComponent(r.label)}` : `q=${encodeURIComponent(r.label)}`}`,
            }))}
            unit="vehicle"
            labelHeader={inventoryView === "body" ? "Body type" : "Brand"}
            emptyText="No vehicles in stock."
          />
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card
          title="Recent bookings"
          description="The latest bookings from every channel"
          action={
            <Link href="/admin/bookings?sort=created_at&dir=desc" className="inline-flex items-center gap-1 text-xs font-medium hover:underline">
              View all <ArrowRight className="size-3.5" aria-hidden="true" />
            </Link>
          }
        >
          <BookingList rows={recent} empty="No bookings yet." showCreated />
        </Card>
        <Card
          title="Upcoming test drives"
          description="Requested, confirmed or rescheduled in the next 7 days"
          action={
            <Link
              href={`/admin/bookings?type=Test+Drive&from=${range.today}&to=${addDays(range.today, 7)}&sort=appointment_date&dir=asc`}
              className="inline-flex items-center gap-1 text-xs font-medium hover:underline"
            >
              View all <ArrowRight className="size-3.5" aria-hidden="true" />
            </Link>
          }
        >
          <BookingList rows={upcoming} empty="No test drives scheduled in the next 7 days." />
        </Card>
      </div>
    </>
  );
}
