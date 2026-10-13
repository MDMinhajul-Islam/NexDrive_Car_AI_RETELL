import { NextResponse, type NextRequest } from "next/server";
import { listBookings, parseBookingFilters, type BookingRow } from "@/lib/data/admin/bookings";
import { formatDateTime, todayInDealershipTz } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const BATCH = 1000; // PostgREST returns at most 1,000 rows per request
const MAX_ROWS = 20_000;

/** Quotes a CSV cell and neutralises spreadsheet formula injection. */
function cell(value: string | null | undefined) {
  let text = value ?? "";
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

const HEADER = [
  "Booking ID",
  "Date",
  "Time (US Central)",
  "Status",
  "Type",
  "Customer",
  "Phone",
  "Email",
  "Vehicle",
  "Stock number",
  "Salesperson",
  "Source",
  "Booked on (US Central)",
  "Notes",
];

function line(b: BookingRow) {
  return [
    b.appointment_id,
    b.appointment_date,
    b.appointment_time.slice(0, 5),
    b.status,
    b.appointment_type,
    b.customer ? `${b.customer.first_name} ${b.customer.last_name}`.trim() : b.customer_id,
    b.customer?.phone,
    b.customer?.email,
    b.vehicle?.name ?? b.vehicle_id,
    b.vehicle?.stock_number,
    b.salesperson?.name ?? b.salesperson_id,
    b.created_by,
    formatDateTime(b.created_at),
    b.notes,
  ]
    .map(cell)
    .join(",");
}

/** CSV of every booking matching the current filters. Admins only. */
export async function GET(request: NextRequest) {
  // The middleware already guards /admin; this is the route's own check.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") return new NextResponse("Forbidden", { status: 403 });

  const filters = parseBookingFilters(Object.fromEntries(request.nextUrl.searchParams));
  const lines = [HEADER.map(cell).join(",")];
  for (let from = 0; from < MAX_ROWS; from += BATCH) {
    const { rows, error } = await listBookings(filters, { from, to: from + BATCH - 1 });
    if (error) return new NextResponse("Export failed", { status: 500 });
    for (const row of rows) lines.push(line(row));
    if (rows.length < BATCH) break;
  }

  // BOM so Excel reads UTF-8 correctly.
  return new NextResponse(`﻿${lines.join("\r\n")}\r\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="nexdrive-bookings-${todayInDealershipTz()}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
