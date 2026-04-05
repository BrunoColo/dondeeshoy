import "server-only";

import { db } from "@/lib/db";
import { events } from "@/lib/db/schema/events";
import { eq, and, gte, lte, asc, desc, sql, ilike, or, isNotNull, inArray } from "drizzle-orm";
import type { EventType, EventFilters } from "@/types/events";
import { DEPARTMENT_BOUNDS, type UruguayDepartment } from "@/processing/department-detector";
import { escapeLikePattern } from "@/lib/utils";
import {
  WEEKEND_HIGHLIGHT_LIMIT,
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

const SERIES_WEEKDAY_TOKEN_REGEX = "\\b(?:lunes|martes|miercoles|miércoles|jueves|viernes|sabado|sábado|domingo|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\\b";
const SERIES_DATE_TOKEN_REGEX = "\\b\\d{1,2}[./-]\\d{1,2}(?:[./-]\\d{2,4})?\\b|\\b\\d{4}\\b";
const SERIES_TIME_TOKEN_REGEX = "\\b\\d{1,2}:\\d{2}\\b";

function normalizedSeriesNameExpression(nameExpression: unknown) {
  return sql`trim(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          regexp_replace(lower(coalesce(${nameExpression}, '')), ${SERIES_WEEKDAY_TOKEN_REGEX}, ' ', 'gi'),
          ${SERIES_DATE_TOKEN_REGEX},
          ' ',
          'g'
        ),
        ${SERIES_TIME_TOKEN_REGEX},
        ' ',
        'g'
      ),
      '\\s+',
      ' ',
      'g'
    )
  )`;
}

const normalizedCurrentSeriesName = normalizedSeriesNameExpression(events.name);
const normalizedVenueName = sql`trim(lower(coalesce(${events.venueName}, '')))`;
const normalizedVenuePartitionKey = sql`(
  CASE
    WHEN ${normalizedVenueName} = '' THEN ${events.id}::text
    ELSE ${normalizedVenueName}
  END
)`;
const normalizedSeriesVenueKey = sql`(
  CASE
    WHEN ${normalizedCurrentSeriesName} = '' OR ${normalizedVenueName} = '' THEN ${events.id}::text
    ELSE ${normalizedCurrentSeriesName} || '::' || ${normalizedVenueName}
  END
)`;

const sameSeriesInWindowCount = sql`(
  SELECT COUNT(*)
  FROM events e2
  WHERE
    e2.status = 'active'
    AND e2.date >= (${events.date} - INTERVAL '45 days')::date
    AND e2.date <= (${events.date} + INTERVAL '45 days')::date
    AND ${normalizedSeriesNameExpression(sql`e2.name`)} = ${normalizedCurrentSeriesName}
    AND lower(trim(coalesce(e2.venue_name, ''))) = lower(trim(coalesce(${events.venueName}, '')))
)`;

const sameSeriesInMonthCount = sql`(
  SELECT COUNT(*)
  FROM events e3
  WHERE
    e3.status = 'active'
    AND date_trunc('month', e3.date::timestamp) = date_trunc('month', ${events.date}::timestamp)
    AND ${normalizedSeriesNameExpression(sql`e3.name`)} = ${normalizedCurrentSeriesName}
    AND lower(trim(coalesce(e3.venue_name, ''))) = lower(trim(coalesce(${events.venueName}, '')))
)`;

const eventTextForScoring = sql`lower(coalesce(${events.name}, '') || ' ' || coalesce(${events.description}, ''))`;
const descriptionLength = sql`length(trim(coalesce(${events.description}, '')))`;

const repeatedSeriesPenalty = sql`(
  CASE
    WHEN ${sameSeriesInMonthCount} >= 6 THEN 0.9
    WHEN ${sameSeriesInMonthCount} >= 4 THEN 0.55
    WHEN ${sameSeriesInMonthCount} >= 3 THEN 0.3
    WHEN ${sameSeriesInWindowCount} >= 6 THEN 0.2
    WHEN ${sameSeriesInWindowCount} >= 4 THEN 0.12
    ELSE 0
  END
)`;

/**
 * Editorial score used for selecting the "6 mejores" without exposing a score in UI.
 * Prioritizes novelty + stronger metadata while penalizing repetitive series.
 */
const editorialInterestingScore = sql`(
  ${rankingScore}
  + CASE
      WHEN ${descriptionLength} >= 320 THEN 0.18
      WHEN ${descriptionLength} >= 180 THEN 0.12
      WHEN ${descriptionLength} >= 80 THEN 0.05
      ELSE 0
    END
  + CASE WHEN ${events.startTime} IS NOT NULL THEN 0.04 ELSE 0 END
  + CASE WHEN ${events.imageUrl} IS NOT NULL THEN 0.05 ELSE 0 END
  + CASE
      WHEN ${eventTextForScoring} ~* '(halloween|noche de brujas|disfraz|terror)'
        AND (
          (EXTRACT(MONTH FROM ${events.date}) = 10 AND EXTRACT(DAY FROM ${events.date}) >= 20)
          OR (EXTRACT(MONTH FROM ${events.date}) = 11 AND EXTRACT(DAY FROM ${events.date}) <= 3)
        )
      THEN 0.5
      WHEN ${eventTextForScoring} ~* '(carnaval|tablado|murga|comparsa|llamadas)'
        AND EXTRACT(MONTH FROM ${events.date}) IN (2, 3)
      THEN 0.3
      WHEN ${eventTextForScoring} ~* '(nostalgia|ochent|novent|retro)'
        AND EXTRACT(MONTH FROM ${events.date}) = 8
        AND EXTRACT(DAY FROM ${events.date}) BETWEEN 20 AND 26
      THEN 0.35
      WHEN ${eventTextForScoring} ~* '(edici[oó]n especial|aniversario|lineup|show en vivo|live set|estreno|beneficio|especial)'
      THEN 0.18
      ELSE 0
    END
  - ${repeatedSeriesPenalty}
  - CASE WHEN ${events.eventType} = 'otro' THEN 0.15 ELSE 0 END
  - CASE WHEN ${events.startTime} IS NULL AND ${descriptionLength} < 40 THEN 0.06 ELSE 0 END
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

export type EventOrderStrategy = "default" | "diverse" | "fast-diverse";

function buildOrderByExpressions(
  orderStrategy: EventOrderStrategy = "default",
  options?: { deprioritizeMultiDaySeries?: boolean },
) {
  const seriesCount = options?.deprioritizeMultiDaySeries
    ? sameSeriesInWindowCount
    : sql`1`;

  if (orderStrategy === "diverse") {
    return [
      sql`CASE WHEN ${events.isRecurring} THEN 1 ELSE 0 END`,
      sql`CASE WHEN ${events.eventType} = 'otro' THEN 1 ELSE 0 END`,
      sql`row_number() OVER (
        PARTITION BY ${events.date}, ${events.eventType}
        ORDER BY
          ${seriesCount} ASC,
          ${editorialInterestingScore} DESC,
          ${rankingScore} DESC,
          ${events.startTime} ASC NULLS LAST,
          ${events.name} ASC,
          ${events.id} ASC
      )`,
      sql`row_number() OVER (
        PARTITION BY ${events.date}, ${normalizedSeriesVenueKey}
        ORDER BY
          ${editorialInterestingScore} DESC,
          ${rankingScore} DESC,
          ${events.startTime} ASC NULLS LAST,
          ${events.name} ASC,
          ${events.id} ASC
      )`,
      sql`row_number() OVER (
        PARTITION BY ${events.date}, ${normalizedVenuePartitionKey}
        ORDER BY
          ${editorialInterestingScore} DESC,
          ${events.startTime} ASC NULLS LAST,
          ${events.name} ASC,
          ${events.id} ASC
      )`,
      asc(seriesCount),
      desc(editorialInterestingScore),
      desc(rankingScore),
      asc(events.startTime),
      asc(events.name),
      asc(events.id),
    ] as const;
  }

  if (orderStrategy === "fast-diverse") {
    return [
      sql`CASE WHEN ${events.isRecurring} THEN 1 ELSE 0 END`,
      sql`CASE WHEN ${events.eventType} = 'otro' THEN 1 ELSE 0 END`,
      sql`row_number() OVER (
        PARTITION BY ${events.date}, ${events.eventType}
        ORDER BY
          ${rankingScore} DESC,
          ${events.startTime} ASC NULLS LAST,
          ${events.name} ASC,
          ${events.id} ASC
      )`,
      sql`row_number() OVER (
        PARTITION BY ${events.date}, ${normalizedSeriesVenueKey}
        ORDER BY
          ${rankingScore} DESC,
          ${events.startTime} ASC NULLS LAST,
          ${events.name} ASC,
          ${events.id} ASC
      )`,
      sql`row_number() OVER (
        PARTITION BY ${events.date}, ${normalizedVenuePartitionKey}
        ORDER BY
          ${rankingScore} DESC,
          ${events.startTime} ASC NULLS LAST,
          ${events.name} ASC,
          ${events.id} ASC
      )`,
      desc(rankingScore),
      asc(events.startTime),
      asc(events.name),
      asc(events.id),
    ] as const;
  }

  return [
    sql`CASE WHEN ${events.isRecurring} THEN 1 ELSE 0 END`,
    desc(editorialInterestingScore),
    desc(rankingScore),
    asc(events.startTime),
    asc(events.name),
    asc(events.id),
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
      desc(editorialInterestingScore),
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

  const orderByExpressions = buildOrderByExpressions(orderStrategy, {
    deprioritizeMultiDaySeries: orderStrategy === "diverse",
  });
  const orderedQuery = baseQuery.orderBy(...orderByExpressions);

  return orderedQuery.limit(safeLimit).offset(safeOffset);
}

async function getEventsByDatePagedWithTotalCount(
  date: string,
  offset: number = 0,
  limit: number = 6,
  filters?: EventFilters,
  orderStrategy: EventOrderStrategy = "default",
) {
  const safeOffset = Math.max(0, offset);
  const safeLimit = Math.max(1, Math.min(limit, 100));
  const filterConditions = buildFilterConditions(filters);
  const orderByExpressions = buildOrderByExpressions(orderStrategy, {
    deprioritizeMultiDaySeries: orderStrategy === "diverse",
  });

  const rows = await db
    .select({
      ...listColumns,
      __totalCount: sql<number>`count(*) OVER ()`,
    })
    .from(events)
    .where(
      and(
        activeStatus,
        eq(events.date, date),
        ...filterConditions,
      ),
    )
    .orderBy(...orderByExpressions)
    .limit(safeLimit)
    .offset(safeOffset);

  const totalCount = rows.length > 0 ? Number(rows[0].__totalCount ?? 0) : 0;
  const pagedEvents = rows.map(({ __totalCount: _totalCount, ...event }) => event);

  return {
    events: pagedEvents,
    totalCount,
  };
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
      const { events: dayEvents, totalCount } = await getEventsByDatePagedWithTotalCount(
        date,
        0,
        safeLimit,
        filters,
        orderStrategy,
      );

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
export async function getUpcomingEventsFromDate(
  startDate: string,
  filters?: EventFilters,
  orderStrategy: EventOrderStrategy = "diverse",
) {
  const filterConditions = buildFilterConditions(filters);
  const orderByExpressions = buildOrderByExpressions(orderStrategy, {
    deprioritizeMultiDaySeries: orderStrategy === "diverse",
  });

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

  const manualCandidates =
    manualSlugs.length > 0
      ? await db
          .select(listColumns)
          .from(events)
          .where(
            and(
              activeStatus,
              gte(events.date, weekendStart),
              lte(events.date, weekendEnd),
              eq(events.isRecurring, false),
              inArray(events.slug, manualSlugs),
            ),
          )
      : [];

  const candidates = await db
    .select(listColumns)
    .from(events)
    .where(
      and(
        activeStatus,
        gte(events.date, weekendStart),
        lte(events.date, weekendEnd),
        eq(events.isRecurring, false),
        sql`${sameSeriesInWindowCount} <= 2`,
        sql`${sameSeriesInMonthCount} <= 2`,
      ),
    )
    .orderBy(desc(editorialInterestingScore), desc(rankingScore), asc(events.date), asc(events.startTime))
    .limit(Math.max(safeLimit * 4, 24));

  if (candidates.length === 0) {
    return [];
  }

  const selected: Array<(typeof candidates)[number]> = [];
  const selectedIds = new Set<string>();
  const selectedTypeCounts = new Map<EventType, number>();
  const selectedSeriesKeys = new Set<string>();
  const candidatesBySlug = new Map<string, (typeof candidates)[number]>();

  const normalizeSeriesValue = (value: string | null | undefined) => {
    if (!value) return "";
    return value
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase()
      .replace(/\b(lunes|martes|miercoles|miércoles|jueves|viernes|sabado|sábado|domingo|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gu, " ")
      .replace(/\b\d{1,2}[./-]\d{1,2}(?:[./-]\d{2,4})?\b|\b\d{4}\b/g, " ")
      .replace(/\b\d{1,2}:\d{2}\b/g, " ")
      .replace(/[|_/\\-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  };

  const getSeriesKey = (candidate: (typeof candidates)[number]) => {
    const name = normalizeSeriesValue(candidate.name);
    const venue = normalizeSeriesValue(candidate.venueName);
    if (!name || !venue) return "";
    return `${name}::${venue}`;
  };

  for (const candidate of manualCandidates) {
    candidatesBySlug.set(candidate.slug, candidate);
  }
  for (const candidate of candidates) {
    if (!candidatesBySlug.has(candidate.slug)) {
      candidatesBySlug.set(candidate.slug, candidate);
    }
  }

  const addCandidate = (
    candidate: (typeof candidates)[number] | undefined,
    options?: { allowDuplicateSeries?: boolean },
  ) => {
    if (!candidate || selectedIds.has(candidate.id) || selected.length >= safeLimit) {
      return false;
    }

    const seriesKey = getSeriesKey(candidate);
    if (!options?.allowDuplicateSeries && seriesKey && selectedSeriesKeys.has(seriesKey)) {
      return false;
    }

    selected.push(candidate);
    selectedIds.add(candidate.id);
    if (seriesKey) {
      selectedSeriesKeys.add(seriesKey);
    }
    selectedTypeCounts.set(candidate.eventType, (selectedTypeCounts.get(candidate.eventType) ?? 0) + 1);
    return true;
  };

  for (const slug of manualSlugs) {
    addCandidate(candidatesBySlug.get(slug), { allowDuplicateSeries: true });
  }

  const typeBuckets = WEEKEND_HIGHLIGHT_TYPE_TARGETS.map((target) => ({
    type: target.type,
    remaining: Math.max(0, target.count - (selectedTypeCounts.get(target.type) ?? 0)),
    matches: candidates.filter((candidate) => candidate.eventType === target.type && !selectedIds.has(candidate.id)),
  }));

  let distributedAny = true;
  while (distributedAny && selected.length < safeLimit) {
    distributedAny = false;

    for (const bucket of typeBuckets) {
      if (selected.length >= safeLimit) {
        break;
      }

      if (bucket.remaining <= 0) {
        continue;
      }

      while (bucket.matches.length > 0) {
        const nextCandidate = bucket.matches.shift();
        if (!nextCandidate) {
          break;
        }

        if (addCandidate(nextCandidate)) {
          bucket.remaining -= 1;
          distributedAny = true;
          break;
        }
      }
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
