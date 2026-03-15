import { NextResponse } from "next/server";
import { PasslineScraper } from "@/scrapers/passline";
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

  const lock = await acquireCronLock("passline", 1_200);

  if (!lock) {
    return NextResponse.json(
      {
        ok: false,
        source: "passline",
        error: "Scraper ya en ejecución. Se evitó una ejecución concurrente.",
      },
      { status: 409, headers: getNoStoreHeaders() },
    );
  }

  try {
    const scraper = new PasslineScraper();
    const result = await scraper.run();

    return NextResponse.json({
      ok: true,
      source: "passline",
      message: "Scraper ejecutado correctamente.",
      data: result,
    }, { headers: getNoStoreHeaders() });
  } catch (error) {
    console.error("[api/scrape/passline] error", error);

    return NextResponse.json(
      {
        ok: false,
        source: "passline",
        error: "Falló la ejecución del scraper de Passline.",
      },
      { status: 500, headers: getNoStoreHeaders() },
    );
  } finally {
    await releaseCronLock(lock);
  }
}