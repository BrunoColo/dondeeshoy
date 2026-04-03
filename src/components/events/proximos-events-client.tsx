"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { EventList } from "./event-list";
import { EventSkeleton } from "./event-skeleton";
import { useGeolocation } from "@/hooks/use-geolocation";
import { RotateCw, ChevronDown, Loader2 } from "lucide-react";
import type { Event } from "@/lib/db/schema/events";
import { getDateLabel, formatDateES } from "@/lib/format";
import { useSearchParams } from "next/navigation";

interface DateGroup {
  date: string;
  totalCount: number;
  events: Event[];
  recurringEvents: Event[];
}

function mergeEventsById(existing: Event[], incoming: Event[]): Event[] {
  if (incoming.length === 0) return existing;

  const merged = [...existing];
  const existingIds = new Set(existing.map((event) => event.id));

  for (const event of incoming) {
    if (!existingIds.has(event.id)) {
      merged.push(event);
      existingIds.add(event.id);
    }
  }

  return merged;
}

function mergeDateGroups(existingGroups: DateGroup[], incomingGroups: DateGroup[]): DateGroup[] {
  if (incomingGroups.length === 0) return existingGroups;

  const byDate = new Map<string, DateGroup>();

  for (const group of existingGroups) {
    byDate.set(group.date, {
      ...group,
      events: [...group.events],
      recurringEvents: [...group.recurringEvents],
    });
  }

  for (const group of incomingGroups) {
    const existing = byDate.get(group.date);

    if (!existing) {
      byDate.set(group.date, {
        ...group,
        events: [...group.events],
        recurringEvents: [...group.recurringEvents],
      });
      continue;
    }

    existing.totalCount = Math.max(existing.totalCount, group.totalCount);
    existing.events = mergeEventsById(existing.events, group.events);
    existing.recurringEvents = mergeEventsById(existing.recurringEvents, group.recurringEvents);
  }

  return [...byDate.values()].sort((left, right) => left.date.localeCompare(right.date));
}

interface ProximosEventsClientProps {
  groups: DateGroup[];
  /** The day after the last loaded date — used to fetch the next batch */
  nextFrom?: string;
  /** Whether more data is potentially available beyond loaded groups */
  hasMore?: boolean;
}

export function ProximosEventsClient({ groups: initialGroups, nextFrom, hasMore = false }: ProximosEventsClientProps) {
  const [groups, setGroups] = useState<DateGroup[]>(initialGroups);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadingMoreByDate, setLoadingMoreByDate] = useState<Record<string, boolean>>({});
  const [cursor, setCursor] = useState(nextFrom);
  const [canLoadMore, setCanLoadMore] = useState(hasMore);
  const { position, loading, error, requestLocation } = useGeolocation();
  const searchParams = useSearchParams();
  const hasRequestedNearRef = useRef(false);
  const nearActive = searchParams.get("near") === "true";

  useEffect(() => {
    setGroups(initialGroups);
    setCursor(nextFrom);
    setCanLoadMore(hasMore);
    setLoadingMore(false);
    setLoadingMoreByDate({});
  }, [initialGroups, nextFrom, hasMore]);

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

  const loadMore = useCallback(async () => {
    if (!cursor || loadingMore) return;

    setLoadingMore(true);
    try {
      const params = new URLSearchParams();
      params.set("from", cursor);
      params.set("days", "7");

      // Forward active filters
      const type = searchParams.get("type");
      const genre = searchParams.get("genre");
      const department = searchParams.get("department");
      const free = searchParams.get("free");
      const night = searchParams.get("night");
      const q = searchParams.get("q");

      if (type) params.set("type", type);
      if (genre) params.set("genre", genre);
      if (department) params.set("department", department);
      if (free) params.set("free", free);
      if (night) params.set("night", night);
      if (q) params.set("q", q);

      const res = await fetch(`/api/events/upcoming?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch");

      const data = (await res.json()) as { groups: DateGroup[] };
      const newGroups = data.groups.filter(
        (g) => g.events.length > 0 || g.recurringEvents.length > 0,
      );

      if (newGroups.length === 0) {
        setCanLoadMore(false);
      } else {
        setGroups((prev) => mergeDateGroups(prev, newGroups));
        // Compute next cursor: day after the last loaded date
        const lastDate = newGroups[newGroups.length - 1].date;
        const [y, m, d] = lastDate.split("-").map(Number);
        const next = new Date(y, m - 1, d);
        next.setDate(next.getDate() + 1);
        const nextStr = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(next.getDate()).padStart(2, "0")}`;
        setCursor(nextStr);
      }
    } catch {
      console.error("[proximos] Failed to load more events");
    } finally {
      setLoadingMore(false);
    }
  }, [cursor, loadingMore, searchParams]);

  const loadMoreForDate = useCallback(async (date: string) => {
    const target = groups.find((g) => g.date === date);
    if (!target) return;

    const loadedCount = target.events.length + target.recurringEvents.length;
    if (loadedCount >= target.totalCount || loadingMoreByDate[date]) return;

    setLoadingMoreByDate((prev) => ({ ...prev, [date]: true }));
    try {
      const params = new URLSearchParams();
      params.set("date", date);
      params.set("offset", String(loadedCount));
      params.set("limit", "6");
      params.set("strategy", "fast-diverse");

      const type = searchParams.get("type");
      const genre = searchParams.get("genre");
      const department = searchParams.get("department");
      const free = searchParams.get("free");
      const night = searchParams.get("night");
      const q = searchParams.get("q");

      if (type) params.set("type", type);
      if (genre) params.set("genre", genre);
      if (department) params.set("department", department);
      if (free) params.set("free", free);
      if (night) params.set("night", night);
      if (q) params.set("q", q);

      const res = await fetch(`/api/events/by-date?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch by date");

      const data = (await res.json()) as { events: Event[]; totalCount: number };
      const newUnique = data.events.filter((e) => !e.isRecurring);
      const newRecurring = data.events.filter((e) => e.isRecurring);

      setGroups((prev) =>
        prev.map((group) => {
          if (group.date !== date) return group;
          return {
            ...group,
            totalCount: data.totalCount,
            events: mergeEventsById(group.events, newUnique),
            recurringEvents: mergeEventsById(group.recurringEvents, newRecurring),
          };
        }),
      );
    } catch {
      console.error("[proximos] Failed to load more events for date", date);
    } finally {
      setLoadingMoreByDate((prev) => ({ ...prev, [date]: false }));
    }
  }, [groups, loadingMoreByDate, searchParams]);

  const geoState = { position, sortByDistance: nearActive && !!position };

  return (
    <div>
      {nearActive && error && (
        <div className="mb-4">
          <p className="mt-1 text-[11px] text-amber-300">
            No pudimos acceder a tu ubicación: {error}
          </p>
        </div>
      )}

      <div className="space-y-8">
        {groups.map(({ date, totalCount, events: dateEvents, recurringEvents: recurringDateEvents }) => {
          const { label, isTomorrow } = getDateLabel(date);

          if (dateEvents.length === 0 && recurringDateEvents.length === 0) return null;

          const loadedCount = dateEvents.length + recurringDateEvents.length;
          const remainingCount = Math.max(totalCount - loadedCount, 0);
          const hasMoreInDate = remainingCount > 0;

          return (
            <section key={date} className="fade-up">
              {/* Date group header */}
              <div className="mb-3 flex items-center gap-2.5">
                {isTomorrow && (
                  <span className="rounded-md bg-neon-amber/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-neon-amber border border-neon-amber/20">
                    Mañana
                  </span>
                )}
                <h2 className="font-display text-[15px] font-semibold text-foreground capitalize sm:text-base">
                  {isTomorrow ? formatDateES(date) : label}
                </h2>
                <span className="text-[12px] text-text-muted sm:text-[13px]">
                  ({totalCount} {totalCount === 1 ? "evento" : "eventos"})
                </span>
              </div>

              {dateEvents.length > 0 && (
                <EventList events={dateEvents} geoState={geoState} />
              )}

              {recurringDateEvents.length > 0 && (
                <div className="mt-4">
                  <div className="flex items-center gap-1.5 mb-2">
                    <RotateCw className="h-3 w-3 text-text-muted" strokeWidth={2} />
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                      Siempre disponible
                    </span>
                  </div>
                  <EventList events={recurringDateEvents} />
                </div>
              )}

              {hasMoreInDate && (
                <div className="mt-5 flex justify-center">
                  <button
                    onClick={() => loadMoreForDate(date)}
                    disabled={!!loadingMoreByDate[date]}
                    className="group flex min-w-[240px] items-center justify-center gap-2 rounded-full px-6 py-3 text-[13px] font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_4px_20px_rgba(99,102,241,0.25)] disabled:opacity-60 disabled:hover:translate-y-0"
                    style={{
                      background: "linear-gradient(135deg, rgba(99,102,241,0.20) 0%, rgba(13,148,136,0.20) 100%)",
                      border: "1px solid rgba(99,102,241,0.30)",
                    }}
                  >
                    {!!loadingMoreByDate[date] ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Cargando más…
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-4 w-4 transition-transform group-hover:translate-y-0.5" />
                        Ver más de este día ({remainingCount})
                      </>
                    )}
                  </button>
                </div>
              )}
            </section>
          );
        })}
      </div>

      {/* Load more button */}
      {canLoadMore && (
        <div className="mt-8 flex justify-center">
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="group flex items-center gap-2 rounded-full px-6 py-3 text-[13px] font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_4px_20px_rgba(99,102,241,0.25)] disabled:opacity-60 disabled:hover:translate-y-0"
            style={{
              background: "linear-gradient(135deg, rgba(99,102,241,0.20) 0%, rgba(13,148,136,0.20) 100%)",
              border: "1px solid rgba(99,102,241,0.30)",
            }}
          >
            {loadingMore ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Cargando más eventos…
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4 transition-transform group-hover:translate-y-0.5" />
                Cargar más eventos
              </>
            )}
          </button>
        </div>
      )}

      {/* Loading skeletons while fetching more */}
      {loadingMore && (
        <div className="mt-8 space-y-6 fade-up">
          <div>
            <div className="skeleton mb-3 h-4 w-40 rounded" />
            <EventSkeleton count={3} />
          </div>
        </div>
      )}
    </div>
  );
}
