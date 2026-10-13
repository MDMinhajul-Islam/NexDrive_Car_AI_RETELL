import "server-only";

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export type TurnstileResult = { ok: true } | { ok: false; message: string };

/**
 * Verifies a Cloudflare Turnstile token with Cloudflare. Call before any database work.
 *
 * - Production without TURNSTILE_SECRET_KEY fails closed: forms are rejected.
 * - Development without the key skips verification so local work is not blocked.
 */
export async function verifyTurnstile(token: string | undefined, ip: string): Promise<TurnstileResult> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      console.error("[turnstile] TURNSTILE_SECRET_KEY is not set; rejecting submission.");
      return { ok: false, message: "Spam protection is not configured. Please call us instead." };
    }
    return { ok: true };
  }
  if (!token) return { ok: false, message: "Please complete the verification check and try again." };

  try {
    const body = new URLSearchParams({ secret, response: token });
    if (ip !== "unknown") body.set("remoteip", ip);
    const res = await fetch(VERIFY_URL, {
      method: "POST",
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    const data = (await res.json()) as { success?: boolean; "error-codes"?: string[] };
    if (data.success === true) return { ok: true };
    console.warn("[turnstile] verification failed:", (data["error-codes"] ?? []).join(", "));
    return { ok: false, message: "Verification expired or failed. Please complete the check again." };
  } catch (err) {
    console.error("[turnstile] verification request failed:", err instanceof Error ? err.message : err);
    return { ok: false, message: "We could not verify your request. Please try again in a moment." };
  }
}
