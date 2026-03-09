import "server-only";

import { redis } from "@/lib/redis";

const PIPELINE_MONITOR_KEY = "status:pipeline:process";
const PIPELINE_LOCK_KEY = "lock:cron:process";
const PIPELINE_MONITOR_TTL_SECONDS = 60 * 60 * 12;

export type PipelineMonitorStatus = "idle" | "running" | "success" | "partial" | "error";

export interface PipelineMonitorState {
  runId: string | null;
  status: PipelineMonitorStatus;
  message: string | null;
  startedAt: string | null;
  lastUpdatedAt: string | null;
  endedAt: string | null;
  batchSize: number | null;
  batches: number;
  initialPending: number;
  pending: number;
  processed: number;
  created: number;
  merged: number;
  skipped: number;
  errors: number;
  aiClassified: number;
  lockActive: boolean;
}

function emptyState(): PipelineMonitorState {
  return {
    runId: null,
    status: "idle",
    message: null,
    startedAt: null,
    lastUpdatedAt: null,
    endedAt: null,
    batchSize: null,
    batches: 0,
    initialPending: 0,
    pending: 0,
    processed: 0,
    created: 0,
    merged: 0,
    skipped: 0,
    errors: 0,
    aiClassified: 0,
    lockActive: false,
  };
}

function coerceNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function hydrateState(value: unknown): PipelineMonitorState {
  if (!value || typeof value !== "object") {
    return emptyState();
  }

  const input = value as Record<string, unknown>;
  return {
    runId: typeof input.runId === "string" ? input.runId : null,
    status: isMonitorStatus(input.status) ? input.status : "idle",
    message: typeof input.message === "string" ? input.message : null,
    startedAt: typeof input.startedAt === "string" ? input.startedAt : null,
    lastUpdatedAt: typeof input.lastUpdatedAt === "string" ? input.lastUpdatedAt : null,
    endedAt: typeof input.endedAt === "string" ? input.endedAt : null,
    batchSize: typeof input.batchSize === "number" ? input.batchSize : null,
    batches: coerceNumber(input.batches),
    initialPending: coerceNumber(input.initialPending),
    pending: coerceNumber(input.pending),
    processed: coerceNumber(input.processed),
    created: coerceNumber(input.created),
    merged: coerceNumber(input.merged),
    skipped: coerceNumber(input.skipped),
    errors: coerceNumber(input.errors),
    aiClassified: coerceNumber(input.aiClassified),
    lockActive: false,
  };
}

function isMonitorStatus(value: unknown): value is PipelineMonitorStatus {
  return value === "idle" || value === "running" || value === "success" || value === "partial" || value === "error";
}

async function getStoredPipelineMonitorState(): Promise<PipelineMonitorState> {
  const raw = await redis.get<unknown>(PIPELINE_MONITOR_KEY);
  return hydrateState(raw);
}

export async function getPipelineMonitorState(): Promise<PipelineMonitorState> {
  const [stored, lockToken] = await Promise.all([
    getStoredPipelineMonitorState(),
    redis.get<string | null>(PIPELINE_LOCK_KEY),
  ]);

  const lockActive = typeof lockToken === "string" && lockToken.length > 0;
  const state: PipelineMonitorState = {
    ...stored,
    lockActive,
  };

  if (state.status === "running" && !lockActive && !state.endedAt) {
    return {
      ...state,
      status: "error",
      message: state.message ?? "La ejecución parece haberse interrumpido antes de terminar.",
      endedAt: state.lastUpdatedAt,
    };
  }

  return state;
}

export async function setPipelineMonitorState(state: Omit<PipelineMonitorState, "lockActive">): Promise<void> {
  await redis.set(PIPELINE_MONITOR_KEY, state, { ex: PIPELINE_MONITOR_TTL_SECONDS });
}

export async function resetPipelineMonitorState(): Promise<void> {
  await setPipelineMonitorState({
    ...emptyState(),
  });
}
