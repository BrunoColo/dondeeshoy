"use client";

import { useMemo, useState, useCallback, useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { RotateCw, Maximize2 } from "lucide-react";
import { formatPrice, formatTime } from "@/lib/format";
import type { EventType } from "@/types/events";

/** Marker color per event type */
const TYPE_COLORS: Record<string, string> = {
  fiesta: "#14B8A6",
  festival: "#EC4899",
  concierto: "#0EA5E9",
  recital: "#06B6D4",
  cultural: "#6366F1",
  deportivo: "#22C55E",
  gastronomico: "#F97316",
  familiar: "#84CC16",
  feria: "#F43F5E",
  taller: "#14B8A6",
  club: "#6366F1",
  bar: "#F59E0B",
  teatro: "#10B981",
  otro: "#94A3B8",
};

/** Category icons (emoji) per event type */
const TYPE_ICONS: Record<string, string> = {
  fiesta: "🎉",
  festival: "🎪",
  concierto: "🎵",
  recital: "🎤",
  cultural: "🎨",
  deportivo: "⚽",
  gastronomico: "🍽️",
  familiar: "👨‍👩‍👧",
  feria: "🛍️",
  taller: "🔧",
  club: "🎶",
  bar: "🍺",
  teatro: "🎭",
  otro: "📌",
};

/** Create a colored marker element for Mapbox GL */
function createMarkerElement(color: string, eventType: string, isSelected = false): HTMLDivElement {
  const size = isSelected ? 40 : 32;
  const el = document.createElement("div");
  el.style.width = `${size}px`;
  el.style.height = `${size}px`;
  el.style.cursor = "pointer";
  el.style.display = "flex";
  el.style.alignItems = "center";
  el.style.justifyContent = "center";
  el.style.borderRadius = "50% 50% 50% 0";
  el.style.background = color;
  el.style.border = `2px solid ${isSelected ? "#fff" : "rgba(255,255,255,0.5)"}`;
  el.style.transform = "rotate(-45deg)";
  el.style.boxShadow = isSelected
    ? `0 0 0 3px ${color}55, 0 4px 12px rgba(0,0,0,0.4)`
    : "0 2px 8px rgba(0,0,0,0.35)";
  el.style.transition = "all 0.2s ease";

  const inner = document.createElement("span");
  inner.style.transform = "rotate(45deg)";
  inner.style.fontSize = isSelected ? "16px" : "13px";
  inner.style.lineHeight = "1";
  inner.textContent = TYPE_ICONS[eventType] ?? "📌";
  el.appendChild(inner);

  return el;
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
  selectedEventId?: string | null;
  activeTypeFilter?: string | null;
  onEventSelect?: (event: MapEvent | null) => void;
  onDateFilterChange?: (filter: DateFilter) => void;
}

export type DateFilter = "hoy" | "manana" | "finde";

const MAP_STYLES = {
  calles: "mapbox://styles/mapbox/streets-v12",
  oscuro: "mapbox://styles/mapbox/dark-v11",
} as const;

type MapStyleKey = keyof typeof MAP_STYLES;

export function EventMap({
  todayEvents,
  tomorrowEvents,
  weekendEvents,
  selectedEventId,
  activeTypeFilter,
  onEventSelect,
  onDateFilterChange,
}: EventMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<Map<string, mapboxgl.Marker>>(new Map());
  const popupRef = useRef<mapboxgl.Popup | null>(null);

  const [styleKey, setStyleKey] = useState<MapStyleKey>("oscuro");
  const [hideRecurring, setHideRecurring] = useState(false);
  const [dateFilter, setDateFilter] = useState<DateFilter>("hoy");
  const [mapReady, setMapReady] = useState(false);

  // Stable ref for onEventSelect to avoid marker recreation
  const onEventSelectRef = useRef(onEventSelect);
  onEventSelectRef.current = onEventSelect;

  const activeEvents = useMemo(() => {
    if (dateFilter === "manana") return tomorrowEvents;
    if (dateFilter === "finde") return weekendEvents;
    return todayEvents;
  }, [dateFilter, todayEvents, tomorrowEvents, weekendEvents]);

  const recurringCount = useMemo(() => activeEvents.filter((e) => e.isRecurring).length, [activeEvents]);

  const visibleEvents = useMemo(() => {
    let events = activeEvents;
    if (hideRecurring) events = events.filter((e) => !e.isRecurring);
    if (activeTypeFilter) events = events.filter((e) => e.eventType === activeTypeFilter);
    return events;
  }, [activeEvents, hideRecurring, activeTypeFilter]);

  // Notify parent only when the date filter pill changes
  useEffect(() => {
    onDateFilterChange?.(dateFilter);
  }, [dateFilter, onDateFilterChange]);

  // Initialize Mapbox GL map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) {
      console.error("NEXT_PUBLIC_MAPBOX_TOKEN not set");
      return;
    }

    mapboxgl.accessToken = token;
    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: MAP_STYLES.oscuro,
      center: [-56.1645, -34.9011],
      zoom: 12,
      attributionControl: true,
      maxBounds: [
        [-58.5, -35.8],
        [-53.0, -30.0],
      ],
    });

    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "bottom-right");

    map.on("load", () => {
      setMapReady(true);
    });

    mapRef.current = map;

    return () => {
      setMapReady(false);
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle style switching
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    // Clear markers and mark as not ready before switching
    for (const [, marker] of markersRef.current) marker.remove();
    markersRef.current.clear();
    setMapReady(false);
    map.setStyle(MAP_STYLES[styleKey]);

    const onStyleLoad = () => setMapReady(true);
    map.once("style.load", onStyleLoad);
    return () => { map.off("style.load", onStyleLoad); };
  }, [styleKey]);


  // Show popup for a given event
  const showPopup = useCallback((map: mapboxgl.Map, event: MapEvent) => {
    if (popupRef.current) popupRef.current.remove();

    const price = event.isFree
      ? "Gratis"
      : event.priceMin
        ? formatPrice(event.priceMin, null, false, event.currency)
        : "Consultar";
    const timeLabel = formatTime(event.startTime ?? null);

    const container = document.createElement("div");
    container.innerHTML = `
      <div style="font-family: system-ui, -apple-system, sans-serif; min-width: 220px; max-width: 280px;">
        <h3 style="font-size: 14px; font-weight: 600; line-height: 1.3; color: #1a1a1a; margin: 0 0 8px 0; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${event.name}</h3>
        <div style="display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: #666;">
          <div style="display: flex; align-items: center; gap: 6px;">
            <span>📍</span>
            <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${event.venueName}</span>
          </div>
          ${timeLabel ? `<div style="display: flex; align-items: center; gap: 6px;"><span>🕐</span><span>${timeLabel}</span></div>` : ""}
          <div style="display: flex; align-items: center; gap: 6px;">
            <span>🎫</span>
            <span>${price}</span>
          </div>
        </div>
        <a href="/evento/${event.slug}" style="display: flex; align-items: center; justify-content: center; gap: 6px; margin-top: 8px; padding: 6px 12px; border-radius: 8px; background: #f0fdfa; border: 1px solid #99f6e4; font-size: 12px; font-weight: 500; color: #0f766e; text-decoration: none;">
          Ver evento →
        </a>
      </div>
    `;

    const popup = new mapboxgl.Popup({
      closeButton: true,
      maxWidth: "300px",
      offset: 25,
    })
      .setLngLat([event.longitude, event.latitude])
      .setDOMContent(container)
      .addTo(map);

    popup.on("close", () => {
      onEventSelectRef.current?.(null);
      popupRef.current = null;
    });

    popupRef.current = popup;
  }, []);

  // Render markers when visible events change
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    // Remove old markers
    for (const [, marker] of markersRef.current) {
      marker.remove();
    }
    markersRef.current.clear();

    // Add new markers
    for (const event of visibleEvents) {
      const isSelected = selectedEventId === event.id;
      const color = TYPE_COLORS[event.eventType] ?? TYPE_COLORS.otro;
      const el = createMarkerElement(color, event.eventType, isSelected);

      // Hover effect
      el.addEventListener("mouseenter", () => {
        el.style.transform = "rotate(-45deg) scale(1.15)";
      });
      el.addEventListener("mouseleave", () => {
        el.style.transform = "rotate(-45deg) scale(1)";
      });

      el.addEventListener("click", (e) => {
        e.stopPropagation();
        onEventSelectRef.current?.(event);
        showPopup(map, event);
      });

      const marker = new mapboxgl.Marker({ element: el, anchor: "bottom" })
        .setLngLat([event.longitude, event.latitude])
        .addTo(map);

      markersRef.current.set(event.id, marker);
    }
  }, [visibleEvents, mapReady, selectedEventId, showPopup]);

  // Fly to selected event
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !selectedEventId) return;

    const event = visibleEvents.find((e) => e.id === selectedEventId);
    if (event) {
      map.flyTo({
        center: [event.longitude, event.latitude],
        zoom: Math.max(map.getZoom(), 14),
        duration: 800,
      });
      showPopup(map, event);
    }
  }, [selectedEventId, visibleEvents, mapReady, showPopup]);

  const fitBounds = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;

    const events = visibleEvents;
    if (events.length === 0) return;

    if (events.length === 1) {
      map.flyTo({ center: [events[0].longitude, events[0].latitude], zoom: 14, duration: 600 });
      return;
    }

    const bounds = new mapboxgl.LngLatBounds();
    for (const e of events) {
      bounds.extend([e.longitude, e.latitude]);
    }
    map.fitBounds(bounds, { padding: 60, duration: 600, maxZoom: 15 });
  }, [visibleEvents]);

  const handleDateChange = (f: DateFilter) => {
    setDateFilter(f);
    onEventSelectRef.current?.(null);
    if (popupRef.current) popupRef.current.remove();
    setTimeout(() => fitBounds(), 50);
  };

  return (
    <div className="relative h-full w-full">
      {/* Mapbox GL container */}
      <div ref={mapContainerRef} className="h-full w-full" />

      {/* Legend — hidden on mobile */}
      <div className="absolute bottom-4 left-4 z-[1000] hidden lg:flex flex-wrap gap-2 rounded-xl glass-card px-3 py-2 text-[10px] max-w-[280px]">
        {Object.entries(TYPE_COLORS)
          .filter(([key]) => key !== "otro")
          .map(([type, color]) => (
            <div key={type} className="flex items-center gap-1">
              <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
              <span className="capitalize text-text-muted">{type}</span>
            </div>
          ))}
      </div>

      {/* Mobile legend (compact) */}
      <div className="absolute bottom-[76px] sm:bottom-4 left-4 z-[1000] flex lg:hidden flex-wrap gap-1.5 rounded-xl glass-card px-2.5 py-1.5 text-[9px] max-w-[200px]">
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

      {/* Top controls — offset on mobile for toggle bar */}
      <div className="absolute top-[52px] lg:top-4 left-4 right-4 z-[1000] flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        {/* Left: date filter + count + recurring toggle */}
        <div className="flex flex-col gap-2">
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
                      ? "bg-accent/20 border border-accent/40 text-accent-light shadow-sm"
                      : "text-white/50 hover:text-white"
                  }`}
                >
                  {labels[f]}
                  <span className={`text-[9px] font-semibold ${dateFilter === f ? "text-accent-light/70" : "text-white/30"}`}>
                    {counts[f]}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="rounded-lg bg-black/80 border border-white/20 shadow-lg px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm whitespace-nowrap">
              {visibleEvents.length} {visibleEvents.length === 1 ? "evento" : "eventos"} en el mapa
              {activeTypeFilter && (
                <span className="ml-1.5 text-[10px] text-accent-light font-semibold">
                  · {activeTypeFilter}
                </span>
              )}
            </div>
            {recurringCount > 0 && (
              <button
                type="button"
                onClick={() => setHideRecurring((v) => !v)}
                title={hideRecurring ? "Mostrar eventos recurrentes" : "Ocultar eventos recurrentes"}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide transition-all shadow-lg backdrop-blur-sm whitespace-nowrap ${
                  hideRecurring
                    ? "bg-accent/25 border border-accent/50 text-accent-light"
                    : "bg-black/80 border border-white/20 text-white/70 hover:text-white hover:border-white/40"
                }`}
              >
                <RotateCw className="h-3 w-3 shrink-0" />
                {hideRecurring ? "Recurrentes ocultos" : "Ocultar recurrentes"}
              </button>
            )}
          </div>
        </div>

        {/* Right: style switcher + fit bounds */}
        <div className="flex flex-col gap-2 items-end">
          <div className="flex items-center gap-1 rounded-lg bg-black/80 border border-white/20 shadow-lg backdrop-blur-sm p-1">
            <button
              type="button"
              onClick={() => setStyleKey("calles")}
              className={`rounded-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide transition-all ${
                styleKey === "calles"
                  ? "bg-white/20 text-white shadow-sm"
                  : "text-white/50 hover:text-white"
              }`}
            >
              Calles
            </button>
            <button
              type="button"
              onClick={() => setStyleKey("oscuro")}
              className={`rounded-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide transition-all ${
                styleKey === "oscuro"
                  ? "bg-white/20 text-white shadow-sm"
                  : "text-white/50 hover:text-white"
              }`}
            >
              Noche
            </button>
          </div>

          <button
            type="button"
            onClick={fitBounds}
            title="Encuadrar todos los eventos"
            className="flex items-center gap-1.5 rounded-lg bg-black/80 border border-white/20 shadow-lg backdrop-blur-sm px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wide text-white/70 hover:text-white hover:border-white/40 transition-all"
          >
            <Maximize2 className="h-3 w-3 shrink-0" />
            <span className="hidden sm:inline">Encuadrar</span>
          </button>
        </div>
      </div>
    </div>
  );
}
