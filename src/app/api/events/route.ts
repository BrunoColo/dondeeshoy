import { NextRequest, NextResponse } from "next/server";
import { searchEvents, getFilterOptions } from "@/lib/queries";
import type { EventType, EventFilters } from "@/types/events";

const VALID_TYPES = new Set<EventType>(["fiesta", "festival", "recital", "club", "bar", "teatro", "otro"]);

/**
 * GET /api/events?q=...&type=...&genre=...&free=true
 * Search and filter events
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const q = searchParams.get("q") ?? undefined;
    const type = searchParams.get("type") as EventType | null;
    const genre = searchParams.get("genre") ?? undefined;
    const department = searchParams.get("department") ?? undefined;
    const free = searchParams.get("free");
    const meta = searchParams.get("meta"); // ?meta=filters returns available filters

    // If meta=filters, return available filter options (single query)
    if (meta === "filters") {
      const data = await getFilterOptions();
      return NextResponse.json({ ok: true, data });
    }

    const filters: EventFilters = {};
    if (q) filters.q = q;
    if (type && VALID_TYPES.has(type)) filters.type = type;
    if (genre) filters.genre = genre;
    if (department) filters.department = department;
    if (free === "true") filters.free = true;

    const results = await searchEvents(filters);

    return NextResponse.json({ ok: true, data: results });
  } catch (error) {
    console.error("[API /events] Error:", error);
    return NextResponse.json(
      { ok: false, error: "Error interno al buscar eventos" },
      { status: 500 },
    );
  }
}
