import { NextResponse } from "next/server";
import { getEventCountByDate, getEventsByDatePaged, type EventOrderStrategy } from "@/lib/queries";
import { apiRateLimit, getClientIp } from "@/lib/rate-limit";
import type { EventFilters, EventType } from "@/types/events";

export async function GET(request: Request) {
  try {
    const ip = getClientIp(request);
    const { success } = await apiRateLimit.limit(ip);

    if (!success) {
      return NextResponse.json(
        { error: "Demasiadas solicitudes. Probá de nuevo en un minuto.", events: [], totalCount: 0, hasMore: false },
        { status: 429 },
      );
    }

    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date")?.trim() ?? "";
    const offsetParam = searchParams.get("offset")?.trim() ?? "0";
    const limitParam = searchParams.get("limit")?.trim() ?? "6";

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json(
        { error: "Parámetro 'date' inválido.", events: [], totalCount: 0, hasMore: false },
        { status: 400 },
      );
    }

    const offset = Math.max(Number.parseInt(offsetParam, 10) || 0, 0);
    const limit = Math.min(Math.max(Number.parseInt(limitParam, 10) || 6, 1), 30);

    const filters: EventFilters = {};
    const type = searchParams.get("type");
    const genre = searchParams.get("genre");
    const department = searchParams.get("department");
    const free = searchParams.get("free");
    const night = searchParams.get("night");
    const q = searchParams.get("q");
    const recurring = searchParams.get("recurring");
    const strategyParam = searchParams.get("strategy");
    let strategy: EventOrderStrategy = "default";
    if (strategyParam === "diverse" || strategyParam === "fast-diverse") {
      strategy = strategyParam;
    }

    if (type) filters.type = type as EventType;
    if (genre) filters.genre = genre;
    if (department) filters.department = department;
    if (free === "true") filters.free = true;
    if (night === "true") filters.night = true;
    if (q && q.trim().length >= 2) filters.q = q.trim();
    if (recurring === "true") filters.recurring = true;
    if (recurring === "false") filters.recurring = false;

    const [events, totalCount] = await Promise.all([
      getEventsByDatePaged(date, offset, limit, filters, strategy),
      getEventCountByDate(date, filters),
    ]);

    return NextResponse.json(
      {
        date,
        offset,
        limit,
        totalCount,
        hasMore: offset + events.length < totalCount,
        events,
      },
      { headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=60" } },
    );
  } catch (error) {
    console.error("[events-by-date] Error", error);
    return NextResponse.json(
      { error: "No se pudieron cargar los eventos por fecha.", events: [], totalCount: 0, hasMore: false },
      { status: 500 },
    );
  }
}
