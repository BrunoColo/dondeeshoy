import { NextRequest, NextResponse } from "next/server";
import { redis } from "@/lib/redis";

/**
 * GET /api/events/trending?date=YYYY-MM-DD&limit=5
 * Returns top trending event IDs from Redis sorted set
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const date = searchParams.get("date") ?? new Date().toISOString().slice(0, 10);
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "5"), 20);

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

    return NextResponse.json({ ok: true, data: trending });
  } catch (error) {
    console.error("[API /events/trending] Error:", error);
    return NextResponse.json({ ok: true, data: [] });
  }
}
