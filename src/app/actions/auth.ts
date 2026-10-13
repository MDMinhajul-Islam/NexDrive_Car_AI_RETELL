"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loginSchema, type LoginInput } from "@/lib/validations/auth";

export type LoginResult = { ok: false; message: string } | undefined;

/** Only same-site /admin paths are accepted as a post-login destination. */
function safeNext(next: string | undefined) {
  return next && /^\/admin(\/[\w\-/]*)?$/.test(next) && next !== "/admin/login" ? next : "/admin/dashboard";
}

export async function signIn(input: LoginInput, next?: string): Promise<LoginResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Enter your email and password." };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error || !data.user) {
    return { ok: false, message: "Incorrect email or password." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .maybeSingle();
  if (profile?.role !== "admin") {
    await supabase.auth.signOut();
    return { ok: false, message: "This account does not have admin access." };
  }

  revalidatePath("/admin", "layout");
  redirect(safeNext(next));
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/admin", "layout");
  redirect("/admin/login");
}
