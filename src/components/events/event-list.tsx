"use client";

import { useMemo, useState } from "react";
import { EventCard } from "./event-card";
import { NearbyButton } from "./nearby-button";
import { useGeolocation } from "@/hooks/use-geolocation";
import { haversineKm } from "@/lib/utils";
import type { Event } from "@/lib/db/schema/events";

interface GeolocationState {
  position: { lat: number; lng: number } | null;
  sortByDistance: boolean;
}

interface EventListProps {
  events: Event[];
  trendingIds?: string[];
  /** Show the nearby button inside this list (self-managed geolocation) */
  enableNearby?: boolean;
  /** External geolocation state for controlled mode (no button rendered) */
  geoState?: GeolocationState;
  className?: string;
}

export function EventList({ events, trendingIds, enableNearby = false, geoState, className }: EventListProps) {
  const trendingSet = useMemo(() => new Set(trendingIds ?? []), [trendingIds]);
  const [sortByDistance, setSortByDistance] = useState(false);
  const { position, loading, error, requestLocation } = useGeolocation();

  // Use external geo state if provided (controlled mode), otherwise use internal state
  const effectivePosition = geoState ? geoState.position : position;
  const effectiveSortByDistance = geoState ? geoState.sortByDistance : sortByDistance;

  const eventsWithDistance = useMemo(() => {
    return events.map((event) => {
      if (!effectivePosition || !effectiveSortByDistance) {
        return { event, distance: null as number | null };
      }

      const lat = event.latitude ? Number.parseFloat(event.latitude) : Number.NaN;
      const lng = event.longitude ? Number.parseFloat(event.longitude) : Number.NaN;
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return { event, distance: null as number | null };
      }

      return {
        event,
        distance: haversineKm(effectivePosition.lat, effectivePosition.lng, lat, lng),
      };
    });
  }, [events, effectivePosition, effectiveSortByDistance]);

  const orderedEvents = useMemo(() => {
    if (!effectiveSortByDistance || !effectivePosition) {
      return eventsWithDistance;
    }

    return [...eventsWithDistance].sort((a, b) => {
      if (a.distance == null && b.distance == null) return 0;
      if (a.distance == null) return 1;
      if (b.distance == null) return -1;
      return a.distance - b.distance;
    });
  }, [eventsWithDistance, effectivePosition, effectiveSortByDistance]);

  const handleNearby = () => {
    if (!position) {
      setSortByDistance(true);
      requestLocation();
      return;
    }
    setSortByDistance((prev) => !prev);
  };

  return (
    <div className={className}>
      {enableNearby && !geoState && (
        <div className="mb-3">
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
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {orderedEvents.map(({ event, distance }) => (
          <EventCard
            key={event.id}
            id={event.id}
            slug={event.slug}
            name={event.name}
            date={event.date}
            startTime={event.startTime}
            endTime={event.endTime}
            venueName={event.venueName}
            city={event.city}
            eventType={event.eventType}
            imageUrl={event.imageUrl}
            priceMin={event.priceMin}
            priceMax={event.priceMax}
            isFree={event.isFree}
            currency={event.currency}
            musicGenre={event.musicGenre}
            isTrending={trendingSet.has(event.id)}
            distance={distance}
          />
        ))}
      </div>
    </div>
  );
}
