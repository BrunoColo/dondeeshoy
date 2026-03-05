import { db } from "./db";
import { events, rawEvents, eventSources, bannedEvents } from "./db/schema";
import { eventSubmissions } from "./db/schema/submissions";
import { eq, desc, and, gte, lte, sql, count, ilike } from "drizzle-orm";

/**
 * Normalize an event name for ban matching:
 * lowercase + strip accents + collapse whitespace.
 */
function normalizeBanName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function slugifyForEvent(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}

export type Source = "redtickets" | "entraste" | "cartelera" | "mvd_eventos" | "cobraticket" | "ticketfacil" | "mientrada";

// ============= Dashboard Stats =============

export async function getAdminDashboardStats() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [eventAggRows, eventsByType, rawAggRows, submissionAggRows] = await Promise.all([
    db.execute<{
      total_events: number | string;
      events_today: number | string;
      with_price: number | string;
      with_image: number | string;
      with_location: number | string;
    }>(sql`
      SELECT
        COUNT(*) FILTER (WHERE ${events.status} = 'active') AS total_events,
        COUNT(*) FILTER (WHERE ${events.createdAt} >= ${today}) AS events_today,
        COUNT(*) FILTER (WHERE ${events.status} = 'active' AND ${events.priceMin} IS NOT NULL) AS with_price,
        COUNT(*) FILTER (WHERE ${events.status} = 'active' AND ${events.imageUrl} IS NOT NULL) AS with_image,
        COUNT(*) FILTER (WHERE ${events.status} = 'active' AND ${events.latitude} IS NOT NULL) AS with_location
      FROM ${events}
    `),
    db
      .select({
        type: events.eventType,
        count: count(),
      })
      .from(events)
      .where(eq(events.status, "active"))
      .groupBy(events.eventType),
    db.execute<{ unprocessed_raw: number | string }>(sql`
      SELECT COUNT(*) AS unprocessed_raw
      FROM ${rawEvents}
      WHERE ${rawEvents.processed} = false
    `),
    db.execute<{ pending_submissions: number | string }>(sql`
      SELECT COUNT(*) AS pending_submissions
      FROM ${eventSubmissions}
      WHERE ${eventSubmissions.status} = 'pending'
    `),
  ]);

  const eventAgg = eventAggRows[0];
  const rawAgg = rawAggRows[0];
  const submissionAgg = submissionAggRows[0];

  // Events by type
  return {
    totalEvents: Number(eventAgg?.total_events ?? 0),
    eventsToday: Number(eventAgg?.events_today ?? 0),
    unprocessedRaw: Number(rawAgg?.unprocessed_raw ?? 0),
    pendingSubmissions: Number(submissionAgg?.pending_submissions ?? 0),
    withPrice: Number(eventAgg?.with_price ?? 0),
    withImage: Number(eventAgg?.with_image ?? 0),
    withLocation: Number(eventAgg?.with_location ?? 0),
    eventsByType,
  };
}

// ============= Scraper Stats =============

export async function getScraperStats() {
  const sources: Source[] = ["redtickets", "entraste", "cartelera", "mvd_eventos", "cobraticket", "ticketfacil", "mientrada"];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [aggRows, lastRows] = await Promise.all([
    db.execute<{
      source: Source;
      total: number | string;
      today: number | string;
      unprocessed: number | string;
      with_error: number | string;
    }>(sql`
      SELECT
        ${rawEvents.source} AS source,
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE ${rawEvents.scrapedAt} >= ${today}) AS today,
        COUNT(*) FILTER (WHERE ${rawEvents.processed} = false) AS unprocessed,
        COUNT(*) FILTER (WHERE ${rawEvents.processingError} IS NOT NULL) AS with_error
      FROM ${rawEvents}
      GROUP BY ${rawEvents.source}
    `),
    db.execute<{
      source: Source;
      last_scrape: Date | string | null;
    }>(sql`
      SELECT
        ${rawEvents.source} AS source,
        MAX(${rawEvents.scrapedAt}) AS last_scrape
      FROM ${rawEvents}
      GROUP BY ${rawEvents.source}
    `),
  ]);

  const aggBySource = new Map(
    aggRows.map((row) => [row.source, row]),
  );
  const lastBySource = new Map(
    lastRows.map((row) => [row.source, row.last_scrape]),
  );

  return sources.map((source) => {
    const agg = aggBySource.get(source);
    const last = lastBySource.get(source);

    return {
      source,
      total: Number(agg?.total ?? 0),
      today: Number(agg?.today ?? 0),
      unprocessed: Number(agg?.unprocessed ?? 0),
      withError: Number(agg?.with_error ?? 0),
      lastScrape: last ? new Date(last) : null,
    };
  });
}

// ============= Pipeline Stats =============

export async function getPipelineStats() {
  const [totalRaw] = await db.select({ count: count() }).from(rawEvents);
  const [processed] = await db.select({ count: count() }).from(rawEvents).where(eq(rawEvents.processed, true));
  const [withError] = await db.select({ count: count() }).from(rawEvents).where(sql`${rawEvents.processingError} IS NOT NULL`);
  const [totalEvents] = await db.select({ count: count() }).from(events);

  // Recent errors
  const recentErrors = await db
    .select({
      id: rawEvents.id,
      source: rawEvents.source,
      sourceId: rawEvents.sourceId,
      title: sql<string>`${rawEvents.rawData}->>'title'`,
      error: rawEvents.processingError,
      scrapedAt: rawEvents.scrapedAt,
    })
    .from(rawEvents)
    .where(sql`${rawEvents.processingError} IS NOT NULL`)
    .orderBy(desc(rawEvents.scrapedAt))
    .limit(20);

  return {
    totalRaw: totalRaw?.count ?? 0,
    processed: processed?.count ?? 0,
    withError: withError?.count ?? 0,
    totalEvents: totalEvents?.count ?? 0,
    conversionRate: totalRaw?.count ? ((totalEvents?.count ?? 0) / totalRaw.count) * 100 : 0,
    recentErrors: recentErrors.map((e) => ({
      ...e,
      title: e.title as string,
    })),
  };
}

// ============= Raw Events =============

export interface RawEventsFilters {
  source?: Source;
  processed?: boolean;
  hasError?: boolean;
}

export async function getRawEvents(
  filters: RawEventsFilters = {},
  page: number = 1,
  limit: number = 50
) {
  const offset = (page - 1) * limit;

  const whereConditions = [];

  if (filters.source) {
    whereConditions.push(eq(rawEvents.source, filters.source));
  }
  if (filters.processed !== undefined) {
    whereConditions.push(eq(rawEvents.processed, filters.processed));
  }
  if (filters.hasError) {
    whereConditions.push(sql`${rawEvents.processingError} IS NOT NULL`);
  }

  const where = whereConditions.length > 0 ? and(...whereConditions) : undefined;

  const [total] = await db.select({ count: count() }).from(rawEvents).where(where);

  const items = await db
    .select({
      id: rawEvents.id,
      source: rawEvents.source,
      sourceId: rawEvents.sourceId,
      title: sql<string>`${rawEvents.rawData}->>'title'`,
      scrapedAt: rawEvents.scrapedAt,
      processed: rawEvents.processed,
      processingError: rawEvents.processingError,
    })
    .from(rawEvents)
    .where(where)
    .orderBy(desc(rawEvents.scrapedAt))
    .limit(limit)
    .offset(offset);

  return {
    items: items.map((i) => ({ ...i, title: i.title as string })),
    total: total?.count ?? 0,
    page,
    limit,
    totalPages: Math.ceil((total?.count ?? 0) / limit),
  };
}

export async function getRejectedEvents(page: number = 1, limit: number = 50) {
  const offset = (page - 1) * limit;

  const where = and(
    eq(rawEvents.processed, true),
    sql`${rawEvents.processingError} IS NOT NULL`
  );

  const [total] = await db.select({ count: count() }).from(rawEvents).where(where);

  const items = await db
    .select({
      id: rawEvents.id,
      source: rawEvents.source,
      sourceId: rawEvents.sourceId,
      title: sql<string>`${rawEvents.rawData}->>'title'`, scrapedAt: rawEvents.scrapedAt,
      processingError: rawEvents.processingError,
    })
    .from(rawEvents)
    .where(where)
    .orderBy(desc(rawEvents.scrapedAt))
    .limit(limit)
    .offset(offset);

  return {
    items: items.map((i) => ({ ...i, title: i.title as string })),
    total: total?.count ?? 0,
    page,
    limit,
    totalPages: Math.ceil((total?.count ?? 0) / limit),
  };
}

// ============= Submissions =============

export async function getSubmissions(
  status?: "pending" | "approved" | "rejected",
  page: number = 1,
  limit: number = 20
) {
  const offset = (page - 1) * limit;

  const where = status ? eq(eventSubmissions.status, status as "pending" | "approved" | "rejected") : undefined;

  const [total] = await db.select({ count: count() }).from(eventSubmissions).where(where);

  const items = await db
    .select()
    .from(eventSubmissions)
    .where(where)
    .orderBy(desc(eventSubmissions.submittedAt))
    .limit(limit)
    .offset(offset);

  return {
    items,
    total: total?.count ?? 0,
    page,
    limit,
    totalPages: Math.ceil((total?.count ?? 0) / limit),
  };
}

export async function getSubmissionById(id: string) {
  const [submission] = await db
    .select()
    .from(eventSubmissions)
    .where(eq(eventSubmissions.id, id));

  return submission ?? null;
}

export async function approveSubmission(id: string, notes?: string) {
  const submission = await getSubmissionById(id);
  if (!submission) {
    throw new Error("Submission not found");
  }

  // Create event from submission
  const safeDate = submission.eventDate || new Date().toISOString().slice(0, 10);
  const slug = `${slugifyForEvent(submission.eventName)}-${safeDate}`;

  await db.insert(events).values({
    name: submission.eventName,
    slug,
    description: submission.description,
    date: submission.eventDate,
    startTime: submission.eventTime,
    venueName: submission.venueName,
    venueAddress: submission.venueAddress,
    city: submission.city,
    eventType: submission.eventType,
    isFree: submission.isFree,
    priceMin: submission.priceRange ? parseInt(submission.priceRange.split("-")[0]) : null,
    priceMax: submission.priceRange && submission.priceRange.includes("-") ? parseInt(submission.priceRange.split("-")[1]) : null,
    ticketUrl: submission.ticketUrl,
    imageUrl: submission.imageUrl,
    confidenceScore: "1.00",
    status: "active",
  });

  // Update submission status
  await db
    .update(eventSubmissions)
    .set({
      status: "approved",
      notes: notes ?? null,
      reviewedAt: new Date(),
    })
    .where(eq(eventSubmissions.id, id));

  return { success: true };
}

export async function rejectSubmission(id: string, notes?: string) {
  await db
    .update(eventSubmissions)
    .set({
      status: "rejected",
      notes: notes ?? null,
      reviewedAt: new Date(),
    })
    .where(eq(eventSubmissions.id, id));

  return { success: true };
}

// ============= Enhanced Dashboard Stats =============

export async function getEnhancedDashboardStats() {
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];

  // Events by source (how many final events each scraper produced)
  const eventsBySource = await db
    .select({
      source: eventSources.source,
      count: count(),
    })
    .from(eventSources)
    .groupBy(eventSources.source);

  // Events by city/department
  const eventsByCity = await db
    .select({
      city: events.city,
      count: count(),
    })
    .from(events)
    .where(eq(events.status, "active"))
    .groupBy(events.city)
    .orderBy(desc(count()));

  // Upcoming events (future dates)
  const [upcomingCount] = await db
    .select({ count: count() })
    .from(events)
    .where(and(eq(events.status, "active"), gte(events.date, todayStr)));

  // Past events (date before today)
  const [pastCount] = await db
    .select({ count: count() })
    .from(events)
    .where(and(eq(events.status, "active"), lte(events.date, todayStr)));

  // Top viewed events
  const topViewed = await db
    .select({
      id: events.id,
      name: events.name,
      viewCount: events.viewCount,
      date: events.date,
      venueName: events.venueName,
      eventType: events.eventType,
    })
    .from(events)
    .where(eq(events.status, "active"))
    .orderBy(desc(events.viewCount))
    .limit(10);

  // Recently created events
  const recentEvents = await db
    .select({
      id: events.id,
      name: events.name,
      date: events.date,
      venueName: events.venueName,
      eventType: events.eventType,
      city: events.city,
      createdAt: events.createdAt,
    })
    .from(events)
    .where(eq(events.status, "active"))
    .orderBy(desc(events.createdAt))
    .limit(10);

  // Free vs paid events
  const [freeCount] = await db
    .select({ count: count() })
    .from(events)
    .where(and(eq(events.status, "active"), eq(events.isFree, true)));

  return {
    eventsBySource,
    eventsByCity,
    upcomingCount: upcomingCount?.count ?? 0,
    pastCount: pastCount?.count ?? 0,
    topViewed,
    recentEvents,
    freeCount: freeCount?.count ?? 0,
  };
}

// ============= Daily Counts =============

export async function getDailyScrapeCounts(days: number = 7) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  startDate.setHours(0, 0, 0, 0);

  const rawCounts = await db
    .select({
      date: sql<string>`DATE(${rawEvents.scrapedAt})`,
      count: count(),
    })
    .from(rawEvents)
    .where(gte(rawEvents.scrapedAt, startDate))
    .groupBy(sql`DATE(${rawEvents.scrapedAt})`);

  const processedCounts = await db
    .select({
      date: sql<string>`DATE(${events.createdAt})`,
      count: count(),
    })
    .from(events)
    .where(gte(events.createdAt, startDate))
    .groupBy(sql`DATE(${events.createdAt})`);

  // Create a map for quick lookup
  const processedMap = new Map(processedCounts.map((c) => [c.date, c.count]));

  // Fill in the days
  const result = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split("T")[0];

    const raw = rawCounts.find((c) => c.date === dateStr);
    const processed = processedMap.get(dateStr) ?? 0;

    result.push({
      date: dateStr,
      scraped: raw?.count ?? 0,
      processed,
    });
  }

  return result;
}

// ============= Events Admin =============

export interface SearchEventsParams {
  query?: string;
  status?: "active" | "cancelled" | "past";
  page?: number;
  limit?: number;
}

export async function searchEvents(params: SearchEventsParams = {}) {
  const { query, status, page = 1, limit = 20 } = params;
  const offset = (page - 1) * limit;

  const whereConditions = [];

  if (query) {
    whereConditions.push(ilike(events.name, `%${query}%`));
  }
  if (status) {
    whereConditions.push(eq(events.status, status));
  }

  const where = whereConditions.length > 0 ? and(...whereConditions) : undefined;

  const [total] = await db.select({ count: count() }).from(events).where(where);

  const items = await db
    .select()
    .from(events)
    .where(where)
    .orderBy(desc(events.updatedAt))
    .limit(limit)
    .offset(offset);

  return {
    items,
    total: total?.count ?? 0,
    page,
    limit,
    totalPages: Math.ceil((total?.count ?? 0) / limit),
  };
}

export async function getEventById(id: string) {
  const [event] = await db.select().from(events).where(eq(events.id, id));
  return event ?? null;
}

export interface UpdateEventData {
  name?: string;
  description?: string | null;
  date?: string;
  startTime?: string | null;
  endTime?: string | null;
  venueName?: string;
  venueAddress?: string | null;
  latitude?: string | null;
  longitude?: string | null;
  city?: string;
  eventType?: string;
  musicGenre?: string | null;
  imageUrl?: string | null;
  ticketUrl?: string | null;
  priceMin?: number | null;
  priceMax?: number | null;
  currency?: string;
  isFree?: boolean;
  ageRestriction?: number | null;
  status?: "active" | "cancelled" | "past";
}

export async function updateEvent(id: string, data: UpdateEventData) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dataAny = data as any;
  const [updated] = await db
    .update(events)
    .set({
      ...dataAny,
      updatedAt: new Date(),
    })
    .where(eq(events.id, id))
    .returning();

  return updated ?? null;
}

export async function deleteEvent(id: string, reason?: string) {
  // 1. Fetch the event before deleting so we can record the ban
  const [event] = await db.select().from(events).where(eq(events.id, id));

  if (event) {
    // 2. Fetch all scraper sources linked to this event
    const sources = await db
      .select({
        source: eventSources.source,
        rawEventId: eventSources.rawEventId,
      })
      .from(eventSources)
      .where(eq(eventSources.eventId, id));

    // 3. Resolve source IDs from raw_events
    const sourceRows: Array<{ source: typeof eventSources.$inferSelect["source"]; sourceId: string }> = [];
    for (const s of sources) {
      const [raw] = await db
        .select({ sourceId: rawEvents.sourceId })
        .from(rawEvents)
        .where(eq(rawEvents.id, s.rawEventId))
        .limit(1);
      if (raw) {
        sourceRows.push({ source: s.source, sourceId: raw.sourceId });
      }
    }

    const normalizedName = normalizeBanName(event.name);

    // 4. Insert one ban row per source (or one generic row if no sources)
    if (sourceRows.length > 0) {
      for (const sr of sourceRows) {
        // Avoid duplicate bans for the same source+sourceId
        const existing = await db
          .select({ id: bannedEvents.id })
          .from(bannedEvents)
          .where(and(eq(bannedEvents.source, sr.source), eq(bannedEvents.sourceId, sr.sourceId)))
          .limit(1);
        if (existing.length === 0) {
          await db.insert(bannedEvents).values({
            normalizedName,
            originalName: event.name,
            source: sr.source,
            sourceId: sr.sourceId,
            reason: reason ?? "Eliminado por administrador",
          });
        }
      }
    }

    // 5. Always insert a name-based ban (catches future re-scrapes with new IDs)
    const existingNameBan = await db
      .select({ id: bannedEvents.id })
      .from(bannedEvents)
      .where(eq(bannedEvents.normalizedName, normalizedName))
      .limit(1);
    if (existingNameBan.length === 0) {
      await db.insert(bannedEvents).values({
        normalizedName,
        originalName: event.name,
        source: null,
        sourceId: null,
        reason: reason ?? "Eliminado por administrador",
      });
    }
  }

  // 6. Delete the event (cascades to event_sources)
  await db.delete(events).where(eq(events.id, id));
  return { success: true };
}

// ============= Banned Events =============

export async function getBannedEvents(page: number = 1, limit: number = 50) {
  const offset = (page - 1) * limit;

  const [total] = await db.select({ count: count() }).from(bannedEvents);

  const items = await db
    .select()
    .from(bannedEvents)
    .orderBy(desc(bannedEvents.bannedAt))
    .limit(limit)
    .offset(offset);

  return {
    items,
    total: total?.count ?? 0,
    page,
    limit,
    totalPages: Math.ceil((total?.count ?? 0) / limit),
  };
}

export async function unbanEvent(id: string) {
  await db.delete(bannedEvents).where(eq(bannedEvents.id, id));
  return { success: true };
}

/**
 * Check if an event name is banned.
 * Used by the pipeline before creating/merging events.
 */
export async function isEventBanned(name: string, source?: string, sourceId?: string): Promise<boolean> {
  const normalizedName = normalizeBanName(name);

  // Check by source+sourceId first (exact match, fastest)
  if (source && sourceId) {
    const bySource = await db
      .select({ id: bannedEvents.id })
      .from(bannedEvents)
      .where(and(eq(bannedEvents.source, source as Source), eq(bannedEvents.sourceId, sourceId)))
      .limit(1);
    if (bySource.length > 0) return true;
  }

  // Check by normalized name
  const byName = await db
    .select({ id: bannedEvents.id })
    .from(bannedEvents)
    .where(eq(bannedEvents.normalizedName, normalizedName))
    .limit(1);

  return byName.length > 0;
}
