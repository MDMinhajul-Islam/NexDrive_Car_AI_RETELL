"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { sanitizeTerm } from "@/lib/admin/table-params";
import { formatDate, formatTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import {
  bookingIdsSchema,
  bookingStatusSchema,
  createBookingSchema,
  updateBookingSchema,
  type CreateBookingInput,
  type UpdateBookingInput,
} from "@/lib/validations/admin-booking";
import { APPOINTMENT_ID_REGEX } from "@/lib/validations/common";
import type { Json } from "@/types/database";

export type ActionResult<T = undefined> =
  | { ok: true; message: string; data?: T }
  | { ok: false; message: string; fieldErrors?: Record<string, string> };

export type PickerOption = { id: string; label: string; detail: string };

type JsonObject = { [key: string]: Json | undefined };
const isObject = (v: unknown): v is JsonObject => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown) => (typeof v === "string" ? v : null);

function fieldErrors(issues: { path: PropertyKey[]; message: string }[]) {
  const out: Record<string, string> = {};
  for (const issue of issues) {
    const key = String(issue.path[0] ?? "");
    if (key && !out[key]) out[key] = issue.message;
  }
  return out;
}

function revalidate() {
  revalidatePath("/admin/bookings");
  revalidatePath("/admin/dashboard");
}

/** Wording for staff. Codes come from admin_create_appointment (07_fixes.sql). */
function createErrorMessage(code: string | null, payload: unknown) {
  const existing = isObject(payload) ? payload.existing_appointment : undefined;
  const when =
    isObject(existing) && str(existing.appointment_date) && str(existing.appointment_time)
      ? ` (${str(existing.appointment_id)} on ${formatDate(str(existing.appointment_date))} at ${formatTime(str(existing.appointment_time))}, ${str(existing.status)})`
      : "";
  switch (code) {
    case "UPCOMING_APPOINTMENT_EXISTS":
      return `This customer already has an upcoming appointment${when}. Edit or cancel that one first.`;
    case "LEAD_ALREADY_HAS_BOOKING":
      return `That lead already has an appointment${when}.`;
    case "SLOT_UNAVAILABLE":
      return "That salesperson already has an appointment at this time.";
    case "VEHICLE_SLOT_UNAVAILABLE":
      return "That vehicle is already scheduled for this time.";
    case "CUSTOMER_NOT_FOUND":
      return "The customer could not be found.";
    case "INVALID_BOOKING_REFERENCE":
      return "The customer, vehicle or salesperson could not be found.";
    case "INVALID_APPOINTMENT_TIME":
    case "MISSING_APPOINTMENT_TIME":
      return "Choose a valid date and a time on the hour or half hour.";
    case "INVALID_BOOKING_DATA":
      return "The appointment type or status is not allowed.";
    default:
      return "The booking could not be created.";
  }
}

/** Postgres errors that can come back from a direct update of appointments. */
function updateErrorMessage(error: { code?: string; message: string }) {
  if (error.code === "23505") {
    return "That salesperson already has an active appointment at this date and time.";
  }
  if (error.code === "23514") return "One of the values is not allowed for an appointment.";
  if (error.code === "23503") return "The selected salesperson could not be found.";
  if (error.code === "42501") return "You do not have permission to change bookings.";
  return "The booking could not be saved.";
}

export async function createBooking(input: CreateBookingInput): Promise<ActionResult<{ id: string }>> {
  await requireAdmin();
  const parsed = createBookingSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Please check the highlighted fields.", fieldErrors: fieldErrors(parsed.error.issues) };
  }
  const v = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_create_appointment", {
    p_request: {
      customer_id: v.customerId,
      vehicle_id: v.vehicleId,
      salesperson_id: v.salespersonId,
      appointment_date: v.date,
      appointment_time: v.time.length === 5 ? `${v.time}:00` : v.time,
      appointment_type: v.type,
      status: v.status,
      created_by: v.createdBy,
      notes: v.notes,
    },
  });
  if (error) {
    console.error("[admin] admin_create_appointment failed:", error.message);
    return { ok: false, message: "The booking could not be created." };
  }
  if (!isObject(data) || data.success !== true) {
    return { ok: false, message: createErrorMessage(isObject(data) ? str(data.error_code) : null, data) };
  }
  const id = isObject(data.appointment) ? (str(data.appointment.appointment_id) ?? "") : "";
  revalidate();
  return { ok: true, message: `Booking ${id} created.`, data: { id } };
}

export async function updateBooking(id: string, input: UpdateBookingInput): Promise<ActionResult> {
  await requireAdmin();
  if (!APPOINTMENT_ID_REGEX.test(id)) return { ok: false, message: "Unknown booking." };
  const parsed = updateBookingSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Please check the highlighted fields.", fieldErrors: fieldErrors(parsed.error.issues) };
  }
  const v = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("appointments")
    .update({
      appointment_date: v.date,
      appointment_time: v.time.length === 5 ? `${v.time}:00` : v.time,
      appointment_type: v.type,
      status: v.status,
      salesperson_id: v.salespersonId,
      notes: v.notes,
      updated_at: new Date().toISOString(),
    })
    .eq("appointment_id", id)
    .select("appointment_id");
  if (error) {
    console.error("[admin] booking update failed:", error.message);
    return { ok: false, message: updateErrorMessage(error) };
  }
  if (!data?.length) return { ok: false, message: "That booking no longer exists." };
  revalidate();
  return { ok: true, message: `Booking ${id} updated.` };
}

/** Quick and bulk status change. Cancelling is a status change: bookings are never deleted. */
export async function setBookingStatus(ids: string[], status: string): Promise<ActionResult> {
  await requireAdmin();
  const parsedIds = bookingIdsSchema.safeParse(ids);
  const parsedStatus = bookingStatusSchema.safeParse(status);
  if (!parsedIds.success || !parsedStatus.success) return { ok: false, message: "Invalid request." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("appointments")
    .update({ status: parsedStatus.data, updated_at: new Date().toISOString() })
    .in("appointment_id", parsedIds.data)
    .select("appointment_id");
  if (error) {
    console.error("[admin] booking status update failed:", error.message);
    return {
      ok: false,
      message:
        error.code === "23505"
          ? "Not changed: one of these bookings would clash with another active appointment for the same salesperson and time."
          : updateErrorMessage(error),
    };
  }
  const count = data?.length ?? 0;
  if (count === 0) return { ok: false, message: "No bookings were changed." };
  revalidate();
  return {
    ok: true,
    message: count === 1 ? `Booking marked ${parsedStatus.data}.` : `${count} bookings marked ${parsedStatus.data}.`,
  };
}

/** Customer typeahead for the booking form. Server-side search, at most 8 rows. */
export async function searchCustomers(term: string): Promise<PickerOption[]> {
  await requireAdmin();
  const clean = sanitizeTerm(String(term ?? "")).slice(0, 60);
  const supabase = await createClient();
  let query = supabase
    .from("customers")
    .select("customer_id, first_name, last_name, synthetic_phone, synthetic_email");
  if (/^CUST-?\d{1,6}$/i.test(clean)) {
    query = query.ilike("customer_id", `%${clean.replace(/\D/g, "")}`);
  } else {
    for (const word of clean.split(" ").filter(Boolean).slice(0, 4)) {
      query = query.or(
        `first_name.ilike.%${word}%,last_name.ilike.%${word}%,synthetic_phone.ilike.%${word}%,synthetic_email.ilike.%${word}%`,
      );
    }
  }
  const { data, error } = await query.order("updated_at", { ascending: false }).limit(8);
  if (error) console.error("[admin] customer search failed:", error.message);
  return (data ?? []).map((c) => ({
    id: c.customer_id,
    label: `${c.first_name} ${c.last_name}`.trim(),
    detail: [c.synthetic_phone, c.synthetic_email, c.customer_id].filter(Boolean).join(" · "),
  }));
}

/** Vehicle typeahead for the booking form. Staff may book any vehicle that is not sold. */
export async function searchVehicles(term: string): Promise<PickerOption[]> {
  await requireAdmin();
  const clean = sanitizeTerm(String(term ?? "")).slice(0, 60);
  const supabase = await createClient();
  let query = supabase
    .from("vehicles")
    .select("vehicle_id, year, make, model, trim, stock_number, vehicle_status")
    .neq("vehicle_status", "Sold");
  if (/^(VEH|NX)-?\d{1,6}$/i.test(clean)) {
    query = query.ilike("vehicle_id", `%${clean.replace(/\D/g, "")}`);
  } else {
    for (const word of clean.split(" ").filter(Boolean).slice(0, 5)) {
      const numeric = /^\d{4}$/.test(word) ? `,year.eq.${word}` : "";
      query = query.or(
        `make.ilike.%${word}%,model.ilike.%${word}%,trim.ilike.%${word}%,stock_number.ilike.%${word}%${numeric}`,
      );
    }
  }
  const { data, error } = await query.order("year", { ascending: false }).order("vehicle_id").limit(8);
  if (error) console.error("[admin] vehicle search failed:", error.message);
  return (data ?? []).map((v) => ({
    id: v.vehicle_id,
    label: `${v.year} ${v.make} ${v.model} ${v.trim}`.trim(),
    detail: `${v.stock_number} · ${v.vehicle_status}`,
  }));
}
