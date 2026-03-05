"use client";

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

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
      el.style.background = "#14B8A6";
      el.style.border = "2px solid rgba(255,255,255,0.7)";
      el.style.transform = "rotate(-45deg)";
      el.style.boxShadow = "0 2px 8px rgba(0,0,0,0.35)";
      el.style.display = "flex";
      el.style.alignItems = "center";
      el.style.justifyContent = "center";

      const inner = document.createElement("span");
      inner.style.transform = "rotate(45deg)";
      inner.style.fontSize = "11px";
      inner.textContent = "📍";
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
