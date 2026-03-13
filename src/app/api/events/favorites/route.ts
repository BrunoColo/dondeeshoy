import { NextRequest, NextResponse } from "next/server";
import { getEventsBySlugs } from "@/lib/queries";
import { apiRateLimit, getClientIp } from "@/lib/rate-limit";

const MAX_SLUGS_PER_REQUEST = 100;

function parseSlugs(rawSlugs: string | null): string[] {
  if (!rawSlugs) return [];

  const unique = new Set<string>();

  for (const raw of rawSlugs.split(",")) {
    const slug = raw.trim().toLowerCase();
    if (!slug) continue;
    if (unique.has(slug)) continue;

    unique.add(slug);
    if (unique.size >= MAX_SLUGS_PER_REQUEST) break;
  }

  return [...unique];
}

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

export async function GET(request: NextRequest) {
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
    const slugsParam = request.nextUrl.searchParams.get("slugs");

    if (!slugsParam || slugsParam.trim().length === 0) {
      return NextResponse.json(
        { ok: true, data: [] },
        {
          headers: {
            "X-RateLimit-Limit": String(limit),
            "X-RateLimit-Remaining": String(remaining),
            "Cache-Control": "s-maxage=60, stale-while-revalidate=300",
          },
        },
      );
    }

    const requestedCount = slugsParam
      .split(",")
      .map((slug) => slug.trim())
      .filter(Boolean).length;

    if (requestedCount > MAX_SLUGS_PER_REQUEST) {
      return NextResponse.json(
        {
          ok: false,
          error: `Máximo ${MAX_SLUGS_PER_REQUEST} favoritos por solicitud.`,
        },
        { status: 400 },
      );
    }

    const slugs = parseSlugs(slugsParam);

    const events = await getEventsBySlugs(slugs);
    const sanitized = events.map((event) => sanitizeEvent(event as unknown as Record<string, unknown>));

    return NextResponse.json(
      {
        ok: true,
        data: sanitized,
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
    console.error("[API /events/favorites] Error:", error);
    return NextResponse.json(
      { ok: false, error: "Error interno al obtener favoritos" },
      { status: 500 },
    );
  }
}
