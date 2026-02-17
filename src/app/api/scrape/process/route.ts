import { NextResponse } from "next/server";
import { runProcessingPipeline } from "@/processing/pipeline";
import {
  acquireCronLock,
  getNoStoreHeaders,
  isCronAuthorized,
  normalizeBatchSize,
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

  const lock = await acquireCronLock("process", 1_800);

  if (!lock) {
    return NextResponse.json(
      {
        ok: false,
        error: "Pipeline ya en ejecución. Se evitó ejecución concurrente.",
      },
      { status: 409, headers: getNoStoreHeaders() },
    );
  }

  try {
    const url = new URL(request.url);
    const batchSize = normalizeBatchSize(url.searchParams.get("batch"), 50, 200);

    const result = await runProcessingPipeline(batchSize);

    return NextResponse.json({
      ok: true,
      message: "Pipeline ejecutado correctamente.",
      data: {
        ...result,
        batchSize,
      },
    }, { headers: getNoStoreHeaders() });
  } catch (error) {
    console.error("[api/scrape/process] error", error);

    return NextResponse.json(
      {
        ok: false,
        error: "Falló la ejecución del pipeline de procesamiento.",
      },
      { status: 500, headers: getNoStoreHeaders() },
    );
  } finally {
    await releaseCronLock(lock);
  }
}
