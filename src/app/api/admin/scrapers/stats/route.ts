import { NextResponse } from "next/server";
import { verifyCookie } from "@/lib/admin-auth";
import { getScraperStats } from "@/lib/admin-queries";

export async function GET() {
  const isAuthenticated = await verifyCookie();
  
  if (!isAuthenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const stats = await getScraperStats();
    return NextResponse.json({ stats });
  } catch (error) {
    console.error("Scraper stats error:", error);
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
  }
}
