import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/env";

const LOGIN_PATH = "/admin/login";

/**
 * Refreshes the Supabase session and guards every /admin route.
 * Only users whose profiles.role is 'admin' get through.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // getUser() validates the JWT with Supabase; never trust getSession() here.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isLogin = pathname === LOGIN_PATH;

  const redirectTo = (path: string, params?: Record<string, string>) => {
    const url = request.nextUrl.clone();
    url.pathname = path;
    url.search = "";
    Object.entries(params ?? {}).forEach(([k, v]) => url.searchParams.set(k, v));
    const redirect = NextResponse.redirect(url);
    // Carry over any refreshed auth cookies.
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    return redirect;
  };

  if (!user) {
    if (isLogin) return response;
    return redirectTo(LOGIN_PATH, { next: pathname });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  const isAdmin = profile?.role === "admin";

  if (isLogin) {
    return isAdmin ? redirectTo("/admin/dashboard") : response;
  }
  if (!isAdmin) {
    return redirectTo(LOGIN_PATH, { error: "not_admin" });
  }
  return response;
}
