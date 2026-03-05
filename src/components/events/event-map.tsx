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

/** Create a colored marker element for Mapbox GL — circle + pointer, no rotation */
function createMarkerElement(color: string, eventType: string, isSelected = false): HTMLDivElement {
  const circleSize = isSelected ? 36 : 30;
  const pointerH = isSelected ? 8 : 6;

  // Container: holds circle + pointer, anchored at bottom-center
  const wrapper = document.createElement("div");
  wrapper.style.display = "flex";
  wrapper.style.flexDirection = "column";
  wrapper.style.alignItems = "center";
  wrapper.style.cursor = "pointer";
  wrapper.style.transition = "transform 0.2s ease";

  // Circle
  const circle = document.createElement("div");
  circle.style.width = `${circleSize}px`;
  circle.style.height = `${circleSize}px`;
  circle.style.borderRadius = "50%";
  circle.style.background = color;
  circle.style.border = `2.5px solid ${isSelected ? "#fff" : "rgba(255,255,255,0.6)"}`;
  circle.style.display = "flex";
  circle.style.alignItems = "center";
  circle.style.justifyContent = "center";
  circle.style.boxShadow = isSelected
    ? `0 0 0 3px ${color}55, 0 4px 12px rgba(0,0,0,0.45)`
    : "0 2px 8px rgba(0,0,0,0.4)";

  // Emoji
  const icon = document.createElement("span");
  icon.style.fontSize = isSelected ? "15px" : "13px";
  icon.style.lineHeight = "1";
  icon.style.userSelect = "none";
  icon.textContent = TYPE_ICONS[eventType] ?? "📌";
  circle.appendChild(icon);
  wrapper.appendChild(circle);

  // Triangle pointer
  const pointer = document.createElement("div");
  pointer.style.width = "0";
  pointer.style.height = "0";
  pointer.style.borderLeft = `${pointerH}px solid transparent`;
  pointer.style.borderRight = `${pointerH}px solid transparent`;
  pointer.style.borderTop = `${pointerH}px solid ${color}`;
  pointer.style.marginTop = "-1px";
  wrapper.appendChild(pointer);

  return wrapper;
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
  useEffect(() => {
    onEventSelectRef.current = onEventSelect;
  }, [onEventSelect]);

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
  }, []);

  // Handle style switching
  const handleStyleChange = useCallback((key: MapStyleKey) => {
    setStyleKey(key);
    setMapReady(false);
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    // Clear markers before switching
    for (const [, marker] of markersRef.current) marker.remove();
    markersRef.current.clear();
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

      // Hover effect — scale from bottom center (the pin tip)
      el.style.transformOrigin = "center bottom";
      el.addEventListener("mouseenter", () => {
        el.style.transform = "scale(1.2)";
      });
      el.addEventListener("mouseleave", () => {
        el.style.transform = "scale(1)";
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

      {/* ─── Top bar: date pills + style/fit ─── */}
      <div className="absolute top-[52px] lg:top-3 left-3 right-3 z-[1000] flex items-start justify-between gap-2">
        {/* Date filter pills */}
        <div className="flex items-center gap-0.5 rounded-xl bg-black/75 border border-white/15 shadow-lg backdrop-blur-md p-1">
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
                className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-bold tracking-wide transition-all ${
                  dateFilter === f
                    ? "bg-accent/25 text-accent-light shadow-sm"
                    : "text-white/50 hover:text-white/80"
                }`}
              >
                {labels[f]}
                <span className={`text-[9px] tabular-nums ${dateFilter === f ? "text-accent-light/70" : "text-white/30"}`}>
                  {counts[f]}
                </span>
              </button>
            );
          })}
        </div>

        {/* Right side: style toggle + fit */}
        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-0.5 rounded-xl bg-black/75 border border-white/15 shadow-lg backdrop-blur-md p-1">
            <button
              type="button"
              onClick={() => handleStyleChange("calles")}
              className={`rounded-lg px-2 py-1.5 text-[10px] font-bold uppercase tracking-wide transition-all ${
                styleKey === "calles"
                  ? "bg-white/20 text-white"
                  : "text-white/50 hover:text-white/80"
              }`}
            >
              Calles
            </button>
            <button
              type="button"
              onClick={() => handleStyleChange("oscuro")}
              className={`rounded-lg px-2 py-1.5 text-[10px] font-bold uppercase tracking-wide transition-all ${
                styleKey === "oscuro"
                  ? "bg-white/20 text-white"
                  : "text-white/50 hover:text-white/80"
              }`}
            >
              Noche
            </button>
          </div>
          <button
            type="button"
            onClick={fitBounds}
            title="Encuadrar todos los eventos"
            className="flex items-center justify-center rounded-xl bg-black/75 border border-white/15 shadow-lg backdrop-blur-md p-2 text-white/60 hover:text-white transition-all"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* ─── Bottom-left: event count + recurring toggle ─── */}
      <div className="absolute bottom-3 left-3 z-[1000] flex flex-col gap-1.5">
        {/* Event count badge */}
        <div className="rounded-xl bg-black/75 border border-white/15 shadow-lg backdrop-blur-md px-3 py-1.5 text-[11px] font-medium text-white/90">
          <span className="font-bold text-white">{visibleEvents.length}</span>{" "}
          {visibleEvents.length === 1 ? "evento" : "eventos"}
          {activeTypeFilter && (
            <span className="ml-1 text-accent-light font-semibold">
              · {activeTypeFilter}
            </span>
          )}
        </div>

        {/* Hide recurring toggle */}
        {recurringCount > 0 && (
          <button
            type="button"
            onClick={() => setHideRecurring((v) => !v)}
            title={hideRecurring ? "Mostrar recurrentes" : "Ocultar recurrentes"}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[10px] font-semibold tracking-wide transition-all shadow-lg backdrop-blur-md ${
              hideRecurring
                ? "bg-accent/25 border border-accent/40 text-accent-light"
                : "bg-black/75 border border-white/15 text-white/60 hover:text-white/90"
            }`}
          >
            <RotateCw className="h-3 w-3 shrink-0" />
            {hideRecurring ? "Ocultos" : "Recurrentes"} ({recurringCount})
          </button>
        )}
      </div>

      {/* ─── Bottom-right: legend (desktop only) ─── */}
      <div className="absolute bottom-3 right-14 z-[1000] hidden lg:flex flex-wrap gap-x-3 gap-y-1 rounded-xl bg-black/75 border border-white/15 shadow-lg backdrop-blur-md px-3 py-2 text-[10px] max-w-[320px]">
        {Object.entries(TYPE_COLORS)
          .filter(([key]) => key !== "otro")
          .map(([type, color]) => (
            <div key={type} className="flex items-center gap-1">
              <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
              <span className="capitalize text-white/60">{type}</span>
            </div>
          ))}
      </div>
    </div>
  );
}
