import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { runProcessingPipeline, type PipelineResult } from "@/processing/pipeline";
import {
  acquireCronLock,
  getNoStoreHeaders,
  isCronAuthorized,
  normalizeBatchSize,
  releaseCronLock,
} from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Allow up to 300s so the drain loop can process multiple batches in one cron invocation.
export const maxDuration = 300;

// Leave a 30-second safety margin before the hard Vercel timeout.
const DRAIN_BUDGET_MS = (maxDuration - 30) * 1_000;

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

    // Drain the pending queue in a loop until:
    //   (a) no more pending events, or
    //   (b) we're approaching the function timeout.
    const startMs = Date.now();
    const totals: PipelineResult = {
      pending: 0,
      processed: 0,
      created: 0,
      merged: 0,
      skipped: 0,
      errors: 0,
      aiClassified: 0,
    };
    let batches = 0;

    while (Date.now() - startMs < DRAIN_BUDGET_MS) {
      const result = await runProcessingPipeline(batchSize);
      batches += 1;

      totals.pending = result.pending;
      totals.processed += result.processed;
      totals.created += result.created;
      totals.merged += result.merged;
      totals.skipped += result.skipped;
      totals.errors += result.errors;
      totals.aiClassified += result.aiClassified;

      // Stop when there's nothing left to process.
      if (result.pending === 0) break;

      // Also stop if the batch returned 0 processed events to avoid a tight
      // loop against a persistent error.
      if (result.processed === 0) break;
    }

    if (totals.created > 0 || totals.merged > 0) {
      revalidatePath("/");
      revalidatePath("/proximos");
      revalidatePath("/mapa");
    }

    return NextResponse.json({
      ok: true,
      message: "Pipeline ejecutado correctamente.",
      data: {
        ...totals,
        batchSize,
        batches,
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
