import { NextRequest, NextResponse } from "next/server";
import { searchEvents, getFilterOptions } from "@/lib/queries";
import { apiRateLimit, getClientIp } from "@/lib/rate-limit";
import { EVENT_TYPES } from "@/types/events";
import type { EventType, EventFilters } from "@/types/events";

const VALID_TYPES = new Set<EventType>(EVENT_TYPES);

/** Maximum events returned per request — prevents full-DB dumps */
const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 20;

/**
 * Strip internal/sensitive fields before sending to public consumers.
 * Hides scraping sources, internal IDs and raw timestamps.
 */
function sanitizeEvent(event: Record<string, unknown>): Record<string, unknown> {
  const {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    confidenceScore: _cs,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    createdAt: _ca,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    updatedAt: _ua,
    ...safe
  } = event;
  return safe;
}

/**
 * GET /api/events?q=...&type=...&genre=...&free=true&limit=20&offset=0
 * Search and filter events — rate-limited, paginated, sanitized.
 */
export async function GET(request: NextRequest) {
  // ── Rate limiting ──────────────────────────────────────────────────────────
  const ip = getClientIp(request);
  const { success, limit, remaining, reset } = await apiRateLimit.limit(ip);

  if (!success) {
    return NextResponse.json(
      { ok: false, error: "Demasiadas solicitudes. Intentá de nuevo en un momento." },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil((reset - Date.now()) / 1000)),
          "X-RateLimit-Limit": String(limit),
          "X-RateLimit-Remaining": "0",
          "Cache-Control": "no-store",
        },
      },
    );
  }

  try {
    const { searchParams } = request.nextUrl;
    const q = searchParams.get("q") ?? undefined;
    const type = searchParams.get("type") as EventType | null;
    const genre = searchParams.get("genre") ?? undefined;
    const department = searchParams.get("department") ?? undefined;
    const free = searchParams.get("free");
    const meta = searchParams.get("meta");

    // ── Pagination ─────────────────────────────────────────────────────────
    const rawLimit = Number.parseInt(searchParams.get("limit") ?? String(DEFAULT_LIMIT), 10);
    const pageLimit = Number.isNaN(rawLimit) ? DEFAULT_LIMIT : Math.min(Math.max(1, rawLimit), MAX_LIMIT);
    const rawOffset = Number.parseInt(searchParams.get("offset") ?? "0", 10);
    const offset = Number.isNaN(rawOffset) ? 0 : Math.max(0, rawOffset);

    // If meta=filters, return available filter options (single query, no pagination needed)
    if (meta === "filters") {
      const data = await getFilterOptions();
      return NextResponse.json(
        { ok: true, data },
        {
          headers: {
            "X-RateLimit-Remaining": String(remaining),
            "Cache-Control": "s-maxage=60, stale-while-revalidate=300",
          },
        },
      );
    }

    const filters: EventFilters = {};
    if (q) filters.q = q;
    if (type && VALID_TYPES.has(type)) filters.type = type;
    if (genre) filters.genre = genre;
    if (department) filters.department = department;
    if (free === "true") filters.free = true;

    const results = await searchEvents(filters, pageLimit, offset);

    // ── Sanitize ───────────────────────────────────────────────────────────
    const sanitized = results.map((e) => sanitizeEvent(e as unknown as Record<string, unknown>));

    return NextResponse.json(
      {
        ok: true,
        data: sanitized,
        pagination: {
          limit: pageLimit,
          offset,
          count: sanitized.length,
          hasMore: sanitized.length === pageLimit,
        },
      },
      {
        headers: {
          "X-RateLimit-Limit": String(limit),
          "X-RateLimit-Remaining": String(remaining),
          "Cache-Control": "s-maxage=60, stale-while-revalidate=300",
        },
      },
    );
  } catch (error) {
    console.error("[API /events] Error:", error);
    return NextResponse.json(
      { ok: false, error: "Error interno al buscar eventos" },
      { status: 500 },
    );
  }
}
