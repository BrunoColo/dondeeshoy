"use client";

import { useState } from "react";
import { EventList } from "./event-list";
import { NearbyButton } from "./nearby-button";
import { SectionHeader } from "./section-header";
import { WeekendPreview } from "./weekend-preview";
import { useGeolocation } from "@/hooks/use-geolocation";
import { Flame, RotateCw, Sparkles } from "lucide-react";
import type { Event } from "@/lib/db/schema/events";

interface HomeEventsClientProps {
  events: Event[];
  recurringEvents: Event[];
  trending: Event[];
  trendingIds: string[];
  hasFilters: boolean;
  weekendEvents?: Event[];
  weekendTotalCount?: number;
  weekendLabel?: string;
}

export function HomeEventsClient({
  events,
  recurringEvents,
  trending,
  trendingIds,
  hasFilters,
  weekendEvents = [],
  weekendTotalCount = 0,
  weekendLabel = "",
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
          <SectionHeader
            icon={Sparkles}
            title="Eventos únicos de hoy"
            subtitle="Solo por hoy"
            count={events.length}
            accent={{
              iconWrap: "border-emerald-400/20 bg-gradient-to-br from-emerald-500/18 to-teal-500/10",
              icon: "text-[#6EE7B7]",
              title: "text-[#6EE7B7]",
              subtitle: "text-[#9FE7C8]/80",
              badge: "border-emerald-400/20 bg-emerald-500/12 text-[#9FE7C8]",
            }}
          />

          {events.length > 0 ? (
            <EventList events={events} trendingIds={trendingIds} geoState={geoState} />
          ) : (
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3 text-[12px] text-muted-foreground">
              No hay eventos únicos para hoy con los filtros actuales.
            </div>
          )}
        </div>
      )}

      {/* Weekend preview (Mon–Thu only, when no filters) */}
      {weekendEvents.length > 0 && !hasFilters && (
        <WeekendPreview
          events={weekendEvents}
          totalCount={weekendTotalCount}
          weekendLabel={weekendLabel}
        />
      )}

      {/* Recurring / always-available section */}
      {recurringEvents.length > 0 && (        <div className="mt-8 mb-6 fade-up">
          <SectionHeader
            icon={RotateCw}
            title="Eventos recurrentes"
            subtitle="Se repiten semanalmente o están disponibles durante gran parte del año"
            count={recurringEvents.length}
            accent={{
              iconWrap: "border-amber-400/20 bg-gradient-to-br from-amber-500/18 to-orange-500/10",
              icon: "text-amber-300",
              title: "text-amber-300",
              subtitle: "text-amber-100/80",
              badge: "border-amber-400/20 bg-amber-500/12 text-amber-200/90",
            }}
          />
          <div className="rounded-2xl border border-amber-400/15 bg-amber-500/[0.04] p-3 sm:p-4">
            <EventList events={recurringEvents} geoState={geoState} />
          </div>
        </div>
      )}
    </>
  );
}