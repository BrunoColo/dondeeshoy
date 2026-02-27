import { NextRequest, NextResponse } from "next/server";
import { verifyCookie } from "@/lib/admin-auth";
import { searchEvents } from "@/lib/admin-queries";

export async function GET(request: NextRequest) {
  const isAuthenticated = await verifyCookie();
  if (!isAuthenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") || undefined;
  const status = searchParams.get("status") as "active" | "cancelled" | "past" | undefined;
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");

  try {
    const result = await searchEvents({ query, status, page, limit });
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error searching events:", error);
    return NextResponse.json({ error: "Failed to search events" }, { status: 500 });
  }
}
