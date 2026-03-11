import { NextRequest, NextResponse } from "next/server";
import { verifyCookie } from "@/lib/admin-auth";
import { GET as runPipelineRoute } from "@/app/api/scrape/process/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ADMIN_PIPELINE_BATCH_SIZE = 150;

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

    const targetUrl = new URL(`/api/scrape/process?batch=${ADMIN_PIPELINE_BATCH_SIZE}`, request.nextUrl.origin);
    const response = await runPipelineRoute(
      new Request(targetUrl.toString(), {
        method: "GET",
        headers: {
          Authorization: `Bearer ${cronSecret}`,
        },
      }),
    );

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
