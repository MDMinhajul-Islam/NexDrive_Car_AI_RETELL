"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { CUSTOMER_ID_REGEX, normalizeUsPhone } from "@/lib/validations/common";
import { customerSchema, type CustomerInput } from "@/lib/validations/customer";
import type { ActionResult } from "@/app/actions/admin/bookings";

/**
 * Updates a customer. The schema mirrors the table's check constraints (state TX,
 * +1-XXX-XXX-XXXX phone, budget ranges, fixed lists), so most problems are caught
 * before the database is asked. Customers are created by the booking flows, not here.
 */
export async function updateCustomer(id: string, input: CustomerInput): Promise<ActionResult> {
  await requireAdmin();
  if (!CUSTOMER_ID_REGEX.test(id)) return { ok: false, message: "Unknown customer." };

  const parsed = customerSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "");
      if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { ok: false, message: "Please check the highlighted fields.", fieldErrors };
  }
  const v = parsed.data;
  const phone = normalizeUsPhone(v.synthetic_phone);
  if (!phone) {
    return {
      ok: false,
      message: "Please check the highlighted fields.",
      fieldErrors: { synthetic_phone: "Enter a 10-digit US phone number" },
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customers")
    .update({
      ...v,
      synthetic_phone: phone,
      synthetic_email: v.synthetic_email ? v.synthetic_email.toLowerCase() : null,
      city: v.city || null,
      preferred_brand: v.preferred_brand || null,
      updated_at: new Date().toISOString(),
    })
    .eq("customer_id", id)
    .select("customer_id");

  if (error) {
    console.error("[admin] customer update failed:", error.message);
    if (error.code === "23505") {
      return {
        ok: false,
        message: "Another customer already uses that phone number or email.",
        fieldErrors: /email/i.test(error.message)
          ? { synthetic_email: "Already used by another customer" }
          : { synthetic_phone: "Already used by another customer" },
      };
    }
    if (error.code === "23514") {
      return { ok: false, message: "One of the values breaks a customer rule. Check budget and down payment." };
    }
    return { ok: false, message: "The customer could not be saved." };
  }
  if (!data?.length) return { ok: false, message: "That customer no longer exists." };

  revalidatePath("/admin/customers");
  revalidatePath("/admin/bookings");
  return { ok: true, message: `Customer ${id} updated.` };
}
