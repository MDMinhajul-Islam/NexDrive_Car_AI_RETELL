"use server";

import { revalidatePath } from "next/cache";
import { createPublicClient } from "@/lib/supabase/server";
import { SITE } from "@/lib/constants";
import { RATE_LIMITS, rateLimit, retryMessage } from "@/lib/security/rate-limit";
import { getClientIp } from "@/lib/security/request";
import { verifyTurnstile } from "@/lib/security/turnstile";
import { contactSchema, type ContactInput } from "@/lib/validations/contact";
import { normalizeUsPhone } from "@/lib/validations/common";

export type ContactResult =
  | { ok: true }
  | { ok: false; message: string; fieldErrors?: Partial<Record<keyof ContactInput, string>> };

export async function sendContactMessage(input: ContactInput): Promise<ContactResult> {
  const ip = await getClientIp();
  const limited = rateLimit(RATE_LIMITS.contact, ip);
  if (!limited.allowed) return { ok: false, message: retryMessage(limited.retryAfterSeconds) };

  const parsed = contactSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Partial<Record<keyof ContactInput, string>> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as keyof ContactInput | undefined;
      if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { ok: false, message: "Please check the highlighted fields.", fieldErrors };
  }
  const v = parsed.data;

  // Spam check happens before any database call.
  const human = await verifyTurnstile(v.turnstileToken, ip);
  if (!human.ok) return { ok: false, message: human.message, fieldErrors: { turnstileToken: human.message } };

  const supabase = createPublicClient();
  // No .select(): the public role may insert but not read messages back.
  const { error } = await supabase.from("contact_messages").insert({
    name: v.name,
    email: v.email,
    phone: v.phone ? normalizeUsPhone(v.phone) : null,
    subject: v.subject || null,
    message: v.message,
  });
  if (error) {
    console.error("[contact] insert failed:", error.message);
    return {
      ok: false,
      message: `We could not send your message. Please call us at ${SITE.phoneDisplay} or email ${SITE.email}.`,
    };
  }
  revalidatePath("/admin/dashboard");
  return { ok: true };
}
