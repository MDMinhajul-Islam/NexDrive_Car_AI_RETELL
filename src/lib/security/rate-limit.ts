import "server-only";

/**
 * Simple per-IP sliding-window rate limiter, held in process memory.
 * Suits a single container (the Dokploy setup in the README). If you scale to
 * several replicas, move this to a shared store such as Redis.
 */
type Bucket = number[]; // request timestamps (ms), oldest first

const buckets = new Map<string, Bucket>();
const MAX_KEYS = 20_000;
let lastSweep = 0;

function sweep(now: number, longestWindowMs: number) {
  if (now - lastSweep < 60_000 && buckets.size < MAX_KEYS) return;
  lastSweep = now;
  for (const [key, stamps] of buckets) {
    if (stamps.length === 0 || now - stamps[stamps.length - 1] > longestWindowMs) buckets.delete(key);
  }
  // Hard cap so a flood of unique addresses cannot grow memory without bound.
  if (buckets.size > MAX_KEYS) {
    let excess = buckets.size - MAX_KEYS;
    for (const key of buckets.keys()) {
      if (excess-- <= 0) break;
      buckets.delete(key);
    }
  }
}

export type RateLimitRule = { name: string; limit: number; windowMs: number };

export const RATE_LIMITS = {
  booking: { name: "booking", limit: 5, windowMs: 10 * 60_000 },
  contact: { name: "contact", limit: 5, windowMs: 10 * 60_000 },
  slots: { name: "slots", limit: 60, windowMs: 60_000 },
  vehicleSearch: { name: "vehicle-search", limit: 90, windowMs: 60_000 },
  login: { name: "login", limit: 10, windowMs: 10 * 60_000 },
} as const satisfies Record<string, RateLimitRule>;

export type RateLimitResult = { allowed: true } | { allowed: false; retryAfterSeconds: number };

export function rateLimit(rule: RateLimitRule, ip: string, now: number = Date.now()): RateLimitResult {
  sweep(now, 10 * 60_000);
  const key = `${rule.name}:${ip}`;
  const cutoff = now - rule.windowMs;
  const stamps = (buckets.get(key) ?? []).filter((t) => t > cutoff);

  if (stamps.length >= rule.limit) {
    buckets.set(key, stamps);
    return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((stamps[0] + rule.windowMs - now) / 1000)) };
  }
  stamps.push(now);
  buckets.set(key, stamps);
  return { allowed: true };
}

export function retryMessage(seconds: number) {
  const minutes = Math.ceil(seconds / 60);
  return `Too many attempts. Please try again in ${minutes <= 1 ? "a minute" : `${minutes} minutes`}.`;
}
