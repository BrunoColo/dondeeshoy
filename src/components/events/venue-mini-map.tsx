"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Check, Copy, ExternalLink, Maximize2, Minimize2 } from "lucide-react";
import { cn } from "@/lib/utils";

const MINI_ZOOM = 14.2;
const EXPANDED_ZOOM = 12.4;

function setMapInteractions(map: mapboxgl.Map, interactive: boolean) {
  const handlers = [
    map.scrollZoom,
    map.boxZoom,
    map.dragRotate,
    map.dragPan,
    map.keyboard,
    map.doubleClickZoom,
    map.touchZoomRotate,
  ];

  handlers.forEach((handler) => {
    if (interactive) {
      handler.enable();
    } else {
      handler.disable();
    }
  });

  map.getCanvas().style.cursor = interactive ? "grab" : "default";
}

const SVG_NS = "http://www.w3.org/2000/svg";

function createMiniMapPinIcon(): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", "12");
  svg.setAttribute("height", "12");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.style.color = "#F8FAFC";
  svg.innerHTML = '<circle cx="12" cy="11" r="2.8" fill="currentColor" stroke="none" /><path d="M12 4.5c-3.6 0-6.5 2.9-6.5 6.4 0 4.8 6.5 8.6 6.5 8.6s6.5-3.8 6.5-8.6c0-3.5-2.9-6.4-6.5-6.4Z" />';
  return svg;
}

interface VenueMiniMapProps {
  lat: number;
  lng: number;
  venueName: string;
  venueAddress?: string | null;
}

export function VenueMiniMap({ lat, lng, venueName, venueAddress }: VenueMiniMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const copyResetTimeoutRef = useRef<number | null>(null);
  const isExpandedRef = useRef(false);

  const [isExpanded, setIsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const hasMapToken = Boolean(process.env.NEXT_PUBLIC_MAPBOX_TOKEN);

  const coordinatesLabel = useMemo(
    () => `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
    [lat, lng],
  );

  const googleMapsUrl = useMemo(
    () => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lng}`)}`,
    [lat, lng],
  );

  useEffect(() => {
    isExpandedRef.current = isExpanded;
  }, [isExpanded]);

  useEffect(() => {
    return () => {
      if (copyResetTimeoutRef.current) {
        window.clearTimeout(copyResetTimeoutRef.current);
      }
    };
  }, []);

  const handleCopyLocation = useCallback(async () => {
    const label = venueAddress ? `${venueName} — ${venueAddress}` : venueName;
    const payload = `${label}\nCoordenadas: ${coordinatesLabel}\n${googleMapsUrl}`;

    try {
      await navigator.clipboard.writeText(payload);
      setCopied(true);

      if (copyResetTimeoutRef.current) {
        window.clearTimeout(copyResetTimeoutRef.current);
      }

      copyResetTimeoutRef.current = window.setTimeout(() => {
        setCopied(false);
      }, 1800);
    } catch {
      window.prompt("Copiá la ubicación:", payload);
    }
  }, [coordinatesLabel, googleMapsUrl, venueAddress, venueName]);

  useEffect(() => {
    if (!containerRef.current) return;

    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) return;

    mapboxgl.accessToken = token;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [lng, lat],
      zoom: MINI_ZOOM,
      interactive: true,
      attributionControl: false,
    });

    // Add marker only after style is fully loaded
    map.on("load", () => {
      const el = document.createElement("div");
      el.style.width = "26px";
      el.style.height = "26px";
      el.style.borderRadius = "50% 50% 50% 0";
      el.style.background = "radial-gradient(circle at 30% 28%, rgba(255,255,255,0.22), rgba(255,255,255,0.02) 34%, transparent 35%), #14B8A6";
      el.style.border = "2px solid rgba(255,255,255,0.7)";
      el.style.transform = "rotate(-45deg)";
      el.style.boxShadow = "0 2px 8px rgba(0,0,0,0.35)";
      el.style.display = "flex";
      el.style.alignItems = "center";
      el.style.justifyContent = "center";

      const inner = document.createElement("div");
      inner.style.transform = "rotate(45deg)";
      inner.style.display = "flex";
      inner.style.alignItems = "center";
      inner.style.justifyContent = "center";
      inner.appendChild(createMiniMapPinIcon());
      el.appendChild(inner);

      new mapboxgl.Marker({ element: el, anchor: "bottom" })
        .setLngLat([lng, lat])
        .addTo(map);

      const expanded = isExpandedRef.current;
      setMapInteractions(map, true);
      map.jumpTo({
        center: [lng, lat],
        zoom: expanded ? EXPANDED_ZOOM : MINI_ZOOM,
      });
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [lat, lng]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    setMapInteractions(map, true);
    map.easeTo({
      center: [lng, lat],
      zoom: isExpanded ? EXPANDED_ZOOM : MINI_ZOOM,
      duration: 420,
    });

    map.resize();
    const resizeId = window.setTimeout(() => map.resize(), 280);

    return () => {
      window.clearTimeout(resizeId);
    };
  }, [isExpanded, lat, lng]);

  return (
    <div className="space-y-2.5">
      <div className="overflow-hidden rounded-xl border border-white/[0.10] bg-[rgba(8,14,25,0.55)]">
        <div
          className={cn(
            "relative w-full overflow-hidden transition-[height] duration-300 ease-out",
            isExpanded ? "h-[320px] sm:h-[360px] lg:h-[440px]" : "h-[168px] sm:h-[184px] lg:h-[268px]",
          )}
        >
          {hasMapToken ? (
            <div ref={containerRef} className="h-full w-full" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-[linear-gradient(180deg,rgba(16,23,34,0.96)_0%,rgba(11,17,27,0.98)_100%)] px-4 text-center">
              <p className="text-xs text-[#B6C4D9]">
                No pudimos cargar el mapa embebido, pero podés abrir la ubicación en Google Maps.
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={() => setIsExpanded((prev) => !prev)}
          disabled={!hasMapToken}
          className="inline-flex min-h-9 items-center justify-center gap-1 rounded-full border border-white/20 bg-white/[0.06] px-2 py-1.5 text-[10px] font-semibold text-[#D9E4F5] whitespace-nowrap transition-colors hover:bg-white/[0.10] disabled:opacity-50 disabled:cursor-not-allowed sm:min-h-10 sm:gap-1.5 sm:px-3 sm:text-[11px]"
        >
          {isExpanded ? (
            <Minimize2 className="h-[10px] w-[10px] sm:h-[11px] sm:w-[11px]" strokeWidth={2.2} />
          ) : (
            <Maximize2 className="h-[10px] w-[10px] sm:h-[11px] sm:w-[11px]" strokeWidth={2.2} />
          )}
          <span className="sm:hidden">{isExpanded ? "Compacto" : "Ampliar"}</span>
          <span className="hidden sm:inline">{isExpanded ? "Ver compacto" : "Ampliar mapa"}</span>
        </button>

        <button
          type="button"
          onClick={handleCopyLocation}
          className="inline-flex min-h-9 items-center justify-center gap-1 rounded-full border border-cyan-300/35 bg-cyan-400/10 px-2 py-1.5 text-[10px] font-semibold text-cyan-100 whitespace-nowrap transition-colors hover:bg-cyan-400/20 sm:min-h-10 sm:gap-1.5 sm:px-3 sm:text-[11px]"
        >
          {copied ? (
            <Check className="h-[10px] w-[10px] sm:h-[11px] sm:w-[11px]" strokeWidth={2.6} />
          ) : (
            <Copy className="h-[10px] w-[10px] sm:h-[11px] sm:w-[11px]" strokeWidth={2.3} />
          )}
          <span className="sm:hidden">{copied ? "Copiado" : "Copiar"}</span>
          <span className="hidden sm:inline">{copied ? "Copiado" : "Copiar ubicación"}</span>
        </button>

        <a
          href={googleMapsUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-9 items-center justify-center gap-1 rounded-full border border-violet-300/35 bg-violet-400/10 px-2 py-1.5 text-[10px] font-semibold text-violet-100 whitespace-nowrap transition-colors hover:bg-violet-400/20 sm:min-h-10 sm:gap-1.5 sm:px-3 sm:text-[11px]"
        >
          <span className="sm:hidden">Maps</span>
          <span className="hidden sm:inline">Google Maps</span>
          <ExternalLink className="h-[10px] w-[10px] sm:h-[11px] sm:w-[11px]" strokeWidth={2.2} />
        </a>
      </div>
    </div>
  );
}
