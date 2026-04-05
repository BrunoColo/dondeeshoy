"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { EventList } from "./event-list";
import { SectionHeader } from "./section-header";
import { WeekendPreview } from "./weekend-preview";
import { useGeolocation } from "@/hooks/use-geolocation";
import { Compass, Flame, RotateCw } from "lucide-react";
import { useSearchParams } from "next/navigation";
import type { Event } from "@/lib/db/schema/events";
import type { EventFilters } from "@/types/events";

interface HomeEventsClientProps {
  date: string;
  events: Event[];
  totalUniqueCount: number;
  recurringEvents: Event[];
  totalRecurringCount: number;
  trending: Event[];
  trendingIds: string[];
  hasFilters: boolean;
  filters: EventFilters;
  weekendEvents?: Event[];
  weekendTotalCount?: number;
  weekendLabel?: string;
}

export function HomeEventsClient({
  date,
  events,
  totalUniqueCount,
  recurringEvents,
  totalRecurringCount,
  trending,
  trendingIds,
  hasFilters,
  filters,
  weekendEvents = [],
  weekendTotalCount = 0,
  weekendLabel = "",
}: HomeEventsClientProps) {
  const [uniqueEvents, setUniqueEvents] = useState(events);
  const [loadingMoreUnique, setLoadingMoreUnique] = useState(false);
  const [recurringEventList, setRecurringEventList] = useState(recurringEvents);
  const [loadingMoreRecurring, setLoadingMoreRecurring] = useState(false);
  const { position, loading, error, requestLocation } = useGeolocation();
  const searchParams = useSearchParams();
  const hasRequestedNearRef = useRef(false);
  const nearActive = searchParams.get("near") === "true";

  const hasMoreUnique = uniqueEvents.length < totalUniqueCount;
  const hasMoreRecurring = recurringEventList.length < totalRecurringCount;

  useEffect(() => {
    setUniqueEvents(events);
    setLoadingMoreUnique(false);
  }, [date, events, totalUniqueCount]);

  useEffect(() => {
    setRecurringEventList(recurringEvents);
    setLoadingMoreRecurring(false);
  }, [date, recurringEvents, totalRecurringCount]);

  useEffect(() => {
    if (!nearActive) {
      hasRequestedNearRef.current = false;
      return;
    }

    if (position || loading || hasRequestedNearRef.current) {
      return;
    }

    hasRequestedNearRef.current = true;
    requestLocation();
  }, [nearActive, position, loading, requestLocation]);

  const loadMoreUnique = useCallback(async () => {
    if (!hasMoreUnique || loadingMoreUnique) return;

    setLoadingMoreUnique(true);
    try {
      const params = new URLSearchParams();
      params.set("date", date);
      params.set("offset", String(uniqueEvents.length));
      params.set("limit", "6");
      params.set("recurring", "false");

      if (filters.type) params.set("type", filters.type);
      if (filters.genre) params.set("genre", filters.genre);
      if (filters.department) params.set("department", filters.department);
      if (filters.free) params.set("free", "true");
      if (filters.night) params.set("night", "true");
      if (filters.q) params.set("q", filters.q);
      if (!hasFilters) params.set("strategy", "diverse");

      const res = await fetch(`/api/events/by-date?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch more daily events");

      const data = (await res.json()) as { events: Event[] };
      if (data.events.length > 0) {
        setUniqueEvents((prev) => [...prev, ...data.events]);
      }
    } catch {
      console.error("[home] Failed to load more events for today");
    } finally {
      setLoadingMoreUnique(false);
    }
  }, [date, filters, hasFilters, hasMoreUnique, loadingMoreUnique, uniqueEvents.length]);

  const loadMoreRecurring = useCallback(async () => {
    if (!hasMoreRecurring || loadingMoreRecurring) return;

    setLoadingMoreRecurring(true);
    try {
      const params = new URLSearchParams();
      params.set("date", date);
      params.set("offset", String(recurringEventList.length));
      params.set("limit", "6");
      params.set("recurring", "true");

      if (filters.type) params.set("type", filters.type);
      if (filters.genre) params.set("genre", filters.genre);
      if (filters.department) params.set("department", filters.department);
      if (filters.free) params.set("free", "true");
      if (filters.night) params.set("night", "true");
      if (filters.q) params.set("q", filters.q);

      const res = await fetch(`/api/events/by-date?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch more recurring events");

      const data = (await res.json()) as { events: Event[] };
      if (data.events.length > 0) {
        setRecurringEventList((prev) => [...prev, ...data.events]);
      }
    } catch {
      console.error("[home] Failed to load more recurring events");
    } finally {
      setLoadingMoreRecurring(false);
    }
  }, [date, filters, hasMoreRecurring, loadingMoreRecurring, recurringEventList.length]);

  const geoState = { position, sortByDistance: nearActive && !!position };

  return (
    <>
      {nearActive && error && (
        <div className="mb-4 fade-up">
          <p className="text-[11px] text-amber-300">
            No pudimos acceder a tu ubicación: {error}
          </p>
        </div>
      )}

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
            icon={Compass}
            title="Eventos únicos de hoy"
            subtitle="Solo por hoy"
            count={totalUniqueCount}
            showPulseDot
            accent={{
              iconWrap: "border-emerald-400/20 bg-gradient-to-br from-emerald-500/18 to-teal-500/10",
              icon: "text-[#6EE7B7]",
              title: "text-[#6EE7B7]",
              subtitle: "text-[#9FE7C8]/80",
              badge: "border-emerald-400/20 bg-emerald-500/12 text-[#9FE7C8]",
            }}
          />

          {totalUniqueCount > 0 ? (
            <>
              <EventList events={uniqueEvents} trendingIds={trendingIds} geoState={geoState} />
              {hasMoreUnique && (
                <div className="mt-4 flex justify-center">
                  <button
                    onClick={loadMoreUnique}
                    disabled={loadingMoreUnique}
                    className="group flex items-center gap-2 rounded-full px-5 py-2.5 text-[12px] font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_4px_20px_rgba(99,102,241,0.25)] disabled:opacity-60 disabled:hover:translate-y-0"
                    style={{
                      background: "linear-gradient(135deg, rgba(99,102,241,0.20) 0%, rgba(13,148,136,0.20) 100%)",
                      border: "1px solid rgba(99,102,241,0.30)",
                    }}
                  >
                    {loadingMoreUnique ? (
                      "Cargando más…"
                    ) : (
                      `Ver más de hoy (${totalUniqueCount - uniqueEvents.length})`
                    )}
                  </button>
                </div>
              )}
            </>
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
      {totalRecurringCount > 0 && (        <div className="mt-8 mb-6 fade-up">
          <SectionHeader
            icon={RotateCw}
            title="Eventos recurrentes"
            subtitle="Se repiten semanalmente o están disponibles durante gran parte del año"
        count={totalRecurringCount}
            accent={{
              iconWrap: "border-amber-400/20 bg-gradient-to-br from-amber-500/18 to-orange-500/10",
              icon: "text-amber-300",
              title: "text-amber-300",
              subtitle: "text-amber-100/80",
              badge: "border-amber-400/20 bg-amber-500/12 text-amber-200/90",
            }}
          />
          <div className="rounded-2xl border border-amber-400/15 bg-amber-500/[0.04] p-3 sm:p-4">
            <EventList events={recurringEventList} geoState={geoState} />

            {hasMoreRecurring && (
              <div className="mt-4 flex justify-center">
                <button
                  onClick={loadMoreRecurring}
                  disabled={loadingMoreRecurring}
                  className="group flex items-center gap-2 rounded-full px-5 py-2.5 text-[12px] font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_4px_20px_rgba(99,102,241,0.25)] disabled:opacity-60 disabled:hover:translate-y-0"
                  style={{
                    background: "linear-gradient(135deg, rgba(99,102,241,0.20) 0%, rgba(13,148,136,0.20) 100%)",
                    border: "1px solid rgba(99,102,241,0.30)",
                  }}
                >
                  {loadingMoreRecurring ? (
                    "Cargando más…"
                  ) : (
                    `Ver más recurrentes (${totalRecurringCount - recurringEventList.length})`
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}