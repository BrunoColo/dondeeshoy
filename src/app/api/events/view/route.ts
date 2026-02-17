import { NextRequest, NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import { incrementViewCount } from "@/lib/queries";

/**
 * POST /api/events/view
 * Track a page view for an event. Uses Redis for real-time trending
 * and increments the DB view_count for persistence.
 *
 * Body: { eventId: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { eventId } = body;

    if (!eventId || typeof eventId !== "string") {
      return NextResponse.json(
        { ok: false, error: "eventId requerido" },
        { status: 400 },
      );
    }

    // Get today's date for the daily trending key
    const today = new Date().toISOString().slice(0, 10);
    const trendingKey = `trending:daily:${today}`;

    // Fire both in parallel — Redis for real-time trending, DB for persistence
    await Promise.all([
      redis.zincrby(trendingKey, 1, eventId),
      incrementViewCount(eventId),
    ]);

    // Set TTL on trending key (48h expiry to auto-cleanup)
    await redis.expire(trendingKey, 60 * 60 * 48);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[API /events/view] Error:", error);
    // Don't fail the user experience for analytics errors
    return NextResponse.json({ ok: true });
  }
}
