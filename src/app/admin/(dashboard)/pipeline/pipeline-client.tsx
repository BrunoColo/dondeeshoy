"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type PipelineMonitorStatus = "idle" | "running" | "success" | "partial" | "error";

type PipelineMonitorState = {
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
};

type PipelineRunClientProps = {
  initialMonitor: PipelineMonitorState;
};

type PipelineStatsResponse = {
  monitor: PipelineMonitorState;
};

function formatDateTime(value: string | null) {
  if (!value) return "—";

  return new Date(value).toLocaleString("es-UY", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function getMonitorTone(status: PipelineMonitorStatus) {
  switch (status) {
    case "running":
      return {
        badge: "bg-cyan-500/10 text-cyan-300 border-cyan-500/30",
        panel: "border-cyan-500/30 bg-cyan-500/5",
        bar: "bg-cyan-400",
        label: "Procesando",
      };
    case "success":
      return {
        badge: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
        panel: "border-emerald-500/30 bg-emerald-500/5",
        bar: "bg-emerald-400",
        label: "Terminado OK",
      };
    case "partial":
      return {
        badge: "bg-amber-500/10 text-amber-300 border-amber-500/30",
        panel: "border-amber-500/30 bg-amber-500/5",
        bar: "bg-amber-400",
        label: "Terminado con alertas",
      };
    case "error":
      return {
        badge: "bg-red-500/10 text-red-300 border-red-500/30",
        panel: "border-red-500/30 bg-red-500/5",
        bar: "bg-red-400",
        label: "Falló",
      };
    default:
      return {
        badge: "bg-zinc-800 text-zinc-300 border-zinc-700",
        panel: "border-zinc-800 bg-zinc-900/60",
        bar: "bg-zinc-500",
        label: "Listo para correr",
      };
  }
}

function StatChip({ label, value, emphasize = false }: { label: string; value: number; emphasize?: boolean }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
      <div className="text-[11px] uppercase tracking-wide text-zinc-500">{label}</div>
      <div className={`mt-1 text-lg font-semibold ${emphasize ? "text-red-300" : "text-zinc-100"}`}>{value}</div>
    </div>
  );
}

function DetailLine({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 px-3 py-2">
      <span className="text-zinc-600">{label}: </span>
      <span className="text-zinc-300">{value}</span>
    </div>
  );
}

export function PipelineRunClient({ initialMonitor }: PipelineRunClientProps) {
  const router = useRouter();
  const [monitor, setMonitor] = useState<PipelineMonitorState>(initialMonitor);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);

  const isRunning = monitor.status === "running" || monitor.lockActive;
  const tone = getMonitorTone(monitor.status);

  const progress = useMemo(() => {
    if (monitor.status === "success" || monitor.status === "partial") {
      return 100;
    }

    if (monitor.initialPending <= 0) {
      return isRunning ? 15 : 0;
    }

    const completed = Math.max(monitor.initialPending - monitor.pending, 0);
    return Math.max(0, Math.min(100, Math.round((completed / monitor.initialPending) * 100)));
  }, [isRunning, monitor.initialPending, monitor.pending, monitor.status]);

  const refreshMonitor = useCallback(async () => {
    const response = await fetch("/api/admin/pipeline/stats", {
      method: "GET",
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error("No se pudo actualizar el estado del pipeline.");
    }

    const data = (await response.json()) as PipelineStatsResponse;
    setMonitor(data.monitor);
    return data.monitor;
  }, []);

  useEffect(() => {
    if (!isRunning && !isSubmitting) {
      return;
    }

    let cancelled = false;

    const sync = async () => {
      try {
        const nextMonitor = await refreshMonitor();

        if (cancelled) return;

        if (nextMonitor.status !== "running" && !nextMonitor.lockActive) {
          setIsSubmitting(false);
          router.refresh();
        }
      } catch {
        if (!cancelled) {
          setRequestError("No se pudo refrescar el estado en vivo. Reintentando...");
        }
      }
    };

    void sync();
    const intervalId = window.setInterval(() => {
      void sync();
    }, 3000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [isRunning, isSubmitting, refreshMonitor, router]);

  const handleRun = async () => {
    setIsSubmitting(true);
    setRequestError(null);
    setMonitor((current) => ({
      ...current,
      status: "running",
      message: "Lanzando pipeline...",
      startedAt: current.startedAt ?? new Date().toISOString(),
      lastUpdatedAt: new Date().toISOString(),
      endedAt: null,
    }));

    try {
      const res = await fetch("/api/admin/pipeline/run", {
        method: "POST",
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setRequestError(data?.data?.error ?? data?.error ?? "No se pudo ejecutar el pipeline.");
      }
    } catch {
      setRequestError("No se pudo ejecutar el pipeline.");
    } finally {
      try {
        await refreshMonitor();
      } catch {
        // noop
      }

      setIsSubmitting(false);
      router.refresh();
    }
  };

  return (
    <div className={`rounded-2xl border p-4 md:p-5 ${tone.panel}`}>
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold text-zinc-100">Pipeline de procesamiento</h2>
            <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${tone.badge}`}>
              {tone.label}
            </span>
            {monitor.lockActive && (
              <span className="inline-flex items-center rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-1 text-xs font-medium text-cyan-300">
                lock activo
              </span>
            )}
          </div>

          <p className="max-w-2xl text-sm text-zinc-400">
            {requestError ?? monitor.message ?? "Todavía no hay una ejecución reciente registrada."}
          </p>
        </div>

        <button
          onClick={handleRun}
          disabled={isRunning || isSubmitting}
          className={`rounded-xl border px-4 py-2 text-sm font-medium transition-colors ${
            isRunning || isSubmitting
              ? "cursor-wait border-zinc-700 bg-zinc-800 text-zinc-500"
              : "border-cyan-500/30 bg-cyan-500/10 text-cyan-200 hover:bg-cyan-500/15"
          }`}
        >
          {isRunning || isSubmitting ? "Procesando..." : "Run Pipeline"}
        </button>
      </div>

      <div className="mt-4 space-y-2">
        <div className="flex items-center justify-between text-xs text-zinc-500">
          <span>Progreso estimado</span>
          <span>{progress}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-zinc-900">
          <div
            className={`h-full rounded-full transition-all duration-500 ${tone.bar}`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-sm md:grid-cols-4 xl:grid-cols-8">
        <StatChip label="Pendientes" value={monitor.pending} />
        <StatChip label="Procesados" value={monitor.processed} />
        <StatChip label="Creados" value={monitor.created} />
        <StatChip label="Mergeados" value={monitor.merged} />
        <StatChip label="Saltados" value={monitor.skipped} />
        <StatChip label="Errores" value={monitor.errors} emphasize={monitor.errors > 0} />
        <StatChip label="IA" value={monitor.aiClassified} />
        <StatChip label="Batches" value={monitor.batches} />
      </div>

      <div className="mt-4 grid gap-2 text-xs text-zinc-500 md:grid-cols-3">
        <DetailLine label="Inicio" value={formatDateTime(monitor.startedAt)} />
        <DetailLine label="Última actualización" value={formatDateTime(monitor.lastUpdatedAt)} />
        <DetailLine label="Fin" value={formatDateTime(monitor.endedAt)} />
        <DetailLine label="Batch size" value={monitor.batchSize ?? "—"} />
        <DetailLine label="Pendientes al iniciar" value={monitor.initialPending || "—"} />
        <DetailLine label="Botón" value={isRunning ? "Deshabilitado mientras corre" : "Disponible para lanzar otra corrida"} />
      </div>
    </div>
  );
}

export function PipelineClient({
  action,
  label,
}: {
  action: string;
  label: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");

  const handleAction = async () => {
    setLoading(true);
    setStatus("idle");

    try {
      const res = await fetch(`/api/admin/pipeline/${action}`, {
        method: "POST",
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setStatus("success");
        router.refresh();
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleAction}
      disabled={loading}
      className={`px-4 py-2 text-sm rounded transition-colors ${
        loading
          ? "bg-zinc-700 text-zinc-400 cursor-wait"
          : status === "success"
            ? "bg-green-900/50 text-green-400 border border-green-800"
            : status === "error"
              ? "bg-red-900/50 text-red-400 border border-red-800"
              : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
      }`}
    >
      {loading ? "Working..." : status === "success" ? "Done" : status === "error" ? "Error" : label}
    </button>
  );
}
