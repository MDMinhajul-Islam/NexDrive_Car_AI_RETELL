import { z } from "zod";
import {
  emailField,
  ISO_DATE_REGEX,
  nameField,
  phoneField,
  SALESPERSON_ID_REGEX,
  SLOT_TIME_REGEX,
  VEHICLE_ID_REGEX,
} from "@/lib/validations/common";

export const bookingSchema = z.object({
  firstName: nameField("First name"),
  lastName: nameField("Last name"),
  email: emailField,
  phone: phoneField,
  vehicleId: z.string().regex(VEHICLE_ID_REGEX, "Choose a vehicle"),
  date: z.string().regex(ISO_DATE_REGEX, "Choose a date"),
  time: z.string().regex(SLOT_TIME_REGEX, "Choose a time"),
  salespersonId: z.string().regex(SALESPERSON_ID_REGEX, "Choose a time"),
  message: z.string().trim().max(1000, "Keep your message under 1,000 characters"),
  /** Honeypot. Real visitors never fill this in. */
  company: z.string().max(0),
  /** Cloudflare Turnstile token; verified in the Server Action. */
  turnstileToken: z.string().max(4096),
});

export type BookingInput = z.infer<typeof bookingSchema>;
