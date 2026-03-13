"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Heart, Loader2, Sparkles, Trash2 } from "lucide-react";
import { useFavorites } from "@/hooks/use-favorites";
import { EventList, type EventListItem } from "@/components/events/event-list";

interface FavoritesApiResponse {
  ok: boolean;
  data?: EventListItem[];
  error?: string;
}

export function FavoritesClient() {
  const { favorites, hydrated, clearFavorites } = useFavorites();
  const [events, setEvents] = useState<EventListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [missingCount, setMissingCount] = useState(0);

  const favoritesCsv = useMemo(() => favorites.join(","), [favorites]);

  useEffect(() => {
    if (!hydrated) return;

    if (favorites.length === 0) {
      setEvents([]);
      setMissingCount(0);
      setError(null);
      return;
    }

    const controller = new AbortController();

    const loadFavorites = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`/api/events/favorites?slugs=${encodeURIComponent(favoritesCsv)}`, {
          signal: controller.signal,
          headers: {
            Accept: "application/json",
          },
        });

        const payload = (await response.json()) as FavoritesApiResponse;

        if (!response.ok || !payload.ok) {
          throw new Error(payload.error || "No pudimos cargar tus favoritos.");
        }

        const data = payload.data ?? [];
        setEvents(data);

        const aliveSlugs = new Set(data.map((event) => event.slug));
        const missing = favorites.filter((slug) => !aliveSlugs.has(slug)).length;
        setMissingCount(missing);
      } catch (requestError) {
        if (controller.signal.aborted) return;

        const message = requestError instanceof Error
          ? requestError.message
          : "No pudimos cargar tus favoritos.";

        setError(message);
        setEvents([]);
        setMissingCount(0);
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    loadFavorites();

    return () => controller.abort();
  }, [favorites, favoritesCsv, hydrated]);

  if (!hydrated) {
    return (
      <div className="pt-4 pb-8">
        <div className="mb-4 flex items-center gap-2">
          <Heart className="h-5 w-5 text-teal-300" strokeWidth={2.4} />
          <h1 className="font-display text-xl font-bold text-white">Favoritos</h1>
        </div>
        <div className="glass-card rounded-2xl p-6">
          <div className="flex items-center gap-2 text-sm text-[#A8B8CC]">
            <Loader2 className="h-4 w-4 animate-spin" />
            Preparando tus favoritos...
          </div>
        </div>
      </div>
    );
  }

  if (favorites.length === 0) {
    return (
      <div className="pt-4 pb-8">
        <header className="mb-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-teal-400/35 bg-teal-500/10 px-3 py-1">
            <Heart className="h-3.5 w-3.5 text-teal-300" strokeWidth={2.4} />
            <span className="text-[10px] font-bold uppercase tracking-[0.17em] text-teal-200">Favoritos</span>
          </div>
          <h1 className="mt-3 font-display text-2xl font-extrabold text-white">Tu lista está vacía</h1>
          <p className="mt-2 text-sm text-[#A8B8CC]">
            Tocá el corazón en cualquier evento para guardarlo acá.
          </p>
        </header>

        <div className="glass-card rounded-2xl p-5">
          <Link
            href="/proximos"
            className="inline-flex min-h-10 items-center gap-2 rounded-full border border-indigo-400/35 bg-gradient-to-r from-indigo-500/20 to-teal-500/20 px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110"
          >
            <Sparkles className="h-4 w-4" strokeWidth={2.2} />
            Explorar próximos eventos
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-4 pb-8">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-teal-400/35 bg-teal-500/10 px-3 py-1">
            <Heart className="h-3.5 w-3.5 text-teal-300" strokeWidth={2.4} />
            <span className="text-[10px] font-bold uppercase tracking-[0.17em] text-teal-200">Favoritos</span>
          </div>
          <h1 className="mt-3 font-display text-2xl font-extrabold text-white">Eventos guardados</h1>
          <p className="mt-1 text-sm text-[#A8B8CC]">
            {events.length} {events.length === 1 ? "evento activo" : "eventos activos"}
            {missingCount > 0 ? ` · ${missingCount} ya no disponible${missingCount > 1 ? "s" : ""}` : ""}
          </p>
        </div>

        <button
          type="button"
          onClick={clearFavorites}
          className="inline-flex min-h-10 items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-[#C4D0E0] transition hover:text-white hover:border-white/30"
        >
          <Trash2 className="h-3.5 w-3.5" strokeWidth={2.2} />
          Limpiar
        </button>
      </header>

      {error && (
        <div className="mb-4 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
          {error}
        </div>
      )}

      {loading ? (
        <div className="glass-card rounded-2xl p-6">
          <div className="flex items-center gap-2 text-sm text-[#A8B8CC]">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando favoritos...
          </div>
        </div>
      ) : (
        <EventList events={events} />
      )}
    </div>
  );
}
