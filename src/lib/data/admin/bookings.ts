import "server-only";
import { createClient } from "@/lib/supabase/server";
import { APPOINTMENT_STATUSES, APPOINTMENT_TYPES } from "@/lib/constants";
import {
  first,
  isoDate,
  oneOf,
  parseTableParams,
  sanitizeTerm,
  type Paged,
  type RawParams,
  type TableParams,
} from "@/lib/admin/table-params";

export const BOOKING_SORTS = ["appointment_date", "created_at", "status", "appointment_id"] as const;
export type BookingSort = (typeof BOOKING_SORTS)[number];

export type BookingFilters = TableParams<BookingSort> & {
  status: string;
  type: string;
  from: string;
  to: string;
};

export type BookingRow = {
  appointment_id: string;
  appointment_date: string;
  appointment_time: string;
  appointment_type: string;
  status: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  notes: string;
  lead_id: string;
  customer_id: string;
  vehicle_id: string;
  salesperson_id: string;
  customer: { first_name: string; last_name: string; phone: string; email: string | null } | null;
  vehicle: { name: string; stock_number: string } | null;
  salesperson: { name: string } | null;
};

export function parseBookingFilters(sp: RawParams): BookingFilters {
  return {
    ...parseTableParams(sp, BOOKING_SORTS, { sort: "appointment_date", dir: "desc" }),
    status: oneOf(first(sp.status), APPOINTMENT_STATUSES),
    type: oneOf(first(sp.type), APPOINTMENT_TYPES),
    from: isoDate(first(sp.from)),
    to: isoDate(first(sp.to)),
  };
}

const SELECT = `
  appointment_id, appointment_date, appointment_time, appointment_type, status, created_by,
  created_at, updated_at, notes, lead_id, customer_id, vehicle_id, salesperson_id,
  customer:customers!appointments_customer_id_fkey(first_name, last_name, synthetic_phone, synthetic_email),
  vehicle:vehicles!appointments_vehicle_id_fkey(year, make, model, trim, stock_number),
  salesperson:salespeople!appointments_salesperson_id_fkey(name)
` as const;

// Same shape, but the customer join is INNER so a customer search narrows the appointments.
const SELECT_CUSTOMER_SEARCH = `
  appointment_id, appointment_date, appointment_time, appointment_type, status, created_by,
  created_at, updated_at, notes, lead_id, customer_id, vehicle_id, salesperson_id,
  customer:customers!appointments_customer_id_fkey!inner(first_name, last_name, synthetic_phone, synthetic_email),
  vehicle:vehicles!appointments_vehicle_id_fkey(year, make, model, trim, stock_number),
  salesperson:salespeople!appointments_salesperson_id_fkey(name)
` as const;

type RawRow = Omit<BookingRow, "customer" | "vehicle" | "salesperson"> & {
  customer: { first_name: string; last_name: string; synthetic_phone: string; synthetic_email: string | null } | null;
  vehicle: { year: number; make: string; model: string; trim: string; stock_number: string } | null;
  salesperson: { name: string } | null;
};

function toRow(r: RawRow): BookingRow {
  return {
    ...r,
    customer: r.customer
      ? {
          first_name: r.customer.first_name,
          last_name: r.customer.last_name,
          phone: r.customer.synthetic_phone,
          email: r.customer.synthetic_email,
        }
      : null,
    vehicle: r.vehicle
      ? {
          name: `${r.vehicle.year} ${r.vehicle.make} ${r.vehicle.model} ${r.vehicle.trim}`.trim(),
          stock_number: r.vehicle.stock_number,
        }
      : null,
    salesperson: r.salesperson,
  };
}

/**
 * One page of appointments. Search, filters, sort and paging all run in Postgres.
 * Search understands IDs (APT-, VEH-, CUST-, a bare number) and otherwise matches the
 * customer's name, phone or email.
 */
export async function listBookings(
  filters: BookingFilters,
  range?: { from: number; to: number },
): Promise<Paged<BookingRow>> {
  const supabase = await createClient();
  const term = sanitizeTerm(filters.q);
  const upper = term.toUpperCase();
  const idSearch = /^(APT|VEH|CUST|LEAD)-?\d{1,6}$/.test(upper) || /^\d{1,6}$/.test(term);
  const customerSearch = term !== "" && !idSearch;

  let query = customerSearch
    ? supabase.from("appointments").select(SELECT_CUSTOMER_SEARCH, { count: "exact" })
    : supabase.from("appointments").select(SELECT, { count: "exact" });

  if (idSearch) {
    const digits = upper.replace(/\D/g, "");
    if (upper.startsWith("VEH")) query = query.ilike("vehicle_id", `%${digits}`);
    else if (upper.startsWith("CUST")) query = query.ilike("customer_id", `%${digits}`);
    else if (upper.startsWith("LEAD")) query = query.ilike("lead_id", `%${digits}`);
    else query = query.ilike("appointment_id", `%${digits}`);
  } else if (customerSearch) {
    // Every word must match one of the customer's fields.
    for (const word of term.split(" ").slice(0, 4)) {
      query = query.or(
        `first_name.ilike.%${word}%,last_name.ilike.%${word}%,synthetic_phone.ilike.%${word}%,synthetic_email.ilike.%${word}%`,
        { referencedTable: "customer" },
      );
    }
  }

  if (filters.status) query = query.eq("status", filters.status);
  if (filters.type) query = query.eq("appointment_type", filters.type);
  if (filters.from) query = query.gte("appointment_date", filters.from);
  if (filters.to) query = query.lte("appointment_date", filters.to);

  const ascending = filters.dir === "asc";
  query = query.order(filters.sort, { ascending });
  if (filters.sort === "appointment_date") query = query.order("appointment_time", { ascending });
  query = query.order("appointment_id", { ascending: true });

  const start = range?.from ?? (filters.page - 1) * filters.pageSize;
  const end = range?.to ?? start + filters.pageSize - 1;
  const { data, count, error } = await query.range(start, end);

  if (error) {
    if (error.code === "PGRST103") return { rows: [], total: count ?? 0, error: null };
    console.error("[admin] bookings list failed:", error.message);
    return { rows: [], total: 0, error: "Bookings could not be loaded." };
  }
  return { rows: (data as unknown as RawRow[]).map(toRow), total: count ?? 0, error: null };
}

export type SalespersonOption = { id: string; name: string; active: boolean };

export async function listSalespeople(): Promise<SalespersonOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("salespeople")
    .select("salesperson_id, name, active")
    .order("name");
  if (error) console.error("[admin] salespeople list failed:", error.message);
  return (data ?? []).map((s) => ({ id: s.salesperson_id, name: s.name, active: s.active }));
}

/** Active test drives in the next `days` days, soonest first. Dates are dealership-local. */
export async function listUpcomingTestDrives(fromDate: string, toDate: string, limit = 8): Promise<BookingRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("appointments")
    .select(SELECT)
    .eq("appointment_type", "Test Drive")
    .in("status", ["Requested", "Confirmed", "Rescheduled"])
    .gte("appointment_date", fromDate)
    .lte("appointment_date", toDate)
    .order("appointment_date", { ascending: true })
    .order("appointment_time", { ascending: true })
    .limit(limit);
  if (error) {
    console.error("[admin] upcoming test drives failed:", error.message);
    return [];
  }
  return (data as unknown as RawRow[]).map(toRow);
}

/** Most recently created bookings, newest first. */
export async function listRecentBookings(limit = 6): Promise<BookingRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("appointments")
    .select(SELECT)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("[admin] recent bookings failed:", error.message);
    return [];
  }
  return (data as unknown as RawRow[]).map(toRow);
}
