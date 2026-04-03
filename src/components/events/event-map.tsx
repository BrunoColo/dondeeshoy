"use client";

import { useMemo, useState, useCallback, useEffect, useRef } from "react";
import { LocateFixed, MapPin, Maximize2, RotateCw, Search, X } from "lucide-react";
import { formatPrice, formatTime } from "@/lib/format";
import type { EventType } from "@/types/events";
import { loadGoogleMapsApi, type GoogleMapsLike } from "@/lib/maps/google-maps-loader";

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

interface GoogleMapInstance {
  panTo(position: { lat: number; lng: number }): void;
  setZoom(zoom: number): void;
  getZoom(): number | undefined;
  fitBounds(
    bounds: GoogleLatLngBoundsInstance,
    padding?: number | { top: number; right: number; bottom: number; left: number },
  ): void;
}

interface GoogleMarkerInstance {
  setMap(map: GoogleMapInstance | null): void;
  addListener(eventName: "click", handler: () => void): void;
}

interface GoogleInfoWindowInstance {
  close(): void;
  open(options: { map: GoogleMapInstance; anchor?: GoogleMarkerInstance; shouldFocus?: boolean }): void;
  addListener(eventName: "closeclick", handler: () => void): void;
}

interface GoogleLatLngBoundsInstance {
  extend(position: { lat: number; lng: number }): void;
}

interface GoogleLatLngInstance {
  lat(): number;
  lng(): number;
}

interface GoogleGeocoderResult {
  formatted_address?: string;
  geometry?: {
    location?: GoogleLatLngInstance;
  };
}

interface GoogleGeocoderInstance {
  geocode(
    request: {
      address: string;
      region?: string;
      componentRestrictions?: {
        country: string;
      };
    },
    callback: (results: GoogleGeocoderResult[] | null, status: string) => void,
  ): void;
}

interface GoogleMapsNamespace {
  maps: {
    Map: new (
      container: HTMLElement,
      options: {
        center: { lat: number; lng: number };
        zoom: number;
        mapTypeControl?: boolean;
        streetViewControl?: boolean;
        fullscreenControl?: boolean;
        clickableIcons?: boolean;
        gestureHandling?: "cooperative" | "greedy" | "none" | "auto";
        restriction?: {
          latLngBounds: {
            north: number;
            south: number;
            west: number;
            east: number;
          };
          strictBounds?: boolean;
        };
      },
    ) => GoogleMapInstance;
    Marker: new (options: {
      map: GoogleMapInstance;
      position: { lat: number; lng: number };
      title: string;
      zIndex?: number;
      icon?: {
        path: unknown;
        scale: number;
        fillColor: string;
        fillOpacity: number;
        strokeColor: string;
        strokeWeight: number;
      };
      label?: {
        text: string;
        color: string;
        fontSize: string;
        fontWeight: string;
      };
    }) => GoogleMarkerInstance;
    InfoWindow: new (options: {
      content: HTMLElement;
      maxWidth?: number;
    }) => GoogleInfoWindowInstance;
    LatLngBounds: new () => GoogleLatLngBoundsInstance;
    Geocoder: new () => GoogleGeocoderInstance;
    SymbolPath: {
      CIRCLE: unknown;
    };
  };
}

interface PlaceSearchResult {
  id: string;
  label: string;
  subtitle: string;
  latitude: number;
  longitude: number;
}

type SearchSuggestion =
  | { kind: "event"; event: MapEvent }
  | { kind: "place"; place: PlaceSearchResult };

function isWithinUruguayBounds(latitude: number, longitude: number): boolean {
  return latitude >= -36 && latitude <= -30 && longitude >= -59 && longitude <= -53;
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
  mobileBottomSheetOpen?: boolean;
  onEventSelect?: (event: MapEvent | null) => void;
  onDateFilterChange?: (filter: DateFilter) => void;
}

export type DateFilter = "hoy" | "manana" | "finde";

export function EventMap({
  todayEvents,
  tomorrowEvents,
  weekendEvents,
  selectedEventId,
  activeTypeFilter,
  mobileBottomSheetOpen = false,
  onEventSelect,
  onDateFilterChange,
}: EventMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const googleMapsRef = useRef<GoogleMapsNamespace | null>(null);
  const geocoderRef = useRef<GoogleGeocoderInstance | null>(null);
  const placeSearchRequestIdRef = useRef(0);
  const placeSearchDebounceRef = useRef<number | null>(null);
  const mapRef = useRef<GoogleMapInstance | null>(null);
  const markersRef = useRef<Map<string, GoogleMarkerInstance>>(new Map());
  const popupRef = useRef<GoogleInfoWindowInstance | null>(null);

  const [hideRecurring, setHideRecurring] = useState(false);
  const [dateFilter, setDateFilter] = useState<DateFilter>("hoy");
  const [mapReady, setMapReady] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [mapSearchQuery, setMapSearchQuery] = useState("");
  const [placeSearchResults, setPlaceSearchResults] = useState<PlaceSearchResult[]>([]);
  const [searchFocused, setSearchFocused] = useState(false);
  const [isDesktopViewport, setIsDesktopViewport] = useState(false);

  // Stable ref for onEventSelect to avoid marker recreation
  const onEventSelectRef = useRef(onEventSelect);
  useEffect(() => {
    onEventSelectRef.current = onEventSelect;
  }, [onEventSelect]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mediaQuery = window.matchMedia("(min-width: 1024px)");

    const updateViewport = () => {
      setIsDesktopViewport(mediaQuery.matches);
    };

    updateViewport();

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", updateViewport);
      return () => {
        mediaQuery.removeEventListener("change", updateViewport);
      };
    }

    mediaQuery.addListener(updateViewport);
    return () => {
      mediaQuery.removeListener(updateViewport);
    };
  }, []);

  const activeEvents = useMemo(() => {
    if (dateFilter === "manana") return tomorrowEvents;
    if (dateFilter === "finde") return weekendEvents;
    return todayEvents;
  }, [dateFilter, todayEvents, tomorrowEvents, weekendEvents]);

  const recurringCount = useMemo(
    () => activeEvents.filter((event) => event.isRecurring).length,
    [activeEvents],
  );

  const visibleEvents = useMemo(() => {
    let events = activeEvents;
    if (hideRecurring) events = events.filter((event) => !event.isRecurring);
    if (activeTypeFilter) {
      events = events.filter((event) => event.eventType === activeTypeFilter);
    }
    return events;
  }, [activeEvents, hideRecurring, activeTypeFilter]);

  const mapSearchResults = useMemo(() => {
    const q = mapSearchQuery.trim().toLowerCase();
    if (q.length < 2) return [] as MapEvent[];

    return visibleEvents
      .filter(
        (event) =>
          event.name.toLowerCase().includes(q) ||
          event.venueName.toLowerCase().includes(q),
      )
      .slice(0, 6);
  }, [mapSearchQuery, visibleEvents]);

  const searchSuggestions = useMemo(() => {
    const eventSuggestions: SearchSuggestion[] = mapSearchResults.map((event) => ({
      kind: "event",
      event,
    }));

    const eventNames = new Set(
      mapSearchResults.map((event) => event.name.trim().toLowerCase()),
    );

    const canShowPlaces = searchFocused && mapSearchQuery.trim().length >= 3;
    const effectivePlaceResults = canShowPlaces ? placeSearchResults : [];

    const placeSuggestions: SearchSuggestion[] = effectivePlaceResults
      .filter((place) => !eventNames.has(place.label.trim().toLowerCase()))
      .map((place) => ({
        kind: "place",
        place,
      }));

    return [...eventSuggestions, ...placeSuggestions].slice(0, 8);
  }, [mapSearchQuery, mapSearchResults, placeSearchResults, searchFocused]);

  // Notify parent only when the date filter pill changes
  useEffect(() => {
    onDateFilterChange?.(dateFilter);
  }, [dateFilter, onDateFilterChange]);

  const clearMarkers = useCallback(() => {
    for (const [, marker] of markersRef.current) {
      marker.setMap(null);
    }
    markersRef.current.clear();
  }, []);

  useEffect(() => {
    if (!isDesktopViewport && popupRef.current) {
      popupRef.current.close();
      popupRef.current = null;
    }
  }, [isDesktopViewport]);

  // Initialize Google Map
  useEffect(() => {
    let cancelled = false;

    async function initMap() {
      if (!mapContainerRef.current) return;

      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
      if (!apiKey) {
        console.error("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY not set");
        return;
      }

      try {
        const googleMaps = (await loadGoogleMapsApi({
          apiKey,
          libraries: ["places"],
        })) as GoogleMapsLike as GoogleMapsNamespace;

        if (cancelled) return;

        const map = new googleMaps.maps.Map(mapContainerRef.current, {
          center: { lat: -34.9011, lng: -56.1645 },
          zoom: 12,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          clickableIcons: false,
          gestureHandling: "greedy",
          restriction: {
            latLngBounds: {
              north: -30.0,
              south: -35.8,
              west: -58.5,
              east: -53.0,
            },
            strictBounds: false,
          },
        });

        googleMapsRef.current = googleMaps;
        geocoderRef.current = new googleMaps.maps.Geocoder();
        mapRef.current = map;
        setMapReady(true);
      } catch (error) {
        console.error("Failed to initialize Google Maps", error);
      }
    }

    initMap();

    return () => {
      cancelled = true;
      setMapReady(false);
      clearMarkers();
      popupRef.current?.close();
      popupRef.current = null;
      mapRef.current = null;
      geocoderRef.current = null;
      googleMapsRef.current = null;

      if (placeSearchDebounceRef.current) {
        window.clearTimeout(placeSearchDebounceRef.current);
        placeSearchDebounceRef.current = null;
      }
    };
  }, [clearMarkers]);

  useEffect(() => {
    const query = mapSearchQuery.trim();
    if (!searchFocused || query.length < 3) {
      placeSearchRequestIdRef.current += 1;

      if (placeSearchDebounceRef.current) {
        window.clearTimeout(placeSearchDebounceRef.current);
        placeSearchDebounceRef.current = null;
      }
      return;
    }

    const geocoder = geocoderRef.current;
    if (!geocoder) return;

    const requestId = placeSearchRequestIdRef.current + 1;
    placeSearchRequestIdRef.current = requestId;

    if (placeSearchDebounceRef.current) {
      window.clearTimeout(placeSearchDebounceRef.current);
    }

    placeSearchDebounceRef.current = window.setTimeout(() => {
      geocoder.geocode(
        {
          address: query,
          region: "uy",
          componentRestrictions: {
            country: "UY",
          },
        },
        (results, status) => {
          if (requestId !== placeSearchRequestIdRef.current) return;

          if (status !== "OK" || !results || results.length === 0) {
            setPlaceSearchResults([]);
            return;
          }

          const mapped = results
            .slice(0, 4)
            .map((result, index) => {
              const location = result.geometry?.location;
              if (!location) return null;

              const latitude = location.lat();
              const longitude = location.lng();

              if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
              if (!isWithinUruguayBounds(latitude, longitude)) return null;

              const formattedAddress = result.formatted_address?.trim() ?? query;
              const label = formattedAddress.split(",")[0]?.trim() || formattedAddress;

              return {
                id: `${requestId}-${index}-${formattedAddress}`,
                label,
                subtitle: formattedAddress,
                latitude,
                longitude,
              } as PlaceSearchResult;
            })
            .filter((place): place is PlaceSearchResult => Boolean(place));

          setPlaceSearchResults(mapped);
        },
      );
    }, 260);

    return () => {
      if (placeSearchDebounceRef.current) {
        window.clearTimeout(placeSearchDebounceRef.current);
        placeSearchDebounceRef.current = null;
      }
    };
  }, [mapSearchQuery, searchFocused]);

  // Show popup for a given event
  const showPopup = useCallback(
    (
      map: GoogleMapInstance,
      marker: GoogleMarkerInstance,
      event: MapEvent,
    ) => {
      const googleMaps = googleMapsRef.current;
      if (!googleMaps) return;

      popupRef.current?.close();

      const price = event.isFree
        ? "Gratis"
        : event.priceMin
          ? formatPrice(event.priceMin, null, false, event.currency)
          : "Consultar";

      const timeLabel = formatTime(event.startTime ?? null);
      const shortDateLabel = (() => {
        const [year, month, day] = event.date.split("-").map(Number);
        if (!year || !month || !day) return event.date;
        return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}`;
      })();
      const dateTimeLabel = timeLabel ? `${shortDateLabel} · ${timeLabel}` : shortDateLabel;

      const typeColor = TYPE_COLORS[event.eventType] ?? TYPE_COLORS.otro;
      const container = document.createElement("div");
      container.innerHTML = `
        <div style="font-family: system-ui, -apple-system, sans-serif; min-width: 220px; max-width: 280px;">
          <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 8px;">
            <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: ${typeColor}; box-shadow: 0 0 6px ${typeColor}88; flex-shrink: 0;"></span>
            <span style="font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: ${typeColor};">${event.eventType}</span>
          </div>
          <h3 style="font-size: 14px; font-weight: 600; line-height: 1.3; color: #0F172A; margin: 0 0 8px 0; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${event.name}</h3>
          <div style="display: flex; flex-direction: column; gap: 5px; font-size: 12px; color: #334155;">
            <div style="display: flex; align-items: center; gap: 6px;">
              <span>📍</span>
              <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${event.venueName}</span>
            </div>
            <div style="display: flex; align-items: center; gap: 6px;"><span>🕐</span><span>${dateTimeLabel}</span></div>
            <div style="display: flex; align-items: center; gap: 6px;">
              <span>🎫</span>
              <span style="font-weight: 600; color: ${event.isFree ? "#059669" : "#1E293B"};">${price}</span>
            </div>
          </div>
          <a href="/evento/${event.slug}" style="display: flex; align-items: center; justify-content: center; gap: 6px; margin-top: 10px; padding: 8px 12px; border-radius: 10px; background: rgba(13,148,136,0.12); border: 1px solid rgba(13,148,136,0.25); font-size: 12px; font-weight: 600; color: #0F766E; text-decoration: none; transition: background 0.2s ease;">Ver evento →</a>
        </div>
      `;

      const popup = new googleMaps.maps.InfoWindow({
        content: container,
        maxWidth: 320,
      });

      popup.addListener("closeclick", () => {
        onEventSelectRef.current?.(null);
        popupRef.current = null;
      });

      popup.open({
        map,
        anchor: marker,
        shouldFocus: false,
      });

      popupRef.current = popup;
    },
    [],
  );

  // Render markers when visible events change
  useEffect(() => {
    const map = mapRef.current;
    const googleMaps = googleMapsRef.current;
    if (!map || !googleMaps || !mapReady) return;

    clearMarkers();

    for (const event of visibleEvents) {
      const isSelected = selectedEventId === event.id;
      const color = TYPE_COLORS[event.eventType] ?? TYPE_COLORS.otro;

      const marker = new googleMaps.maps.Marker({
        map,
        position: {
          lat: event.latitude,
          lng: event.longitude,
        },
        title: event.name,
        zIndex: isSelected ? 3000 : 1000,
        icon: {
          path: googleMaps.maps.SymbolPath.CIRCLE,
          scale: isSelected ? 11 : 9,
          fillColor: color,
          fillOpacity: 1,
          strokeColor: "#FFFFFF",
          strokeWeight: isSelected ? 3 : 2,
        },
        label: {
          text: event.eventType.slice(0, 1).toUpperCase(),
          color: "#FFFFFF",
          fontSize: isSelected ? "10px" : "9px",
          fontWeight: "700",
        },
      });

      marker.addListener("click", () => {
        onEventSelectRef.current?.(event);
        if (isDesktopViewport) {
          showPopup(map, marker, event);
        } else if (popupRef.current) {
          popupRef.current.close();
          popupRef.current = null;
        }
      });

      markersRef.current.set(event.id, marker);
    }
  }, [visibleEvents, mapReady, selectedEventId, clearMarkers, showPopup, isDesktopViewport]);

  // Fly to selected event
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !selectedEventId) return;

    const event = visibleEvents.find((item) => item.id === selectedEventId);
    if (!event) return;

    const marker = markersRef.current.get(event.id);

    map.panTo({
      lat: event.latitude,
      lng: event.longitude,
    });

    const zoom = map.getZoom() ?? 12;
    if (zoom < 14) {
      map.setZoom(14);
    }

    if (marker && isDesktopViewport) {
      showPopup(map, marker, event);
    }
  }, [selectedEventId, visibleEvents, mapReady, showPopup, isDesktopViewport]);

  const fitBounds = useCallback(() => {
    const map = mapRef.current;
    const googleMaps = googleMapsRef.current;
    if (!map || !googleMaps) return;

    if (visibleEvents.length === 0) return;

    if (visibleEvents.length === 1) {
      map.panTo({
        lat: visibleEvents[0].latitude,
        lng: visibleEvents[0].longitude,
      });
      map.setZoom(14);
      return;
    }

    const bounds = new googleMaps.maps.LatLngBounds();
    for (const event of visibleEvents) {
      bounds.extend({ lat: event.latitude, lng: event.longitude });
    }

    map.fitBounds(bounds, {
      top: isDesktopViewport ? 90 : 130,
      right: 56,
      bottom: isDesktopViewport ? 120 : mobileBottomSheetOpen ? 320 : 150,
      left: 56,
    });
  }, [visibleEvents, isDesktopViewport, mobileBottomSheetOpen]);

  const focusEventFromSearch = useCallback(
    (event: MapEvent) => {
      const map = mapRef.current;
      if (!map) return;

      onEventSelectRef.current?.(event);
      setMapSearchQuery(event.name);
      setSearchFocused(false);

      map.panTo({
        lat: event.latitude,
        lng: event.longitude,
      });

      const zoom = map.getZoom() ?? 12;
      if (zoom < 14) {
        map.setZoom(14);
      }

      const marker = markersRef.current.get(event.id);
      if (marker && isDesktopViewport) {
        showPopup(map, marker, event);
      }
    },
    [showPopup, isDesktopViewport],
  );

  const focusPlaceFromSearch = useCallback((place: PlaceSearchResult) => {
    const map = mapRef.current;
    if (!map) return;

    onEventSelectRef.current?.(null);
    popupRef.current?.close();
    popupRef.current = null;

    setMapSearchQuery(place.label);
    setSearchFocused(false);

    map.panTo({
      lat: place.latitude,
      lng: place.longitude,
    });

    const zoom = map.getZoom() ?? 12;
    if (zoom < 14) {
      map.setZoom(14);
    }
  }, []);

  const effectiveBottomOffset = isDesktopViewport
    ? 74
    : mobileBottomSheetOpen
      ? 248
      : 74;

  const goToMyLocation = useCallback(() => {
    if (geoLoading) return;

    const map = mapRef.current;
    if (!map || typeof navigator === "undefined" || !navigator.geolocation) return;

    setGeoLoading(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };

        map.panTo(coords);
        const zoom = map.getZoom() ?? 12;
        if (zoom < 14) {
          map.setZoom(14);
        }
        setGeoLoading(false);
      },
      () => {
        setGeoLoading(false);
      },
      {
        enableHighAccuracy: false,
        timeout: 10000,
      },
    );
  }, [geoLoading]);

  const handleDateChange = (filter: DateFilter) => {
    setDateFilter(filter);
    onEventSelectRef.current?.(null);

    popupRef.current?.close();
    popupRef.current = null;

    window.setTimeout(() => {
      fitBounds();
    }, 80);
  };

  return (
    <div className="relative h-full w-full">
      {/* Google Maps container */}
      <div ref={mapContainerRef} className="h-full w-full" />

      {/* ─── Top search bar (Google Maps-like) ─── */}
      <div
        className="absolute z-[1002]"
        style={{
          top: "calc(env(safe-area-inset-top, 0px) + 10px)",
          left: "calc(env(safe-area-inset-left, 0px) + 12px)",
          right: "calc(env(safe-area-inset-right, 0px) + 12px)",
        }}
      >
        <div className="mx-auto max-w-[440px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#6B7280] pointer-events-none" />
            <input
              type="text"
              value={mapSearchQuery}
              onChange={(event) => setMapSearchQuery(event.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => {
                window.setTimeout(() => {
                  setSearchFocused(false);
                }, 120);
              }}
              placeholder="Buscar evento o lugar en el mapa..."
              className="w-full rounded-2xl border border-black/10 bg-white/95 px-10 py-2.5 text-[13px] text-slate-800 shadow-[0_10px_24px_rgba(0,0,0,0.22)] backdrop-blur-xl placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/35"
            />
            {mapSearchQuery && (
              <button
                type="button"
                onClick={() => {
                  setMapSearchQuery("");
                  setPlaceSearchResults([]);
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-[#6B7280] hover:bg-black/5 hover:text-slate-800"
                aria-label="Limpiar búsqueda"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {searchFocused && mapSearchQuery.trim().length >= 2 && (
            <div className="mt-1.5 overflow-hidden rounded-xl border border-black/10 bg-white/95 shadow-[0_12px_28px_rgba(0,0,0,0.24)] backdrop-blur-xl">
              {searchSuggestions.length > 0 ? (
                <ul className="max-h-[260px] overflow-y-auto py-1.5">
                  {searchSuggestions.map((suggestion) => {
                    if (suggestion.kind === "event") {
                      const event = suggestion.event;
                      return (
                        <li key={`event-${event.id}`}>
                          <button
                            type="button"
                            onMouseDown={(eventMouseDown) => eventMouseDown.preventDefault()}
                            onClick={() => focusEventFromSearch(event)}
                            className="flex w-full items-start gap-2.5 px-3 py-2 text-left hover:bg-black/[0.05]"
                          >
                            <span
                              className="mt-1 inline-block h-2 w-2 rounded-full"
                              style={{
                                backgroundColor: TYPE_COLORS[event.eventType] ?? TYPE_COLORS.otro,
                              }}
                            />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[12px] font-semibold text-slate-900">{event.name}</span>
                              <span className="block truncate text-[11px] text-slate-500">{event.venueName}</span>
                            </span>
                          </button>
                        </li>
                      );
                    }

                    const place = suggestion.place;
                    return (
                      <li key={`place-${place.id}`}>
                        <button
                          type="button"
                          onMouseDown={(eventMouseDown) => eventMouseDown.preventDefault()}
                          onClick={() => focusPlaceFromSearch(place)}
                          className="flex w-full items-start gap-2.5 px-3 py-2 text-left hover:bg-black/[0.05]"
                        >
                          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#0D9488]" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[12px] font-semibold text-slate-900">{place.label}</span>
                            <span className="block truncate text-[11px] text-slate-500">{place.subtitle}</span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="px-3 py-3 text-[12px] text-slate-500">No encontramos eventos ni lugares en este mapa.</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ─── Date filter pills ─── */}
      <div
        className="absolute z-[1001]"
        style={{
          top: "calc(env(safe-area-inset-top, 0px) + 66px)",
          left: "calc(env(safe-area-inset-left, 0px) + 14px)",
          right: "calc(env(safe-area-inset-right, 0px) + 14px)",
        }}
      >
        <div className="flex items-center gap-1.5 rounded-2xl p-0.5">
          {(["hoy", "manana", "finde"] as DateFilter[]).map((filter) => {
            const labels: Record<DateFilter, string> = {
              hoy: "Hoy",
              manana: "Mañana",
              finde: "Finde",
            };

            const counts: Record<DateFilter, number> = {
              hoy: todayEvents.length,
              manana: tomorrowEvents.length,
              finde: weekendEvents.length,
            };

            const isActive = dateFilter === filter;

            return (
              <button
                key={filter}
                type="button"
                onClick={() => handleDateChange(filter)}
                className={`relative flex items-center gap-1.5 rounded-xl px-3 py-2 text-[11px] font-bold tracking-wide transition-all duration-200 ${
                  isActive
                    ? "bg-[rgba(34,39,74,0.9)] text-white ring-1 ring-indigo-200/20 shadow-[0_8px_18px_rgba(8,10,24,0.22)]"
                    : "bg-[rgba(248,250,252,0.88)] text-slate-700 ring-1 ring-black/[0.06] shadow-[0_6px_14px_rgba(0,0,0,0.12)] hover:bg-white"
                }`}
              >
                {labels[filter]}
                <span
                  className={`text-[9px] tabular-nums font-semibold ${
                    isActive
                      ? "bg-white/[0.10] text-indigo-100 px-1.5 py-0.5 rounded-full"
                      : "text-slate-500"
                  }`}
                >
                  {counts[filter]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── Bottom-left: event count + recurring toggle ─── */}
      <div
        className="absolute z-[1000] flex max-w-[calc(100%-20px)] flex-col gap-1.5"
        style={{
          left: "calc(env(safe-area-inset-left, 0px) + 10px)",
          bottom: `calc(env(safe-area-inset-bottom, 0px) + ${effectiveBottomOffset}px)`,
        }}
      >
        <div className="rounded-xl bg-[rgba(6,6,17,0.85)] border border-white/[0.12] shadow-xl backdrop-blur-xl px-3 py-2 text-[11px] font-medium text-white/90">
          <span className="font-bold text-white">{visibleEvents.length}</span>{" "}
          {visibleEvents.length === 1 ? "evento" : "eventos"}
          {activeTypeFilter && (
            <span className="ml-1 text-indigo-light font-semibold">
              · {activeTypeFilter}
            </span>
          )}
        </div>

        {recurringCount > 0 && (
          <button
            type="button"
            onClick={() => setHideRecurring((value) => !value)}
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

      {/* ─── Bottom-right: map actions (moved lower for mobile ergonomics) ─── */}
      <div
        className="absolute z-[1000] flex flex-col gap-1.5"
        style={{
          right: "calc(env(safe-area-inset-right, 0px) + 10px)",
          bottom: `calc(env(safe-area-inset-bottom, 0px) + ${effectiveBottomOffset}px)`,
        }}
      >
        <button
          type="button"
          onClick={goToMyLocation}
          title="Ir a mi ubicación"
          className="flex items-center justify-center rounded-xl bg-[rgba(6,6,17,0.85)] border border-white/[0.12] shadow-xl backdrop-blur-xl p-2.5 text-white/70 hover:text-white hover:bg-white/[0.08] transition-all duration-200"
        >
          <LocateFixed className={`h-3.5 w-3.5 ${geoLoading ? "animate-pulse" : ""}`} />
        </button>

        <button
          type="button"
          onClick={fitBounds}
          title="Encuadrar todos los eventos"
          className="flex items-center justify-center rounded-xl bg-[rgba(6,6,17,0.85)] border border-white/[0.12] shadow-xl backdrop-blur-xl p-2.5 text-white/70 hover:text-white hover:bg-white/[0.08] transition-all duration-200"
        >
          <Maximize2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
