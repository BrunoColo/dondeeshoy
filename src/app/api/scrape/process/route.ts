import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { runProcessingPipeline, type PipelineResult } from "@/processing/pipeline";
import {
  getPipelineMonitorState,
  setPipelineMonitorState,
} from "@/lib/pipeline-monitor";
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
    const state = await getPipelineMonitorState();

    return NextResponse.json(
      {
        ok: false,
        error: "Pipeline ya en ejecución. Se evitó ejecución concurrente.",
        state,
      },
      { status: 409, headers: getNoStoreHeaders() },
    );
  }

  const runId = crypto.randomUUID();
  let startedAt: string | null = null;
  let batchSize: number | null = null;
  let batches = 0;
  const totals: PipelineResult = {
    pending: 0,
    processed: 0,
    created: 0,
    merged: 0,
    skipped: 0,
    errors: 0,
    aiClassified: 0,
  };
  let initialPending = 0;

  try {
    const url = new URL(request.url);
    batchSize = normalizeBatchSize(url.searchParams.get("batch"), 50, 200);
    startedAt = new Date().toISOString();

    await setPipelineMonitorState({
      runId,
      status: "running",
      message: "Procesando eventos pendientes...",
      startedAt,
      lastUpdatedAt: startedAt,
      endedAt: null,
      batchSize,
      batches: 0,
      initialPending: 0,
      pending: 0,
      processed: 0,
      created: 0,
      merged: 0,
      skipped: 0,
      errors: 0,
      aiClassified: 0,
    });

    // Drain the pending queue in a loop until:
    //   (a) no more pending events, or
    //   (b) we're approaching the function timeout.
    const startMs = Date.now();

    while (Date.now() - startMs < DRAIN_BUDGET_MS) {
      const result = await runProcessingPipeline(batchSize);
      batches += 1;

      if (batches === 1) {
        initialPending = result.pending + result.processed;
      }

      totals.pending = result.pending;
      totals.processed += result.processed;
      totals.created += result.created;
      totals.merged += result.merged;
      totals.skipped += result.skipped;
      totals.errors += result.errors;
      totals.aiClassified += result.aiClassified;

      const now = new Date().toISOString();

      await setPipelineMonitorState({
        runId,
        status: "running",
        message:
          result.pending === 0
            ? "Terminando ejecución del pipeline..."
            : `Procesando eventos pendientes... Quedan ${result.pending}.`,
        startedAt,
        lastUpdatedAt: now,
        endedAt: null,
        batchSize,
        batches,
        initialPending,
        pending: result.pending,
        processed: totals.processed,
        created: totals.created,
        merged: totals.merged,
        skipped: totals.skipped,
        errors: totals.errors,
        aiClassified: totals.aiClassified,
      });

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

    const endedAt = new Date().toISOString();
    const finalStatus = totals.errors > 0 ? "partial" : "success";

    await setPipelineMonitorState({
      runId,
      status: finalStatus,
      message:
        finalStatus === "success"
          ? "Pipeline finalizado correctamente."
          : "Pipeline finalizado con algunos errores. Revisá el resumen.",
      startedAt,
      lastUpdatedAt: endedAt,
      endedAt,
      batchSize,
      batches,
      initialPending,
      pending: totals.pending,
      processed: totals.processed,
      created: totals.created,
      merged: totals.merged,
      skipped: totals.skipped,
      errors: totals.errors,
      aiClassified: totals.aiClassified,
    });

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

    const endedAt = new Date().toISOString();

    await setPipelineMonitorState({
      runId,
      status: "error",
      message: "Falló la ejecución del pipeline de procesamiento.",
      startedAt,
      lastUpdatedAt: endedAt,
      endedAt,
      batchSize,
      batches,
      initialPending,
      pending: totals.pending,
      processed: totals.processed,
      created: totals.created,
      merged: totals.merged,
      skipped: totals.skipped,
      errors: totals.errors,
      aiClassified: totals.aiClassified,
    });

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
