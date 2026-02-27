"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import "leaflet/dist/leaflet.css";

interface VenueMiniMapProps {
  lat: number;
  lng: number;
  venueName: string;
}

const MapContainer = dynamic(
  () => import("react-leaflet").then((mod) => mod.MapContainer),
  { ssr: false },
);
const TileLayer = dynamic(
  () => import("react-leaflet").then((mod) => mod.TileLayer),
  { ssr: false },
);
const Marker = dynamic(
  () => import("react-leaflet").then((mod) => mod.Marker),
  { ssr: false },
);
const Popup = dynamic(
  () => import("react-leaflet").then((mod) => mod.Popup),
  { ssr: false },
);

export function VenueMiniMap({ lat, lng, venueName }: VenueMiniMapProps) {
  const [markerIcon, setMarkerIcon] = useState<import("leaflet").DivIcon | null>(null);

  useEffect(() => {
    let isMounted = true;

    void (async () => {
      const L = await import("leaflet");
      if (!isMounted) return;

      const icon = L.divIcon({
        className: "",
        iconSize: [26, 34],
        iconAnchor: [13, 34],
        popupAnchor: [0, -32],
        html: `
          <svg width="26" height="34" viewBox="0 0 26 34" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M13 0C5.82 0 0 5.82 0 13c0 9.75 13 20.5 13 20.5S26 22.75 26 13C26 5.82 20.18 0 13 0z" fill="#14B8A6" fill-opacity="0.88" stroke="#14B8A6" stroke-width="1.5"/>
            <circle cx="13" cy="12" r="5" fill="white" fill-opacity="0.95"/>
          </svg>
        `,
      });

      setMarkerIcon(icon);
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  const marker = useMemo(() => markerIcon, [markerIcon]);

  return (
    <div className="overflow-hidden rounded-xl border border-white/[0.08]">
      {marker ? (
        <MapContainer
          center={[lat, lng]}
          zoom={15}
          style={{ height: "150px", width: "100%" }}
          scrollWheelZoom={false}
          dragging={false}
          doubleClickZoom={false}
          zoomControl={false}
          attributionControl
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          />
          <Marker position={[lat, lng]} icon={marker}>
            <Popup>{venueName}</Popup>
          </Marker>
        </MapContainer>
      ) : (
        <div className="h-[150px] w-full bg-white/[0.02]" />
      )}
    </div>
  );
}
