import { z } from "zod";

/** customers.synthetic_phone check: ^\+1-[0-9]{3}-[0-9]{3}-[0-9]{4}$ */
export const PHONE_DB_REGEX = /^\+1-[0-9]{3}-[0-9]{3}-[0-9]{4}$/;
/** customers.synthetic_email check */
export const EMAIL_DB_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

/**
 * Turns anything a person might type for a US number into +1-XXX-XXX-XXXX,
 * the only format the database accepts. Returns null when it cannot.
 */
export function normalizeUsPhone(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  const ten = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (ten.length !== 10) return null;
  return `+1-${ten.slice(0, 3)}-${ten.slice(3, 6)}-${ten.slice(6)}`;
}

export const phoneField = z
  .string()
  .trim()
  .min(1, "Phone number is required")
  .refine((v) => normalizeUsPhone(v) !== null, "Enter a 10-digit US phone number");

export const emailField = z
  .string()
  .trim()
  .min(1, "Email is required")
  .max(254, "Email is too long")
  .regex(EMAIL_DB_REGEX, "Enter a valid email address");

export const nameField = (label: string) =>
  z.string().trim().min(1, `${label} is required`).max(60, `${label} is too long`);

export const VEHICLE_ID_REGEX = /^VEH-[0-9]{6}$/;
export const CUSTOMER_ID_REGEX = /^CUST-[0-9]{6}$/;
export const LEAD_ID_REGEX = /^LEAD-[0-9]{6}$/;
export const SALESPERSON_ID_REGEX = /^SP-[0-9]{3}$/;
export const APPOINTMENT_ID_REGEX = /^APT-[0-9]{6}$/;
export const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
/** 30-minute slot boundaries only, as the booking functions require. */
export const SLOT_TIME_REGEX = /^([01]\d|2[0-3]):(00|30)(:00)?$/;
