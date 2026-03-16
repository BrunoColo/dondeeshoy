import { NextRequest, NextResponse } from "next/server";
import { verifyCookie } from "@/lib/admin-auth";
import { CarteleraScraper } from "@/scrapers/cartelera";
import { CobraTicketScraper } from "@/scrapers/cobraticket";
import { EntrasteScraper } from "@/scrapers/entraste";
import { HayPlanScraper } from "@/scrapers/hayplan";
import { MiEntradaScraper } from "@/scrapers/mientrada";
import { MvdEventosScraper } from "@/scrapers/mvd-eventos";
import { RedTicketsScraper } from "@/scrapers/redtickets";
import { TicketFacilScraper } from "@/scrapers/ticketfacil";
import { acquireCronLock, releaseCronLock } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const validSources = ["redtickets", "entraste", "cartelera", "mvd_eventos", "cobraticket", "ticketfacil", "mientrada", "hayplan"] as const;

type ValidSource = (typeof validSources)[number];

function isValidSource(source: string): source is ValidSource {
  return validSources.includes(source as ValidSource);
}

function createScraper(source: ValidSource) {
  switch (source) {
    case "redtickets":
      return new RedTicketsScraper();
    case "entraste":
      return new EntrasteScraper();
    case "cartelera":
      return new CarteleraScraper();
    case "mvd_eventos":
      return new MvdEventosScraper();
    case "cobraticket":
      return new CobraTicketScraper();
    case "ticketfacil":
      return new TicketFacilScraper();
    case "mientrada":
      return new MiEntradaScraper();
    case "hayplan":
      return new HayPlanScraper();
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ source: string }> }
) {
  const isAuthenticated = await verifyCookie();
  
  if (!isAuthenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { source } = await params;

  if (!isValidSource(source)) {
    return NextResponse.json({ error: "Invalid source" }, { status: 400 });
  }

  const lock = await acquireCronLock(source, 1_200);

  if (!lock) {
    return NextResponse.json(
      {
        success: false,
        source,
        data: {
          ok: false,
          source,
          error: "Scraper ya en ejecución. Se evitó una ejecución concurrente.",
        },
      },
      { status: 409 },
    );
  }

  try {
    const scraper = createScraper(source);
    const result = await scraper.run();

    return NextResponse.json({
      success: true,
      source,
      data: {
        ok: true,
        source,
        message: "Scraper ejecutado correctamente.",
        data: result,
      },
    });
  } catch (error) {
    console.error("Scraper run error:", error);
    return NextResponse.json({ error: "Failed to run scraper" }, { status: 500 });
  } finally {
    await releaseCronLock(lock);
  }
}
