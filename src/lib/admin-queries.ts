import { unstable_cache } from "next/cache";

import { db } from "./db";
import { getPipelineMonitorState } from "./pipeline-monitor";
import { events, rawEvents, eventSources, bannedEvents } from "./db/schema";
import { eventSubmissions } from "./db/schema/submissions";
import { eq, desc, and, gte, sql, count, ilike, inArray } from "drizzle-orm";

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
export type ScraperHealth = "healthy" | "warning" | "error" | "idle";

type ScraperStatsRow = {
  source: Source;
  total: number | string;
  today: number | string;
  unprocessed: number | string;
  with_error: number | string;
  last_scrape: Date | string | null;
};

type PipelineDbSnapshot = {
  totalRaw: number;
  processed: number;
  withError: number;
  totalEvents: number;
  recentErrors: Array<{
    id: string;
    source: Source;
    sourceId: string;
    title: string;
    error: string | null;
    scrapedAt: Date;
  }>;
};

function deriveScraperHealth(stat: {
  total: number;
  today: number;
  unprocessed: number;
  withError: number;
  lastScrape: Date | null;
}): { health: ScraperHealth; healthReason: string } {
  if (!stat.lastScrape || stat.total === 0) {
    return { health: "idle", healthReason: "Sin ejecuciones registradas" };
  }

  const hoursSinceLastScrape = (Date.now() - stat.lastScrape.getTime()) / 3_600_000;

  if (hoursSinceLastScrape >= 48 || stat.withError >= 25) {
    return {
      health: "error",
      healthReason: hoursSinceLastScrape >= 48
        ? `Sin actividad hace ${Math.round(hoursSinceLastScrape)}h`
        : `${stat.withError} raws con error`,
    };
  }

  if (stat.today === 0 && hoursSinceLastScrape >= 24) {
    return {
      health: "warning",
      healthReason: `Sin scrapeos hoy (${Math.round(hoursSinceLastScrape)}h)`,
    };
  }

  if (stat.unprocessed >= 25 || stat.withError > 0 || hoursSinceLastScrape >= 12) {
    return {
      health: "warning",
      healthReason: stat.unprocessed >= 25
        ? `${stat.unprocessed} pendientes`
        : stat.withError > 0
          ? `${stat.withError} con error`
          : `Último scrape hace ${Math.round(hoursSinceLastScrape)}h`,
    };
  }

  return { health: "healthy", healthReason: "Operando normalmente" };
}

type DashboardStats = {
  totalEvents: number;
  eventsToday: number;
  unprocessedRaw: number;
  pendingSubmissions: number;
  withPrice: number;
  withImage: number;
  withLocation: number;
  eventsByType: Array<{ type: string; count: number }>;
};

type EnhancedDashboardStats = {
  eventsBySource: Array<{ source: string; count: number }>;
  eventsByCity: Array<{ department: string; count: number }>;
  upcomingCount: number;
  pastCount: number;
  topViewed: Array<{
    id: string;
    name: string;
    viewCount: number;
    date: string;
    venueName: string;
    eventType: string;
  }>;
  recentEvents: Array<{
    id: string;
    name: string;
    date: string;
    venueName: string;
    eventType: string;
    department: string;
    createdAt: Date;
  }>;
  freeCount: number;
};

type DailyScrapeCount = { date: string; scraped: number; processed: number };

type TrafficStats = {
  totalEventViews: number;
  avgViewsPerActiveEvent: number;
  viewsToday: number;
  ticketClicksToday: number;
  topClickedToday: Array<{
    id: string;
    name: string;
    slug: string;
    venueName: string;
    date: string;
    ticketClicks: number;
  }>;
};

type DashboardSnapshotCore = {
  stats: DashboardStats;
  enhanced: EnhancedDashboardStats;
  dailyCounts: DailyScrapeCount[];
};

type DashboardSnapshot = DashboardSnapshotCore & {
  traffic: TrafficStats;
};

type DashboardSnapshotRow = {
  total_events: number | string | null;
  events_today: number | string | null;
  unprocessed_raw: number | string | null;
  pending_submissions: number | string | null;
  with_price: number | string | null;
  with_image: number | string | null;
  with_location: number | string | null;
  upcoming_count: number | string | null;
  past_count: number | string | null;
  free_count: number | string | null;
  events_by_type: unknown;
  events_by_source: unknown;
  events_by_city: unknown;
  top_viewed: unknown;
  recent_events: unknown;
  daily_counts: unknown;
};

function parseCount(value: number | string | null | undefined): number {
  return Number(value ?? 0);
}

function parseJsonArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) {
    return value as T[];
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? (parsed as T[]) : [];
    } catch {
      return [];
    }
  }

  return [];
}

const getAdminDashboardSnapshotCached = unstable_cache(
  async (): Promise<DashboardSnapshotCore> => {
    const rows = await db.execute<DashboardSnapshotRow>(sql`
      WITH event_metrics AS (
        SELECT
          COUNT(*) FILTER (WHERE ${events.status} = 'active')::int AS total_events,
          COUNT(*) FILTER (WHERE ${events.createdAt} >= date_trunc('day', now()))::int AS events_today,
          COUNT(*) FILTER (WHERE ${events.status} = 'active' AND ${events.priceMin} IS NOT NULL)::int AS with_price,
          COUNT(*) FILTER (WHERE ${events.status} = 'active' AND ${events.imageUrl} IS NOT NULL)::int AS with_image,
          COUNT(*) FILTER (WHERE ${events.status} = 'active' AND ${events.latitude} IS NOT NULL)::int AS with_location,
          COUNT(*) FILTER (WHERE ${events.status} = 'active' AND ${events.date} >= current_date)::int AS upcoming_count,
          COUNT(*) FILTER (WHERE ${events.status} = 'active' AND ${events.date} < current_date)::int AS past_count,
          COUNT(*) FILTER (WHERE ${events.status} = 'active' AND ${events.isFree} = true)::int AS free_count
        FROM ${events}
      ),
      raw_metrics AS (
        SELECT COUNT(*) FILTER (WHERE ${rawEvents.processed} = false)::int AS unprocessed_raw
        FROM ${rawEvents}
      ),
      submission_metrics AS (
        SELECT COUNT(*) FILTER (WHERE ${eventSubmissions.status} = 'pending')::int AS pending_submissions
        FROM ${eventSubmissions}
      )
      SELECT
        event_metrics.total_events,
        event_metrics.events_today,
        raw_metrics.unprocessed_raw,
        submission_metrics.pending_submissions,
        event_metrics.with_price,
        event_metrics.with_image,
        event_metrics.with_location,
        event_metrics.upcoming_count,
        event_metrics.past_count,
        event_metrics.free_count,
        COALESCE((
          SELECT json_agg(row_to_json(t) ORDER BY t.count DESC, t.type)
          FROM (
            SELECT ${events.eventType}::text AS type, COUNT(*)::int AS count
            FROM ${events}
            WHERE ${events.status} = 'active'
            GROUP BY ${events.eventType}
          ) AS t
        ), '[]'::json) AS events_by_type,
        COALESCE((
          SELECT json_agg(row_to_json(t) ORDER BY t.count DESC, t.source)
          FROM (
            SELECT ${eventSources.source}::text AS source, COUNT(*)::int AS count
            FROM ${eventSources}
            GROUP BY ${eventSources.source}
          ) AS t
        ), '[]'::json) AS events_by_source,
        COALESCE((
          SELECT json_agg(row_to_json(t) ORDER BY t.count DESC, t.department)
          FROM (
            SELECT ${events.department} AS department, COUNT(*)::int AS count
            FROM ${events}
            WHERE ${events.status} = 'active'
            GROUP BY ${events.department}
          ) AS t
        ), '[]'::json) AS events_by_city,
        COALESCE((
          SELECT json_agg(row_to_json(t) ORDER BY t.view_count DESC, t.date ASC)
          FROM (
            SELECT
              ${events.id} AS id,
              ${events.name} AS name,
              ${events.viewCount}::int AS view_count,
              ${events.date}::text AS date,
              ${events.venueName} AS venue_name,
              ${events.eventType}::text AS event_type
            FROM ${events}
            WHERE ${events.status} = 'active'
            ORDER BY ${events.viewCount} DESC, ${events.date} ASC
            LIMIT 10
          ) AS t
        ), '[]'::json) AS top_viewed,
        COALESCE((
          SELECT json_agg(row_to_json(t) ORDER BY t.created_at DESC)
          FROM (
            SELECT
              ${events.id} AS id,
              ${events.name} AS name,
              ${events.date}::text AS date,
              ${events.venueName} AS venue_name,
              ${events.eventType}::text AS event_type,
              ${events.department} AS department,
              ${events.createdAt} AS created_at
            FROM ${events}
            WHERE ${events.status} = 'active'
            ORDER BY ${events.createdAt} DESC
            LIMIT 10
          ) AS t
        ), '[]'::json) AS recent_events,
        COALESCE((
          SELECT json_agg(row_to_json(t) ORDER BY t.date)
          FROM (
            SELECT
              to_char(days.day, 'YYYY-MM-DD') AS date,
              COALESCE(raw_counts.scraped, 0)::int AS scraped,
              COALESCE(processed_counts.processed, 0)::int AS processed
            FROM generate_series(current_date - interval '6 days', current_date, interval '1 day') AS days(day)
            LEFT JOIN (
              SELECT DATE(${rawEvents.scrapedAt}) AS day, COUNT(*)::int AS scraped
              FROM ${rawEvents}
              WHERE ${rawEvents.scrapedAt} >= current_date - interval '6 days'
              GROUP BY DATE(${rawEvents.scrapedAt})
            ) AS raw_counts ON raw_counts.day = days.day::date
            LEFT JOIN (
              SELECT DATE(${events.createdAt}) AS day, COUNT(*)::int AS processed
              FROM ${events}
              WHERE ${events.createdAt} >= current_date - interval '6 days'
              GROUP BY DATE(${events.createdAt})
            ) AS processed_counts ON processed_counts.day = days.day::date
          ) AS t
        ), '[]'::json) AS daily_counts
      FROM event_metrics, raw_metrics, submission_metrics
    `);

    const row = rows[0];
    const stats: DashboardStats = {
      totalEvents: parseCount(row?.total_events),
      eventsToday: parseCount(row?.events_today),
      unprocessedRaw: parseCount(row?.unprocessed_raw),
      pendingSubmissions: parseCount(row?.pending_submissions),
      withPrice: parseCount(row?.with_price),
      withImage: parseCount(row?.with_image),
      withLocation: parseCount(row?.with_location),
      eventsByType: parseJsonArray<{ type: string; count: number | string }>(row?.events_by_type).map((item) => ({
        type: item.type,
        count: parseCount(item.count),
      })),
    };

    const enhanced: EnhancedDashboardStats = {
      eventsBySource: parseJsonArray<{ source: string; count: number | string }>(row?.events_by_source).map((item) => ({
        source: item.source,
        count: parseCount(item.count),
      })),
      eventsByCity: parseJsonArray<{ department: string; count: number | string }>(row?.events_by_city).map((item) => ({
        department: item.department,
        count: parseCount(item.count),
      })),
      upcomingCount: parseCount(row?.upcoming_count),
      pastCount: parseCount(row?.past_count),
      topViewed: parseJsonArray<{
        id: string;
        name: string;
        view_count: number | string;
        date: string;
        venue_name: string;
        event_type: string;
      }>(row?.top_viewed).map((item) => ({
        id: item.id,
        name: item.name,
        viewCount: parseCount(item.view_count),
        date: item.date,
        venueName: item.venue_name,
        eventType: item.event_type,
      })),
      recentEvents: parseJsonArray<{
        id: string;
        name: string;
        date: string;
        venue_name: string;
        event_type: string;
        department: string;
        created_at: string | Date;
      }>(row?.recent_events).map((item) => ({
        id: item.id,
        name: item.name,
        date: item.date,
        venueName: item.venue_name,
        eventType: item.event_type,
        department: item.department,
        createdAt: new Date(item.created_at),
      })),
      freeCount: parseCount(row?.free_count),
    };

    const dailyCounts = parseJsonArray<{ date: string; scraped: number | string; processed: number | string }>(row?.daily_counts).map((item) => ({
      date: item.date,
      scraped: parseCount(item.scraped),
      processed: parseCount(item.processed),
    }));

    return {
      stats,
      enhanced,
      dailyCounts,
    };
  },
  ["admin-dashboard-snapshot-v1"],
  {
    revalidate: 30,
    tags: ["admin-dashboard"],
  },
);

function getUruguayDateKey(now: Date = new Date()): string {
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

const getTrafficStatsCached = unstable_cache(
  async (): Promise<TrafficStats> => {
    const [{ totalViewResult }, { totalActiveResult }] = await Promise.all([
      db.execute<{ total_views: number | string | null }>(sql`
        SELECT COALESCE(SUM(${events.viewCount}), 0)::int AS total_views
        FROM ${events}
        WHERE ${events.status} = 'active'
      `).then((rows) => ({ totalViewResult: rows[0] })),
      db.execute<{ total_active: number | string | null }>(sql`
        SELECT COUNT(*)::int AS total_active
        FROM ${events}
        WHERE ${events.status} = 'active'
      `).then((rows) => ({ totalActiveResult: rows[0] })),
    ]);

    const totalEventViews = parseCount(totalViewResult?.total_views);
    const totalActiveEvents = parseCount(totalActiveResult?.total_active);
    const avgViewsPerActiveEvent = totalActiveEvents > 0
      ? Math.round((totalEventViews / totalActiveEvents) * 10) / 10
      : 0;

    try {
      const { redis } = await import("@/lib/redis");
      const todayKey = getUruguayDateKey();
      const viewsDailyKey = `trending:daily:${todayKey}`;
      const clicksDailyKey = `traffic:ticket-clicks:daily:${todayKey}`;

      const [todayViewsRaw, todayClicksRaw] = await Promise.all([
        redis.zrange(viewsDailyKey, 0, -1, { withScores: true }),
        redis.zrange(clicksDailyKey, 0, 9, { rev: true, withScores: true }),
      ]);

      let viewsToday = 0;
      for (let i = 1; i < todayViewsRaw.length; i += 2) {
        viewsToday += Number(todayViewsRaw[i] ?? 0);
      }

      let ticketClicksToday = 0;
      const clickPairs: Array<{ eventId: string; ticketClicks: number }> = [];
      for (let i = 0; i < todayClicksRaw.length; i += 2) {
        const eventId = String(todayClicksRaw[i] ?? "");
        const score = Number(todayClicksRaw[i + 1] ?? 0);
        ticketClicksToday += score;
        if (eventId) {
          clickPairs.push({ eventId, ticketClicks: score });
        }
      }

      if (clickPairs.length === 0) {
        return {
          totalEventViews,
          avgViewsPerActiveEvent,
          viewsToday,
          ticketClicksToday,
          topClickedToday: [],
        };
      }

      const eventRows = await db
        .select({
          id: events.id,
          name: events.name,
          slug: events.slug,
          venueName: events.venueName,
          date: events.date,
        })
        .from(events)
        .where(inArray(events.id, clickPairs.map((item) => item.eventId)));

      const rowsById = new Map(eventRows.map((row) => [row.id, row]));
      const topClickedToday = clickPairs
        .map((item) => {
          const event = rowsById.get(item.eventId);
          if (!event) return null;
          return {
            id: event.id,
            name: event.name,
            slug: event.slug,
            venueName: event.venueName,
            date: event.date,
            ticketClicks: item.ticketClicks,
          };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null);

      return {
        totalEventViews,
        avgViewsPerActiveEvent,
        viewsToday,
        ticketClicksToday,
        topClickedToday,
      };
    } catch {
      return {
        totalEventViews,
        avgViewsPerActiveEvent,
        viewsToday: 0,
        ticketClicksToday: 0,
        topClickedToday: [],
      };
    }
  },
  ["admin-traffic-stats-v1"],
  {
    revalidate: 30,
    tags: ["admin-dashboard", "admin-traffic"],
  },
);

export async function getAdminDashboardSnapshot(): Promise<DashboardSnapshot> {
  const [snapshot, traffic] = await Promise.all([
    getAdminDashboardSnapshotCached(),
    getTrafficStatsCached(),
  ]);

  return {
    ...snapshot,
    traffic,
  };
}

// ============= Dashboard Stats =============

export async function getAdminDashboardStats() {
  const snapshot = await getAdminDashboardSnapshot();
  return snapshot.stats;
}

// ============= Scraper Stats =============

const getScraperStatsCached = unstable_cache(
  async () => {
    const sources: Source[] = ["redtickets", "entraste", "cartelera", "mvd_eventos", "cobraticket", "ticketfacil", "mientrada"];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayIso = today.toISOString();

    const rows = await db.execute<ScraperStatsRow>(sql`
      SELECT
        ${rawEvents.source} AS source,
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE ${rawEvents.scrapedAt} >= ${todayIso})::int AS today,
        COUNT(*) FILTER (WHERE ${rawEvents.processed} = false)::int AS unprocessed,
        COUNT(*) FILTER (WHERE ${rawEvents.processingError} IS NOT NULL)::int AS with_error,
        MAX(${rawEvents.scrapedAt}) AS last_scrape
      FROM ${rawEvents}
      GROUP BY ${rawEvents.source}
    `);

    const rowsBySource = new Map(rows.map((row) => [row.source, row]));

    return sources.map((source) => {
      const row = rowsBySource.get(source);
      const stat = {
        source,
        total: Number(row?.total ?? 0),
        today: Number(row?.today ?? 0),
        unprocessed: Number(row?.unprocessed ?? 0),
        withError: Number(row?.with_error ?? 0),
        lastScrape: row?.last_scrape ? new Date(row.last_scrape) : null,
      };
      const health = deriveScraperHealth(stat);

      return {
        ...stat,
        ...health,
      };
    });
  },
  ["admin-scraper-stats-v2"],
  {
    revalidate: 15,
    tags: ["admin-scrapers"],
  },
);

export async function getScraperStats() {
  return getScraperStatsCached();
}

// ============= Pipeline Stats =============

const getPipelineDbSnapshotCached = unstable_cache(
  async (): Promise<PipelineDbSnapshot> => {
    const [[rawSummary], [totalEvents], recentErrors] = await Promise.all([
      db.execute<{
        total_raw: number | string;
        processed: number | string;
        with_error: number | string;
      }>(sql`
        SELECT
          COUNT(*)::int AS total_raw,
          COUNT(*) FILTER (WHERE ${rawEvents.processed} = true)::int AS processed,
          COUNT(*) FILTER (WHERE ${rawEvents.processingError} IS NOT NULL)::int AS with_error
        FROM ${rawEvents}
      `),
      db.select({ count: count() }).from(events),
      db
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
        .limit(20),
    ]);

    return {
      totalRaw: Number(rawSummary?.total_raw ?? 0),
      processed: Number(rawSummary?.processed ?? 0),
      withError: Number(rawSummary?.with_error ?? 0),
      totalEvents: totalEvents?.count ?? 0,
      recentErrors: recentErrors.map((e) => ({
        ...e,
        title: e.title as string,
      })),
    };
  },
  ["admin-pipeline-db-snapshot-v2"],
  {
    revalidate: 5,
    tags: ["admin-pipeline"],
  },
);

export async function getPipelineStats() {
  const [snapshot, monitor] = await Promise.all([
    getPipelineDbSnapshotCached(),
    getPipelineMonitorState(),
  ]);

  return {
    totalRaw: snapshot.totalRaw,
    processed: snapshot.processed,
    withError: snapshot.withError,
    totalEvents: snapshot.totalEvents,
    conversionRate: snapshot.totalRaw ? (snapshot.totalEvents / snapshot.totalRaw) * 100 : 0,
    monitor,
    recentErrors: snapshot.recentErrors,
  };
}

const getRecentRawEventsCached = unstable_cache(
  async (limit: number) => {
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
      .orderBy(desc(rawEvents.scrapedAt))
      .limit(limit);

    return items.map((item) => ({
      ...item,
      title: item.title as string,
    }));
  },
  ["admin-recent-raw-events-v1"],
  {
    revalidate: 5,
    tags: ["admin-pipeline"],
  },
);

export async function getRecentRawEvents(limit: number = 25) {
  return getRecentRawEventsCached(limit);
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
    department: submission.city,
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
  const snapshot = await getAdminDashboardSnapshot();
  return snapshot.enhanced;
}

// ============= Daily Counts =============

export async function getDailyScrapeCounts(days: number = 7) {
  if (days === 7) {
    const snapshot = await getAdminDashboardSnapshot();
    return snapshot.dailyCounts;
  }

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
    .select({
      id: events.id,
      name: events.name,
      slug: events.slug,
      description: events.description,
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
    })
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
  department?: string;
  eventType?: typeof events.$inferSelect.eventType;
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
  const { department, ...rest } = data;
  const resolvedDepartment = department ?? data.city;
  const updatePayload: Partial<typeof events.$inferInsert> = {
    ...rest,
    city: resolvedDepartment,
    department: resolvedDepartment,
  };
  const [updated] = await db
    .update(events)
    .set({
      ...updatePayload,
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
