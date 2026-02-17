import { NextResponse } from "next/server";
import { RedTicketsScraper } from "@/scrapers/redtickets";
import {
  acquireCronLock,
  getNoStoreHeaders,
  isCronAuthorized,
  releaseCronLock,
} from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401, headers: getNoStoreHeaders() },
    );
  }

  const lock = await acquireCronLock("redtickets", 1_200);

  if (!lock) {
    return NextResponse.json(
      {
        ok: false,
        source: "redtickets",
        error: "Scraper ya en ejecución. Se evitó una ejecución concurrente.",
      },
      { status: 409, headers: getNoStoreHeaders() },
    );
  }

  try {
    const scraper = new RedTicketsScraper();
    const result = await scraper.run();

    return NextResponse.json({
      ok: true,
      source: "redtickets",
      message: "Scraper ejecutado correctamente.",
      data: result,
    }, { headers: getNoStoreHeaders() });
  } catch (error) {
    console.error("[api/scrape/redtickets] error", error);

    return NextResponse.json(
      {
        ok: false,
        source: "redtickets",
        error: "Falló la ejecución del scraper de RedTickets.",
      },
      { status: 500, headers: getNoStoreHeaders() },
    );
  } finally {
    await releaseCronLock(lock);
  }
}
