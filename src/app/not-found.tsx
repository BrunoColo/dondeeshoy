import Link from "next/link";
import { SearchX } from "lucide-react";

export default function NotFound() {
  return (
    <div className="relative z-10 flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <div className="relative mb-6">
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-white/[0.03] border border-white/[0.06]">
          <SearchX className="h-8 w-8 text-neon-violet" strokeWidth={1.5} />
        </div>
        <div className="absolute inset-0 -z-10 rounded-2xl bg-neon-violet opacity-15 blur-2xl" />
      </div>

      <h1 className="font-display text-2xl font-bold text-foreground mb-2">
        Página no encontrada
      </h1>
      <p className="max-w-sm text-sm leading-relaxed text-muted-foreground mb-8">
        El evento que buscás no existe o fue removido. Volvé al inicio para ver qué hay esta noche.
      </p>

      <Link
        href="/"
        className="btn-neon inline-flex items-center gap-2"
      >
        Volver al inicio
      </Link>
    </div>
  );
}
