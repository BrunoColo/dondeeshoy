"use client";

import { useMemo, useState, useCallback, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { MapPin, Clock, Ticket, ExternalLink, RotateCw } from "lucide-react";
import { EventTypeBadge } from "@/components/shared/event-type-badge";
import { formatPrice, formatTime } from "@/lib/format";
import Link from "next/link";
import type { EventType } from "@/types/events";
import "leaflet/dist/leaflet.css";

/** Marker color per event type (neon palette) */
const TYPE_COLORS: Record<string, string> = {
  fiesta: "#A855F7",    // violet
  festival: "#EC4899",  // pink
  concierto: "#0EA5E9", // sky
  recital: "#06B6D4",   // cyan
  cultural: "#6366F1",  // indigo
  deportivo: "#22C55E", // green
  gastronomico: "#F97316", // orange
  familiar: "#84CC16",  // lime
  feria: "#F43F5E",     // rose
  taller: "#14B8A6",    // teal
  club: "#6366F1",      // indigo
  bar: "#F59E0B",       // amber
  teatro: "#10B981",    // emerald
  otro: "#94A3B8",      // slate
};

/** Create a colored SVG marker icon for Leaflet */
function createMarkerIcon(color: string): L.DivIcon {
  return L.divIcon({
    className: "",
    iconSize: [28, 36],
    iconAnchor: [14, 36],
    popupAnchor: [0, -36],
    html: `
      <svg width="28" height="36" viewBox="0 0 28 36" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M14 0C6.268 0 0 6.268 0 14c0 10.5 14 22 14 22s14-11.5 14-22C28 6.268 21.732 0 14 0z" fill="${color}" fill-opacity="0.85" stroke="${color}" stroke-width="1.5"/>
        <circle cx="14" cy="13" r="5.5" fill="white" fill-opacity="0.9"/>
      </svg>
    `,
  });
}

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
  isRecurring?: boolean;
}

interface EventMapProps {
  events: MapEvent[];
}

const TILE_LAYERS = {
  calles: {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  },
  oscuro: {
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
  },
} as const;

type TileLayerKey = keyof typeof TILE_LAYERS;

/** Inner component to handle tile layer switching (needs useMap) */
function TileSwitch({ tileKey }: { tileKey: TileLayerKey }) {
  const map = useMap();
  useEffect(() => {
    map.invalidateSize();
  }, [map, tileKey]);

  const tile = TILE_LAYERS[tileKey];
  return <TileLayer key={tileKey} url={tile.url} attribution={tile.attribution} />;
}

export function EventMap({ events }: EventMapProps) {
  const [selected, setSelected] = useState<MapEvent | null>(null);
  const [tileKey, setTileKey] = useState<TileLayerKey>("calles");
  const [hideRecurring, setHideRecurring] = useState(false);

  const recurringCount = useMemo(() => events.filter((e) => e.isRecurring).length, [events]);
  const visibleEvents = useMemo(
    () => (hideRecurring ? events.filter((e) => !e.isRecurring) : events),
    [events, hideRecurring],
  );

  // Pre-build marker icons (memoized per event type)
  const iconCache = useMemo(() => {
    const cache = new Map<string, L.DivIcon>();
    for (const [type, color] of Object.entries(TYPE_COLORS)) {
      cache.set(type, createMarkerIcon(color));
    }
    return cache;
  }, []);

  const getIcon = useCallback(
    (eventType: string) => iconCache.get(eventType) ?? iconCache.get("otro")!,
    [iconCache],
  );

  const handleMarkerClick = useCallback((event: MapEvent) => {
    setSelected(event);
  }, []);

  return (
    <div className="relative h-full w-full">
      <MapContainer
        center={[-34.9011, -56.1645]}
        zoom={12}
        scrollWheelZoom
        style={{ width: "100%", height: "100%" }}
        className="z-0"
        zoomControl={false}
      >
        <TileSwitch tileKey={tileKey} />

        {visibleEvents.map((event) => (
          <Marker
            key={event.id}
            position={[event.latitude, event.longitude]}
            icon={getIcon(event.eventType)}
            eventHandlers={{
              click: () => handleMarkerClick(event),
            }}
          />
        ))}

        {selected && (
          <Popup
            position={[selected.latitude, selected.longitude]}
            offset={[0, -36]}
            closeButton
            autoPan
            eventHandlers={{
              remove: () => setSelected(null),
            }}
          >
            <div className="space-y-2 p-1 min-w-[220px] max-w-[280px]">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sm font-semibold leading-tight line-clamp-2 text-gray-900">
                  {selected.name}
                </h3>
                <EventTypeBadge type={selected.eventType} />
              </div>

              <div className="space-y-1 text-xs text-gray-600">
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
                className="mt-1 flex items-center justify-center gap-1.5 rounded-lg bg-violet-100 border border-violet-300 px-3 py-1.5 text-xs font-medium text-violet-700 hover:bg-violet-200 transition-colors"
              >
                Ver evento
                <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          </Popup>
        )}
      </MapContainer>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 z-[1000] flex flex-wrap gap-2 rounded-xl glass-card px-3 py-2 text-[10px] max-w-[280px]">
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

      {/* Event count + recurring toggle */}
      <div className="absolute top-4 left-4 z-[1000] flex items-center gap-2">
        <div className="rounded-lg bg-black/80 border border-white/20 shadow-lg px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm">
          {visibleEvents.length} {visibleEvents.length === 1 ? "evento" : "eventos"} en el mapa
        </div>
        {recurringCount > 0 && (
          <button
            type="button"
            onClick={() => setHideRecurring((v) => !v)}
            title={hideRecurring ? "Mostrar eventos recurrentes" : "Ocultar eventos recurrentes"}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide transition-all shadow-lg backdrop-blur-sm ${
              hideRecurring
                ? "bg-amber-500/20 border border-amber-400/60 text-amber-300 shadow-amber-900/30"
                : "bg-black/80 border border-white/20 text-white/80 hover:text-amber-300 hover:border-amber-400/40"
            }`}
          >
            <RotateCw className="h-3 w-3" />
            {hideRecurring ? "Recurrentes ocultos" : "Ocultar recurrentes"}
          </button>
        )}
      </div>

      {/* Style switcher */}
      <div className="absolute top-4 right-4 z-[1000] flex items-center gap-1 rounded-lg bg-black/80 border border-white/20 shadow-lg backdrop-blur-sm p-1">
        <button
          type="button"
          onClick={() => setTileKey("calles")}
          className={`rounded-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide transition-all ${
            tileKey === "calles"
              ? "bg-white/20 text-white shadow-sm"
              : "text-white/50 hover:text-white"
          }`}
        >
          Calles
        </button>
        <button
          type="button"
          onClick={() => setTileKey("oscuro")}
          className={`rounded-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide transition-all ${
            tileKey === "oscuro"
              ? "bg-white/20 text-white shadow-sm"
              : "text-white/50 hover:text-white"
          }`}
        >
          Noche
        </button>
      </div>
    </div>
  );
}
