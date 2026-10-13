import { TIMEZONE } from "@/lib/constants";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});
const number = new Intl.NumberFormat("en-US");

export function formatCurrency(value: number | null | undefined) {
  return value == null ? "N/A" : currency.format(value);
}

export function formatNumber(value: number | null | undefined) {
  return value == null ? "N/A" : number.format(value);
}

export function formatMileage(value: number | null | undefined) {
  return value == null ? "N/A" : `${number.format(value)} mi`;
}

/** Today's calendar date at the dealership, as YYYY-MM-DD. */
export function todayInDealershipTz(now: Date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Current wall-clock time at the dealership, as HH:MM (24h). */
export function timeInDealershipTz(now: Date = new Date()) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(now);
}

/** Adds days to a YYYY-MM-DD string without any timezone drift. */
export function addDays(isoDate: string, days: number) {
  const [y, m, d] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
}

/**
 * Formats a DATE column (YYYY-MM-DD). The value is already dealership-local,
 * so it is rendered as-is and never shifted by the viewer's timezone.
 */
export function formatDate(
  isoDate: string | null | undefined,
  options: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric", year: "numeric" },
) {
  if (!isoDate) return "N/A";
  const [y, m, d] = isoDate.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return isoDate;
  return new Intl.DateTimeFormat("en-US", { ...options, timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, d, 12)),
  );
}

/** Formats a TIME column (HH:MM[:SS]) as 2:30 PM. Already dealership-local. */
export function formatTime(time: string | null | undefined) {
  if (!time) return "N/A";
  const [h, m] = time.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return time;
  const suffix = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${suffix}`;
}

/** Formats a timestamptz in the dealership timezone. */
export function formatDateTime(timestamp: string | null | undefined) {
  if (!timestamp) return "N/A";
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return timestamp;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function vehicleName(v: { year: number; make: string; model: string; trim?: string | null }) {
  return [v.year, v.make, v.model, v.trim].filter(Boolean).join(" ");
}
