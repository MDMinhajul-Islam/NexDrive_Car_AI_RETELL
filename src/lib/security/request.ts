import "server-only";
import { headers } from "next/headers";

/**
 * Best-effort client IP for rate limiting and Turnstile. Behind Dokploy (Traefik)
 * or Cloudflare the real address arrives in a forwarding header.
 */
export async function getClientIp(): Promise<string> {
  const h = await headers();
  const candidates = [
    h.get("cf-connecting-ip"),
    h.get("x-real-ip"),
    h.get("x-forwarded-for")?.split(",")[0],
  ];
  for (const value of candidates) {
    const ip = value?.trim();
    if (ip && ip.length <= 64 && /^[0-9a-fA-F:.]+$/.test(ip)) return ip;
  }
  return "unknown";
}
