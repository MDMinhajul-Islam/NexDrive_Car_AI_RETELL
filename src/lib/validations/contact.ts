import { z } from "zod";
import { emailField, normalizeUsPhone } from "@/lib/validations/common";

export const contactSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120, "Name is too long"),
  email: emailField,
  phone: z
    .string()
    .trim()
    .refine((v) => v === "" || normalizeUsPhone(v) !== null, "Enter a 10-digit US phone number"),
  subject: z.string().trim().max(200, "Subject is too long"),
  message: z
    .string()
    .trim()
    .min(10, "Tell us a little more so we can help")
    .max(4000, "Keep your message under 4,000 characters"),
  company: z.string().max(0),
});

export type ContactInput = z.infer<typeof contactSchema>;
