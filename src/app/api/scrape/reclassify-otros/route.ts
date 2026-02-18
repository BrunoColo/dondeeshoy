import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";

import { db } from "@/lib/db";
import { events } from "@/lib/db/schema";
import { isCronAuthorized, acquireCronLock, releaseCronLock, getNoStoreHeaders } from "@/lib/security";
import { classifyEventWithAi } from "@/processing/ai-client";

const ALLOWED_EVENT_TYPES = new Set([
  "fiesta", "festival", "concierto", "recital", "cultural", "deportivo",
  "gastronomico", "familiar", "feria", "taller", "club", "bar", "teatro", "otro",
]);

export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: getNoStoreHeaders() });
  }

  const lock = await acquireCronLock("reclassify-otros", 300);
  if (!lock) {
    return NextResponse.json({ skipped: true, reason: "lock held" }, { headers: getNoStoreHeaders() });
  }

  try {
    const url = new URL(request.url);
    const limit = Math.min(Number.parseInt(url.searchParams.get("limit") ?? "30", 10), 50);

    const candidates = await db
      .select({
        id: events.id,
        name: events.name,
        description: events.description,
        venueName: events.venueName,
      })
      .from(events)
      .where(and(eq(events.status, "active"), eq(events.eventType, "otro")))
      .limit(limit);

    let reviewed = 0;
    let updated = 0;

    for (const event of candidates) {
      reviewed++;

      const ai = await classifyEventWithAi({
        name: event.name,
        description: event.description ?? null,
        venueName: event.venueName,
        fallbackType: "otro",
      });

      if (!ai || !ALLOWED_EVENT_TYPES.has(ai.eventType) || ai.eventType === "otro" || ai.confidence < 0.7) {
        continue;
      }

      await db
        .update(events)
        .set({
          eventType: ai.eventType,
          musicGenre: ai.musicGenre ?? null,
          updatedAt: new Date(),
        })
        .where(eq(events.id, event.id));

      updated++;
      console.info(`[reclassify-otros] "${event.name}": otro → ${ai.eventType} (${ai.confidence.toFixed(2)})`);
    }

    console.info(`[reclassify-otros] revisados=${reviewed} actualizados=${updated}`);

    return NextResponse.json({ reviewed, updated }, { headers: getNoStoreHeaders() });
  } finally {
    await releaseCronLock(lock);
  }
}
