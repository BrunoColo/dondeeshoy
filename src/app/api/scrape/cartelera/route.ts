import { NextResponse } from "next/server";
import { CarteleraScraper } from "@/scrapers/cartelera";
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

  const lock = await acquireCronLock("cartelera", 1_200);

  if (!lock) {
    return NextResponse.json(
      {
        ok: false,
        source: "cartelera",
        error: "Scraper ya en ejecución. Se evitó una ejecución concurrente.",
      },
      { status: 409, headers: getNoStoreHeaders() },
    );
  }

  try {
    const scraper = new CarteleraScraper();
    const result = await scraper.run();

    return NextResponse.json({
      ok: true,
      source: "cartelera",
      message: "Scraper ejecutado correctamente.",
      data: result,
    }, { headers: getNoStoreHeaders() });
  } catch (error) {
    console.error("[api/scrape/cartelera] error", error);

    return NextResponse.json(
      {
        ok: false,
        source: "cartelera",
        error: "Falló la ejecución del scraper de Cartelera.",
      },
      { status: 500, headers: getNoStoreHeaders() },
    );
  } finally {
    await releaseCronLock(lock);
  }
}
