import { NextRequest, NextResponse } from "next/server";
import { verifyCookie } from "@/lib/admin-auth";
import { getRejectedEvents } from "@/lib/admin-queries";

export async function GET(request: NextRequest) {
  const isAuthenticated = await verifyCookie();
  if (!isAuthenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "50");

  try {
    const result = await getRejectedEvents(page, limit);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error getting rejected events:", error);
    return NextResponse.json({ error: "Failed to get rejected events" }, { status: 500 });
  }
}
