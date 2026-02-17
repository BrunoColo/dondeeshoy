import { NextResponse } from "next/server";
import { EntrasteScraper } from "@/scrapers/entraste";
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

  const lock = await acquireCronLock("entraste", 1_200);

  if (!lock) {
    return NextResponse.json(
      {
        ok: false,
        source: "entraste",
        error: "Scraper ya en ejecución. Se evitó una ejecución concurrente.",
      },
      { status: 409, headers: getNoStoreHeaders() },
    );
  }

  try {
    const scraper = new EntrasteScraper();
    const result = await scraper.run();

    return NextResponse.json({
      ok: true,
      source: "entraste",
      message: "Scraper ejecutado correctamente.",
      data: result,
    }, { headers: getNoStoreHeaders() });
  } catch (error) {
    console.error("[api/scrape/entraste] error", error);

    return NextResponse.json(
      {
        ok: false,
        source: "entraste",
        error: "Falló la ejecución del scraper de Entraste.",
      },
      { status: 500, headers: getNoStoreHeaders() },
    );
  } finally {
    await releaseCronLock(lock);
  }
}
