"use client";

import { useEffect, useMemo, useState } from "react";

type WeekendHighlightEditorEvent = {
  id: string;
  slug: string;
  name: string;
  date: string;
  eventType: string;
  venueName: string;
  isRecurring: boolean;
  status: "active" | "cancelled" | "past";
};

type EditorState = {
  manualSlugs: string[];
  manualEvents: WeekendHighlightEditorEvent[];
  updatedAt: string | null;
  limit: number;
  maxManualSlugs: number;
};

type SearchResult = WeekendHighlightEditorEvent;

type Props = {
  initialState: EditorState;
  weekendStart: string;
  weekendEnd: string;
};

function formatDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("es-UY", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function isInCurrentWeekend(date: string, weekendStart: string, weekendEnd: string) {
  return date >= weekendStart && date <= weekendEnd;
}

export function WeekendHighlightsClient({ initialState, weekendStart, weekendEnd }: Props) {
  const [manualSlugs, setManualSlugs] = useState(initialState.manualSlugs);
  const [manualEvents, setManualEvents] = useState(initialState.manualEvents);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedSet = useMemo(() => new Set(manualSlugs), [manualSlugs]);

  useEffect(() => {
    if (query.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      try {
        setSearching(true);
        const params = new URLSearchParams({
          q: query.trim(),
          status: "active",
          limit: "8",
          page: "1",
        });

        const response = await fetch(`/api/admin/events?${params.toString()}`, {
          method: "GET",
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("No se pudieron buscar eventos.");
        }

        const data = await response.json();
        setSearchResults((data.items ?? []) as SearchResult[]);
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : "No se pudieron buscar eventos.");
        }
      } finally {
        if (!controller.signal.aborted) {
          setSearching(false);
        }
      }
    }, 250);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [query]);

  const addEvent = (event: SearchResult) => {
    if (selectedSet.has(event.slug) || manualSlugs.length >= initialState.maxManualSlugs) {
      return;
    }

    setManualSlugs((current) => [...current, event.slug]);
    setManualEvents((current) => [...current, event]);
    setMessage(null);
    setError(null);
  };

  const removeEvent = (slug: string) => {
    setManualSlugs((current) => current.filter((item) => item !== slug));
    setManualEvents((current) => current.filter((item) => item.slug !== slug));
    setMessage(null);
    setError(null);
  };

  const moveEvent = (slug: string, direction: -1 | 1) => {
    setManualSlugs((current) => {
      const index = current.indexOf(slug);
      const nextIndex = index + direction;

      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) {
        return current;
      }

      const clone = [...current];
      [clone[index], clone[nextIndex]] = [clone[nextIndex], clone[index]];
      return clone;
    });

    setManualEvents((current) => {
      const index = current.findIndex((item) => item.slug === slug);
      const nextIndex = index + direction;

      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) {
        return current;
      }

      const clone = [...current];
      [clone[index], clone[nextIndex]] = [clone[nextIndex], clone[index]];
      return clone;
    });
    setMessage(null);
    setError(null);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setMessage(null);
      setError(null);

      const response = await fetch("/api/admin/weekend-highlights", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ manualSlugs }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error ?? "No se pudo guardar la curaduría.");
      }

      setManualSlugs(data.manualSlugs ?? []);
      setManualEvents(data.manualEvents ?? []);
      setMessage("Curaduría guardada. La home va a usar estos picks en el próximo render/cache refresh.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la curaduría.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">Picks manuales</h2>
            <p className="text-xs text-zinc-500 mt-1">
              Fin de semana actual: {formatDate(weekendStart)} → {formatDate(weekendEnd)}. Si el lunes tus picks quedan fuera de ese rango, se ignoran solos y vuelven los defaults editoriales + ranking.
            </p>
          </div>
          <div className="text-xs text-zinc-500">
            {manualSlugs.length}/{initialState.maxManualSlugs} guardables · se muestran hasta {initialState.limit}
          </div>
        </div>

        <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/8 p-3 text-xs text-cyan-100/90">
          Orden = prioridad. Primero entran tus picks manuales; después se completa con 2 fiestas, 2 teatros, 1 cultural y 1 deportivo si hay disponibles; el resto sale por ranking.
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-xs uppercase tracking-wide text-zinc-500">Buscar eventos activos</label>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por nombre..."
            className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-cyan-500/40"
          />
        </div>

        {query.trim().length >= 2 && (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 overflow-hidden">
            <div className="px-3 py-2 text-xs text-zinc-500 border-b border-zinc-800">
              {searching ? "Buscando..." : `${searchResults.length} resultado(s)`}
            </div>
            <div className="divide-y divide-zinc-800">
              {searchResults.map((event) => {
                const alreadySelected = selectedSet.has(event.slug);
                const inWeekend = isInCurrentWeekend(event.date, weekendStart, weekendEnd);

                return (
                  <div key={event.id} className="flex items-center justify-between gap-3 px-3 py-3">
                    <div className="min-w-0">
                      <div className="text-sm text-zinc-100 truncate">{event.name}</div>
                      <div className="text-xs text-zinc-500 truncate">
                        {formatDate(event.date)} · {event.eventType} · {event.venueName}
                        {!inWeekend ? " · fuera del finde actual" : ""}
                      </div>
                    </div>
                    <button
                      onClick={() => addEvent(event)}
                      disabled={alreadySelected || manualSlugs.length >= initialState.maxManualSlugs}
                      className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                        alreadySelected || manualSlugs.length >= initialState.maxManualSlugs
                          ? "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                          : "bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/15"
                      }`}
                    >
                      {alreadySelected ? "Ya está" : "Agregar"}
                    </button>
                  </div>
                );
              })}
              {!searching && searchResults.length === 0 && (
                <div className="px-3 py-4 text-sm text-zinc-500">No encontramos eventos con esa búsqueda.</div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">Orden actual</h2>
            <p className="text-xs text-zinc-500 mt-1">Si un evento queda cancelado, pasado, recurrente o fuera del finde actual, la home lo ignora sola.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setManualSlugs([]);
                setManualEvents([]);
                setMessage(null);
                setError(null);
              }}
              disabled={saving || manualEvents.length === 0}
              className="rounded-xl px-4 py-2 text-sm font-medium bg-zinc-800 text-zinc-300 hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Limpiar picks
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
                saving
                  ? "bg-zinc-800 text-zinc-500 cursor-wait"
                  : "bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/15"
              }`}
            >
              {saving ? "Guardando..." : "Guardar picks"}
            </button>
          </div>
        </div>

        <div className="space-y-2">
          {manualEvents.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-800 px-3 py-6 text-sm text-zinc-500 text-center">
              No hay picks manuales guardados. En ese caso entran los cupos por tipo y después el ranking automático.
            </div>
          ) : (
            manualEvents.map((event, index) => {
              const inWeekend = isInCurrentWeekend(event.date, weekendStart, weekendEnd);

              return (
                <div key={event.slug} className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-3 py-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-xs text-zinc-500 mb-1">
                      <span className="rounded-md bg-zinc-800 px-2 py-0.5 text-zinc-300">#{index + 1}</span>
                      <span>{event.eventType}</span>
                      <span>·</span>
                      <span>{formatDate(event.date)}</span>
                      {!inWeekend && <span className="text-amber-300">· fuera del finde actual</span>}
                    </div>
                    <div className="text-sm text-zinc-100 truncate">{event.name}</div>
                    <div className="text-xs text-zinc-500 truncate mt-1">{event.venueName} · {event.slug}</div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => moveEvent(event.slug, -1)}
                      disabled={index === 0}
                      className="rounded-lg bg-zinc-800 px-2 py-1 text-xs text-zinc-300 disabled:opacity-40"
                    >
                      ↑
                    </button>
                    <button
                      onClick={() => moveEvent(event.slug, 1)}
                      disabled={index === manualEvents.length - 1}
                      className="rounded-lg bg-zinc-800 px-2 py-1 text-xs text-zinc-300 disabled:opacity-40"
                    >
                      ↓
                    </button>
                    <button
                      onClick={() => removeEvent(event.slug)}
                      className="rounded-lg bg-red-500/10 px-2.5 py-1 text-xs text-red-300 hover:bg-red-500/15"
                    >
                      Quitar
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {message && <div className="text-sm text-emerald-300">{message}</div>}
        {error && <div className="text-sm text-red-300">{error}</div>}
      </div>
    </div>
  );
}