import { z } from "zod";
import {
  BUDGET_MAX,
  BUDGET_MIN,
  BUYER_PROFILES,
  CUSTOMER_VEHICLE_TYPES,
  PURCHASE_TIMELINES,
} from "@/lib/constants";
import { emailField, nameField, phoneField } from "@/lib/validations/common";

const optionalNumber = (min: number, max: number, label: string) =>
  z
    .number({ message: `${label} must be a number` })
    .min(min, `${label} must be at least ${min.toLocaleString("en-US")}`)
    .max(max, `${label} must be at most ${max.toLocaleString("en-US")}`)
    .nullable();

/**
 * Mirrors the check constraints on public.customers:
 *  - state = 'TX'
 *  - synthetic_phone ~ +1-XXX-XXX-XXXX (normalized in the Server Action)
 *  - budget_min >= 3000, budget_max >= budget_min, budget_max <= 100000
 *  - 0 <= estimated_down_payment <= budget_max, and 0 unless financing_needed
 *  - family_size between 1 and 8
 *  - preferred_vehicle_type, purchase_timeline, buyer_profile limited to fixed lists
 */
export const customerSchema = z
  .object({
    first_name: nameField("First name"),
    last_name: nameField("Last name"),
    synthetic_email: emailField.nullable(),
    synthetic_phone: phoneField,
    city: z.string().trim().max(80, "City is too long").nullable(),
    state: z.literal("TX", { message: "NexDrive serves Texas customers only (state must be TX)" }),
    budget_min: optionalNumber(BUDGET_MIN, BUDGET_MAX, "Minimum budget"),
    budget_max: optionalNumber(BUDGET_MIN, BUDGET_MAX, "Maximum budget"),
    estimated_down_payment: z
      .number({ message: "Down payment must be a number" })
      .min(0, "Down payment cannot be negative"),
    financing_needed: z.boolean().nullable(),
    trade_in: z.boolean().nullable(),
    family_size: z
      .number({ message: "Family size must be a number" })
      .int("Family size must be a whole number")
      .min(1, "Family size must be at least 1")
      .max(8, "Family size must be at most 8")
      .nullable(),
    preferred_brand: z.string().trim().max(60, "Brand is too long").nullable(),
    preferred_vehicle_type: z.enum(CUSTOMER_VEHICLE_TYPES).nullable(),
    purchase_timeline: z.enum(PURCHASE_TIMELINES).nullable(),
    buyer_profile: z.enum(BUYER_PROFILES).nullable(),
    notes: z.string().trim().max(4000, "Notes are too long"),
  })
  .superRefine((v, ctx) => {
    if (v.budget_min != null && v.budget_max != null && v.budget_max < v.budget_min) {
      ctx.addIssue({
        code: "custom",
        path: ["budget_max"],
        message: "Maximum budget must be at least the minimum budget",
      });
    }
    if (v.budget_max != null && v.estimated_down_payment > v.budget_max) {
      ctx.addIssue({
        code: "custom",
        path: ["estimated_down_payment"],
        message: "Down payment cannot exceed the maximum budget",
      });
    }
    if (v.estimated_down_payment > 0 && v.financing_needed !== true) {
      ctx.addIssue({
        code: "custom",
        path: ["estimated_down_payment"],
        message: "A down payment is only allowed when financing is needed",
      });
    }
  });

export type CustomerInput = z.infer<typeof customerSchema>;
