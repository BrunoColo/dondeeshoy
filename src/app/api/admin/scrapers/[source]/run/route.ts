import { NextRequest, NextResponse } from "next/server";
import { verifyCookie } from "@/lib/admin-auth";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ source: string }> }
) {
  const isAuthenticated = await verifyCookie();
  
  if (!isAuthenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { source } = await params;

  // Validar source
  const validSources = ["redtickets", "entraste", "cartelera", "mvd_eventos", "cobraticket", "ticketfacil"];
  if (!validSources.includes(source)) {
    return NextResponse.json({ error: "Invalid source" }, { status: 400 });
  }

  try {
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      return NextResponse.json({ error: "Cron secret not configured" }, { status: 500 });
    }

    // Llamar al endpoint de scrape existente
    const baseUrl = request.nextUrl.origin;
    const response = await fetch(`${baseUrl}/api/scrape/${source}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${cronSecret}`,
      },
    });

    const data = await response.json();
    
    return NextResponse.json({
      success: response.ok,
      source,
      data,
    });
  } catch (error) {
    console.error("Scraper run error:", error);
    return NextResponse.json({ error: "Failed to run scraper" }, { status: 500 });
  }
}
