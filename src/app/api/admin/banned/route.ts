import { NextRequest, NextResponse } from "next/server";
import { verifyCookie } from "@/lib/admin-auth";
import { getBannedEvents } from "@/lib/admin-queries";

export async function GET(request: NextRequest) {
  const isAuthenticated = await verifyCookie();
  if (!isAuthenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") ?? "1", 10);
  const limit = parseInt(searchParams.get("limit") ?? "50", 10);

  try {
    const data = await getBannedEvents(page, limit);
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error getting banned events:", error);
    return NextResponse.json({ error: "Failed to get banned events" }, { status: 500 });
  }
}
