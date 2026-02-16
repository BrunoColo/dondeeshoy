import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-background px-5 py-12 text-foreground md:px-10">
      <section className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <p className="inline-flex w-fit rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.14em] text-muted-foreground">
          Fase 0 — Setup en progreso
        </p>

        <h1 className="text-4xl font-bold leading-tight md:text-5xl">
          ¿Dónde es Hoy?
        </h1>

        <p className="text-base leading-7 text-muted-foreground md:text-lg">
          Entrás y en 5 segundos sabés a dónde ir esta noche en Montevideo.
          Ya dejamos la base técnica lista para empezar scrapers + pipeline.
        </p>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="mb-2 text-sm font-semibold text-foreground">Estado actual</p>
          <ul className="space-y-1 text-sm text-muted-foreground">
            <li>• Next.js 16 + TypeScript + Tailwind v4 ✅</li>
            <li>• Drizzle config + schema inicial ✅</li>
            <li>• Endpoints API base para scrapers/pipeline ✅</li>
          </ul>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            className="rounded-xl border border-violet-400/30 bg-violet-500/20 px-4 py-2 text-sm font-medium text-violet-100 transition hover:bg-violet-500/30"
            href="/api/events"
          >
            Ver API base
          </Link>
          <Link
            className="rounded-xl border border-cyan-400/30 bg-cyan-500/20 px-4 py-2 text-sm font-medium text-cyan-100 transition hover:bg-cyan-500/30"
            href="/api/scrape/redtickets"
          >
            Probar endpoint cron
          </Link>
        </div>
      </section>
    </main>
  );
}
