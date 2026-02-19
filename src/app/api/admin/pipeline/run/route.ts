import { NextRequest, NextResponse } from "next/server";
import { verifyCookie } from "@/lib/admin-auth";

export async function POST(request: NextRequest) {
  const isAuthenticated = await verifyCookie();
  
  if (!isAuthenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      return NextResponse.json({ error: "Cron secret not configured" }, { status: 500 });
    }

    const baseUrl = request.nextUrl.origin;
    const response = await fetch(`${baseUrl}/api/scrape/process`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${cronSecret}`,
      },
    });

    const data = await response.json();
    
    return NextResponse.json({
      success: response.ok,
      data,
    });
  } catch (error) {
    console.error("Pipeline run error:", error);
    return NextResponse.json({ error: "Failed to run pipeline" }, { status: 500 });
  }
}
