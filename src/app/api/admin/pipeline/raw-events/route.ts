import { NextRequest, NextResponse } from "next/server";
import { verifyCookie } from "@/lib/admin-auth";
import { getRawEvents, RawEventsFilters } from "@/lib/admin-queries";

export async function GET(request: NextRequest) {
  const isAuthenticated = await verifyCookie();
  
  if (!isAuthenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const page = parseInt(searchParams.get("page") || "1");
  const source = searchParams.get("source") as RawEventsFilters["source"] || undefined;
  const processed = searchParams.get("processed");
  const hasError = searchParams.get("hasError");

  const filters: RawEventsFilters = {
    source,
    processed: processed === "true" ? true : processed === "false" ? false : undefined,
    hasError: hasError === "true",
  };

  try {
    const result = await getRawEvents(filters, page, 50);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Raw events error:", error);
    return NextResponse.json({ error: "Failed to fetch raw events" }, { status: 500 });
  }
}
