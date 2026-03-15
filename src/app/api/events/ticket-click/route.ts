import { NextRequest, NextResponse } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { redis } from "@/lib/redis";
import { getClientIp } from "@/lib/rate-limit";

const clickRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(20, "1 m"),
  analytics: true,
  prefix: "rl:ticket-click",
});

function getUruguayDateKey(now: Date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Montevideo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    return now.toISOString().slice(0, 10);
  }

  return `${year}-${month}-${day}`;
}

/**
 * POST /api/events/ticket-click
 * Track clicks on external ticket/purchase links per event.
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

    const ip = getClientIp(request);
    const { success, limit, remaining, reset } = await clickRateLimit.limit(`${ip}:${eventId}`);

    if (!success) {
      return NextResponse.json(
        { ok: false, error: "Demasiados clicks en poco tiempo" },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil((reset - Date.now()) / 1000)),
            "X-RateLimit-Limit": String(limit),
            "X-RateLimit-Remaining": String(remaining),
            "X-RateLimit-Reset": String(reset),
            "Cache-Control": "no-store",
          },
        },
      );
    }

    const todayKey = getUruguayDateKey();
    const clicksDailyKey = `traffic:ticket-clicks:daily:${todayKey}`;

    await Promise.all([
      redis.zincrby(clicksDailyKey, 1, eventId),
      redis.expire(clicksDailyKey, 60 * 60 * 24 * 9),
    ]);

    return NextResponse.json(
      { ok: true },
      {
        headers: {
          "X-RateLimit-Limit": String(limit),
          "X-RateLimit-Remaining": String(remaining),
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    console.error("[API /events/ticket-click] Error:", error);
    return NextResponse.json({ ok: true });
  }
}
