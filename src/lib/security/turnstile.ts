import "server-only";

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export type TurnstileResult = { ok: true } | { ok: false; message: string };

/**
 * Turnstile is OPTIONAL. It is on only when both keys are set:
 *   TURNSTILE_SECRET_KEY            (server, read at runtime)
 *   NEXT_PUBLIC_TURNSTILE_SITE_KEY  (public, inlined at build time)
 * With either one missing the check is skipped and the widget is hidden.
 * The per-IP rate limit and the honeypot field stay on regardless.
 */
export function isTurnstileEnabled() {
  const secret = Boolean(process.env.TURNSTILE_SECRET_KEY);
  const siteKey = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);
  if (secret && !siteKey && !warned) {
    warned = true;
    console.warn(
      "[turnstile] TURNSTILE_SECRET_KEY is set but NEXT_PUBLIC_TURNSTILE_SITE_KEY is not. " +
        "The widget cannot render, so Turnstile is OFF. Set the site key at build time to enable it.",
    );
  }
  return secret && siteKey;
}
let warned = false;

/**
 * Verifies a Cloudflare Turnstile token with Cloudflare. Call before any database work.
 * Returns ok without calling Cloudflare when Turnstile is not enabled.
 */
export async function verifyTurnstile(token: string | undefined, ip: string): Promise<TurnstileResult> {
  if (!isTurnstileEnabled()) return { ok: true };
  const secret = process.env.TURNSTILE_SECRET_KEY as string;
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
