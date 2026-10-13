import "server-only";
import { createClient } from "@/lib/supabase/server";
import { first, isoDate, type RawParams } from "@/lib/admin/table-params";
import { addDays, todayInDealershipTz } from "@/lib/format";

export const RANGE_PRESETS = [7, 30, 90] as const;
export type RangePreset = (typeof RANGE_PRESETS)[number];

export type DashboardRange = {
  from: string;
  to: string;
  /** Set when the range is exactly one of the presets ending today. */
  preset: RangePreset | null;
  /** Window for the "bookings over time" chart: 7, 30 or 90 days ending at `to`. */
  trend: RangePreset;
  today: string;
};

const MAX_RANGE_DAYS = 731;

/**
 * Global dashboard range from the URL. Every date is a calendar date in America/Chicago;
 * the SQL functions compare against the Chicago date of each booking.
 */
export function parseDashboardRange(sp: RawParams): DashboardRange {
  const today = todayInDealershipTz();
  const presetParam = Number(first(sp.range));
  const trendParam = Number(first(sp.trend));
  let from = isoDate(first(sp.from));
  let to = isoDate(first(sp.to));
  let preset: RangePreset | null = null;

  if (from && to && from <= to) {
    if (from < addDays(to, -MAX_RANGE_DAYS)) from = addDays(to, -MAX_RANGE_DAYS);
  } else {
    preset = (RANGE_PRESETS as readonly number[]).includes(presetParam) ? (presetParam as RangePreset) : 30;
    to = today;
    from = addDays(today, -(preset - 1));
  }
  const trend = (RANGE_PRESETS as readonly number[]).includes(trendParam) ? (trendParam as RangePreset) : 30;
  return { from, to, preset, trend, today };
}

export type Kpis = {
  totalBookings: number;
  pendingBookings: number;
  confirmedBookings: number;
  completedBookings: number;
  cancelledBookings: number;
  noShowBookings: number;
  bookingsThisMonth: number;
  bookingsLastMonth: number;
  carsInStock: number;
  carsAvailable: number;
  carsSold: number;
  carsTotal: number;
  inventoryValue: number;
};

export type DashboardData = {
  kpis: Kpis | null;
  overTime: { day: string; bookings: number }[];
  byStatus: { status: string; bookings: number }[];
  topVehicles: { vehicleId: string; name: string; bookings: number }[];
  byWeekday: { weekday: number; bookings: number }[];
  byHour: { hour: number; bookings: number }[];
  inventoryByMake: { label: string; vehicles: number; totalValue: number }[];
  inventoryByBody: { label: string; vehicles: number; totalValue: number }[];
  failed: string[];
};

const n = (v: unknown) => (typeof v === "number" ? v : Number(v ?? 0) || 0);

/**
 * All dashboard numbers. Every aggregate is computed in Postgres by the functions in
 * 04_dashboard_functions.sql; the browser only receives the small result sets.
 */
export async function getDashboardData(range: DashboardRange): Promise<DashboardData> {
  const supabase = await createClient();
  const args = { p_from: range.from, p_to: range.to };
  const trendFrom = addDays(range.to, -(range.trend - 1));

  const [kpis, overTime, byStatus, top, weekday, hour, byMake, byBody] = await Promise.all([
    supabase.rpc("dashboard_kpis", args),
    supabase.rpc("dashboard_bookings_over_time", { p_from: trendFrom, p_to: range.to }),
    supabase.rpc("dashboard_bookings_by_status", args),
    supabase.rpc("dashboard_top_vehicles", { ...args, p_limit: 8 }),
    supabase.rpc("dashboard_bookings_by_weekday", args),
    supabase.rpc("dashboard_bookings_by_hour", args),
    supabase.rpc("dashboard_inventory_breakdown", { p_dimension: "make" }),
    supabase.rpc("dashboard_inventory_breakdown", { p_dimension: "body_type" }),
  ]);

  const failed: string[] = [];
  const check = (name: string, res: { error: { message: string } | null }) => {
    if (res.error) {
      failed.push(name);
      console.error(`[admin] ${name} failed:`, res.error.message);
    }
  };
  check("KPIs", kpis);
  check("Bookings over time", overTime);
  check("Bookings by status", byStatus);
  check("Most booked vehicles", top);
  check("Bookings by weekday", weekday);
  check("Bookings by hour", hour);
  check("Inventory by brand", byMake);
  check("Inventory by body type", byBody);

  const k = kpis.data && typeof kpis.data === "object" && !Array.isArray(kpis.data) ? kpis.data : null;

  return {
    kpis: k
      ? {
          totalBookings: n(k.total_bookings),
          pendingBookings: n(k.pending_bookings),
          confirmedBookings: n(k.confirmed_bookings),
          completedBookings: n(k.completed_bookings),
          cancelledBookings: n(k.cancelled_bookings),
          noShowBookings: n(k.no_show_bookings),
          bookingsThisMonth: n(k.bookings_this_month),
          bookingsLastMonth: n(k.bookings_last_month),
          carsInStock: n(k.cars_in_stock),
          carsAvailable: n(k.cars_available),
          carsSold: n(k.cars_sold),
          carsTotal: n(k.cars_total),
          inventoryValue: n(k.inventory_value),
        }
      : null,
    overTime: (overTime.data ?? []).map((r) => ({ day: r.day, bookings: n(r.bookings) })),
    byStatus: (byStatus.data ?? []).map((r) => ({ status: r.status, bookings: n(r.bookings) })),
    topVehicles: (top.data ?? []).map((r) => ({ vehicleId: r.vehicle_id, name: r.vehicle_name, bookings: n(r.bookings) })),
    byWeekday: (weekday.data ?? []).map((r) => ({ weekday: n(r.weekday), bookings: n(r.bookings) })),
    byHour: (hour.data ?? []).map((r) => ({ hour: n(r.hour), bookings: n(r.bookings) })),
    inventoryByMake: (byMake.data ?? []).map((r) => ({ label: r.label, vehicles: n(r.vehicles), totalValue: n(r.total_value) })),
    inventoryByBody: (byBody.data ?? []).map((r) => ({ label: r.label, vehicles: n(r.vehicles), totalValue: n(r.total_value) })),
    failed,
  };
}
