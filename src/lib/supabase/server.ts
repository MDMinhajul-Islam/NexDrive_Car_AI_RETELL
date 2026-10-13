import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient as createPlainClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/env";

/** Server client bound to the request cookies (the signed-in user's session). */
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component: cookies are read-only there.
          // The middleware refreshes the session, so this is safe to ignore.
        }
      },
    },
  });
}

/**
 * Cookie-less anon client for public catalogue reads and public RPCs.
 * Keeps public pages cacheable and never carries a user session.
 */
export function createPublicClient() {
  return createPlainClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

/**
 * Anon client that also presents the website booking key. The key comes from the
 * server-only env var WEBSITE_BOOKING_KEY and is checked inside Postgres by
 * private.require_website_booking_key(). Never import this from client code.
 */
export function createWebsiteBookingClient() {
  const key = process.env.WEBSITE_BOOKING_KEY;
  if (!key) return null;
  return createPlainClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { "x-nexdrive-website-key": key } },
  });
}
