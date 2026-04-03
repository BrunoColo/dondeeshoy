"use client";

import { useEffect, useRef } from "react";
import { loadGoogleMapsApi, type GoogleMapsLike } from "@/lib/maps/google-maps-loader";

interface GoogleMapInstance {
  setCenter(position: { lat: number; lng: number }): void;
}

interface GoogleMarkerInstance {
  setMap(map: GoogleMapInstance | null): void;
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
        gestureHandling?: "cooperative" | "greedy" | "none" | "auto";
        draggable?: boolean;
        disableDefaultUI?: boolean;
      },
    ) => GoogleMapInstance;
    Marker: new (options: {
      map: GoogleMapInstance;
      position: { lat: number; lng: number };
      title: string;
      icon?: {
        path: unknown;
        scale: number;
        fillColor: string;
        fillOpacity: number;
        strokeColor: string;
        strokeWeight: number;
      };
    }) => GoogleMarkerInstance;
    SymbolPath: {
      CIRCLE: unknown;
    };
  };
}

interface VenueMiniMapProps {
  lat: number;
  lng: number;
  venueName: string;
}

export function VenueMiniMap({ lat, lng, venueName }: VenueMiniMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const markerRef = useRef<GoogleMarkerInstance | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function initMap() {
      if (!containerRef.current) return;

      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
      if (!apiKey) return;

      try {
        const googleMaps = (await loadGoogleMapsApi({
          apiKey,
          libraries: ["places"],
        })) as GoogleMapsLike as GoogleMapsNamespace;

        if (cancelled || !containerRef.current) return;

        const map = new googleMaps.maps.Map(containerRef.current, {
          center: { lat, lng },
          zoom: 15,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          gestureHandling: "none",
          draggable: false,
          disableDefaultUI: true,
        });

        const marker = new googleMaps.maps.Marker({
          map,
          position: { lat, lng },
          title: venueName,
          icon: {
            path: googleMaps.maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: "#14B8A6",
            fillOpacity: 1,
            strokeColor: "#FFFFFF",
            strokeWeight: 2,
          },
        });

        markerRef.current = marker;
      } catch (error) {
        console.error("Failed to initialize venue mini map", error);
      }
    }

    initMap();

    return () => {
      cancelled = true;
      markerRef.current?.setMap(null);
      markerRef.current = null;
    };
  }, [lat, lng, venueName]);

  return (
    <div className="overflow-hidden rounded-xl border border-white/[0.08]">
      <div ref={containerRef} style={{ height: "150px", width: "100%" }} />
    </div>
  );
}
