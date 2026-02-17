"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app/error]", error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="rounded-2xl border border-neon-red/25 bg-neon-red/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-neon-red">
        Error inesperado
      </div>

      <h2 className="font-display text-2xl font-bold text-foreground sm:text-3xl">
        Algo salió mal
      </h2>

      <p className="max-w-md text-sm text-muted-foreground sm:text-base">
        Ocurrió un error al renderizar esta pantalla. Probá recargar o intentá de nuevo en unos segundos.
      </p>

      <button
        type="button"
        onClick={reset}
        className="btn-neon mt-2"
      >
        Reintentar
      </button>
    </div>
  );
}