import { NextRequest, NextResponse } from "next/server";
import { getSubmissions } from "@/lib/admin-queries";
import { verifyCookie } from "@/lib/admin-auth";

export async function GET(request: NextRequest) {
  // Verify admin session
  const isAuthenticated = await verifyCookie();
  if (!isAuthenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const status = searchParams.get("status") as "pending" | "approved" | "rejected" | null;
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");

  try {
    const result = await getSubmissions(status || undefined, page, limit);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching submissions:", error);
    return NextResponse.json({ error: "Failed to fetch submissions" }, { status: 500 });
  }
}
