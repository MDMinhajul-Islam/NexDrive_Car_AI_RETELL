import { type NextRequest } from "next/server";
import { RATE_LIMITS, rateLimit, retryMessage } from "@/lib/security/rate-limit";
import { getClientIp } from "@/lib/security/request";
import { isTurnstileEnabled, verifyTurnstile } from "@/lib/security/turnstile";

/**
 * Creates a Retell web call for the "Talk to our AI assistant" button.
 *
 * Server-only: RETELL_API_KEY and RETELL_AGENT_ID never leave this file. The browser
 * receives just what the Retell browser SDK needs to join one call: a short-lived
 * access token, the call ID, and the connection details (transport and ICE servers)
 * that Retell's v3 endpoint returns alongside the token.
 *
 * Every call costs money, so three checks run BEFORE Retell is contacted:
 *   1. the request must come from this site (same-origin Origin header)
 *   2. per-IP rate limit (3 calls per 10 minutes)
 *   3. Cloudflare Turnstile, when it is enabled
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const RETELL_CREATE_WEB_CALL_URL = "https://api.retellai.com/v3/create-web-call";

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } });

function isConfigured() {
  return Boolean(process.env.RETELL_API_KEY && process.env.RETELL_AGENT_ID);
}

/**
 * True when the Origin header names this site. Browsers always send Origin on a
 * cross-site POST and cannot be made to forge it, so this blocks other websites from
 * spending our call budget. Requests with no Origin at all (curl, scripts) are refused.
 */
function isSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  let originHost: string;
  try {
    originHost = new URL(origin).host.toLowerCase();
  } catch {
    return false;
  }
  const allowed = new Set<string>();
  // Behind Dokploy's proxy the public host arrives in X-Forwarded-Host.
  for (const value of [request.headers.get("x-forwarded-host"), request.headers.get("host")]) {
    const host = value?.split(",")[0]?.trim().toLowerCase();
    if (host) allowed.add(host);
  }
  try {
    if (process.env.NEXT_PUBLIC_SITE_URL) allowed.add(new URL(process.env.NEXT_PUBLIC_SITE_URL).host.toLowerCase());
  } catch {
    // ignore a malformed site URL
  }
  return allowed.has(originHost);
}

/** Tells the call panel what to show before a call is attempted. Reveals no secrets. */
export function GET() {
  return json({ available: isConfigured(), turnstile: isConfigured() && isTurnstileEnabled() });
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return json({ error: "forbidden", message: "This request is not allowed." }, 403);
  }

  const ip = await getClientIp();
  const limited = rateLimit(RATE_LIMITS.webCall, ip);
  if (!limited.allowed) {
    return json(
      { error: "rate_limited", message: retryMessage(limited.retryAfterSeconds) },
      429,
      { "Retry-After": String(limited.retryAfterSeconds) },
    );
  }

  let turnstileToken: string | undefined;
  let page = "/";
  try {
    const body: unknown = await request.json();
    if (body && typeof body === "object") {
      const b = body as Record<string, unknown>;
      if (typeof b.turnstileToken === "string") turnstileToken = b.turnstileToken.slice(0, 4096);
      if (typeof b.page === "string" && /^\/[\w\-/]{0,120}$/.test(b.page)) page = b.page;
    }
  } catch {
    // An empty or invalid body is fine: both fields are optional.
  }

  const human = await verifyTurnstile(turnstileToken, ip);
  if (!human.ok) return json({ error: "verification_failed", message: human.message }, 400);

  const apiKey = process.env.RETELL_API_KEY;
  const agentId = process.env.RETELL_AGENT_ID;
  if (!apiKey || !agentId) {
    console.error("[retell] RETELL_API_KEY or RETELL_AGENT_ID is not set.");
    return json({ error: "unavailable", message: "The voice assistant is not available right now." }, 503);
  }

  try {
    const upstream = await fetch(RETELL_CREATE_WEB_CALL_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        agent_id: agentId,
        // Stored on the call record so website calls can be told apart from phone calls.
        metadata: { source: "website", channel: "web_call", page },
        // Available to the agent's prompt as {{source}} and {{channel}}. Values must be strings.
        retell_llm_dynamic_variables: { source: "website", channel: "web_call" },
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });

    if (!upstream.ok) {
      // Log the status only: the response body may echo request details.
      console.error("[retell] create-web-call failed with status", upstream.status);
      return json({ error: "unavailable", message: "The voice assistant is not available right now." }, 502);
    }

    const data = (await upstream.json()) as Record<string, unknown>;
    if (typeof data.access_token !== "string" || typeof data.call_id !== "string") {
      console.error("[retell] create-web-call returned an unexpected response shape.");
      return json({ error: "unavailable", message: "The voice assistant is not available right now." }, 502);
    }

    // Only the fields the browser SDK needs to join this one call.
    return json({
      accessToken: data.access_token,
      callId: data.call_id,
      transport: data.transport === "gateway" || data.transport === "livekit" ? data.transport : undefined,
      iceServers: Array.isArray(data.ice_servers) ? data.ice_servers : undefined,
      url: typeof data.url === "string" ? data.url : undefined,
    });
  } catch (err) {
    console.error("[retell] create-web-call request failed:", err instanceof Error ? err.name : "unknown error");
    return json({ error: "unavailable", message: "The voice assistant is not available right now." }, 502);
  }
}
