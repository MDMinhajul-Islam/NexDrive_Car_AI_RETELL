import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/env";

/** Browser client. Uses the public anon key only; RLS decides what it can do. */
export function createClient() {
  return createBrowserClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY);
}
