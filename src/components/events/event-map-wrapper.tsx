"use client";

import dynamic from "next/dynamic";
import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import type { MapEvent, DateFilter } from "./event-map";
import Link from "next/link";
import {
  MapPin,
  Clock,
  Ticket,
  ExternalLink,
  List,
  Map,
  RotateCcw,
  Search,
  X,
  ChevronRight,
  SlidersHorizontal,
} from "lucide-react";
import { formatPrice, formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";

const EventMapLazy = dynamic(
  () => import("./event-map").then((m) => m.EventMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="skeleton h-8 w-8 rounded-full" />
          <p className="text-text-muted text-sm">Cargando mapa...</p>
        </div>
      </div>
    ),
  },
);

interface EventMapWrapperProps {
  todayEvents: MapEvent[];
  tomorrowEvents: MapEvent[];
  weekendEvents: MapEvent[];
}

/** Color per event type */
const TYPE_COLORS: Record<string, string> = {
  fiesta: "#14B8A6",    // teal (was violet — aligned with new accent)
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

/** Compact sidebar row for a single event */
function SidebarEventRow({
  event,
  isSelected,
  onClick,
  index,
}: {
  event: MapEvent;
  isSelected: boolean;
  onClick: () => void;
  index: number;
}) {
  const rowRef = useRef<HTMLButtonElement>(null);
  const color = TYPE_COLORS[event.eventType] ?? TYPE_COLORS.otro;
  const price = formatPrice(event.priceMin ?? null, null, event.isFree, event.currency);
  const timeLabel = formatTime(event.startTime ?? null);

  // Scroll into view when selected
  useEffect(() => {
    if (isSelected && rowRef.current) {
      rowRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [isSelected]);

  return (
    <button
      ref={rowRef}
      type="button"
      onClick={onClick}
      style={{ animationDelay: `${Math.min(index * 35, 400)}ms` }}
      className={cn(
        "card-animate w-full text-left rounded-xl border transition-all duration-200 group overflow-hidden",
        isSelected
          ? "bg-white/[0.09] border-white/25 shadow-[0_0_0_1px_rgba(13,148,136,0.4),0_4px_20px_rgba(0,0,0,0.4)] ring-1 ring-inset ring-white/5"
          : "bg-white/[0.04] border-white/[0.08] hover:bg-white/[0.07] hover:border-white/[0.15]",
      )}
    >
      {/* Accent bar on left when selected */}
      <div className="flex items-stretch">
        <div
          className={cn(
            "w-[3px] shrink-0 rounded-l-xl transition-all duration-300",
            isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-40",
          )}
          style={{ backgroundColor: color }}
        />

        <div className="flex-1 px-3 py-3">
          <div className="flex items-start gap-2.5">
            {/* Color dot */}
            <div
              className="mt-[3px] h-2.5 w-2.5 shrink-0 rounded-full shadow-[0_0_6px_currentColor]"
              style={{ backgroundColor: color, color }}
            />

            <div className="min-w-0 flex-1">
              {/* Name */}
              <p
                className={cn(
                  "text-[13px] font-semibold leading-snug line-clamp-2 transition-colors",
                  isSelected ? "text-white" : "text-[#CBD5E1] group-hover:text-white",
                )}
              >
                {event.name}
              </p>

              {/* Venue */}
              <div className="mt-1 flex items-center gap-1 text-[#64748B] group-hover:text-[#94A3B8] transition-colors">
                <MapPin className="h-3 w-3 shrink-0" strokeWidth={2} />
                <span className="text-[11px] truncate">{event.venueName}</span>
              </div>

              {/* Time + price row */}
              <div className="mt-1.5 flex items-center gap-3">
                {timeLabel && (
                  <div className="flex items-center gap-1 text-[#64748B]">
                    <Clock className="h-3 w-3 shrink-0" strokeWidth={2} />
                    <span className="font-mono text-[11px] text-[#94A3B8]">{timeLabel}</span>
                  </div>
                )}
                <div className="flex items-center gap-1">
                  <Ticket className="h-3 w-3 shrink-0 text-[#64748B]" strokeWidth={2} />
                  <span
                    className={cn(
                      "text-[11px] font-semibold",
                      event.isFree ? "text-[#34D399]" : "text-[#94A3B8]",
                    )}
                  >
                    {price ?? "—"}
                  </span>
                </div>
              </div>
            </div>

            {/* Arrow */}
            <ChevronRight
              className={cn(
                "h-3.5 w-3.5 shrink-0 mt-0.5 transition-all duration-200",
                isSelected
                  ? "text-[#14B8A6] opacity-100 translate-x-0"
                  : "text-[#475569] opacity-0 group-hover:opacity-100 -translate-x-1 group-hover:translate-x-0",
              )}
              strokeWidth={2.5}
            />
          </div>

          {/* "Ver evento" link — only visible when selected */}
          {isSelected && (
            <Link
              href={`/evento/${event.slug}`}
              onClick={(e) => e.stopPropagation()}
              className="mt-2.5 flex items-center justify-center gap-1.5 rounded-lg bg-[#0D9488]/20 border border-[#0D9488]/40 px-3 py-1.5 text-[11px] font-semibold text-[#14B8A6] hover:bg-[#0D9488]/30 hover:border-[#0D9488]/60 transition-all"
            >
              Ver evento completo
              <ExternalLink className="h-3 w-3" />
            </Link>
          )}
        </div>
      </div>
    </button>
  );
}

/** Type filter chip */
function TypeChip({
  type,
  color,
  active,
  count,
  onClick,
}: {
  type: string;
  color: string;
  active: boolean;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide transition-all whitespace-nowrap border",
        active
          ? "text-white border-transparent shadow-[0_0_8px_currentColor]"
          : "bg-white/[0.04] border-white/[0.08] text-[#64748B] hover:text-[#94A3B8] hover:border-white/[0.15]",
      )}
      style={
        active
          ? {
              backgroundColor: `${color}30`,
              borderColor: `${color}60`,
              color,
              boxShadow: `0 0 8px ${color}40`,
            }
          : undefined
      }
    >
      <span
        className="h-1.5 w-1.5 rounded-full shrink-0"
        style={{ backgroundColor: active ? color : "#475569" }}
      />
      {type}
      <span
        className={cn(
          "text-[9px] font-bold",
          active ? "opacity-80" : "opacity-50",
        )}
      >
        {count}
      </span>
    </button>
  );
}

export function EventMapWrapper({ todayEvents, tomorrowEvents, weekendEvents }: EventMapWrapperProps) {
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [currentFilter, setCurrentFilter] = useState<DateFilter>("hoy");
  const [mobileView, setMobileView] = useState<"map" | "list">("map");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTypeFilter, setActiveTypeFilter] = useState<string | null>(null);

  // Track previous date filter to only reset sidebar state when it truly changes
  const prevFilterRef = useRef<DateFilter>("hoy");

  const handleEventSelect = useCallback((event: MapEvent | null) => {
    setSelectedEventId(event?.id ?? null);
  }, []);

  const handleDateFilterChange = useCallback((filter: DateFilter) => {
    const dateActuallyChanged = prevFilterRef.current !== filter;
    prevFilterRef.current = filter;
    setCurrentFilter(filter);
    if (dateActuallyChanged) {
      setSelectedEventId(null);
      setSearchQuery("");
      setActiveTypeFilter(null);
    }
  }, []);

  // Derive sidebar events from date filter + props (not from map’s filtered output)
  const sidebarEvents = useMemo(() => {
    if (currentFilter === "manana") return tomorrowEvents;
    if (currentFilter === "finde") return weekendEvents;
    return todayEvents;
  }, [currentFilter, todayEvents, tomorrowEvents, weekendEvents]);

  // Compute available types from current sidebar events
  const availableTypes = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const e of sidebarEvents) {
      counts[e.eventType] = (counts[e.eventType] ?? 0) + 1;
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([type, count]) => ({ type, count, color: TYPE_COLORS[type] ?? TYPE_COLORS.otro }));
  }, [sidebarEvents]);

  // Filtered events for display
  const filteredEvents = useMemo(() => {
    let events = sidebarEvents;
    if (activeTypeFilter) {
      events = events.filter((e) => e.eventType === activeTypeFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      events = events.filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          e.venueName.toLowerCase().includes(q),
      );
    }
    return events;
  }, [sidebarEvents, activeTypeFilter, searchQuery]);

  const filterLabels: Record<DateFilter, string> = {
    hoy: "Hoy",
    manana: "Mañana",
    finde: "Este finde",
  };

  const SidebarContent = (
    <>
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-white/[0.08] bg-gradient-to-b from-white/[0.03] to-transparent">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-[13px] font-bold text-white uppercase tracking-widest flex items-center gap-2">
              <span
                className="inline-block h-2 w-2 rounded-full animate-pulse"
                style={{ backgroundColor: "#0D9488", boxShadow: "0 0 8px #0D9488" }}
              />
              Eventos en el mapa
            </h2>
            <p className="text-[11px] text-[#64748B] mt-0.5">
              {filterLabels[currentFilter]} ·{" "}
              <span className="text-[#94A3B8] font-semibold">
                {filteredEvents.length}
              </span>{" "}
              {filteredEvents.length === 1 ? "evento" : "eventos"}
              {(searchQuery || activeTypeFilter) && (
                <span className="text-[#14B8A6]"> filtrados</span>
              )}
            </p>
          </div>
          {selectedEventId && (
            <button
              type="button"
              onClick={() => setSelectedEventId(null)}
              className="flex items-center gap-1 rounded-lg bg-white/[0.06] border border-white/[0.12] px-2 py-1 text-[10px] font-medium text-[#94A3B8] hover:text-white hover:border-white/20 transition-all"
            >
              <RotateCcw className="h-3 w-3" />
              Limpiar
            </button>
          )}
        </div>

        {/* Search bar */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#475569] pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar evento o lugar..."
            className="w-full rounded-lg bg-white/[0.06] border border-white/[0.10] pl-8 pr-8 py-2 text-[12px] text-[#CBD5E1] placeholder:text-[#475569] focus:outline-none focus:border-[#0D9488]/50 focus:bg-white/[0.08] transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#475569] hover:text-[#94A3B8] transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Type filter chips — always visible */}
        {availableTypes.length > 1 && (
          <div className="mt-2.5">
            <div className="flex items-center gap-1.5 mb-1.5">
              <SlidersHorizontal className="h-3 w-3 text-[#475569]" />
              <span className="text-[10px] font-semibold uppercase tracking-wide text-[#475569]">
                Filtrar por tipo
              </span>
              {activeTypeFilter && (
                <span className="rounded-full bg-[#0D9488]/20 border border-[#0D9488]/40 px-1.5 py-0.5 text-[9px] text-[#14B8A6]">
                  1 activo
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {activeTypeFilter && (
                <button
                  type="button"
                  onClick={() => setActiveTypeFilter(null)}
                  className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold bg-white/[0.06] border border-white/[0.12] text-[#94A3B8] hover:text-white transition-all"
                >
                  <X className="h-2.5 w-2.5" />
                  Todos
                </button>
              )}
              {availableTypes.map(({ type, count, color }) => (
                <TypeChip
                  key={type}
                  type={type}
                  color={color}
                  count={count}
                  active={activeTypeFilter === type}
                  onClick={() =>
                    setActiveTypeFilter(activeTypeFilter === type ? null : type)
                  }
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Event list */}
      <div className="flex-1 overflow-y-auto scrollbar-none px-3 py-3 space-y-1.5">
        {filteredEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-center px-4">
            <p className="text-3xl mb-2">
              {searchQuery || activeTypeFilter ? "🔍" : "📍"}
            </p>
            <p className="text-[13px] text-[#64748B]">
              {searchQuery || activeTypeFilter
                ? "No hay eventos que coincidan"
                : "No hay eventos con ubicación para este día"}
            </p>
            {(searchQuery || activeTypeFilter) && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setActiveTypeFilter(null);
                }}
                className="mt-2 text-[11px] text-[#0D9488] hover:text-[#14B8A6] transition-colors"
              >
                Limpiar filtros
              </button>
            )}
          </div>
        ) : (
          filteredEvents.map((event, i) => (
            <SidebarEventRow
              key={event.id}
              event={event}
              isSelected={selectedEventId === event.id}
              index={i}
              onClick={() => {
                setSelectedEventId(selectedEventId === event.id ? null : event.id);
              }}
            />
          ))
        )}
      </div>

      {/* Footer hint */}
      <div className="px-4 py-2.5 border-t border-white/[0.06] bg-gradient-to-t from-white/[0.02] to-transparent">
        <p className="text-[10px] text-[#475569] text-center">
          Hacé clic en un evento o marcador para ver detalles
        </p>
      </div>
    </>
  );

  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* ── Sidebar (desktop only) ── */}
      <aside className="hidden lg:flex flex-col w-[340px] xl:w-[380px] shrink-0 overflow-hidden relative"
        style={{
          background: "linear-gradient(180deg, #0D0D1A 0%, #0A0A14 100%)",
          borderRight: "1px solid rgba(13, 148, 136, 0.15)",
          boxShadow: "inset -1px 0 0 rgba(255,255,255,0.04), 4px 0 24px rgba(0,0,0,0.4)",
        }}
      >
        {/* Subtle top accent line */}
        <div
          className="absolute top-0 left-0 right-0 h-[2px] z-10"
          style={{
            background: "linear-gradient(90deg, transparent 0%, #0D9488 40%, #6EE7B7 70%, transparent 100%)",
            opacity: 0.6,
          }}
        />
        {SidebarContent}
      </aside>

      {/* ── Map area ── */}
      <div className="relative flex-1 min-w-0">
        {/* Mobile toggle bar */}
        <div className="lg:hidden absolute top-0 left-0 right-0 z-[1001] flex items-center justify-center gap-1 backdrop-blur-sm border-b border-white/10 py-1.5 px-3"
          style={{ background: "rgba(8, 12, 14, 0.9)" }}
        >
          <button
            type="button"
            aria-label="Ver mapa"
            onClick={() => setMobileView("map")}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-1 text-[11px] font-bold uppercase tracking-wide transition-all",
              mobileView === "map"
                ? "bg-accent/20 border border-accent/40 text-accent-light"
                : "text-white/50 hover:text-white",
            )}
          >
            <Map className="h-3.5 w-3.5" />
            Mapa
          </button>
          <button
            type="button"
            aria-label="Ver lista de eventos"
            onClick={() => setMobileView("list")}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-1 text-[11px] font-bold uppercase tracking-wide transition-all",
              mobileView === "list"
                ? "bg-accent/20 border border-accent/40 text-accent-light"
                : "text-white/50 hover:text-white",
            )}
          >
            <List className="h-3.5 w-3.5" />
            Lista
            <span className="text-[9px] font-semibold opacity-60">
              {filteredEvents.length}
            </span>
          </button>
        </div>

        {/* Map — always rendered (hidden on mobile list view) */}
        <div
          className={cn(
            "absolute inset-0 lg:relative lg:h-full",
            mobileView === "list" ? "hidden lg:block" : "block",
          )}
        >
          {/* Offset for mobile toggle bar */}
          <div className="lg:hidden h-[36px]" />
          <div className="h-[calc(100%-36px)] lg:h-full">
            <EventMapLazy
              todayEvents={todayEvents}
              tomorrowEvents={tomorrowEvents}
              weekendEvents={weekendEvents}
              selectedEventId={selectedEventId}
              activeTypeFilter={activeTypeFilter}
              onEventSelect={handleEventSelect}
              onDateFilterChange={handleDateFilterChange}
            />
          </div>
        </div>

        {/* Mobile list view */}
        {mobileView === "list" && (
          <div className="lg:hidden flex flex-col h-full overflow-hidden"
            style={{ background: "linear-gradient(180deg, #0D0D1A 0%, #0A0A14 100%)" }}
          >
            {/* Offset for toggle bar */}
            <div className="h-[36px] shrink-0" />

            {/* Mobile search */}
            <div className="px-3 pt-3 pb-2 border-b border-white/[0.08]">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#475569] pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar evento o lugar..."
                  className="w-full rounded-lg bg-white/[0.06] border border-white/[0.10] pl-8 pr-8 py-2 text-[12px] text-[#CBD5E1] placeholder:text-[#475569] focus:outline-none focus:border-[#0D9488]/50 transition-all"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#475569] hover:text-[#94A3B8]"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <p className="mt-1.5 text-[11px] text-[#64748B]">
                {filterLabels[currentFilter]} · <span className="text-[#94A3B8] font-semibold">{filteredEvents.length}</span> eventos
              </p>

              {/* Mobile type filter chips */}
              {availableTypes.length > 1 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {activeTypeFilter && (
                    <button
                      type="button"
                      onClick={() => setActiveTypeFilter(null)}
                      className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold bg-white/[0.06] border border-white/[0.12] text-[#94A3B8] hover:text-white transition-all"
                    >
                      <X className="h-2.5 w-2.5" />
                      Todos
                    </button>
                  )}
                  {availableTypes.map(({ type, count, color }) => (
                    <TypeChip
                      key={type}
                      type={type}
                      color={color}
                      count={count}
                      active={activeTypeFilter === type}
                      onClick={() =>
                        setActiveTypeFilter(activeTypeFilter === type ? null : type)
                      }
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-none px-3 py-3 space-y-2">
              {filteredEvents.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-center">
                  <MapPin className="h-8 w-8 text-[#475569] mb-2" strokeWidth={1.5} />
                  <p className="text-[13px] text-[#64748B]">No hay eventos con ubicación</p>
                </div>
              ) : (
                filteredEvents.map((event, i) => (
                  <SidebarEventRow
                    key={event.id}
                    event={event}
                    isSelected={selectedEventId === event.id}
                    index={i}
                    onClick={() => {
                      setSelectedEventId(
                        selectedEventId === event.id ? null : event.id,
                      );
                      setMobileView("map");
                    }}
                  />
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
