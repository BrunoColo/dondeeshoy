import { db } from "./db";
import { events, rawEvents, eventSources } from "./db/schema";
import { eventSubmissions } from "./db/schema/submissions";
import { eq, desc, and, gte, lte, sql, count } from "drizzle-orm";

export type Source = "redtickets" | "entraste" | "cartelera" | "mvd_eventos" | "cobraticket" | "ticketfacil";

// ============= Dashboard Stats =============

export async function getAdminDashboardStats() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Total active events
  const [totalEvents] = await db
    .select({ count: count() })
    .from(events)
    .where(eq(events.status, "active"));

  // Events created today
  const [eventsToday] = await db
    .select({ count: count() })
    .from(events)
    .where(gte(events.createdAt, today));

  // Raw events unprocessed
  const [unprocessedRaw] = await db
    .select({ count: count() })
    .from(rawEvents)
    .where(eq(rawEvents.processed, false));

  // Pending submissions
  const [pendingSubmissions] = await db
    .select({ count: count() })
    .from(eventSubmissions)
    .where(eq(eventSubmissions.status, "pending"));

  // Events with price
  const [withPrice] = await db
    .select({ count: count() })
    .from(events)
    .where(and(eq(events.status, "active"), sql`${events.priceMin} IS NOT NULL`));

  // Events with image
  const [withImage] = await db
    .select({ count: count() })
    .from(events)
    .where(and(eq(events.status, "active"), sql`${events.imageUrl} IS NOT NULL`));

  // Events with location
  const [withLocation] = await db
    .select({ count: count() })
    .from(events)
    .where(and(eq(events.status, "active"), sql`${events.latitude} IS NOT NULL`));

  // Events by type
  const eventsByType = await db
    .select({
      type: events.eventType,
      count: count(),
    })
    .from(events)
    .where(eq(events.status, "active"))
    .groupBy(events.eventType);

  return {
    totalEvents: totalEvents?.count ?? 0,
    eventsToday: eventsToday?.count ?? 0,
    unprocessedRaw: unprocessedRaw?.count ?? 0,
    pendingSubmissions: pendingSubmissions?.count ?? 0,
    withPrice: withPrice?.count ?? 0,
    withImage: withImage?.count ?? 0,
    withLocation: withLocation?.count ?? 0,
    eventsByType,
  };
}

// ============= Scraper Stats =============

export async function getScraperStats() {
  const sources: Source[] = ["redtickets", "entraste", "cartelera", "mvd_eventos", "cobraticket", "ticketfacil"];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const stats = await Promise.all(
    sources.map(async (source) => {
      const [total] = await db
        .select({ count: count() })
        .from(rawEvents)
        .where(eq(rawEvents.source, source));

      const [todayCount] = await db
        .select({ count: count() })
        .from(rawEvents)
        .where(and(eq(rawEvents.source, source), gte(rawEvents.scrapedAt, today)));

      const [unprocessed] = await db
        .select({ count: count() })
        .from(rawEvents)
        .where(and(eq(rawEvents.source, source), eq(rawEvents.processed, false)));

      const [withError] = await db
        .select({ count: count() })
        .from(rawEvents)
        .where(and(eq(rawEvents.source, source), sql`${rawEvents.processingError} IS NOT NULL`));

      const [lastScrape] = await db
        .select({ scrapedAt: rawEvents.scrapedAt })
        .from(rawEvents)
        .where(eq(rawEvents.source, source))
        .orderBy(desc(rawEvents.scrapedAt))
        .limit(1);

      return {
        source,
        total: total?.count ?? 0,
        today: todayCount?.count ?? 0,
        unprocessed: unprocessed?.count ?? 0,
        withError: withError?.count ?? 0,
        lastScrape: lastScrape?.scrapedAt ?? null,
      };
    })
  );

  return stats;
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
  const slug = submission.eventName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") +
    "-" +
    Date.now();

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
