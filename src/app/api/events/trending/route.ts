import { NextRequest, NextResponse } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { redis } from "@/lib/redis";
import { getClientIp } from "@/lib/rate-limit";

const trendingRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(60, "1 m"),
  analytics: true,
  prefix: "rl:trending",
});

/**
 * GET /api/events/trending?date=YYYY-MM-DD&limit=5
 * Returns top trending event IDs from Redis sorted set
 */
export async function GET(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const { success, limit: rlLimit, remaining, reset } = await trendingRateLimit.limit(ip);
    if (!success) {
      return NextResponse.json(
        { ok: false, error: "Demasiadas solicitudes" },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil((reset - Date.now()) / 1000)),
            "X-RateLimit-Limit": String(rlLimit),
            "X-RateLimit-Remaining": String(remaining),
            "X-RateLimit-Reset": String(reset),
            "Cache-Control": "no-store",
          },
        },
      );
    }

    const { searchParams } = request.nextUrl;
    const date = searchParams.get("date") ?? new Date().toISOString().slice(0, 10);
    const rawLimit = Number.parseInt(searchParams.get("limit") ?? "5", 10);
    const limit = Number.isNaN(rawLimit) ? 5 : Math.min(Math.max(rawLimit, 1), 20);

    const trendingKey = `trending:daily:${date}`;

    // Get top N event IDs with scores, sorted by score (views) DESC
    const results = await redis.zrange(trendingKey, 0, limit - 1, { rev: true, withScores: true });

    // Parse results into { eventId, views } pairs
    const trending: { eventId: string; views: number }[] = [];
    for (let i = 0; i < results.length; i += 2) {
      trending.push({
        eventId: results[i] as string,
        views: results[i + 1] as number,
      });
    }

    return NextResponse.json(
      { ok: true, data: trending },
      {
        headers: {
          "X-RateLimit-Limit": String(rlLimit),
          "X-RateLimit-Remaining": String(remaining),
          "Cache-Control": "s-maxage=60, stale-while-revalidate=300",
        },
      },
    );
  } catch (error) {
    console.error("[API /events/trending] Error:", error);
    return NextResponse.json(
      { ok: true, data: [] },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }
}
