"use server";

import { revalidatePath } from "next/cache";
import { createPublicClient, createWebsiteBookingClient } from "@/lib/supabase/server";
import { RATE_LIMITS, rateLimit, retryMessage } from "@/lib/security/rate-limit";
import { getClientIp } from "@/lib/security/request";
import { verifyTurnstile } from "@/lib/security/turnstile";
import { SITE } from "@/lib/constants";
import { addDays, formatDate, formatTime, timeInDealershipTz, todayInDealershipTz } from "@/lib/format";
import { bookingSchema, type BookingInput } from "@/lib/validations/booking";
import { ISO_DATE_REGEX, normalizeUsPhone, VEHICLE_ID_REGEX } from "@/lib/validations/common";
import type { Json } from "@/types/database";

export type Slot = {
  time: string; // HH:MM:SS
  label: string; // 2:30 PM
  salespersonId: string;
  salespersonName: string;
};

export type SlotsResult = { ok: true; slots: Slot[] } | { ok: false; message: string };

export type BookingResult =
  | {
      ok: true;
      confirmation: { id: string; date: string; time: string; vehicle: string; status: string };
    }
  | { ok: false; message: string; fieldErrors?: Partial<Record<keyof BookingInput, string>> };

export type VehicleOption = { id: string; name: string; price: number; location: string };

const MAX_DAYS_AHEAD = 60;
const CALL_US = `Please call us at ${SITE.phoneDisplay} and we will sort it out.`;

type JsonObject = { [key: string]: Json | undefined };
const isObject = (v: unknown): v is JsonObject => typeof v === "object" && v !== null && !Array.isArray(v);

/** The existing functions nest their payload differently; look a few levels deep. */
function findString(value: unknown, key: string, depth = 0): string | null {
  if (!isObject(value) || depth > 3) return null;
  const direct = value[key];
  if (typeof direct === "string" && direct) return direct;
  for (const child of Object.values(value)) {
    const found = findString(child, key, depth + 1);
    if (found) return found;
  }
  return null;
}

function rpcFailed(value: unknown) {
  return isObject(value) && value.success === false;
}

/** Customer-facing wording for every error code the booking functions can return. */
function friendlyBookingError(code: string | null, existing?: { date: string | null; time: string | null }) {
  switch (code) {
    case "UPCOMING_APPOINTMENT_EXISTS":
    case "EXISTING_APPOINTMENT_CONFLICT":
    case "LEAD_ALREADY_HAS_BOOKING": {
      const when =
        existing?.date && existing?.time
          ? ` on ${formatDate(existing.date)} at ${formatTime(existing.time)} (US Central)`
          : "";
      return `You already have an upcoming appointment${when}. To change it or add another, call ${SITE.phoneDisplay} and we will take care of it.`;
    }
    case "APPOINTMENT_SLOT_UNAVAILABLE":
    case "SLOT_UNAVAILABLE":
    case "VEHICLE_SLOT_UNAVAILABLE":
    case "BOOKING_CONFLICT":
      return "That time was just taken. Please choose another time.";
    case "VEHICLE_NOT_AVAILABLE_FOR_TEST_DRIVE":
    case "VEHICLE_UNAVAILABLE":
    case "TEST_DRIVE_NOT_AVAILABLE":
    case "VEHICLE_NOT_AVAILABLE":
    case "VEHICLE_NOT_FOUND":
      return "This vehicle is no longer available for test drives. Please choose another vehicle.";
    case "OUTSIDE_SALESPERSON_SHIFT":
    case "SALESPERSON_UNAVAILABLE":
    case "SALESPERSON_INACTIVE":
    case "SALESPERSON_NOT_FOUND":
    case "SALESPERSON_NOT_WORKING":
      return "That time is no longer offered. Please choose another time.";
    case "PAST_APPOINTMENT_DATE":
    case "APPOINTMENT_IN_PAST":
    case "INVALID_APPOINTMENT_TIME":
      return "Please choose a future date and one of the listed times.";
    default:
      return `We could not complete your booking. ${CALL_US}`;
  }
}

function validateDateWindow(date: string, time?: string): string | null {
  const today = todayInDealershipTz();
  if (date < today) return "Please choose a date that is not in the past.";
  if (date > addDays(today, MAX_DAYS_AHEAD)) return `Please choose a date within the next ${MAX_DAYS_AHEAD} days.`;
  if (time && date === today && time.slice(0, 5) <= timeInDealershipTz()) {
    return "That time has already passed today. Please choose a later time.";
  }
  return null;
}

/** Open test-drive slots for a vehicle on a date (dealership time, America/Chicago). */
export async function getAvailableSlots(vehicleId: string, date: string): Promise<SlotsResult> {
  if (!VEHICLE_ID_REGEX.test(vehicleId) || !ISO_DATE_REGEX.test(date)) {
    return { ok: false, message: "Choose a vehicle and a date first." };
  }
  const limited = rateLimit(RATE_LIMITS.slots, await getClientIp());
  if (!limited.allowed) return { ok: false, message: retryMessage(limited.retryAfterSeconds) };
  const windowError = validateDateWindow(date);
  if (windowError) return { ok: false, message: windowError };

  const supabase = createPublicClient();
  const { data, error } = await supabase.rpc("get_test_drive_slots", {
    p_vehicle_id: vehicleId,
    p_appointment_date: date,
  });
  if (error) {
    console.error("[booking] get_test_drive_slots failed:", error.message);
    return { ok: false, message: `We could not load available times. ${CALL_US}` };
  }
  if (rpcFailed(data)) {
    return { ok: false, message: friendlyBookingError(findString(data, "error_code")) };
  }

  const payload = isObject(data) && isObject(data.data) ? data.data : data;
  const rawSlots = isObject(payload) && Array.isArray(payload.slots) ? payload.slots : [];
  const today = todayInDealershipTz();
  const nowTime = timeInDealershipTz();

  // Several salespeople can share a time; offer each time once.
  const byTime = new Map<string, Slot>();
  for (const raw of rawSlots) {
    if (!isObject(raw)) continue;
    const time = typeof raw.appointment_time === "string" ? raw.appointment_time : null;
    const salespersonId = typeof raw.salesperson_id === "string" ? raw.salesperson_id : null;
    if (!time || !salespersonId || byTime.has(time)) continue;
    if (date === today && time.slice(0, 5) <= nowTime) continue;
    byTime.set(time, {
      time,
      label: formatTime(time),
      salespersonId,
      salespersonName: typeof raw.salesperson_name === "string" ? raw.salesperson_name : "",
    });
  }
  return { ok: true, slots: [...byTime.values()].sort((a, b) => a.time.localeCompare(b.time)) };
}

/** Typeahead for the vehicle picker. Server-side search; returns at most 8 rows. */
export async function searchBookableVehicles(term: string): Promise<VehicleOption[]> {
  if (typeof term !== "string") return [];
  if (!rateLimit(RATE_LIMITS.vehicleSearch, await getClientIp()).allowed) return [];
  const clean = term.replace(/[^\p{L}\p{N}\s-]/gu, " ").replace(/\s+/g, " ").trim().slice(0, 60);
  const supabase = createPublicClient();
  let query = supabase
    .from("vehicles")
    .select("vehicle_id, year, make, model, trim, sale_price, dealership_location")
    .eq("test_drive_available", true)
    // get_test_drive_slots only returns times for vehicles whose status is exactly Available.
    .eq("vehicle_status", "Available");
  for (const word of clean.split(" ").filter(Boolean).slice(0, 5)) {
    const numeric = /^\d{4}$/.test(word) ? `,year.eq.${word}` : "";
    query = query.or(
      `make.ilike.%${word}%,model.ilike.%${word}%,trim.ilike.%${word}%,stock_number.ilike.%${word}%${numeric}`,
    );
  }
  const { data, error } = await query.order("year", { ascending: false }).order("vehicle_id").limit(8);
  if (error) {
    console.error("[booking] vehicle search failed:", error.message);
    return [];
  }
  return (data ?? []).map((v) => ({
    id: v.vehicle_id,
    name: `${v.year} ${v.make} ${v.model} ${v.trim}`.trim(),
    price: v.sale_price,
    location: v.dealership_location,
  }));
}

/**
 * Books a test drive from the website.
 * Runs only on the server. Steps:
 *   0. per-IP rate limit, input validation, Cloudflare Turnstile (all before any DB call)
 *   1. resolve_or_create_customer_website
 *   2. upsert_lead_website
 *   3. create_test_drive_website   (status 'Requested', created_by 'Website')
 * All three require the server-only website key, sent as a request header.
 */
export async function bookTestDrive(input: BookingInput): Promise<BookingResult> {
  const ip = await getClientIp();
  const limited = rateLimit(RATE_LIMITS.booking, ip);
  if (!limited.allowed) return { ok: false, message: retryMessage(limited.retryAfterSeconds) };

  const parsed = bookingSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Partial<Record<keyof BookingInput, string>> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as keyof BookingInput | undefined;
      if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { ok: false, message: "Please check the highlighted fields.", fieldErrors };
  }
  const v = parsed.data;
  const phone = normalizeUsPhone(v.phone);
  if (!phone) {
    return { ok: false, message: "Please check the highlighted fields.", fieldErrors: { phone: "Enter a 10-digit US phone number" } };
  }
  const time = v.time.length === 5 ? `${v.time}:00` : v.time;
  const windowError = validateDateWindow(v.date, time);
  if (windowError) return { ok: false, message: windowError, fieldErrors: { date: windowError } };

  const generic: BookingResult = { ok: false, message: `We could not complete your booking. ${CALL_US}` };

  const human = await verifyTurnstile(v.turnstileToken, ip);
  if (!human.ok) return { ok: false, message: human.message, fieldErrors: { turnstileToken: human.message } };

  const keyed = createWebsiteBookingClient();
  if (!keyed) {
    console.error("[booking] WEBSITE_BOOKING_KEY is not set; cannot create website bookings.");
    return generic;
  }
  const supabase = createPublicClient();

  // 1. Customer (website version: checks the website key, not the Retell key)
  const customer = await keyed.rpc("resolve_or_create_customer_website", {
    p_first_name: v.firstName,
    p_last_name: v.lastName,
    p_phone: phone,
    p_email: v.email,
  });
  const customerId = findString(customer.data, "customer_id");
  if (customer.error || rpcFailed(customer.data) || !customerId) {
    const code = findString(customer.data, "error_code");
    console.error("[booking] resolve_or_create_customer_website failed:", customer.error?.message ?? code ?? "no customer_id");
    if (code === "EMAIL_IN_USE" || code === "CUSTOMER_CONFLICT") {
      const message = `That email is already on file with a different phone number. Use the phone number you gave us before, or call ${SITE.phoneDisplay}.`;
      return { ok: false, message, fieldErrors: { email: message } };
    }
    if (code === "INVALID_PHONE") {
      return { ok: false, message: "Please check the highlighted fields.", fieldErrors: { phone: "Enter a 10-digit US phone number" } };
    }
    if (code === "INVALID_EMAIL") {
      return { ok: false, message: "Please check the highlighted fields.", fieldErrors: { email: "Enter a valid email address" } };
    }
    return generic;
  }

  // 2. Lead (website version)
  const lead = await keyed.rpc("upsert_lead_website", {
    p_request: {
      customer_id: customerId,
      vehicle_interest: v.vehicleId,
      assigned_salesperson: v.salespersonId,
    },
  });
  const leadId = findString(lead.data, "lead_id");
  if (lead.error || rpcFailed(lead.data) || !leadId) {
    const code = findString(lead.data, "error_code");
    console.error("[booking] upsert_lead_website failed:", lead.error?.message ?? code ?? "no lead_id");
    if (code === "UPCOMING_APPOINTMENT_EXISTS") {
      // The customer's open lead already has a Requested, Confirmed or Rescheduled appointment.
      const existing = isObject(lead.data) ? lead.data.existing_appointment : undefined;
      return {
        ok: false,
        message: friendlyBookingError(code, {
          date: findString(existing, "appointment_date"),
          time: findString(existing, "appointment_time"),
        }),
      };
    }
    if (code === "SALESPERSON_NOT_FOUND" || code === "VEHICLE_NOT_FOUND") {
      return { ok: false, message: friendlyBookingError(code) };
    }
    return generic;
  }

  // 3. Appointment
  const booking = await keyed.rpc("create_test_drive_website", {
    p_request: {
      lead_id: leadId,
      customer_id: customerId,
      vehicle_id: v.vehicleId,
      salesperson_id: v.salespersonId,
      appointment_date: v.date,
      appointment_time: time,
      notes: v.message,
    },
  });
  if (booking.error) {
    console.error("[booking] create_test_drive_website failed:", booking.error.message);
    return generic;
  }
  if (rpcFailed(booking.data)) {
    const code = findString(booking.data, "error_code");
    const existing = isObject(booking.data) ? booking.data.existing_appointment : undefined;
    return {
      ok: false,
      message: friendlyBookingError(code, {
        date: findString(existing, "appointment_date"),
        time: findString(existing, "appointment_time"),
      }),
    };
  }

  const vehicle = await supabase
    .from("vehicles")
    .select("year, make, model, trim")
    .eq("vehicle_id", v.vehicleId)
    .maybeSingle();

  revalidatePath("/admin/bookings");
  revalidatePath("/admin/dashboard");

  return {
    ok: true,
    confirmation: {
      // create_test_drive_website returns the same flat shape as create_test_drive.
      id: findString(booking.data, "booking_id") ?? "",
      date: findString(booking.data, "appointment_date") ?? v.date,
      time: findString(booking.data, "appointment_time") ?? time,
      status: findString(booking.data, "status") ?? "Requested",
      vehicle: vehicle.data
        ? `${vehicle.data.year} ${vehicle.data.make} ${vehicle.data.model} ${vehicle.data.trim}`.trim()
        : "your selected vehicle",
    },
  };
}
