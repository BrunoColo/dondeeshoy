"use client";

import { useMemo, useState, useCallback, useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { RotateCw, Maximize2 } from "lucide-react";
import { formatPrice, formatTime } from "@/lib/format";
import type { EventType } from "@/types/events";

/** Marker color per event type */
const TYPE_COLORS: Record<string, string> = {
  fiesta: "#F97316",
  festival: "#EC4899",
  concierto: "#0EA5E9",
  recital: "#06B6D4",
  cultural: "#6366F1",
  deportivo: "#22C55E",
  gastronomico: "#14B8A6",
  familiar: "#10B981",
  feria: "#F43F5E",
  taller: "#14B8A6",
  club: "#6366F1",
  bar: "#F59E0B",
  teatro: "#84CC16",
  otro: "#94A3B8",
};

const SVG_NS = "http://www.w3.org/2000/svg";

/** Category icons (SVG markup) per event type */
const TYPE_ICON_MARKUP: Record<string, string> = {
  fiesta: '<path d="M12 3v4M12 17v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M3 12h4M17 12h4M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8" /><circle cx="12" cy="12" r="2.5" />',
  festival: '<path d="M12 3.5 14.7 8.9 20.6 9.8 16.3 14 17.3 19.9 12 17.1 6.7 19.9 7.7 14 3.4 9.8 9.3 8.9Z" fill="currentColor" stroke="none" />',
  concierto: '<path d="M15 5v8.4a3 3 0 1 1-1.8-2.7V7.2l6-1.8v6a3 3 0 1 1-1.8-2.7V3.9Z" fill="currentColor" stroke="none" />',
  recital: '<path d="M15 5v8.4a3 3 0 1 1-1.8-2.7V7.2l6-1.8v6a3 3 0 1 1-1.8-2.7V3.9Z" fill="currentColor" stroke="none" />',
  cultural: '<path d="M7 5.5A2.5 2.5 0 0 1 9.5 8v10A2.5 2.5 0 0 0 7 15.5H5V5.5Zm10 0A2.5 2.5 0 0 0 14.5 8v10A2.5 2.5 0 0 1 17 15.5h2V5.5Z" fill="currentColor" stroke="none" /><path d="M9.5 8h5M9.5 12h5M9.5 16h5" />',
  deportivo: '<circle cx="12" cy="12" r="7.5" /><path d="M12 4.5c1.8 1.4 2.9 2.9 3.4 4.5-.8 1.2-2 2.1-3.4 2.8-1.4-.7-2.6-1.6-3.4-2.8.5-1.6 1.6-3.1 3.4-4.5Zm-3.4 7.3L6 16l3.8 2.5M15.4 11.8 18 16l-3.8 2.5" />',
  gastronomico: '<path d="M8 4v7M6 4v7M8 8H6M15 4v7" /><path d="M18 4c0 3-1 4.7-3 5.2V20" />',
  familiar: '<circle cx="9" cy="9" r="2.2" fill="currentColor" stroke="none" /><circle cx="15.5" cy="8.2" r="2.6" fill="currentColor" stroke="none" /><path d="M5.5 18a4 4 0 0 1 7 0M11.5 18a4.8 4.8 0 0 1 8 0" />',
  feria: '<path d="M7 8.5h10l-1 9H8Zm2-3h6l1 3H8Z" /><path d="M10 11.5h4" />',
  taller: '<path d="M14.8 6.2a3 3 0 0 0-3.9 3.9L5 16v3h3l5.9-5.9a3 3 0 0 0 3.9-3.9l-2.2 2.2-1.6-1.6Z" fill="currentColor" stroke="none" />',
  club: '<path d="M15 5v8.4a3 3 0 1 1-1.8-2.7V7.2l6-1.8v6a3 3 0 1 1-1.8-2.7V3.9Z" fill="currentColor" stroke="none" />',
  bar: '<path d="M6 5h12l-4.5 5v3.8l-2 1.2V10Z" /><path d="M10.5 18h3" />',
  teatro: '<path d="M7 6.5h10v6.8c-2-.8-3.8-.8-5.5.2-1.5.8-2.9.9-4.5.1Z" /><path d="M9.2 9.4h.01M14.8 9.4h.01" /><path d="M9.5 12c.8.7 1.6 1 2.5 1s1.7-.3 2.5-1" />',
  otro: '<circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" /><path d="M12 4.5c-3.6 0-6.5 2.9-6.5 6.4 0 4.8 6.5 8.6 6.5 8.6s6.5-3.8 6.5-8.6c0-3.5-2.9-6.4-6.5-6.4Z" />',
};

function createMarkerIcon(eventType: string, isSelected: boolean): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, "svg");
  const iconSize = isSelected ? 16 : 14;

  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", String(iconSize));
  svg.setAttribute("height", String(iconSize));
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", isSelected ? "1.9" : "1.8");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.style.color = "#F8FAFC";
  svg.style.filter = "drop-shadow(0 1px 2px rgba(0,0,0,0.35))";
  svg.style.pointerEvents = "none";
  svg.innerHTML = TYPE_ICON_MARKUP[eventType] ?? TYPE_ICON_MARKUP.otro;

  return svg;
}

/** Create a colored marker element.
 *  IMPORTANT: Do NOT set `position` on the wrapper — Mapbox GL applies
 *  `position: absolute` via the `.mapboxgl-marker` class and uses CSS
 *  `transform` to project it on screen.  Overriding that with
 *  `position: relative` breaks zoom because the marker starts in
 *  document flow instead of at (0,0) of the marker container. */
function createMarkerElement(color: string, eventType: string, isSelected = false): HTMLDivElement {
  const circleSize = isSelected ? 34 : 28;
  const pointerH = isSelected ? 7 : 5;
  const totalH = circleSize + pointerH - 1; // -1 overlap

  // Wrapper — only width/height so Mapbox can compute the anchor offset.
  // `position` is intentionally NOT set; .mapboxgl-marker (absolute) handles it.
  const wrapper = document.createElement("div");
  wrapper.style.width = `${circleSize}px`;
  wrapper.style.height = `${totalH}px`;
  wrapper.style.cursor = "pointer";

  // Circle — absolutely positioned inside the wrapper
  const circle = document.createElement("div");
  circle.style.position = "absolute";
  circle.style.top = "0";
  circle.style.left = "0";
  circle.style.width = `${circleSize}px`;
  circle.style.height = `${circleSize}px`;
  circle.style.borderRadius = "50%";
  circle.style.background = `radial-gradient(circle at 30% 28%, rgba(255,255,255,0.24), rgba(255,255,255,0.02) 34%, transparent 35%), ${color}`;
  circle.style.border = `2px solid ${isSelected ? "#fff" : "rgba(255,255,255,0.7)"}`;
  circle.style.display = "flex";
  circle.style.alignItems = "center";
  circle.style.justifyContent = "center";
  circle.style.boxShadow = isSelected
    ? `0 0 0 3px ${color}55, 0 4px 12px rgba(0,0,0,0.45)`
    : "0 2px 6px rgba(0,0,0,0.35)";
  circle.style.transition = "box-shadow 0.2s ease, filter 0.2s ease";
  circle.dataset.role = "circle";

  // Pulse ring for selected marker
  if (isSelected) {
    const pulse = document.createElement("div");
    pulse.style.position = "absolute";
    pulse.style.top = "0";
    pulse.style.left = "0";
    pulse.style.width = `${circleSize}px`;
    pulse.style.height = `${circleSize}px`;
    pulse.style.borderRadius = "50%";
    pulse.style.border = `2px solid ${color}`;
    pulse.style.animation = "marker-pulse 2s ease-out infinite";
    pulse.style.pointerEvents = "none";
    wrapper.appendChild(pulse);
  }

  // SVG icon
  const icon = createMarkerIcon(eventType, isSelected);
  circle.appendChild(icon);
  wrapper.appendChild(circle);

  // Triangle pointer — absolute, centred at bottom
  const pointer = document.createElement("div");
  pointer.style.position = "absolute";
  pointer.style.bottom = "0";
  pointer.style.left = "50%";
  pointer.style.transform = "translateX(-50%)";
  pointer.style.width = "0";
  pointer.style.height = "0";
  pointer.style.borderLeft = `${pointerH}px solid transparent`;
  pointer.style.borderRight = `${pointerH}px solid transparent`;
  pointer.style.borderTop = `${pointerH}px solid ${color}`;
  wrapper.appendChild(pointer);

  // Drop-in entrance animation (on the wrapper — uses opacity+scale only,
  // NOT translate, so it doesn't fight Mapbox's positioning transform).
  wrapper.style.animation = "marker-drop 0.35s cubic-bezier(0.34,1.56,0.64,1) both";

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
  const initialStyleRef = useRef(true);

  const [styleKey, setStyleKey] = useState<MapStyleKey>("calles");
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
      style: MAP_STYLES.calles,
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

  // Handle style switching — setMapReady(false) here so we don't call it inside the effect
  const handleStyleChange = useCallback((key: MapStyleKey) => {
    setMapReady(false);
    setStyleKey(key);
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Skip on mount — map was already created with the initial style in the init effect
    if (initialStyleRef.current) {
      initialStyleRef.current = false;
      return;
    }

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

    const typeColor = TYPE_COLORS[event.eventType] ?? TYPE_COLORS.otro;
    const container = document.createElement("div");
    container.innerHTML = `
      <div style="font-family: system-ui, -apple-system, sans-serif; min-width: 220px; max-width: 280px;">
        <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 8px;">
          <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: ${typeColor}; box-shadow: 0 0 6px ${typeColor}88; flex-shrink: 0;"></span>
          <span style="font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: ${typeColor};">${event.eventType}</span>
        </div>
        <h3 style="font-size: 14px; font-weight: 600; line-height: 1.3; color: #F1F5F9; margin: 0 0 8px 0; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${event.name}</h3>
        <div style="display: flex; flex-direction: column; gap: 5px; font-size: 12px; color: #94A3B8;">
          <div style="display: flex; align-items: center; gap: 6px;">
            <span>📍</span>
            <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${event.venueName}</span>
          </div>
          ${timeLabel ? `<div style="display: flex; align-items: center; gap: 6px;"><span>🕐</span><span>${timeLabel}</span></div>` : ""}
          <div style="display: flex; align-items: center; gap: 6px;">
            <span>🎫</span>
            <span style="font-weight: 600; color: ${event.isFree ? "#34D399" : "#CBD5E1"};">${price}</span>
          </div>
        </div>
        <a href="/evento/${event.slug}" style="display: flex; align-items: center; justify-content: center; gap: 6px; margin-top: 10px; padding: 7px 12px; border-radius: 10px; background: rgba(13,148,136,0.15); border: 1px solid rgba(13,148,136,0.35); font-size: 12px; font-weight: 600; color: #14B8A6; text-decoration: none; transition: background 0.2s ease;">
          Ver evento →
        </a>
      </div>
    `;

    const popup = new mapboxgl.Popup({
      closeButton: true,
      maxWidth: "300px",
      offset: 28,
      className: "dark-popup",
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

      // Hover effect — glow on circle child only, NO transform to avoid
      // conflicting with Mapbox's internal marker positioning.
      const circleEl = el.querySelector('[data-role="circle"]') as HTMLElement | null;
      if (circleEl) {
        el.addEventListener("mouseenter", () => {
          circleEl.style.boxShadow = `0 0 0 3px rgba(255,255,255,0.9), 0 0 12px ${color}80, 0 4px 16px rgba(0,0,0,0.5)`;
          circleEl.style.filter = "brightness(1.2)";
        });
        el.addEventListener("mouseleave", () => {
          circleEl.style.boxShadow = isSelected
            ? `0 0 0 3px ${color}55, 0 4px 12px rgba(0,0,0,0.45)`
            : "0 2px 6px rgba(0,0,0,0.35)";
          circleEl.style.filter = "brightness(1)";
        });
      }

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
      <div className="absolute top-2 lg:top-3 left-2 right-2 z-[1000] flex items-start justify-between gap-2">
        {/* Date filter pills */}
        <div className="flex items-center gap-1.5 rounded-2xl p-0.5">
          {(["hoy", "manana", "finde"] as DateFilter[]).map((f) => {
            const labels: Record<DateFilter, string> = { hoy: "Hoy", manana: "Mañana", finde: "Finde" };
            const counts: Record<DateFilter, number> = {
              hoy: todayEvents.length,
              manana: tomorrowEvents.length,
              finde: weekendEvents.length,
            };
            const isActive = dateFilter === f;
            return (
              <button
                key={f}
                type="button"
                onClick={() => handleDateChange(f)}
                className={`relative flex items-center gap-1.5 rounded-xl px-3 py-2 text-[11px] font-bold tracking-wide transition-all duration-200 ${
                  isActive
                    ? "bg-[rgba(34,39,74,0.88)] text-white ring-1 ring-indigo-200/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_8px_18px_rgba(8,10,24,0.22)] backdrop-blur-xl"
                    : "bg-[rgba(8,10,24,0.58)] text-white/72 ring-1 ring-white/[0.08] shadow-[0_6px_16px_rgba(0,0,0,0.16)] backdrop-blur-lg hover:text-white hover:bg-[rgba(12,15,32,0.72)]"
                }`}
              >
                {labels[f]}
                <span className={`text-[9px] tabular-nums font-semibold ${
                  isActive ? "bg-white/[0.10] text-indigo-100 px-1.5 py-0.5 rounded-full" : "text-white/45"
                }`}>
                  {counts[f]}
                </span>
              </button>
            );
          })}
        </div>

        {/* Right side: style toggle + fit */}
        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-0.5 rounded-xl bg-[rgba(6,6,17,0.85)] border border-white/[0.12] shadow-xl backdrop-blur-xl p-1">
            <button
              type="button"
              onClick={() => handleStyleChange("calles")}
              className={`rounded-lg px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wide transition-all duration-200 ${
                styleKey === "calles"
                  ? "bg-white/15 text-white border border-white/20 shadow-sm"
                  : "text-white/50 hover:text-white/80 hover:bg-white/[0.06] border border-transparent"
              }`}
            >
              Calles
            </button>
            <button
              type="button"
              onClick={() => handleStyleChange("oscuro")}
              className={`rounded-lg px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wide transition-all duration-200 ${
                styleKey === "oscuro"
                  ? "bg-white/15 text-white border border-white/20 shadow-sm"
                  : "text-white/50 hover:text-white/80 hover:bg-white/[0.06] border border-transparent"
              }`}
            >
              Noche
            </button>
          </div>
          <button
            type="button"
            onClick={fitBounds}
            title="Encuadrar todos los eventos"
            className="flex items-center justify-center rounded-xl bg-[rgba(6,6,17,0.85)] border border-white/[0.12] shadow-xl backdrop-blur-xl p-2.5 text-white/60 hover:text-white hover:bg-white/[0.08] transition-all duration-200"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* ─── Bottom-left: event count + recurring toggle ─── */}
      <div className="absolute bottom-[72px] sm:bottom-3 left-2 sm:left-3 z-[1000] flex flex-col gap-1.5">
        {/* Event count badge */}
        <div className="rounded-xl bg-[rgba(6,6,17,0.85)] border border-white/[0.12] shadow-xl backdrop-blur-xl px-3 py-2 text-[11px] font-medium text-white/90">
          <span className="font-bold text-white">{visibleEvents.length}</span>{" "}
          {visibleEvents.length === 1 ? "evento" : "eventos"}
          {activeTypeFilter && (
            <span className="ml-1 text-indigo-light font-semibold">
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
            className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-[10px] font-semibold tracking-wide transition-all duration-200 shadow-xl backdrop-blur-xl ${
              hideRecurring
                ? "bg-indigo/25 border border-indigo/40 text-indigo-light"
                : "bg-[rgba(6,6,17,0.85)] border border-white/[0.12] text-white/60 hover:text-white/90"
            }`}
          >
            <RotateCw className="h-3 w-3 shrink-0" />
            {hideRecurring ? "Ocultos" : "Recurrentes"} ({recurringCount})
          </button>
        )}
      </div>

      {/* ─── Bottom-right: legend (desktop only) ─── */}
      <div className="absolute bottom-3 right-14 z-[1000] hidden lg:flex flex-wrap gap-x-3 gap-y-1 rounded-xl bg-[rgba(6,6,17,0.85)] border border-white/[0.12] shadow-xl backdrop-blur-xl px-3 py-2.5 text-[10px] max-w-[300px]">
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
