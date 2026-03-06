"use client";

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

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
}

export function VenueMiniMap({ lat, lng, venueName }: VenueMiniMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) return;

    mapboxgl.accessToken = token;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [lng, lat],
      zoom: 15,
      interactive: false,
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
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [lat, lng, venueName]);

  return (
    <div className="overflow-hidden rounded-xl border border-white/[0.08]">
      <div ref={containerRef} style={{ height: "150px", width: "100%" }} />
    </div>
  );
}
