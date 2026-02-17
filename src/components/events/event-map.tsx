"use client";

import { useRef, useMemo, useCallback, useState } from "react";
import Map, { Marker, Popup, NavigationControl } from "react-map-gl/mapbox";
import { MapPin, Clock, Ticket, ExternalLink } from "lucide-react";
import { EventTypeBadge } from "@/components/shared/event-type-badge";
import { formatPrice, formatTime } from "@/lib/format";
import Link from "next/link";
import type { EventType } from "@/types/events";
import "mapbox-gl/dist/mapbox-gl.css";

/** Marker color per event type (neon palette) */
const TYPE_COLORS: Record<string, string> = {
  fiesta: "#A855F7",   // violet
  festival: "#EC4899", // pink
  concierto: "#0EA5E9", // sky
  recital: "#06B6D4",  // cyan
  cultural: "#6366F1", // indigo
  deportivo: "#22C55E", // green
  gastronomico: "#F97316", // orange
  familiar: "#84CC16", // lime
  feria: "#F43F5E", // rose
  taller: "#14B8A6", // teal
  club: "#6366F1",     // indigo
  bar: "#F59E0B",      // amber
  teatro: "#10B981",   // emerald
  otro: "#94A3B8",     // slate
};

export interface MapEvent {
  id: string;
  slug: string;
  name: string;
  date: string;
  startTime?: string | null;
  venueName: string;
  eventType: EventType;
  latitude: number;
  longitude: number;
  priceMin?: number | null;
  isFree: boolean;
  currency?: string;
  imageUrl?: string | null;
}

interface EventMapProps {
  events: MapEvent[];
  token: string;
}

export function EventMap({ events, token }: EventMapProps) {
  const mapRef = useRef(null);
  const [selected, setSelected] = useState<MapEvent | null>(null);

  // Cluster nearby events or just show markers
  const markers = useMemo(
    () =>
      events.map((event) => ({
        ...event,
        color: TYPE_COLORS[event.eventType] ?? TYPE_COLORS.otro,
      })),
    [events],
  );

  const handleMarkerClick = useCallback((event: MapEvent) => {
    setSelected(event);
  }, []);

  return (
    <div className="relative h-full w-full">
      <Map
        ref={mapRef}
        mapboxAccessToken={token}
        initialViewState={{
          latitude: -34.9011,
          longitude: -56.1645,
          zoom: 12,
        }}
        style={{ width: "100%", height: "100%" }}
        mapStyle="mapbox://styles/mapbox/dark-v11"
        attributionControl={false}
      >
        <NavigationControl position="top-right" showCompass={false} />

        {markers.map((event) => (
          <Marker
            key={event.id}
            latitude={event.latitude}
            longitude={event.longitude}
            anchor="bottom"
            onClick={(e) => {
              e.originalEvent.stopPropagation();
              handleMarkerClick(event);
            }}
          >
            <div
              className="group relative cursor-pointer transition-transform hover:scale-125"
              style={{ color: event.color }}
            >
              <MapPin
                className="h-7 w-7 drop-shadow-lg"
                fill={event.color}
                fillOpacity={0.3}
                strokeWidth={2}
              />
              {/* Glow effect */}
              <div
                className="absolute inset-0 -z-10 animate-pulse rounded-full blur-md opacity-40"
                style={{ backgroundColor: event.color }}
              />
            </div>
          </Marker>
        ))}

        {selected && (
          <Popup
            latitude={selected.latitude}
            longitude={selected.longitude}
            anchor="bottom"
            offset={30}
            closeOnClick={false}
            onClose={() => setSelected(null)}
            className="event-map-popup"
            maxWidth="280px"
          >
            <div className="space-y-2 p-1">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sm font-semibold text-white leading-tight line-clamp-2">
                  {selected.name}
                </h3>
                <EventTypeBadge type={selected.eventType} />
              </div>

              <div className="space-y-1 text-xs text-gray-300">
                <div className="flex items-center gap-1.5">
                  <MapPin className="h-3 w-3 shrink-0" />
                  <span className="truncate">{selected.venueName}</span>
                </div>
                {selected.startTime && (
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-3 w-3 shrink-0" />
                    <span>{formatTime(selected.startTime)}</span>
                  </div>
                )}
                <div className="flex items-center gap-1.5">
                  <Ticket className="h-3 w-3 shrink-0" />
                  <span>
                    {selected.isFree
                      ? "Gratis"
                      : selected.priceMin
                        ? formatPrice(selected.priceMin, null, false, selected.currency)
                        : "Consultar"}
                  </span>
                </div>
              </div>

              <Link
                href={`/evento/${selected.slug}`}
                className="mt-1 flex items-center justify-center gap-1.5 rounded-lg bg-neon-violet/20 border border-neon-violet/30 px-3 py-1.5 text-xs font-medium text-neon-violet hover:bg-neon-violet/30 transition-colors"
              >
                Ver evento
                <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          </Popup>
        )}
      </Map>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 flex flex-wrap gap-2 rounded-xl glass-card px-3 py-2 text-[10px]">
        {Object.entries(TYPE_COLORS)
          .filter(([key]) => key !== "otro")
          .map(([type, color]) => (
            <div key={type} className="flex items-center gap-1">
              <div
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: color }}
              />
              <span className="capitalize text-text-muted">{type}</span>
            </div>
          ))}
      </div>

      {/* Event count */}
      <div className="absolute top-4 left-4 glass-card rounded-lg px-3 py-1.5 text-xs text-text-secondary">
        {events.length} {events.length === 1 ? "evento" : "eventos"} en el mapa
      </div>
    </div>
  );
}
