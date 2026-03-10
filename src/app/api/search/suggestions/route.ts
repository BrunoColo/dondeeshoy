import { NextResponse } from "next/server";
import { getSearchSuggestions } from "@/lib/queries";
import { apiRateLimit, getClientIp } from "@/lib/rate-limit";

export async function GET(request: Request) {
  try {
    const ip = getClientIp(request);
    const { success, limit, remaining, reset } = await apiRateLimit.limit(ip);

    if (!success) {
      return NextResponse.json(
        { error: "Demasiadas búsquedas. Probá de nuevo en un minuto.", suggestions: [] },
        {
          status: 429,
          headers: {
            "Cache-Control": "no-store",
            "X-RateLimit-Limit": String(limit),
            "X-RateLimit-Remaining": String(remaining),
            "X-RateLimit-Reset": String(reset),
          },
        },
      );
    }

    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim() ?? "";

    if (q.length < 2) {
      return NextResponse.json(
        { suggestions: [] },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    const suggestions = await getSearchSuggestions(q, 5);

    return NextResponse.json(
      { suggestions },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("[search-suggestions] Error", error);
    return NextResponse.json(
      { error: "No se pudieron cargar sugerencias.", suggestions: [] },
      {
        status: 500,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}