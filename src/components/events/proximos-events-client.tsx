"use client";

import { useState } from "react";
import { EventList } from "./event-list";
import { NearbyButton } from "./nearby-button";
import { useGeolocation } from "@/hooks/use-geolocation";
import { RotateCw } from "lucide-react";
import type { Event } from "@/lib/db/schema/events";
import { getDateLabel, formatDateES } from "@/lib/format";

interface DateGroup {
  date: string;
  events: Event[];
  recurringEvents: Event[];
}

interface ProximosEventsClientProps {
  groups: DateGroup[];
}

export function ProximosEventsClient({ groups }: ProximosEventsClientProps) {
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
    <div>
      {/* Single "cerca de mí" button at the top */}
      <div className="mb-4">
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

      <div className="space-y-8">
        {groups.map(({ date, events: dateEvents, recurringEvents: recurringDateEvents }) => {
          const { label, isTomorrow } = getDateLabel(date);

          if (dateEvents.length === 0 && recurringDateEvents.length === 0) return null;

          return (
            <section key={date} className="fade-up">
              {/* Date group header */}
              <div className="mb-3 flex items-center gap-2.5">
                {isTomorrow && (
                  <span className="rounded-md bg-neon-amber/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-neon-amber border border-neon-amber/20">
                    Mañana
                  </span>
                )}
                <h2 className="font-display text-sm font-semibold text-muted-foreground capitalize">
                  Eventos · {isTomorrow ? formatDateES(date) : label}
                </h2>
                <span className="text-[11px] text-text-muted">
                  ({dateEvents.length > 0
                    ? `${dateEvents.length} eventos${recurringDateEvents.length > 0 ? ` + ${recurringDateEvents.length} recurrentes` : ""}`
                    : `${recurringDateEvents.length} recurrentes`})
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
            </section>
          );
        })}
      </div>
    </div>
  );
}
