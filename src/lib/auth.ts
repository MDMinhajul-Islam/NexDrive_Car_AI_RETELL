import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type AdminUser = { id: string; email: string; fullName: string | null };

/**
 * Second line of defence behind the middleware: every admin page and every admin
 * Server Action calls this. RLS in the database is the third.
 */
export const requireAdmin = cache(async (): Promise<AdminUser> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "admin") redirect("/admin/login?error=not_admin");

  return { id: user.id, email: user.email ?? "", fullName: profile.full_name };
});
