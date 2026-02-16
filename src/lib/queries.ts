import "server-only";

import { db } from "@/lib/db";
import { events } from "@/lib/db/schema/events";
import { eq, and, gte, lte, asc } from "drizzle-orm";

/**
 * Get all active events for a specific date
 */
export async function getEventsByDate(date: string) {
  return db
    .select()
    .from(events)
    .where(
      and(
        eq(events.date, date),
        eq(events.status, "active"),
      ),
    )
    .orderBy(asc(events.startTime), asc(events.name));
}

/**
 * Get all active events between two dates (inclusive)
 */
export async function getEventsBetweenDates(startDate: string, endDate: string) {
  return db
    .select()
    .from(events)
    .where(
      and(
        gte(events.date, startDate),
        lte(events.date, endDate),
        eq(events.status, "active"),
      ),
    )
    .orderBy(asc(events.date), asc(events.startTime), asc(events.name));
}

/**
 * Get a single event by slug
 */
export async function getEventBySlug(slug: string) {
  const results = await db
    .select()
    .from(events)
    .where(eq(events.slug, slug))
    .limit(1);

  return results[0] ?? null;
}

/**
 * Get total count of active events for today (used for header indicator)
 */
export async function getEventCountForDate(date: string) {
  const results = await db
    .select()
    .from(events)
    .where(
      and(
        eq(events.date, date),
        eq(events.status, "active"),
      ),
    );
  return results.length;
}

/**
 * Get upcoming events grouped by date
 * Returns events from tomorrow up to `daysAhead` days
 */
export async function getUpcomingEvents(startDate: string, daysAhead: number = 7) {
  const endDate = getOffsetDate(startDate, daysAhead);

  const results = await db
    .select()
    .from(events)
    .where(
      and(
        gte(events.date, startDate),
        lte(events.date, endDate),
        eq(events.status, "active"),
      ),
    )
    .orderBy(asc(events.date), asc(events.startTime), asc(events.name));

  // Group by date
  const grouped = new Map<string, typeof results>();
  for (const event of results) {
    const date = event.date;
    if (!grouped.has(date)) {
      grouped.set(date, []);
    }
    grouped.get(date)!.push(event);
  }

  return grouped;
}

function getOffsetDate(dateStr: string, days: number): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
