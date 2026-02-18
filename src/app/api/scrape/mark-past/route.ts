import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { events } from "@/lib/db/schema/events";
import { and, eq, lt } from "drizzle-orm";
import { isCronAuthorized, acquireCronLock, releaseCronLock, getNoStoreHeaders } from "@/lib/security";
import { getTodayUY } from "@/lib/format";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const lock = await acquireCronLock("mark-past", 120);
  if (!lock) {
    return NextResponse.json(
      { skipped: true, reason: "Another instance is running" },
      { status: 200, headers: getNoStoreHeaders() },
    );
  }

  try {
    const today = getTodayUY();

    // Mark all active non-recurring events whose date is before today as 'past'
    const result = await db
      .update(events)
      .set({ status: "past" })
      .where(
        and(
          eq(events.status, "active"),
          eq(events.isRecurring, false),
          lt(events.date, today),
        ),
      )
      .returning({ id: events.id });

    return NextResponse.json(
      {
        success: true,
        markedPast: result.length,
        date: today,
      },
      { headers: getNoStoreHeaders() },
    );
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to mark past events", details: String(error) },
      { status: 500, headers: getNoStoreHeaders() },
    );
  } finally {
    await releaseCronLock(lock);
  }
}
