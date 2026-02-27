"use client";

import { useState } from "react";
import { EventList } from "./event-list";
import { NearbyButton } from "./nearby-button";
import { useGeolocation } from "@/hooks/use-geolocation";
import { Flame, Sparkles, RotateCw } from "lucide-react";
import type { Event } from "@/lib/db/schema/events";

interface HomeEventsClientProps {
  events: Event[];
  recurringEvents: Event[];
  trending: Event[];
  trendingIds: string[];
  hasFilters: boolean;
}

export function HomeEventsClient({
  events,
  recurringEvents,
  trending,
  trendingIds,
  hasFilters,
}: HomeEventsClientProps) {
  const [sortByDistance, setSortByDistance] = useState(false);
  const { position, loading, error, requestLocation } = useGeolocation();

  const handleNearby = () => {
    if (!position) {
      setSortByDistance(true);
      requestLocation();
      return;
    }
    setSortByDistance((prev) => !prev);
  };

  const geoState = { position, sortByDistance };

  return (
    <>
      {/* "Cerca de mí" button — always right below filters */}
      <div className="mb-4 fade-up">
        <NearbyButton
          active={sortByDistance && !!position}
          loading={loading}
          onClick={handleNearby}
        />
        {error && (
          <p className="mt-1 text-[11px] text-amber-300">
            No pudimos acceder a tu ubicación: {error}
          </p>
        )}
      </div>

      {/* Los más buscados (only when no filters active) */}
      {trending.length > 0 && !hasFilters && (
        <div className="mb-6 fade-up">
          <div className="flex items-center gap-2 mb-3">
            <Flame className="h-4 w-4 text-orange-400 drop-shadow-[0_0_6px_rgba(251,146,60,0.5)]" strokeWidth={2.5} />
            <h2 className="text-[12px] font-bold uppercase tracking-[0.15em] text-orange-400">
              Los más buscados
            </h2>
          </div>
          <EventList events={trending} trendingIds={trendingIds} geoState={geoState} />
        </div>
      )}

      {/* One-time / special events section */}
      {(events.length > 0 || hasFilters) && (
        <div className="fade-up">
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-indigo-light" strokeWidth={2.5} />
            <h2 className="text-[12px] font-bold uppercase tracking-[0.15em] text-indigo-light">
              Eventos únicos de hoy
            </h2>
            <span className="text-[10px] text-indigo-light/85">
              ({events.length})
            </span>
          </div>

          {events.length > 0 ? (
            <EventList events={events} trendingIds={trendingIds} geoState={geoState} />
          ) : (
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3 text-[12px] text-muted-foreground">
              No hay eventos únicos para hoy con los filtros actuales.
            </div>
          )}
        </div>
      )}

      {/* Recurring / always-available section */}
      {recurringEvents.length > 0 && (        <div className="mt-8 mb-6 fade-up">
          <div className="flex items-center gap-2 mb-2">
            <RotateCw className="h-4 w-4 text-amber-300" strokeWidth={2.5} />
            <h2 className="text-[12px] font-bold uppercase tracking-[0.15em] text-amber-300">
              Eventos recurrentes
            </h2>
            <span className="text-[10px] text-amber-200/85">
              ({recurringEvents.length})
            </span>
          </div>
          <p className="text-[11px] text-amber-100/80 mb-3">
            Se repiten semanalmente o están disponibles durante gran parte del año
          </p>
          <div className="rounded-2xl border border-amber-400/15 bg-amber-500/[0.04] p-3 sm:p-4">
            <EventList events={recurringEvents} geoState={geoState} />
          </div>
        </div>
      )}
    </>
  );
}