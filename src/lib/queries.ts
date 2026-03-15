import "server-only";

import { db } from "@/lib/db";
import { events } from "@/lib/db/schema/events";
import { eq, and, gte, lte, asc, desc, sql, ilike, or, isNotNull, inArray } from "drizzle-orm";
import type { EventType, EventFilters } from "@/types/events";
import { DEPARTMENT_BOUNDS, type UruguayDepartment } from "@/processing/department-detector";
import { escapeLikePattern } from "@/lib/utils";
import {
  WEEKEND_HIGHLIGHT_LIMIT,
  WEEKEND_HIGHLIGHT_MANUAL_SLUGS,
  WEEKEND_HIGHLIGHT_TYPE_TARGETS,
} from "@/config/weekend-highlights";
import { getStoredWeekendHighlightManualSlugs } from "@/lib/weekend-highlights-store";

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
  department: events.department,
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

/**
 * Composite ranking score: 60% confidence score + 40% normalised view count.
 * LOG(viewCount + 1) / 5.0 smooths the view signal so a single viral event
 * doesn't bury everything else; dividing by 5 keeps the range sensible up to
 * ~150 views before saturating.
 */
const rankingScore = sql`(
  COALESCE(${events.confidenceScore}, 0) * 0.6
  + (LOG(COALESCE(${events.viewCount}, 0) + 1) / 5.0) * 0.4
)`;

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
    const dept = filters.department.trim() as UruguayDepartment;
    const bounds = DEPARTMENT_BOUNDS[dept];

    if (bounds) {
      // Use coordinate bounding boxes for department filtering (more reliable).
      // Fall back to text matching for events without coordinates.
      conditions.push(
        or(
          and(
            isNotNull(events.latitude),
            isNotNull(events.longitude),
            sql`CAST(${events.latitude} AS DECIMAL) >= ${bounds.minLat}`,
            sql`CAST(${events.latitude} AS DECIMAL) <= ${bounds.maxLat}`,
            sql`CAST(${events.longitude} AS DECIMAL) >= ${bounds.minLng}`,
            sql`CAST(${events.longitude} AS DECIMAL) <= ${bounds.maxLng}`,
          ),
          and(
            sql`${events.latitude} IS NULL`,
            ilike(events.department, dept),
          ),
        )!,
      );
    } else {
      // Unknown department — fall back to text matching
      conditions.push(ilike(events.department, dept));
    }
  }
  if (filters?.free) {
    conditions.push(eq(events.isFree, true));
  }
  if (filters?.night) {
    // Night events: startTime >= "20:00" or startTime is null (unknown hour, keep them)
    // We use a raw SQL comparison since startTime is stored as text "HH:MM"
    conditions.push(
      sql`(${events.startTime} IS NULL OR ${events.startTime} >= '20:00')`,
    );
  }
  if (filters?.recurring === true) {
    conditions.push(eq(events.isRecurring, true));
  } else if (filters?.recurring === false) {
    conditions.push(eq(events.isRecurring, false));
  }
  if (filters?.q && filters.q.trim().length > 0) {
    const query = escapeLikePattern(filters.q.trim());
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

export type EventOrderStrategy = "default" | "diverse";

function buildOrderByExpressions(orderStrategy: EventOrderStrategy = "default") {
  if (orderStrategy === "diverse") {
    return [
      sql`CASE WHEN ${events.isRecurring} THEN 1 ELSE 0 END`,
      sql`CASE WHEN ${events.eventType} = 'otro' THEN 1 ELSE 0 END`,
      sql`row_number() OVER (
        PARTITION BY ${events.date}, ${events.eventType}
        ORDER BY
          COALESCE(${events.confidenceScore}, 0) DESC,
          ${rankingScore} DESC,
          ${events.startTime} ASC NULLS LAST,
          ${events.name} ASC
      )`,
      desc(sql`COALESCE(${events.confidenceScore}, 0)`),
      desc(rankingScore),
      asc(events.startTime),
      asc(events.name),
    ] as const;
  }

  return [
    sql`CASE WHEN ${events.isRecurring} THEN 1 ELSE 0 END`,
    desc(rankingScore),
    asc(events.startTime),
    asc(events.name),
  ] as const;
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
    department: string;
  }>(sql`
    SELECT DISTINCT music_genre, event_type, department
    FROM events
    WHERE status = 'active' AND (${dateCondition})
  `);

  const genreSet = new Set<string>();
  const typeSet = new Set<EventType>();
  const deptSet = new Set<string>();

  for (const row of rows) {
    if (row.music_genre && row.music_genre.trim()) genreSet.add(row.music_genre);
    if (row.event_type) typeSet.add(row.event_type);
    if (row.department && row.department.trim()) deptSet.add(row.department);
  }

  // Move "fiesta" to first position in types, "Montevideo" to first position in departments
  const typesArray = [...typeSet];
  const fiestaIndex = typesArray.indexOf("fiesta");
  if (fiestaIndex > 0) {
    typesArray.splice(fiestaIndex, 1);
    typesArray.unshift("fiesta");
  }

  const departmentsArray = [...deptSet].sort((a, b) => a.localeCompare(b, "es"));
  const montevideoIndex = departmentsArray.indexOf("Montevideo");
  if (montevideoIndex > 0) {
    departmentsArray.splice(montevideoIndex, 1);
    departmentsArray.unshift("Montevideo");
  }

  return {
    genres: [...genreSet].sort(),
    types: typesArray,
    departments: departmentsArray,
  };
}

/* ═══════════════════════════════════════════════════════════════════
   Event queries
   ═══════════════════════════════════════════════════════════════════ */

/**
 * Get all active events for a specific date, with optional filters.
 * Only includes events explicitly scheduled for the requested date.
 * Recurring/open-ended listings should not be injected automatically because
 * several sources do not expose recurrence days with enough precision.
 */
export async function getEventsByDate(date: string, filters?: EventFilters) {
  const filterConditions = buildFilterConditions(filters);

  return db
    .select(listColumns)
    .from(events)
    .where(
      and(
        activeStatus,
        eq(events.date, date),
        ...filterConditions,
      ),
    )
    .orderBy(
      sql`CASE WHEN ${events.isRecurring} THEN 1 ELSE 0 END`,
      desc(rankingScore),
      asc(events.startTime),
      asc(events.name),
    );
}

/**
 * Get active events for a specific date with pagination.
 */
export async function getEventsByDatePaged(
  date: string,
  offset: number = 0,
  limit: number = 6,
  filters?: EventFilters,
  orderStrategy: EventOrderStrategy = "default",
) {
  const safeOffset = Math.max(0, offset);
  const safeLimit = Math.max(1, Math.min(limit, 100));
  const filterConditions = buildFilterConditions(filters);

  const baseQuery = db
    .select(listColumns)
    .from(events)
    .where(
      and(
        activeStatus,
        eq(events.date, date),
        ...filterConditions,
      ),
    );

  const orderByExpressions = buildOrderByExpressions(orderStrategy);
  const orderedQuery = baseQuery.orderBy(...orderByExpressions);

  return orderedQuery.limit(safeLimit).offset(safeOffset);
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
    .orderBy(asc(events.date), desc(rankingScore), asc(events.startTime), asc(events.name));
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
 * Resolve a list of event slugs into active events preserving input order.
 */
export async function getEventsBySlugs(slugs: string[]) {
  const cleaned = [...new Set(slugs.map((slug) => slug.trim().toLowerCase()).filter(Boolean))].slice(0, 100);

  if (cleaned.length === 0) {
    return [];
  }

  const rows = await db
    .select(listColumns)
    .from(events)
    .where(and(activeStatus, inArray(events.slug, cleaned)));

  const bySlug = new Map(rows.map((event) => [event.slug, event]));
  return cleaned.map((slug) => bySlug.get(slug)).filter((event): event is (typeof rows)[number] => Boolean(event));
}

/**
 * Get total count of active events for a date (uses COUNT instead of fetching all rows)
 */
export async function getEventCountForDate(date: string) {
  return getEventCountByDate(date);
}

/**
 * Get total count of active events for a date with optional filters.
 */
export async function getEventCountByDate(date: string, filters?: EventFilters) {
  const filterConditions = buildFilterConditions(filters);

  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(events)
    .where(and(eq(events.date, date), activeStatus, ...filterConditions));

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
    .orderBy(asc(events.date), desc(rankingScore), asc(events.startTime), asc(events.name));

  // Group by date
  const grouped = new Map<string, typeof results>();
  for (const event of results) {
    const d = event.date;
    if (!grouped.has(d)) grouped.set(d, []);
    grouped.get(d)!.push(event);
  }

  return grouped;
}

export interface UpcomingDayPreview {
  date: string;
  events: Awaited<ReturnType<typeof getEventsByDatePaged>>;
  totalCount: number;
}

/**
 * Get upcoming events grouped by date with a per-day cap (preview mode).
 * Useful for fast initial rendering in pages like /proximos.
 */
export async function getUpcomingEventGroupsPreview(
  startDate: string,
  daysAhead: number = 7,
  perDayLimit: number = 6,
  filters?: EventFilters,
  orderStrategy: EventOrderStrategy = "default",
): Promise<UpcomingDayPreview[]> {
  const endDate = getOffsetDate(startDate, daysAhead);
  const safeLimit = Math.max(1, Math.min(perDayLimit, 50));

  const dates: string[] = [];
  let cursor = startDate;
  while (cursor <= endDate) {
    dates.push(cursor);
    cursor = getOffsetDate(cursor, 1);
  }

  const dayResults = await Promise.all(
    dates.map(async (date) => {
      const [dayEvents, totalCount] = await Promise.all([
        getEventsByDatePaged(date, 0, safeLimit, filters, orderStrategy),
        getEventCountByDate(date, filters),
      ]);

      return {
        date,
        events: dayEvents,
        totalCount,
      };
    }),
  );

  return dayResults.filter((day) => day.totalCount > 0);
}

/**
 * Get all active future events from a date onwards, grouped by date.
 * Intended for text search flows where users expect matches regardless of
 * whether the event is tomorrow, next month, or further ahead.
 */
export async function getUpcomingEventsFromDate(startDate: string, filters?: EventFilters) {
  const filterConditions = buildFilterConditions(filters);
  const orderByExpressions = buildOrderByExpressions("diverse");

  const results = await db
    .select(listColumns)
    .from(events)
    .where(and(gte(events.date, startDate), activeStatus, ...filterConditions))
    .orderBy(asc(events.date), ...orderByExpressions);

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
 * Search events across all active events with text query + filters.
 * Supports pagination via limit + offset.
 */
export async function searchEvents(filters: EventFilters, limit: number = 50, offset: number = 0) {
  const filterConditions = buildFilterConditions(filters);

  return db
    .select(listColumns)
    .from(events)
    .where(and(activeStatus, ...filterConditions))
    .orderBy(desc(rankingScore), asc(events.date), asc(events.startTime))
    .limit(limit)
    .offset(offset);
}

export interface SearchSuggestion {
  id: string;
  slug: string;
  name: string;
  date: string;
  venueName: string;
  eventType: EventType;
}

/**
 * Lightweight suggestions for the header autocomplete.
 * Prioritises name matches first, then venue matches, then the composite ranking.
 * Only shows events from today onwards (no past events).
 */
export async function getSearchSuggestions(query: string, limit: number = 5): Promise<SearchSuggestion[]> {
  const normalized = query.trim();
  if (normalized.length < 2) return [];

  const escaped = escapeLikePattern(normalized);
  const containsPattern = `%${escaped}%`;
  const prefixPattern = `${escaped}%`;

  const today = new Date();
  const uyDate = new Date(today.toLocaleString("en-US", { timeZone: "America/Montevideo" }));
  const todayStr = `${uyDate.getFullYear()}-${String(uyDate.getMonth() + 1).padStart(2, "0")}-${String(uyDate.getDate()).padStart(2, "0")}`;

  return db
    .select({
      id: events.id,
      slug: events.slug,
      name: events.name,
      date: events.date,
      venueName: events.venueName,
      eventType: events.eventType,
    })
    .from(events)
    .where(
      and(
        activeStatus,
        gte(events.date, todayStr),
        or(
          ilike(events.name, containsPattern),
          ilike(events.venueName, containsPattern),
        )!,
      ),
    )
    .orderBy(
      sql`CASE
        WHEN ${events.name} ILIKE ${prefixPattern} THEN 0
        WHEN ${events.name} ILIKE ${containsPattern} THEN 1
        WHEN ${events.venueName} ILIKE ${prefixPattern} THEN 2
        ELSE 3
      END`,
      desc(rankingScore),
      asc(events.date),
      asc(events.startTime),
      asc(events.name),
    )
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
 * Get hourly trending events — events with >= 10 views in the current hour.
 * Uses Redis hourly sorted set for real-time tracking.
 * Returns at most `limit` events (default 3).
 */
export async function getHourlyTrendingEvents(date: string, limit: number = 3) {
  const { redis } = await import("@/lib/redis");

  // Compute current hour key in Uruguay timezone
  const now = new Date();
  const uyNow = new Date(now.toLocaleString("en-US", { timeZone: "America/Montevideo" }));
  const uyHour = `${uyNow.getFullYear()}-${String(uyNow.getMonth() + 1).padStart(2, "0")}-${String(uyNow.getDate()).padStart(2, "0")}T${String(uyNow.getHours()).padStart(2, "0")}`;
  const hourlyKey = `trending:hourly:${uyHour}`;

  // Get top entries with scores (up to 20 to have room after filtering)
  const results = await redis.zrange(hourlyKey, 0, 19, { rev: true, withScores: true });

  // Parse into pairs and filter by minimum 10 views in the hour
  const qualified: { eventId: string; views: number }[] = [];
  for (let i = 0; i < results.length; i += 2) {
    const eventId = results[i] as string;
    const views = results[i + 1] as number;
    if (views >= 10) {
      qualified.push({ eventId, views });
    }
  }

  if (qualified.length === 0) return [];

  const topIds = qualified.slice(0, limit).map((q) => q.eventId);

  // Fetch events from DB
  const eventRows = await db
    .select(listColumns)
    .from(events)
    .where(and(inArray(events.id, topIds), activeStatus, eq(events.date, date)))

  // Preserve the Redis ordering (most views first)
  const idOrder = new Map(topIds.map((id, i) => [id, i]));
  return eventRows.sort((a, b) => (idOrder.get(a.id) ?? 99) - (idOrder.get(b.id) ?? 99));
}

/**
 * Get sidebar stats: event count today, this week, and active venues
 */
export async function getSidebarStats(today: string, weekEnd: string) {
  const [todayResult, weekResult, venuesResult] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)` })
      .from(events)
      .where(and(eq(events.date, today), activeStatus)),
    db
      .select({ count: sql<number>`count(*)` })
      .from(events)
      .where(and(gte(events.date, today), lte(events.date, weekEnd), activeStatus)),
    db
      .select({ count: sql<number>`count(distinct ${events.venueName})` })
      .from(events)
      .where(and(eq(events.date, today), activeStatus)),
  ]);

  return {
    todayCount: Number(todayResult[0]?.count ?? 0),
    weekCount: Number(weekResult[0]?.count ?? 0),
    venuesCount: Number(venuesResult[0]?.count ?? 0),
  };
}

/**
 * Get upcoming highlighted events (next 3 days, top by viewCount)
 */
export async function getUpcomingHighlights(today: string, limit: number = 3) {
  const endDate = getOffsetDate(today, 3);
  return db
    .select({
      id: events.id,
      name: events.name,
      slug: events.slug,
      date: events.date,
      startTime: events.startTime,
      venueName: events.venueName,
      eventType: events.eventType,
      isFree: events.isFree,
      imageUrl: events.imageUrl,
    })
    .from(events)
    .where(
      and(
        gte(events.date, today),
        lte(events.date, endDate),
        activeStatus,
        eq(events.isRecurring, false),
      ),
    )
    .orderBy(desc(events.viewCount), asc(events.date), asc(events.startTime))
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

/**
 * Get the top-ranked weekend events (non-recurring) for the preview section.
 * Only useful Monday–Thursday; callers should check the day before invoking.
 */
export async function getWeekendHighlights(weekendStart: string, weekendEnd: string, limit: number = 6) {
  const safeLimit = Math.max(1, Math.min(limit, WEEKEND_HIGHLIGHT_LIMIT));
  const manualSlugs = await getStoredWeekendHighlightManualSlugs();

  const candidates = await db
    .select(listColumns)
    .from(events)
    .where(
      and(
        activeStatus,
        gte(events.date, weekendStart),
        lte(events.date, weekendEnd),
        eq(events.isRecurring, false),
      ),
    )
    .orderBy(desc(rankingScore), asc(events.date), asc(events.startTime))
    .limit(Math.max(safeLimit * 4, 24));

  if (candidates.length === 0) {
    return [];
  }

  const selected: Array<(typeof candidates)[number]> = [];
  const selectedIds = new Set<string>();
  const selectedTypeCounts = new Map<EventType, number>();
  const candidatesBySlug = new Map(candidates.map((candidate) => [candidate.slug, candidate]));

  const addCandidate = (candidate: (typeof candidates)[number] | undefined) => {
    if (!candidate || selectedIds.has(candidate.id) || selected.length >= safeLimit) {
      return false;
    }

    selected.push(candidate);
    selectedIds.add(candidate.id);
    selectedTypeCounts.set(candidate.eventType, (selectedTypeCounts.get(candidate.eventType) ?? 0) + 1);
    return true;
  };

  for (const slug of manualSlugs.length > 0 ? manualSlugs : WEEKEND_HIGHLIGHT_MANUAL_SLUGS) {
    addCandidate(candidatesBySlug.get(slug));
  }

  for (const target of WEEKEND_HIGHLIGHT_TYPE_TARGETS) {
    const alreadySelected = selectedTypeCounts.get(target.type) ?? 0;
    const remainingSlotsForType = Math.max(0, target.count - alreadySelected);

    if (remainingSlotsForType === 0) {
      continue;
    }

    const matches = candidates.filter((candidate) => candidate.eventType === target.type && !selectedIds.has(candidate.id));

    for (const candidate of matches.slice(0, remainingSlotsForType)) {
      addCandidate(candidate);
    }
  }

  for (const candidate of candidates) {
    if (selected.length >= safeLimit) {
      break;
    }

    addCandidate(candidate);
  }

  return selected;
}

/**
 * Count weekend events (non-recurring) for the preview badge.
 */
export async function getWeekendEventCount(weekendStart: string, weekendEnd: string) {
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(events)
    .where(
      and(
        activeStatus,
        gte(events.date, weekendStart),
        lte(events.date, weekendEnd),
        eq(events.isRecurring, false),
      ),
    );
  return Number(result[0]?.count ?? 0);
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
