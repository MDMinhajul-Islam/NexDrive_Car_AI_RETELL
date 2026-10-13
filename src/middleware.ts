import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Public pages do not need a session, so only /admin runs the middleware.
  matcher: ["/admin/:path*"],
};
