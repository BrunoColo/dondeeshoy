import { NextResponse } from "next/server";
import { EntrasteScraper } from "@/scrapers/entraste";

function isAuthorized(request: Request): boolean {
  const incoming = request.headers.get("x-cron-secret");
  const expected = process.env.CRON_SECRET;

  if (!expected) {
    return false;
  }

  return incoming === expected;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const scraper = new EntrasteScraper();
    const result = await scraper.run();

    return NextResponse.json({
      ok: true,
      source: "entraste",
      message: "Scraper ejecutado correctamente.",
      data: result,
    });
  } catch (error) {
    console.error("[api/scrape/entraste] error", error);

    return NextResponse.json(
      {
        ok: false,
        source: "entraste",
        error: "Falló la ejecución del scraper de Entraste.",
      },
      { status: 500 },
    );
  }
}
