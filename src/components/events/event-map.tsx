"use client";

import { useMemo, useState, useCallback, useEffect, useRef } from "react";
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
function createMarkerIcon(color: string, isSelected = false): L.DivIcon {
  const size = isSelected ? 36 : 28;
  const height = isSelected ? 46 : 36;
  const ring = isSelected
    ? `<circle cx="${size / 2}" cy="${size / 2 - 1}" r="${size / 2 + 3}" fill="none" stroke="${color}" stroke-width="2.5" stroke-opacity="0.5"/>`
    : "";
  return L.divIcon({
    className: "",
    iconSize: [size, height],
    iconAnchor: [size / 2, height],
    popupAnchor: [0, -height],
    html: `
      <svg width="${size}" height="${height}" viewBox="0 0 ${size} ${height}" fill="none" xmlns="http://www.w3.org/2000/svg">
        ${ring}
        <path d="M${size / 2} 0C${size * 0.232} 0 0 ${size * 0.232} 0 ${size / 2}c0 ${size * 0.375} ${size / 2} ${size * 0.786} ${size / 2} ${size * 0.786}s${size / 2}-${size * 0.411} ${size / 2}-${size * 0.786}C${size} ${size * 0.232} ${size * 0.768} 0 ${size / 2} 0z" fill="${color}" fill-opacity="${isSelected ? 1 : 0.85}" stroke="${color}" stroke-width="1.5"/>
        <circle cx="${size / 2}" cy="${size / 2 - 1}" r="${size * 0.196}" fill="white" fill-opacity="0.9"/>
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
  todayEvents: MapEvent[];
  tomorrowEvents: MapEvent[];
  weekendEvents: MapEvent[];
  /** Controlled selected event id (from sidebar) */
  selectedEventId?: string | null;
  /** Called when user clicks a marker */
  onEventSelect?: (event: MapEvent | null) => void;
  /** Called when date filter changes */
  onDateFilterChange?: (filter: DateFilter, events: MapEvent[]) => void;
}

export type DateFilter = "hoy" | "manana" | "finde";

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

/** Flies map to a given position when selectedEventId changes */
function MapFlyTo({ event }: { event: MapEvent | null }) {
  const map = useMap();
  useEffect(() => {
    if (event) {
      map.flyTo([event.latitude, event.longitude], Math.max(map.getZoom(), 14), {
        duration: 0.8,
      });
    }
  }, [map, event]);
  return null;
}

export function EventMap({
  todayEvents,
  tomorrowEvents,
  weekendEvents,
  selectedEventId,
  onEventSelect,
  onDateFilterChange,
}: EventMapProps) {
  const [internalSelected, setInternalSelected] = useState<MapEvent | null>(null);
  const [tileKey, setTileKey] = useState<TileLayerKey>("calles");
  const [hideRecurring, setHideRecurring] = useState(false);
  const [dateFilter, setDateFilter] = useState<DateFilter>("hoy");
  const popupRef = useRef<L.Popup | null>(null);

  const activeEvents = useMemo(() => {
    if (dateFilter === "manana") return tomorrowEvents;
    if (dateFilter === "finde") return weekendEvents;
    return todayEvents;
  }, [dateFilter, todayEvents, tomorrowEvents, weekendEvents]);

  const recurringCount = useMemo(() => activeEvents.filter((e: MapEvent) => e.isRecurring).length, [activeEvents]);
  const visibleEvents = useMemo(
    () => (hideRecurring ? activeEvents.filter((e: MapEvent) => !e.isRecurring) : activeEvents),
    [activeEvents, hideRecurring],
  );

  // Notify parent when date filter or visible events change
  useEffect(() => {
    onDateFilterChange?.(dateFilter, visibleEvents);
  }, [dateFilter, visibleEvents, onDateFilterChange]);

  // Resolve the selected event object (from controlled id or internal state)
  const selectedEvent = useMemo(() => {
    if (selectedEventId !== undefined) {
      return visibleEvents.find((e) => e.id === selectedEventId) ?? null;
    }
    return internalSelected;
  }, [selectedEventId, internalSelected, visibleEvents]);

  // Pre-build marker icons (memoized per event type + selected state)
  const iconCache = useMemo(() => {
    const cache = new Map<string, L.DivIcon>();
    for (const [type, color] of Object.entries(TYPE_COLORS)) {
      cache.set(type, createMarkerIcon(color, false));
      cache.set(`${type}:selected`, createMarkerIcon(color, true));
    }
    return cache;
  }, []);

  const getIcon = useCallback(
    (eventType: string, isSelected: boolean) => {
      const key = isSelected ? `${eventType}:selected` : eventType;
      return iconCache.get(key) ?? iconCache.get(isSelected ? "otro:selected" : "otro")!;
    },
    [iconCache],
  );

  const handleMarkerClick = useCallback(
    (event: MapEvent) => {
      if (onEventSelect) {
        onEventSelect(event);
      } else {
        setInternalSelected(event);
      }
    },
    [onEventSelect],
  );

  const handleDateChange = (f: DateFilter) => {
    setDateFilter(f);
    if (onEventSelect) {
      onEventSelect(null);
    } else {
      setInternalSelected(null);
    }
  };

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
        <MapFlyTo event={selectedEvent} />

        {visibleEvents.map((event) => {
          const isSelected = selectedEvent?.id === event.id;
          return (
            <Marker
              key={event.id}
              position={[event.latitude, event.longitude]}
              icon={getIcon(event.eventType, isSelected)}
              zIndexOffset={isSelected ? 1000 : 0}
              eventHandlers={{
                click: () => handleMarkerClick(event),
              }}
            />
          );
        })}

        {selectedEvent && (
          <Popup
            key={selectedEvent.id}
            position={[selectedEvent.latitude, selectedEvent.longitude]}
            offset={[0, -(selectedEvent.id === selectedEvent.id ? 46 : 36)]}
            closeButton
            autoPan
            ref={popupRef}
            eventHandlers={{
              remove: () => {
                if (onEventSelect) {
                  onEventSelect(null);
                } else {
                  setInternalSelected(null);
                }
              },
            }}
          >
            <div className="space-y-2 p-1 min-w-[220px] max-w-[280px]">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sm font-semibold leading-tight line-clamp-2 text-gray-900">
                  {selectedEvent.name}
                </h3>
                <EventTypeBadge type={selectedEvent.eventType} />
              </div>

              <div className="space-y-1 text-xs text-gray-600">
                <div className="flex items-center gap-1.5">
                  <MapPin className="h-3 w-3 shrink-0" />
                  <span className="truncate">{selectedEvent.venueName}</span>
                </div>
                {selectedEvent.startTime && (
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-3 w-3 shrink-0" />
                    <span>{formatTime(selectedEvent.startTime)}</span>
                  </div>
                )}
                <div className="flex items-center gap-1.5">
                  <Ticket className="h-3 w-3 shrink-0" />
                  <span>
                    {selectedEvent.isFree
                      ? "Gratis"
                      : selectedEvent.priceMin
                        ? formatPrice(selectedEvent.priceMin, null, false, selectedEvent.currency)
                        : "Consultar"}
                  </span>
                </div>
              </div>

              <Link
                href={`/evento/${selectedEvent.slug}`}
                className="mt-1 flex items-center justify-center gap-1.5 rounded-lg bg-violet-100 border border-violet-300 px-3 py-1.5 text-xs font-medium text-violet-700 hover:bg-violet-200 transition-colors"
              >
                Ver evento
                <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          </Popup>
        )}
      </MapContainer>

      {/* Legend — hidden on mobile to save space */}
      <div className="absolute bottom-4 left-4 z-[1000] hidden lg:flex flex-wrap gap-2 rounded-xl glass-card px-3 py-2 text-[10px] max-w-[280px]">
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

      {/* Mobile legend (compact) */}
      <div className="absolute bottom-4 left-4 z-[1000] flex lg:hidden flex-wrap gap-1.5 rounded-xl glass-card px-2.5 py-1.5 text-[9px] max-w-[200px]">
        {Object.entries(TYPE_COLORS)
          .filter(([key]) => key !== "otro")
          .slice(0, 8)
          .map(([type, color]) => (
            <div key={type} className="flex items-center gap-1">
              <div className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
              <span className="capitalize text-text-muted">{type}</span>
            </div>
          ))}
      </div>

      {/* Top controls — stacked on mobile, row on desktop */}
      <div className="absolute top-4 left-4 right-4 z-[1000] flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        {/* Left: date filter + count + recurring toggle */}
        <div className="flex flex-col gap-2">
          {/* Date filter pills */}
          <div className="flex items-center gap-1 rounded-lg bg-black/80 border border-white/20 shadow-lg backdrop-blur-sm p-1 self-start">
            {(["hoy", "manana", "finde"] as DateFilter[]).map((f) => {
              const labels: Record<DateFilter, string> = { hoy: "Hoy", manana: "Mañana", finde: "Finde" };
              const counts: Record<DateFilter, number> = {
                hoy: todayEvents.length,
                manana: tomorrowEvents.length,
                finde: weekendEvents.length,
              };
              return (
                <button
                  key={f}
                  type="button"
                  onClick={() => handleDateChange(f)}
                  className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-bold tracking-wide transition-all ${
                    dateFilter === f
                      ? "bg-neon-cyan/20 border border-neon-cyan/40 text-neon-cyan shadow-sm"
                      : "text-white/50 hover:text-white"
                  }`}
                >
                  {labels[f]}
                  <span className={`text-[9px] font-semibold ${dateFilter === f ? "text-neon-cyan/70" : "text-white/30"}`}>
                    {counts[f]}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Count + recurring toggle */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="rounded-lg bg-black/80 border border-white/20 shadow-lg px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm whitespace-nowrap">
              {visibleEvents.length} {visibleEvents.length === 1 ? "evento" : "eventos"} en el mapa
            </div>
            {recurringCount > 0 && (
              <button
                type="button"
                onClick={() => setHideRecurring((v) => !v)}
                title={hideRecurring ? "Mostrar eventos recurrentes" : "Ocultar eventos recurrentes"}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide transition-all shadow-lg backdrop-blur-sm whitespace-nowrap ${
                  hideRecurring
                    ? "bg-neon-violet/25 border border-neon-violet/50 text-neon-violet"
                    : "bg-black/80 border border-white/20 text-white/70 hover:text-white hover:border-white/40"
                }`}
              >
                <RotateCw className="h-3 w-3 shrink-0" />
                {hideRecurring ? "Recurrentes ocultos" : "Ocultar recurrentes"}
              </button>
            )}
          </div>
        </div>

        {/* Right: style switcher */}
        <div className="flex items-center gap-1 rounded-lg bg-black/80 border border-white/20 shadow-lg backdrop-blur-sm p-1 self-start">
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
    </div>
  );
}
