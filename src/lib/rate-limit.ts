import "server-only";

import { Ratelimit } from "@upstash/ratelimit";
import { redis } from "@/lib/redis";

/**
 * Public API rate limiter — 30 requests per minute per IP.
 * Uses sliding window algorithm to prevent burst scraping.
 */
export const apiRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(30, "1 m"),
  analytics: true,
  prefix: "rl:api",
});

/**
 * Extract the real client IP from the request, respecting Vercel/proxy headers.
 */
export function getClientIp(request: Request): string {
  const headers = request.headers;
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headers.get("x-real-ip") ??
    "anonymous"
  );
}
