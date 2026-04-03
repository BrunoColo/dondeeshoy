import { NextResponse } from "next/server";
import { getUpcomingEventGroupsPreview } from "@/lib/queries";
import { apiRateLimit, getClientIp } from "@/lib/rate-limit";
import type { EventType, EventFilters } from "@/types/events";

export async function GET(request: Request) {
  try {
    const ip = getClientIp(request);
    const { success } = await apiRateLimit.limit(ip);

    if (!success) {
      return NextResponse.json(
        { error: "Demasiadas solicitudes. Probá de nuevo en un minuto.", groups: [] },
        { status: 429 },
      );
    }

    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from")?.trim() ?? "";
    const daysParam = searchParams.get("days")?.trim() ?? "7";

    if (!/^\d{4}-\d{2}-\d{2}$/.test(from)) {
      return NextResponse.json(
        { error: "Parámetro 'from' inválido.", groups: [] },
        { status: 400 },
      );
    }

    const days = Math.min(Math.max(Number.parseInt(daysParam, 10) || 7, 1), 30);

    // Parse optional filters
    const filters: EventFilters = {};
    const type = searchParams.get("type");
    const genre = searchParams.get("genre");
    const department = searchParams.get("department");
    const free = searchParams.get("free");
    const night = searchParams.get("night");
    const q = searchParams.get("q");

    if (type) filters.type = type as EventType;
    if (genre) filters.genre = genre;
    if (department) filters.department = department;
    if (free === "true") filters.free = true;
    if (night === "true") filters.night = true;
    if (q && q.trim().length >= 2) filters.q = q.trim();

    const dayPreview = await getUpcomingEventGroupsPreview(from, days, 6, filters, "fast-diverse");

    const groups = dayPreview.map(({ date, events: allDateEvents, totalCount }) => ({
      date,
      totalCount,
      events: allDateEvents.filter((e) => !e.isRecurring),
      recurringEvents: allDateEvents.filter((e) => e.isRecurring),
    }));

    return NextResponse.json(
      { groups },
      { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60" } },
    );
  } catch (error) {
    console.error("[upcoming-events] Error", error);
    return NextResponse.json(
      { error: "No se pudieron cargar los eventos.", groups: [] },
      { status: 500 },
    );
  }
}
