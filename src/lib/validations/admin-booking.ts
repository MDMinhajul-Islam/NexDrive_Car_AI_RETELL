import { z } from "zod";
import { APPOINTMENT_STATUSES, APPOINTMENT_TYPES } from "@/lib/constants";
import {
  APPOINTMENT_ID_REGEX,
  CUSTOMER_ID_REGEX,
  ISO_DATE_REGEX,
  SALESPERSON_ID_REGEX,
  SLOT_TIME_REGEX,
  VEHICLE_ID_REGEX,
} from "@/lib/validations/common";

const shared = {
  salespersonId: z.string().regex(SALESPERSON_ID_REGEX, "Choose a salesperson"),
  date: z.string().regex(ISO_DATE_REGEX, "Choose a date"),
  time: z.string().regex(SLOT_TIME_REGEX, "Choose a time on the hour or half hour"),
  type: z.enum(APPOINTMENT_TYPES, { message: "Choose a type" }),
  status: z.enum(APPOINTMENT_STATUSES, { message: "Choose a status" }),
  notes: z.string().trim().max(4000, "Notes are too long"),
};

export const createBookingSchema = z.object({
  ...shared,
  customerId: z.string().regex(CUSTOMER_ID_REGEX, "Choose a customer"),
  vehicleId: z.string().regex(VEHICLE_ID_REGEX, "Choose a vehicle"),
  /** appointments.created_by: staff-created bookings may only use these two values. */
  createdBy: z.enum(["Customer Service", "Salesperson"]),
});
export type CreateBookingInput = z.infer<typeof createBookingSchema>;

export const updateBookingSchema = z.object(shared);
export type UpdateBookingInput = z.infer<typeof updateBookingSchema>;

export const bookingIdsSchema = z.array(z.string().regex(APPOINTMENT_ID_REGEX)).min(1).max(200);
export const bookingStatusSchema = z.enum(APPOINTMENT_STATUSES);
