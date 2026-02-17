import "server-only";

import { db } from "@/lib/db";
import { events } from "@/lib/db/schema/events";
import { eq, and, gte, lte, asc, desc, sql, ilike, or } from "drizzle-orm";
import type { EventType, EventFilters } from "@/types/events";

/**
 * Build WHERE conditions array from filters
 */
function buildFilterConditions(filters?: EventFilters) {
  const conditions = [];

  if (filters?.type) {
    conditions.push(eq(events.eventType, filters.type));
  }
  if (filters?.genre) {
    conditions.push(eq(events.musicGenre, filters.genre));
  }
  if (filters?.department && filters.department.trim().length > 0) {
    conditions.push(eq(events.city, filters.department.trim()));
  }
  if (filters?.free) {
    conditions.push(eq(events.isFree, true));
  }
  if (filters?.q && filters.q.trim().length > 0) {
    const query = filters.q.trim();
    // Use ILIKE for simple, reliable search across name, venue, description
    const pattern = `%${query}%`;
    conditions.push(
      or(
        ilike(events.name, pattern),
        ilike(events.venueName, pattern),
        ilike(events.description, pattern),
        ilike(events.musicGenre, pattern),
      )!,
    );
  }

  return conditions;
}

/**
 * Get all active events for a specific date, with optional filters
 */
export async function getEventsByDate(date: string, filters?: EventFilters) {
  const filterConditions = buildFilterConditions(filters);

  return db
    .select()
    .from(events)
    .where(
      and(
        eq(events.date, date),
        eq(events.status, "active"),
        ...filterConditions,
      ),
    )
    .orderBy(desc(events.viewCount), asc(events.startTime), asc(events.name));
}

/**
 * Get all active events between two dates (inclusive), with optional filters
 */
export async function getEventsBetweenDates(startDate: string, endDate: string, filters?: EventFilters) {
  const filterConditions = buildFilterConditions(filters);

  return db
    .select()
    .from(events)
    .where(
      and(
        gte(events.date, startDate),
        lte(events.date, endDate),
        eq(events.status, "active"),
        ...filterConditions,
      ),
    )
    .orderBy(asc(events.date), desc(events.viewCount), asc(events.startTime), asc(events.name));
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
 * Get upcoming events grouped by date, with optional filters
 */
export async function getUpcomingEvents(startDate: string, daysAhead: number = 7, filters?: EventFilters) {
  const endDate = getOffsetDate(startDate, daysAhead);
  const filterConditions = buildFilterConditions(filters);

  const results = await db
    .select()
    .from(events)
    .where(
      and(
        gte(events.date, startDate),
        lte(events.date, endDate),
        eq(events.status, "active"),
        ...filterConditions,
      ),
    )
    .orderBy(asc(events.date), desc(events.viewCount), asc(events.startTime), asc(events.name));

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

/**
 * Get the distinct music genres that have active events (for filter chips)
 */
export async function getActiveGenres(date?: string) {
  const conditions = [eq(events.status, "active")];
  if (date) {
    conditions.push(eq(events.date, date));
  }

  const results = await db
    .selectDistinct({ genre: events.musicGenre })
    .from(events)
    .where(and(...conditions));

  return results
    .map((r) => r.genre)
    .filter((g): g is string => g !== null && g.trim().length > 0)
    .sort();
}

/**
 * Get distinct event types that have active events (for filter chips)
 */
export async function getActiveEventTypes(date?: string) {
  const conditions = [eq(events.status, "active")];
  if (date) {
    conditions.push(eq(events.date, date));
  }

  const results = await db
    .selectDistinct({ type: events.eventType })
    .from(events)
    .where(and(...conditions));

  return results.map((r) => r.type);
}

/**
 * Get distinct departments/cities that have active events
 */
export async function getActiveDepartments(date?: string) {
  const conditions = [eq(events.status, "active")];
  if (date) {
    conditions.push(eq(events.date, date));
  }

  const results = await db
    .selectDistinct({ department: events.city })
    .from(events)
    .where(and(...conditions));

  return results
    .map((r) => r.department)
    .filter((d): d is string => d !== null && d.trim().length > 0)
    .sort((a, b) => a.localeCompare(b, "es"));
}

/**
 * Search events across all active events with text query + filters
 */
export async function searchEvents(filters: EventFilters, limit: number = 50) {
  const filterConditions = buildFilterConditions(filters);

  return db
    .select()
    .from(events)
    .where(
      and(
        eq(events.status, "active"),
        ...filterConditions,
      ),
    )
    .orderBy(desc(events.viewCount), asc(events.date), asc(events.startTime))
    .limit(limit);
}

/**
 * Get trending events (most viewed) for a date
 */
export async function getTrendingEvents(date: string, limit: number = 5) {
  return db
    .select()
    .from(events)
    .where(
      and(
        eq(events.date, date),
        eq(events.status, "active"),
        sql`${events.viewCount} > 0`,
      ),
    )
    .orderBy(desc(events.viewCount))
    .limit(limit);
}

/**
 * Increment view count for an event
 */
export async function incrementViewCount(eventId: string) {
  await db
    .update(events)
    .set({ viewCount: sql`${events.viewCount} + 1` })
    .where(eq(events.id, eventId));
}

/**
 * Get events that have coordinates (for map view)
 */
export async function getEventsWithCoordinates(date?: string) {
  const conditions = [
    eq(events.status, "active"),
    sql`${events.latitude} IS NOT NULL`,
    sql`${events.longitude} IS NOT NULL`,
  ];
  if (date) {
    conditions.push(eq(events.date, date));
  }

  return db
    .select()
    .from(events)
    .where(and(...conditions))
    .orderBy(asc(events.date), asc(events.startTime));
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
