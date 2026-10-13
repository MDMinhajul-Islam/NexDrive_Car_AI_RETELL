import "server-only";
import { headers } from "next/headers";

/**
 * Best-effort client IP for rate limiting and Turnstile.
 *
 * Order matters, because a client can send any header it likes:
 *   1. X-Real-IP, which Dokploy's proxy (Traefik) sets to the connecting address
 *      and overwrites if the client supplied its own.
 *   2. The first X-Forwarded-For entry, which the proxy also rewrites.
 *   3. CF-Connecting-IP, ONLY when TRUST_CLOUDFLARE_IP=true. Set that when the site
 *      sits behind Cloudflare; otherwise a caller could forge this header to get a
 *      fresh rate-limit bucket on every request.
 * Run directly on the internet with no proxy, all of these are client-controlled.
 */
export async function getClientIp(): Promise<string> {
  const h = await headers();
  const candidates = [
    process.env.TRUST_CLOUDFLARE_IP === "true" ? h.get("cf-connecting-ip") : null,
    h.get("x-real-ip"),
    h.get("x-forwarded-for")?.split(",")[0],
  ];
  for (const value of candidates) {
    const ip = value?.trim();
    if (ip && ip.length <= 64 && /^[0-9a-fA-F:.]+$/.test(ip)) return ip;
  }
  return "unknown";
}
