import "server-only";

import { db } from "@/lib/db";
import { events } from "@/lib/db/schema/events";
import { eq, and, gte, lte, asc, desc, sql, ilike, or, isNotNull } from "drizzle-orm";
import type { EventType, EventFilters } from "@/types/events";

/* ─── Columns used by list/card views (skip heavy/unused fields) ─── */
const listColumns = {
  id: events.id,
  name: events.name,
  slug: events.slug,
  date: events.date,
  startTime: events.startTime,
  endTime: events.endTime,
  venueName: events.venueName,
  venueAddress: events.venueAddress,
  latitude: events.latitude,
  longitude: events.longitude,
  city: events.city,
  eventType: events.eventType,
  musicGenre: events.musicGenre,
  imageUrl: events.imageUrl,
  ticketUrl: events.ticketUrl,
  priceMin: events.priceMin,
  priceMax: events.priceMax,
  currency: events.currency,
  isFree: events.isFree,
  ageRestriction: events.ageRestriction,
  confidenceScore: events.confidenceScore,
  viewCount: events.viewCount,
  isRecurring: events.isRecurring,
  status: events.status,
  createdAt: events.createdAt,
  updatedAt: events.updatedAt,
  description: events.description,
} as const;

/* ─── Base conditions ─── */
const activeStatus = eq(events.status, "active");

/* ─── Filter builder ─── */
function buildFilterConditions(filters?: EventFilters) {
  const conditions = [];

  if (filters?.type) {
    conditions.push(eq(events.eventType, filters.type));
  }
  if (filters?.genre) {
    conditions.push(eq(events.musicGenre, filters.genre));
  }
  if (filters?.department && filters.department.trim().length > 0) {
    // Use ilike for case-insensitive matching to handle accent/case variations
    // stored in the DB (e.g. "San José" vs "San Jose")
    conditions.push(ilike(events.city, filters.department.trim()));
  }
  if (filters?.free) {
    conditions.push(eq(events.isFree, true));
  }
  if (filters?.recurring === true) {
    conditions.push(eq(events.isRecurring, true));
  } else if (filters?.recurring === false) {
    conditions.push(eq(events.isRecurring, false));
  }
  if (filters?.q && filters.q.trim().length > 0) {
    const query = filters.q.trim();
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

/* ═══════════════════════════════════════════════════════════════════
   Combined filter-options query (genres + types + departments in ONE
   round-trip instead of three separate queries)
   ═══════════════════════════════════════════════════════════════════ */
export interface FilterOptions {
  genres: string[];
  types: EventType[];
  departments: string[];
}

export async function getFilterOptions(date?: string, dateRange?: { start: string; end: string }): Promise<FilterOptions> {
  let dateCondition = sql`TRUE`;
  if (dateRange) {
    dateCondition = sql`${events.date} >= ${dateRange.start} AND ${events.date} <= ${dateRange.end}`;
  } else if (date) {
    dateCondition = sql`${events.date} = ${date}`;
  }

  const rows = await db.execute<{
    music_genre: string | null;
    event_type: EventType;
    city: string;
  }>(sql`
    SELECT DISTINCT music_genre, event_type, city
    FROM events
    WHERE status = 'active' AND (${dateCondition})
  `);

  const genreSet = new Set<string>();
  const typeSet = new Set<EventType>();
  const deptSet = new Set<string>();

  for (const row of rows) {
    if (row.music_genre && row.music_genre.trim()) genreSet.add(row.music_genre);
    if (row.event_type) typeSet.add(row.event_type);
    if (row.city && row.city.trim()) deptSet.add(row.city);
  }

  return {
    genres: [...genreSet].sort(),
    types: [...typeSet],
    departments: [...deptSet].sort((a, b) => a.localeCompare(b, "es")),
  };
}

/* ═══════════════════════════════════════════════════════════════════
   Event queries
   ═══════════════════════════════════════════════════════════════════ */

/**
 * Get all active events for a specific date, with optional filters
 */
export async function getEventsByDate(date: string, filters?: EventFilters) {
  const filterConditions = buildFilterConditions(filters);

  return db
    .select(listColumns)
    .from(events)
    .where(and(eq(events.date, date), activeStatus, ...filterConditions))
    .orderBy(desc(events.viewCount), asc(events.startTime), asc(events.name));
}

/**
 * Get all active events between two dates (inclusive), with optional filters
 */
export async function getEventsBetweenDates(startDate: string, endDate: string, filters?: EventFilters) {
  const filterConditions = buildFilterConditions(filters);

  return db
    .select(listColumns)
    .from(events)
    .where(and(gte(events.date, startDate), lte(events.date, endDate), activeStatus, ...filterConditions))
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
 * Get total count of active events for a date (uses COUNT instead of fetching all rows)
 */
export async function getEventCountForDate(date: string) {
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(events)
    .where(and(eq(events.date, date), activeStatus));

  return Number(result[0]?.count ?? 0);
}

/**
 * Get upcoming events grouped by date, with optional filters
 */
export async function getUpcomingEvents(startDate: string, daysAhead: number = 7, filters?: EventFilters) {
  const endDate = getOffsetDate(startDate, daysAhead);
  const filterConditions = buildFilterConditions(filters);

  const results = await db
    .select(listColumns)
    .from(events)
    .where(and(gte(events.date, startDate), lte(events.date, endDate), activeStatus, ...filterConditions))
    .orderBy(asc(events.date), desc(events.viewCount), asc(events.startTime), asc(events.name));

  // Group by date
  const grouped = new Map<string, typeof results>();
  for (const event of results) {
    const d = event.date;
    if (!grouped.has(d)) grouped.set(d, []);
    grouped.get(d)!.push(event);
  }

  return grouped;
}

/**
 * Legacy wrappers for pages that still call individual filter queries
 */
export async function getActiveGenres(date?: string) {
  const opts = await getFilterOptions(date);
  return opts.genres;
}

export async function getActiveEventTypes(date?: string) {
  const opts = await getFilterOptions(date);
  return opts.types;
}

export async function getActiveDepartments(date?: string) {
  const opts = await getFilterOptions(date);
  return opts.departments;
}

/**
 * Search events across all active events with text query + filters
 */
export async function searchEvents(filters: EventFilters, limit: number = 50) {
  const filterConditions = buildFilterConditions(filters);

  return db
    .select(listColumns)
    .from(events)
    .where(and(activeStatus, ...filterConditions))
    .orderBy(desc(events.viewCount), asc(events.date), asc(events.startTime))
    .limit(limit);
}

/**
 * Get trending events (most viewed) for a date — excludes recurring events.
 * Requires at least 3 views to avoid showing barely-seen events as "most searched".
 */
export async function getTrendingEvents(date: string, limit: number = 5) {
  return db
    .select(listColumns)
    .from(events)
    .where(and(eq(events.date, date), activeStatus, gte(events.viewCount, 3), eq(events.isRecurring, false)))
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
    activeStatus,
    isNotNull(events.latitude),
    isNotNull(events.longitude),
  ];
  if (date) {
    conditions.push(eq(events.date, date));
  }

  return db
    .select(listColumns)
    .from(events)
    .where(and(...conditions))
    .orderBy(asc(events.date), asc(events.startTime));
}

/* ─── Helpers ─── */
function getOffsetDate(dateStr: string, days: number): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const d = new Date(year, month - 1, day);
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}
