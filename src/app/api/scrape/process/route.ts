import { NextResponse } from "next/server";
import { runProcessingPipeline } from "@/processing/pipeline";

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
    const url = new URL(request.url);
    const batchParam = url.searchParams.get("batch");
    const batchSize = batchParam ? Number.parseInt(batchParam, 10) : 50;

    const result = await runProcessingPipeline(Number.isNaN(batchSize) ? 50 : batchSize);

    return NextResponse.json({
      ok: true,
      message: "Pipeline ejecutado correctamente.",
      data: result,
    });
  } catch (error) {
    console.error("[api/scrape/process] error", error);

    return NextResponse.json(
      {
        ok: false,
        error: "Falló la ejecución del pipeline de procesamiento.",
      },
      { status: 500 },
    );
  }
}
